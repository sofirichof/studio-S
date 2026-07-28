// Slice 1 store-v2 verification. Run: node tests/store-v2.test.cjs
const fs = require('fs');
const path = require('path');
const mem = {};
global.window = {
  localStorage: {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; }
  }
};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8'));
const Store = global.window.Store;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }
function reset(seed) { for (const k in mem) delete mem[k]; if (seed !== undefined) mem['aifs.v1'] = JSON.stringify(seed); }

// ── A. fresh store ──
reset();
let d = Store.load();
ok('fresh: version 3', d.version === 3);
['clients', 'projects', 'deliverables', 'assets', 'versions', 'people'].forEach(k =>
  ok('fresh: has ' + k + '[]', Array.isArray(d[k]) && d[k].length === 0));
ok('fresh: ui has activeClientId/activeDeliverableId', 'activeClientId' in d.ui && 'activeDeliverableId' in d.ui);

// ── B. migration (idempotent + non-destructive) ──
const v1 = {
  version: 1,
  settings: { configured: true, claudeApiKey: '', defaultVideoModel: 'seedance', defaultStillsModel: 'nano' },
  projects: [{
    id: 'prj_1', name: 'P1', todos: [{ label: 't', done: false }],
    concepts: [{ id: 'c1', name: 'C1', shots: [
      { id: 's1', name: 'S1', label: '1A', status: 'prompted',
        builder: { charRefIds: ['ref_1'], propRefIds: [], locRefId: null, styleRefId: 'ref_2' } }
    ] }]
  }],
  references: [
    { id: 'ref_1', projectId: 'prj_1', name: 'Hero', kind: 'character', note: 'n', fields: { desc: 'd', wardrobe: 'w' }, prompt: 'P', imagePath: '/x.png', createdAt: 111 },
    { id: 'ref_2', projectId: 'prj_1', name: 'Look', kind: 'look', fields: {}, prompt: '', imagePath: '' }
  ],
  ui: { activeProjectId: 'prj_1' }
};
reset(v1);
d = Store.load();
ok('migrate: version → 3', d.version === 3);
ok('migrate: Unassigned client created', d.clients.length === 1 && d.clients[0].name === 'Unassigned');
ok('migrate: project got clientId', d.projects[0].clientId === d.clients[0].id);
ok('migrate: project gained status/brief/timeline/team', d.projects[0].status === 'active' && d.projects[0].brief === '' && !!d.projects[0].timeline && Array.isArray(d.projects[0].team));
ok('migrate: settings preserved (defaultVideoModel)', d.settings.defaultVideoModel === 'seedance');
ok('migrate: settings preserved (defaultStillsModel)', d.settings.defaultStillsModel === 'nano');
ok('migrate: configured preserved', d.settings.configured === true);
ok('migrate: no references key', !('references' in d));
const refAssets = d.assets.filter(a => a.type === 'reference');
ok('migrate: 2 reference assets', refAssets.length === 2);
const hero = d.assets.filter(a => a.id === 'ref_1')[0];
ok('migrate: reference id PRESERVED (link integrity)', !!hero);
ok('migrate: carried fields', hero && hero.fields && hero.fields.desc === 'd' && hero.fields.wardrobe === 'w');
ok('migrate: carried prompt', hero && hero.prompt === 'P');
ok('migrate: carried imagePath', hero && hero.imagePath === '/x.png');
ok('migrate: reference clientId resolved from project', hero && hero.clientId === d.projects[0].clientId);
// v3 inserted the concept level: the old flat concepts[] became scenes[] inside one
// concept, so every shot moved exactly one level deeper and nothing was lost.
ok('migrate: NON-DESTRUCTIVE — shots intact one level deeper', d.projects[0].concepts[0].scenes[0].shots[0].id === 's1' && d.projects[0].concepts[0].scenes[0].shots[0].label === '1A');
ok('migrate: legacy concept became a SCENE, wrapped in one concept', d.projects[0].concepts.length === 1 && Array.isArray(d.projects[0].concepts[0].scenes) && d.projects[0].concepts[0].scenes[0].name === 'C1');
ok('migrate: wrapping concept is a video deliverable', d.projects[0].concepts[0].kind === 'video');
ok('migrate: NON-DESTRUCTIVE — builder links still resolve', Store.getReference('ref_1') && Store.getReference('ref_2'));
ok('migrate: todos intact', d.projects[0].todos.length === 1);
// idempotent: load again (already persisted at v3), assert no duplication
d = Store.load();
ok('idempotent: still 1 client', d.clients.length === 1);
ok('idempotent: still 2 reference assets', d.assets.filter(a => a.type === 'reference').length === 2);

// ── B2. migration edge cases (handled in code — now asserted) ──
// Orphan reference: projectId points at a project that no longer exists.
reset({
  version: 1,
  settings: {},
  projects: [{ id: 'prj_live', name: 'Live', concepts: [] }],
  references: [{ id: 'ref_orphan', projectId: 'prj_GONE', name: 'Ghost', kind: 'prop', fields: {}, prompt: '', imagePath: '' }],
  ui: {}
});
d = Store.load();
var orphan = d.assets.filter(function (a) { return a.id === 'ref_orphan'; })[0];
ok('edge: orphan reference still folds (no throw)', !!orphan && orphan.type === 'reference');
ok('edge: orphan reference gets empty clientId (project gone)', orphan && orphan.clientId === '');
ok('edge: live project still migrated cleanly alongside orphan', d.projects[0].clientId === d.clients[0].id);

// Dangling builder link: a shot points at a ref id that was never in references[].
reset({
  version: 1,
  settings: {},
  projects: [{ id: 'prj_d', name: 'D', concepts: [{ id: 'cd', name: 'C', shots: [
    { id: 'sd', name: 'S', label: '1A', status: 'draft',
      builder: { charRefIds: ['ref_missing'], propRefIds: [], locRefId: null, styleRefId: null } }
  ] }] }],
  references: [],
  ui: {}
});
d = Store.load();
var b = d.projects[0].concepts[0].scenes[0].shots[0].builder;
ok('edge: dangling builder link survives migration untouched', b.charRefIds.length === 1 && b.charRefIds[0] === 'ref_missing');
ok('edge: dangling link resolves to null (no throw on getReference)', Store.getReference('ref_missing') === null);

// ── C. CRUD round-trips ──
reset();
const cli = Store.createClient({ name: 'US Bank', brand: { styleLook: 'clean', legal: 'NFL clearance' } });
ok('client: created + brand merged', Store.getClient(cli.id).brand.legal === 'NFL clearance' && Store.getClient(cli.id).brand.styleLook === 'clean');
const prj = Store.createProject({ name: 'Rotation 4', clientId: cli.id });
ok('project: created with clientId', Store.getProject(prj.id).clientId === cli.id);
ok('project: listProjects(clientId) filters', Store.listProjects(cli.id).length === 1 && Store.listProjects('nope').length === 0);
const dlv = Store.createDeliverable(prj.id, { name: 'Hero :15', specs: { ratio: '9:16', platform: 'Meta' } });
ok('deliverable: created', Store.getDeliverable(dlv.id).name === 'Hero :15' && Store.getDeliverable(dlv.id).specs.ratio === '9:16');
ok('deliverable: default status not-started', Store.getDeliverable(dlv.id).status === 'not-started');
Store.updateDeliverable(dlv.id, { status: 'in-review' });
ok('deliverable: update status', Store.getDeliverable(dlv.id).status === 'in-review');
const gen = Store.createAsset({ type: 'generated', projectId: prj.id, deliverableId: dlv.id, name: 'Still 1', recipe: { model: 'gpt', prompt: 'x', cost: 2 } });
ok('asset: generated created with recipe', Store.getAsset(gen.id).recipe.cost === 2 && Store.getAsset(gen.id).status === 'draft');
ok('asset: listAssets filter by type+deliverable', Store.listAssets({ type: 'generated', deliverableId: dlv.id }).length === 1);
const ver = Store.createVersion(dlv.id, { round: 1, reviewer: 'per_x', status: 'needs-review' });
ok('version: created + set current', Store.getDeliverable(dlv.id).currentVersionId === ver.id);
const ver2 = Store.createVersion(dlv.id, {});
ok('version: second is round 2 + only-one-current', ver2.round === 2 && Store.listVersions(dlv.id).filter(v => v.isCurrent).length === 1);
const cut = Store.registerCut(dlv.id, { url: 'frame.io/x', reviewer: 'per_x' });
ok('registerCut: made a cut asset', cut.asset.type === 'cut' && Store.getAsset(cut.asset.id));
ok('registerCut: made a current version linked to the cut', cut.version.assetId === cut.asset.id && Store.getDeliverable(dlv.id).currentVersionId === cut.version.id);
const per = Store.createPerson({ name: 'Sofia', role: 'maker' });
ok('person: created', Store.getPerson(per.id).name === 'Sofia');
Store.updatePerson(per.id, { role: 'lead' });
ok('person: updated', Store.getPerson(per.id).role === 'lead');

// ── D. getProjectBrand live ──
ok('getProjectBrand: reads live', Store.getProjectBrand(prj.id).legal === 'NFL clearance');
Store.updateBrand(cli.id, { legal: 'UPDATED' });
ok('getProjectBrand: propagates brand edit (not snapshotted)', Store.getProjectBrand(prj.id).legal === 'UPDATED');

// ── E. getWork aggregation ──
Store.updateDeliverable(dlv.id, { status: 'blocked' });
const dlv2 = Store.createDeliverable(prj.id, { name: 'Cutdown' });
Store.updateDeliverable(dlv2.id, { status: 'in-review' });
const w = Store.getWork({ personId: 'per_x' });
ok('getWork: 1 active project', w.counts.projects === 1);
ok('getWork: blocked count', w.counts.blocked === 1 && w.blocked[0].name === 'Hero :15');
ok('getWork: inReview count', w.counts.inReview === 1 && w.inReview[0].name === 'Cutdown');
ok('getWork: project rollup counts', w.activeProjects[0].deliverableCount === 2 && w.activeProjects[0].clientName === 'US Bank');
ok('getWork: needsMe from version reviewer', w.counts.needsMe >= 1);

// ── F. reference shims (over assets) + builder un-attach on delete ──
reset();
const p2 = Store.createProject({ name: 'RefTest' });
const active = Store.getActive();
const rHero = Store.addReference(p2.id, { name: 'HeroA', kind: 'character', fields: { desc: 'x' }, prompt: 'pp', imagePath: '/i.png' });
ok('shim: addReference → reference asset', Store.getAsset(rHero.id).type === 'reference' && rHero.prompt === 'pp');
ok('shim: listReferences returns it', Store.listReferences(p2.id).length === 1);
ok('shim: getReference only returns references', Store.getReference(rHero.id) && Store.getReference(gen.id) === null || Store.getReference(rHero.id).name === 'HeroA');
Store.updateReference(rHero.id, { prompt: 'edited', imagePath: '/j.png' });
ok('shim: updateReference persists', Store.getReference(rHero.id).prompt === 'edited' && Store.getReference(rHero.id).imagePath === '/j.png');
// attach to a shot builder, then delete the reference → link removed
Store.updateShotBuilder(active.ids, { charRefIds: [rHero.id], styleRefId: null });
ok('shim: builder holds the ref id', Store.getActive().shot.builder.charRefIds[0] === rHero.id);
Store.deleteReference(rHero.id);
ok('shim: deleteReference removes asset', Store.getReference(rHero.id) === null);
ok('shim: deleteReference un-attached from builder', Store.getActive().shot.builder.charRefIds.length === 0);

// ── G. Hierarchy: project → concept → scene → shot ──
reset();
const sp = Store.createProject({ name: 'SceneTest' });
const cA = Store.getProject(sp.id).concepts[0];
ok('hierarchy: a new project has one concept', Store.getProject(sp.id).concepts.length === 1);
ok('hierarchy: that concept is a video deliverable', cA.kind === 'video' && /^Concept /.test(cA.name));
ok('hierarchy: it holds one scene holding one shot', cA.scenes.length === 1 && cA.scenes[0].shots.length === 1 && cA.scenes[0].shots[0].label === '1A');

// a client wanting several videos = several concepts in one project
const cB = Store.addConcept(sp.id, { name: 'Social cutdown', kind: 'still' });
ok('concept: added alongside the first', Store.getProject(sp.id).concepts.length === 2);
ok('concept: kind honoured', Store.getProject(sp.id).concepts[1].kind === 'still');
Store.setConceptKind(sp.id, cB.id, 'video');
ok('concept: kind editable', Store.getProject(sp.id).concepts[1].kind === 'video');
Store.renameConcept(sp.id, cB.id, 'Hero film');
ok('concept: rename persists', Store.getProject(sp.id).concepts[1].name === 'Hero film');

// scenes live inside a concept
const s1 = Store.addScene(sp.id, cB.id, { name: 'Festival grounds' });
const s2 = Store.addScene(sp.id, cB.id, { name: 'Hotel room' });
ok('scene: added under the concept, not the project', Store.getProject(sp.id).concepts[1].scenes.length === 2);
Store.renameScene(sp.id, cB.id, s2.id, 'Hotel room, night before');
ok('scene: rename persists', Store.getProject(sp.id).concepts[1].scenes[1].name === 'Hotel room, night before');

// shots live inside a scene, labelled <scene><letter> within their concept
const ids = (shotId, sceneId) => ({ projectId: sp.id, conceptId: cB.id, sceneId: sceneId || s1.id, shotId: shotId });
const h1 = Store.addShot(sp.id, cB.id, s1.id, {});
const h2 = Store.addShot(sp.id, cB.id, s1.id, { name: 'Man enters' });
const h3 = Store.addShot(sp.id, cB.id, s2.id, {});
const conc = () => Store.getProject(sp.id).concepts[1];
const labelsOf = () => conc().scenes.map(sc => (sc.shots || []).map(x => x.label).join(','));
ok('shot: no flat "Shot N" default name', h1.name === '');
ok('shot: labels are scene-number + letter', labelsOf()[0] === '1A,1B' && labelsOf()[1] === '2A');
// labels restart per concept — 1A exists in BOTH concepts, scoped to each
ok('label: scoped to its concept, so 1A repeats across concepts',
   Store.getProject(sp.id).concepts[0].scenes[0].shots[0].label === '1A' && conc().scenes[0].shots[0].label === '1A');
Store.renameShot(ids(h2.id), 'Man enters the bodega');
ok('shot: rename persists', conc().scenes[0].shots[1].name === 'Man enters the bodega');

// descriptive fields, still one data model on shot.builder
Store.updateShotFields(ids(h1.id), { subject: 'a man, 40s', action: 'pushes the door', environment: 'corner bodega', cameraIntent: 'low 35mm dolly-in' });
const fb = () => conc().scenes[0].shots.filter(x => x.id === h1.id)[0].builder;
ok('fields: all four persist onto shot.builder', fb().subject === 'a man, 40s' && fb().action === 'pushes the door' && fb().environment === 'corner bodega' && fb().cameraIntent === 'low 35mm dolly-in');
ok('fields: unknown keys rejected', Store.updateShotFields(ids(h1.id), { videoModel: 'sora' }) === null && fb().videoModel !== 'sora');
Store.updateShotBuilder(ids(h1.id), { lens: '85' });
ok('fields: builder edit does not clobber descriptive fields', fb().lens === '85' && fb().subject === 'a man, 40s');

// reorder
Store.reorderShot(ids(h1.id), 1);
ok('reorder: shot moved and relabelled', conc().scenes[0].shots[1].id === h1.id && labelsOf()[0] === '1A,1B');
Store.reorderScene(sp.id, cB.id, s2.id, 0);
ok('reorder: scene moved', conc().scenes[0].id === s2.id);
ok('reorder: scene order IS the label prefix', labelsOf()[0] === '1A' && labelsOf()[1] === '2A,2B');
Store.reorderConcept(sp.id, cB.id, 0);
ok('reorder: concept moved', Store.getProject(sp.id).concepts[0].id === cB.id);
ok('reorder: concept order does NOT change labels', Store.getProject(sp.id).concepts[0].scenes[0].shots[0].label === '1A');
ok('reorder: out-of-range clamps', !!Store.reorderShot(ids(h1.id, s1.id), 99));

// remove, with the active pointer re-seated rather than dangling
Store.setActive({ projectId: sp.id, conceptId: cB.id, sceneId: s1.id, shotId: h1.id });
Store.removeShot(ids(h1.id, s1.id));
ok('remove: shot gone', Store.getProject(sp.id).concepts[0].scenes.filter(sc => sc.id === s1.id)[0].shots.filter(x => x.id === h1.id).length === 0);
ok('remove: active shot re-seated, not dangling', Store.getActive().shotId !== h1.id && Store.getActive().shot !== null);
Store.setActive({ projectId: sp.id, conceptId: cB.id, sceneId: s1.id });
Store.removeScene(sp.id, cB.id, s1.id);
ok('remove: scene gone', Store.getProject(sp.id).concepts[0].scenes.filter(sc => sc.id === s1.id).length === 0);
ok('remove: active scene re-seated', Store.getActive().sceneId !== s1.id && Store.getActive().sceneId !== '');
Store.removeConcept(sp.id, cB.id);
ok('remove: concept gone', Store.getProject(sp.id).concepts.length === 1);
ok('remove: active concept re-seated', Store.getActive().conceptId !== cB.id && Store.getActive().conceptId !== '');

// bad ids are inert at every level
ok('guard: bad ids return null',
   Store.renameConcept(sp.id, 'nope', 'x') === null &&
   Store.renameScene(sp.id, 'nope', 'nope', 'x') === null &&
   Store.addScene(sp.id, 'nope', {}) === null &&
   Store.addShot(sp.id, 'nope', 'nope', {}) === null &&
   Store.removeShot({ projectId: sp.id, conceptId: 'nope', sceneId: 'nope', shotId: 'nope' }) === null &&
   Store.removeScene('nope', 'nope', 'nope') === null &&
   Store.removeConcept('nope', 'nope') === null);
// getActive exposes a ready-made ids bundle for the editors above
const ga = Store.getActive();
ok('getActive: returns concept, scene and shot', !!ga.concept && !!ga.scene && !!ga.shot);
ok('getActive: ids bundle carries all four keys', ['projectId','conceptId','sceneId','shotId'].every(k => k in ga.ids));

// ── H. Locked prompts persist per shot ──
reset();
const lp = Store.createProject({ name: 'LockTest' });
const lc = Store.getProject(lp.id).concepts[0];
const lsc = lc.scenes[0];
const ls = lsc.shots[0];
const lids = { projectId: lp.id, conceptId: lc.id, sceneId: lsc.id, shotId: ls.id };
ok('lock: refuses an empty prompt', Store.lockShotPrompt(lids, { prompt: '   ' }) === null);
Store.lockShotPrompt(lids, { prompt: 'A photorealistic wide shot.', video: 'Slow push in.', stillModel: 'gpt', videoModel: 'higgsfield' });
const lshot = () => Store.getProject(lp.id).concepts[0].scenes[0].shots.filter(x => x.id === ls.id)[0];
ok('lock: prompt + video persist on the shot', lshot().locked.prompt === 'A photorealistic wide shot.' && lshot().locked.video === 'Slow push in.');
ok('lock: records the models it was composed for', lshot().locked.stillModel === 'gpt' && lshot().locked.videoModel === 'higgsfield');
ok('lock: stamps a time and marks the shot prompted', typeof lshot().locked.at === 'number' && lshot().status === 'prompted');
Store.updateShotFields(lids, { subject: 'changed after locking' });
ok('lock: snapshot is immune to later field edits', lshot().locked.prompt === 'A photorealistic wide shot.');
Store.lockShotPrompt(lids, { prompt: 'Re-locked text.' });
ok('lock: re-locking overwrites', lshot().locked.prompt === 'Re-locked text.' && lshot().locked.video === '');
Store.unlockShotPrompt(lids);
ok('lock: unlock clears it and resets status', !lshot().locked && lshot().status === 'draft');
ok('lock: unlocking twice is inert', Store.unlockShotPrompt(lids) === null);
ok('lock: bad ids return null', Store.lockShotPrompt({ projectId: 'x', conceptId: 'y', sceneId: 'z', shotId: 'w' }, { prompt: 'p' }) === null);
// a locked shot survives a reorder (its label changes, the snapshot doesn't)
Store.lockShotPrompt(lids, { prompt: 'Keep me.' });
Store.addShot(lp.id, lc.id, lsc.id, {});
Store.reorderShot(lids, 1);
ok('lock: survives reorder with a new label', lshot().locked.prompt === 'Keep me.' && lshot().label === '1B');

// ── I. Handoff import into the concept → scene → shot model ──
reset();
const hp = Store.createProject({ name: 'HandoffTest' });
Store.scaffoldFromPlan(hp.id, JSON.stringify({
  project: 'US Bank festival film',
  scenes: [
    { name: 'Bodega exterior — dusk, wet street', shots: [
      { label: '1A', name: '1A · Man enters the bodega', subject: 'a man, 40s', action: 'pushes the door',
        environment: 'corner bodega, dusk', cameraIntent: 'low 35mm dolly-in', breakdown: 'Marco, bodega exterior' },
      { name: '1B · Hand on the handle' }
    ] },
    { name: 'Bodega interior', shots: [{ name: '2A · Clerk looks up' }] }
  ],
  descriptions: [
    { kind: 'character', name: 'Marco (lead)', description: '40s, worn canvas jacket.' },
    { kind: 'location', name: 'Corner bodega', description: 'Neon sign, wet asphalt.' }
  ],
  todos: ['Create Marco character sheet', 'Create bodega location plate']
}));
const hc = Store.getProject(hp.id).concepts;
ok('plan: a scenes-only plan becomes ONE concept', hc.length === 1);
ok('plan: concept named from the plan', hc[0].name === 'US Bank festival film');
ok('plan: its scenes are scenes, not concepts', hc[0].scenes.length === 2 && hc[0].scenes[0].name === 'Bodega exterior');
ok('plan: trailing description split off the scene name', hc[0].scenes[0].desc === 'dusk, wet street');
ok('plan: labels honored and derived', hc[0].scenes[0].shots[0].label === '1A' && hc[0].scenes[0].shots[1].label === '1B' && hc[0].scenes[1].shots[0].label === '2A');
ok('plan: label-led names kept as given', hc[0].scenes[0].shots[0].name === '1A · Man enters the bodega');
ok('plan: no flat "Shot N" fallback', hc[0].scenes[0].shots[1].name === '1B · Hand on the handle');
const pbf = hc[0].scenes[0].shots[0].builder;
ok('plan: four descriptive fields land as data', pbf.subject === 'a man, 40s' && pbf.action === 'pushes the door' && pbf.environment === 'corner bodega, dusk' && pbf.cameraIntent === 'low 35mm dolly-in');
ok('plan: per-shot breakdown carried', hc[0].scenes[0].shots[0].breakdown === 'Marco, bodega exterior');
ok('plan: todos imported', Store.listTodos(hp.id).length === 2);
const hrefs = Store.listReferences(hp.id);
ok('plan: locked descriptions become typed references', hrefs.length === 2 && hrefs.filter(r => r.kind === 'location').length === 1);
ok('plan: descriptions carry facts, never a prompt', hrefs[0].fields.desc.indexOf('canvas jacket') !== -1 && hrefs[0].prompt === '');
ok('plan: nothing is marked generated', hrefs.every(r => !r.imagePath));
ok('plan: active pointer lands on concept/scene/shot', Store.getActive().conceptId === hc[0].id && Store.getActive().sceneId === hc[0].scenes[0].id);

// a multi-concept plan: the client asked for two videos
reset();
const mp = Store.createProject({ name: 'MultiTest' });
Store.scaffoldFromPlan(mp.id, JSON.stringify({ concepts: [
  { name: 'Hero film', kind: 'video', scenes: [{ name: 'Opening', shots: [{ name: '1A · Wide' }] }] },
  { name: 'Product still', kind: 'still', scenes: [{ name: 'Tabletop', shots: [{ name: '1A · Pack shot' }] }] }
] }));
const mc = Store.getProject(mp.id).concepts;
ok('plan: multi-concept plan imports both concepts', mc.length === 2 && mc[0].name === 'Hero film' && mc[1].name === 'Product still');
ok('plan: per-concept kind honoured', mc[0].kind === 'video' && mc[1].kind === 'still');
ok('plan: each concept keeps its own scenes and 1A', mc[0].scenes[0].shots[0].label === '1A' && mc[1].scenes[0].shots[0].label === '1A');

// legacy plans (scenes directly under "concepts") still import
reset();
const op = Store.createProject({ name: 'OldPlan' });
Store.scaffoldFromPlan(op.id, JSON.stringify({ concepts: [{ name: 'Legacy', shots: [{ name: 'a' }] }] }));
const oc = Store.getProject(op.id).concepts;
ok('plan: legacy scenes-under-concepts still import', oc.length === 1 && oc[0].scenes[0].name === 'Legacy');
ok('plan: malformed JSON is inert', Store.scaffoldFromPlan(op.id, '{not json') !== null && Store.getProject(op.id).concepts.length === 1);

// ── K. Scene names: a bare "Scene N" head is replaced by the descriptive half ──
reset();
const np = Store.createProject({ name: 'NameTest' });
Store.scaffoldFromPlan(np.id, JSON.stringify({ scenes: [
  { name: 'Scene 1 — Festival grounds, golden hour: we land inside the weekend', shots: [{ name: 'a' }] },
  { name: 'Hotel room, night before — the outfit is laid out', shots: [{ name: 'b' }] },
  { name: 'Just a plain name', shots: [{ name: 'c' }] }
] }));
const ns = Store.getProject(np.id).concepts[0].scenes;
ok('scene name: generic "Scene 1" head replaced by its description', ns[0].name === 'Festival grounds, golden hour');
ok('scene name: remainder kept as desc', ns[0].desc === 'we land inside the weekend');
ok('scene name: a real name is left alone', ns[1].name === 'Hotel room, night before' && ns[1].desc === 'the outfit is laid out');
ok('scene name: no em-dash means no desc', ns[2].name === 'Just a plain name' && ns[2].desc === '');

// ── J. Regression: the Rust scan gate must accept every key the importer does ──
// 0.3.93 shipped a template emitting "scenes" while scan_plan_folder in
// src-tauri/src/lib.rs still only looked for "concepts", so real plans were skipped
// before the importer saw them and the UI said "no plan file found". This test fails
// if the two ever drift apart again.
{
  const rust = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'lib.rs'), 'utf8');
  const gate = (rust.split('fn scan_plan_folder')[1] || '').split('\n}')[0];
  ['scenes', 'concepts', 'tasks'].forEach((k) =>
    ok('scan gate accepts "' + k + '"', gate.indexOf('\\"' + k + '\\"') !== -1));
}

// ── K. Phase 1: a plan may set the camera setup per shot ──
// Before this, every imported shot kept defaultBuilder()'s wide/24/eye/shallow,
// so a whole shotlist compiled with one identical setup. Off-vocabulary values
// must be dropped rather than passed through — promptcompile's DICT lookup
// returns '' for an unknown key, which would silently delete the clause.
{
  reset();
  const p = Store.createProject({ name: 'Phase1' });
  Store.scaffoldFromPlan(p.id, JSON.stringify({
    scenes: [{
      name: 'Bodega, late afternoon', shots: [
        { label: '1A', shot: 'close', lens: '85', angle: 'low', depth: 'deep', move: 'static',
          comp: 'ml', density: 'single', framing: ['ots', 'bogus'], subject: 'Marco' },
        { label: '1B', shot: 'nonsense', lens: '9000', angle: '', subject: 'the clerk' }
      ]
    }]
  }));
  const shots = Store.load().projects.filter(x => x.id === p.id)[0].concepts[0].scenes[0].shots;
  const a = shots[0].builder, b = shots[1].builder;
  ok('plan controls: shot', a.shot === 'close');
  ok('plan controls: lens', a.lens === '85');
  ok('plan controls: angle', a.angle === 'low');
  ok('plan controls: depth', a.depth === 'deep');
  ok('plan controls: move', a.move === 'static');
  ok('plan controls: comp', a.comp === 'ml');
  ok('plan controls: density', a.density === 'single');
  ok('plan controls: framing whitelisted', Array.isArray(a.framing) && a.framing.length === 1 && a.framing[0] === 'ots');
  ok('plan controls: junk shot ignored', b.shot === 'wide');
  ok('plan controls: junk lens ignored', b.lens === '24');
  ok('plan controls: empty angle keeps default', b.angle === 'eye');
  ok('plan controls: descriptive fields still land', a.subject === 'Marco' && b.subject === 'the clerk');
}

// ── K2. Regression: the plan template must only offer values the store accepts ──
// The template in newproject.html lists the allowed values inline. If either side
// gains a value the other doesn't know, plans compile to an empty camera clause.
{
  const tpl = fs.readFileSync(path.join(__dirname, '..', 'src', 'newproject.html'), 'utf8');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8');
  const block = (src.split('var SHOT_CONTROLS')[1] || '').split('};')[0];
  // comp / density / framing compile too, and the handoff now asks for them —
  // so they need the same guard. `framing` lives in FRAMING_VALUES, not
  // SHOT_CONTROLS, so it is checked against the whole store source.
  ['shot', 'lens', 'angle', 'depth', 'move', 'comp', 'density'].forEach((k) => {
    const line = (tpl.split('"' + k + '": "')[1] || '').split('"')[0];
    const offered = line.split('|').map(s => s.trim()).filter(Boolean);
    ok('template offers ' + k + ' values', offered.length > 1);
    offered.forEach((v) =>
      ok('store accepts ' + k + '=' + v, block.indexOf("'" + v + "'") !== -1));
  });
  {
    const line = (tpl.split('"framing": "')[1] || '').split('"')[0];
    const offered = line.split('|').map(s => s.trim()).filter(Boolean);
    ok('template offers framing values', offered.length > 1);
    offered.forEach((v) =>
      ok('store accepts framing=' + v, src.indexOf("'" + v + "'") !== -1));
  }
}

// ── K3. Shot size is size, never editorial purpose ──
// 'wide' compiled as "wide establishing shot", so every master and final wide
// claimed to establish geography — issue 2.3, baked into the compiler rather
// than the planner. Purpose belongs in the shot's breakdown, not in the size.
// This also locks shotLabelShort's keys to SHOT_CONTROLS.shot: a size the store
// accepts but the compiler can't word would compile to a bare "A shot of…".
{
  const pb = fs.readFileSync(path.join(__dirname, '..', 'src', 'promptbuilder.html'), 'utf8');
  // Just the object literal — not the surrounding comment, which is allowed to
  // explain what the wording must NOT say.
  const map = ((pb.split('shotLabelShort(v) {')[1] || '').split('return ({')[1] || '').split('})')[0];
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8');
  const block = (src.split('var SHOT_CONTROLS')[1] || '').split('};')[0];
  const sizes = ((block.split('shot:')[1] || '').split(']')[0])
    .replace(/[[\s']/g, '').split(',').filter(Boolean);
  ok('shot sizes: store lists 7', sizes.length === 7);
  sizes.forEach((v) => ok('shotLabelShort words "' + v + '"', map.indexOf(v + ':') !== -1));
  ok('shot size wording carries no editorial purpose', map.indexOf('establishing') === -1);
}

// ── L. Phase 2: per-shot continuity fields ──
// A still is generated from one shot's fields alone, so who left the crop and
// what the props are doing have to be written down per shot or they're gone.
{
  reset();
  const p = Store.createProject({ name: 'Phase2' });
  Store.scaffoldFromPlan(p.id, JSON.stringify({
    scenes: [{ name: 'Bedroom, morning', shots: [
      { label: '1A', subject: 'Traveler at the open bag',
        offCamera: 'Runner still seated frame left; her eyeline holds toward him',
        propState: 'weekender open on the bench, shoes already packed' },
      { label: '1B', subject: 'the bag' }
    ] }]
  }));
  const shots = Store.load().projects.filter(x => x.id === p.id)[0].concepts[0].scenes[0].shots;
  ok('continuity: offCamera imported', shots[0].builder.offCamera.indexOf('Runner still seated') === 0);
  ok('continuity: propState imported', shots[0].builder.propState.indexOf('weekender open') === 0);
  ok('continuity: absent → empty string, not undefined', shots[1].builder.offCamera === '' && shots[1].builder.propState === '');

  // Editable from the project view as well as the builder.
  const ids = { projectId: p.id, conceptId: Store.load().projects.filter(x => x.id === p.id)[0].concepts[0].id };
  const doc0 = Store.load().projects.filter(x => x.id === p.id)[0];
  ids.sceneId = doc0.concepts[0].scenes[0].id; ids.shotId = shots[1].id;
  Store.updateShotFields(ids, { offCamera: 'Traveler off frame right', propState: 'bag zipped' });
  const after = Store.load().projects.filter(x => x.id === p.id)[0].concepts[0].scenes[0].shots[1].builder;
  ok('continuity: updateShotFields accepts offCamera', after.offCamera === 'Traveler off frame right');
  ok('continuity: updateShotFields accepts propState', after.propState === 'bag zipped');
}

// ── L2. Regression: continuity fields must persist and must compile ──
// builderKeys() is the persistence whitelist in promptbuilder.html — a field
// missing from it renders, accepts typing, and is silently discarded on save.
// The compile tail must also sit AFTER the scene assembly (like `negative`), and
// before it, so the layering is scene → refs → continuity → negative.
{
  const pb = fs.readFileSync(path.join(__dirname, '..', 'src', 'promptbuilder.html'), 'utf8');
  const keys = (pb.split('builderKeys() {')[1] || '').split(']')[0];
  ['offCamera', 'propState'].forEach((k) => {
    ok('builderKeys persists ' + k, keys.indexOf("'" + k + "'") !== -1);
    ok('builder renders a field for ' + k, pb.indexOf("this.textarea('" + k + "'") !== -1);
  });
  const body = (pb.split('compilePrompt() {')[1] || '').split('renderRail()')[0];
  const iScene = body.indexOf('stills = pre +');
  const iOff = body.indexOf("tail('Off camera'");
  const iProp = body.indexOf("tail('Continuity'");
  const iNeg = body.indexOf('has(s.negative)');
  ok('compile: continuity tail exists', iOff !== -1 && iProp !== -1);
  ok('compile: tail comes after the scene assembly', iOff > iScene);
  ok('compile: off camera before prop state before negative', iOff < iProp && iProp < iNeg);
  // The plan template must emit every field the store now imports.
  const tpl = fs.readFileSync(path.join(__dirname, '..', 'src', 'newproject.html'), 'utf8');
  ['offCamera', 'propState'].forEach((k) =>
    ok('plan template emits ' + k, tpl.indexOf('"' + k + '":') !== -1));
  // Every SHOT_FIELDS entry is editable in the project view, or a plan-imported
  // continuity error can only be fixed by opening the builder shot by shot.
  const pv = fs.readFileSync(path.join(__dirname, '..', 'src', 'projects.html'), 'utf8');
  const fieldRows = (pv.split('const FIELDS = [')[1] || '').split('];')[0];
  Store.shotFields().forEach((k) =>
    ok('project view edits ' + k, fieldRows.indexOf("['" + k + "'") !== -1));
}

// ── M. Phase 3 step A: purpose as a real field ──
// Purpose used to ride as prose at the head of `breakdown` ("Purpose: master. …"),
// so it couldn't be validated or filtered. Now it's a vocabulary-checked field,
// same shape as Phase 1's SHOT_CONTROLS: off-vocabulary values are dropped.
{
  const VOCAB = ['establishing', 'master', 'two-shot', 'group', 'single', 'reaction',
    'insert', 'product detail', 'cutaway', 'location texture', 'match action',
    'transition', 'final wide', 'hero product'];
  ok('shotPurposes: 14 exact strings', Store.shotPurposes().length === 14);
  ok('shotPurposes: matches vocabulary', VOCAB.every((v) => Store.shotPurposes().indexOf(v) !== -1));

  reset();
  const p = Store.createProject({ name: 'Phase3A' });
  Store.scaffoldFromPlan(p.id, JSON.stringify({
    scenes: [{ name: 'Bodega, afternoon', shots: [
      { label: '1A', subject: 'Marco at the counter', purpose: 'master' },
      { label: '1B', subject: 'The clerk', purpose: 'bogus-not-in-vocab' },
      { label: '1C', subject: 'The bag', breakdown: 'Purpose: insert. Bag held low.' },
      { label: '1D', subject: 'Empty aisle', breakdown: 'No purpose sentence here.' },
      { label: '1E', subject: 'No purpose or breakdown at all' }
    ] }]
  }));
  const shots = Store.load().projects.filter(x => x.id === p.id)[0].concepts[0].scenes[0].shots;
  ok('purpose: valid sh.purpose imported', shots[0].builder.purpose === 'master');
  ok('purpose: junk sh.purpose rejected', shots[1].builder.purpose === '');
  ok('purpose: breakdown fallback parses "Purpose: insert."', shots[2].builder.purpose === 'insert');
  ok('purpose: junk breakdown → empty', shots[3].builder.purpose === '');
  ok('purpose: absent → empty string, not undefined', shots[4].builder.purpose === '');
}

// ── M2. Regression: purpose must persist, render, and round-trip with the template ──
{
  const pb = fs.readFileSync(path.join(__dirname, '..', 'src', 'promptbuilder.html'), 'utf8');
  const keys = (pb.split('builderKeys() {')[1] || '').split(']')[0];
  ok('builderKeys persists purpose', keys.indexOf("'purpose'") !== -1);
  ok('builder renders single-select chips for purpose', pb.indexOf("this.schips('purpose'") !== -1);

  const tpl = fs.readFileSync(path.join(__dirname, '..', 'src', 'newproject.html'), 'utf8');
  ok('plan template emits "purpose"', tpl.indexOf('"purpose":') !== -1);

  const pv = fs.readFileSync(path.join(__dirname, '..', 'src', 'projects.html'), 'utf8');
  ok('project view shows purpose on the shot card', pv.indexOf('b.purpose') !== -1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
