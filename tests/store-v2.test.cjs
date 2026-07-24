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
ok('fresh: version 2', d.version === 2);
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
ok('migrate: version → 2', d.version === 2);
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
ok('migrate: NON-DESTRUCTIVE — concepts/shots intact', d.projects[0].concepts[0].shots[0].id === 's1' && d.projects[0].concepts[0].shots[0].label === '1A');
ok('migrate: NON-DESTRUCTIVE — builder links still resolve', Store.getReference('ref_1') && Store.getReference('ref_2'));
ok('migrate: todos intact', d.projects[0].todos.length === 1);
// idempotent: load again (already persisted at v2), assert no duplication
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
var b = d.projects[0].concepts[0].shots[0].builder;
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
Store.updateShotBuilder({ projectId: p2.id, conceptId: active.conceptId, shotId: active.shotId }, { charRefIds: [rHero.id], styleRefId: null });
ok('shim: builder holds the ref id', Store.getActive().shot.builder.charRefIds[0] === rHero.id);
Store.deleteReference(rHero.id);
ok('shim: deleteReference removes asset', Store.getReference(rHero.id) === null);
ok('shim: deleteReference un-attached from builder', Store.getActive().shot.builder.charRefIds.length === 0);

// ── G. Phase 4 slice 2 — scene/shot list editing, labels, single source of truth ──
reset();
const sp = Store.createProject({ name: 'SceneTest' });
const sc1 = Store.getProject(sp.id).concepts[0];
ok('scene: default name reads as a scene', /^Scene /.test(sc1.name));
const sc2 = Store.addConcept(sp.id, { name: 'Bodega exterior' });
const a1 = Store.addShot(sp.id, sc1.id, {});
const a2 = Store.addShot(sp.id, sc1.id, { name: 'Man enters' });
const b1 = Store.addShot(sp.id, sc2.id, {});
const labels = (pid) => Store.getProject(pid).concepts.map(c => (c.shots || []).map(s => s.label).join(','));
ok('label: no flat "Shot N" default name', a1.name === '');
ok('label: derived per scene', labels(sp.id)[1] === '2A' && labels(sp.id)[0].indexOf('1A') === 0);

// rename
Store.renameConcept(sp.id, sc2.id, 'Bodega interior');
ok('rename: scene persists', Store.getProject(sp.id).concepts[1].name === 'Bodega interior');
Store.renameShot(sp.id, sc1.id, a2.id, 'Man enters the bodega');
ok('rename: shot persists', Store.getProject(sp.id).concepts[0].shots.filter(s => s.id === a2.id)[0].name === 'Man enters the bodega');

// descriptive fields — written through store, read back off the SAME builder object
Store.updateShotFields({ projectId: sp.id, conceptId: sc1.id, shotId: a1.id },
  { subject: 'a man, 40s', action: 'pushes the door open', environment: 'corner bodega, dusk', cameraIntent: 'low 35mm dolly-in' });
const fb = Store.getProject(sp.id).concepts[0].shots.filter(s => s.id === a1.id)[0].builder;
ok('fields: all four persist onto shot.builder', fb.subject === 'a man, 40s' && fb.action === 'pushes the door open' &&
   fb.environment === 'corner bodega, dusk' && fb.cameraIntent === 'low 35mm dolly-in');
ok('fields: unknown keys rejected', Store.updateShotFields({ projectId: sp.id, conceptId: sc1.id, shotId: a1.id }, { videoModel: 'sora' }) === null &&
   Store.getProject(sp.id).concepts[0].shots.filter(s => s.id === a1.id)[0].builder.videoModel !== 'sora');
// single source of truth: updateShotBuilder and updateShotFields hit one object
Store.updateShotBuilder({ projectId: sp.id, conceptId: sc1.id, shotId: a1.id }, { lens: '85' });
const fb2 = Store.getProject(sp.id).concepts[0].shots.filter(s => s.id === a1.id)[0].builder;
ok('fields: builder edit does not clobber descriptive fields', fb2.lens === '85' && fb2.subject === 'a man, 40s');

// reorder — labels re-derive
Store.reorderShot(sp.id, sc1.id, a1.id, 1);
const sh = Store.getProject(sp.id).concepts[0].shots;
ok('reorder: shot moved', sh[1].id === a1.id);
ok('reorder: labels re-derived, not stale', sh[0].label === '1A' && sh[1].label === '1B');
Store.reorderConcept(sp.id, sc2.id, 0);
ok('reorder: scene moved and shots relabelled', Store.getProject(sp.id).concepts[0].id === sc2.id &&
   Store.getProject(sp.id).concepts[0].shots[0].label === '1A' &&
   Store.getProject(sp.id).concepts[1].shots[0].label === '2A');
ok('reorder: out-of-range index clamps', Store.reorderShot(sp.id, sc1.id, a1.id, 99) &&
   Store.getProject(sp.id).concepts[1].shots.map(s => s.label).join(',') === '2A,2B,2C');

// remove — labels re-derive and the active pointer never dangles
Store.setActive({ projectId: sp.id, conceptId: sc1.id, shotId: a1.id });
Store.removeShot(sp.id, sc1.id, a1.id);
ok('remove: shot gone', Store.getProject(sp.id).concepts[1].shots.filter(s => s.id === a1.id).length === 0);
ok('remove: active shot pointer moved, not dangling', Store.getActive().shotId !== a1.id && Store.getActive().shot !== null);
const c3 = Store.addConcept(sp.id, { name: 'Doomed' });
Store.addShot(sp.id, c3.id, {});
Store.setActive({ projectId: sp.id, conceptId: c3.id, shotId: Store.getProject(sp.id).concepts[2].shots[0].id });
Store.removeConcept(sp.id, c3.id);
ok('remove: scene gone', Store.getProject(sp.id).concepts.length === 2);
ok('remove: active concept pointer moved', Store.getActive().conceptId !== c3.id && Store.getActive().conceptId !== '');
ok('remove: labels still contiguous', labels(sp.id).join(' | ').indexOf('2A') !== -1);
// bad ids are inert, not throwing
ok('guard: bad ids return null', Store.renameConcept(sp.id, 'nope', 'x') === null &&
   Store.removeShot(sp.id, 'nope', 'nope') === null &&
   Store.reorderShot('nope', 'nope', 'nope', 0) === null &&
   Store.removeConcept('nope', 'nope') === null);

// ── H. Phase 4 slice 3 — locked prompts persist per shot ──
reset();
const lp = Store.createProject({ name: 'LockTest' });
const lc = Store.getProject(lp.id).concepts[0];
const ls = lc.shots[0];
const lids = { projectId: lp.id, conceptId: lc.id, shotId: ls.id };
ok('lock: refuses an empty prompt', Store.lockShotPrompt(lids, { prompt: '   ' }) === null);
Store.lockShotPrompt(lids, { prompt: 'A photorealistic wide shot.', video: 'Slow push in.', stillModel: 'gpt', videoModel: 'higgsfield' });
const lshot = () => Store.getProject(lp.id).concepts[0].shots[0];
ok('lock: prompt + video persist on the shot', lshot().locked.prompt === 'A photorealistic wide shot.' && lshot().locked.video === 'Slow push in.');
ok('lock: records the models it was composed for', lshot().locked.stillModel === 'gpt' && lshot().locked.videoModel === 'higgsfield');
ok('lock: stamps a time and marks the shot prompted', typeof lshot().locked.at === 'number' && lshot().status === 'prompted');
// editing fields afterwards must NOT silently rewrite the locked snapshot
Store.updateShotFields(lids, { subject: 'changed after locking' });
ok('lock: snapshot is immune to later field edits', lshot().locked.prompt === 'A photorealistic wide shot.');
Store.lockShotPrompt(lids, { prompt: 'Re-locked text.' });
ok('lock: re-locking overwrites', lshot().locked.prompt === 'Re-locked text.' && lshot().locked.video === '');
Store.unlockShotPrompt(lids);
ok('lock: unlock clears it and resets status', !lshot().locked && lshot().status === 'draft');
ok('lock: unlocking twice is inert', Store.unlockShotPrompt(lids) === null);
ok('lock: bad ids return null', Store.lockShotPrompt({ projectId: 'x', conceptId: 'y', shotId: 'z' }, { prompt: 'p' }) === null);
// a locked shot survives a reorder (labels change, the snapshot doesn't)
Store.lockShotPrompt(lids, { prompt: 'Keep me.' });
const ls2 = Store.addShot(lp.id, lc.id, {});
Store.reorderShot(lp.id, lc.id, ls.id, 1);
const moved = Store.getProject(lp.id).concepts[0].shots.filter(s => s.id === ls.id)[0];
ok('lock: survives reorder with a new label', moved.locked.prompt === 'Keep me.' && moved.label === '1B');

// ── I. Phase 4 slice 5 — handoff imports into the scene/shot model ──
reset();
const hp = Store.createProject({ name: 'HandoffTest' });
Store.scaffoldFromPlan(hp.id, JSON.stringify({
  scenes: [
    { name: 'Bodega exterior — dusk, wet street', shots: [
      { label: '1A', name: '1A · Man enters the bodega', subject: 'a man, 40s', action: 'pushes the door',
        environment: 'corner bodega, dusk', cameraIntent: 'low 35mm dolly-in', breakdown: 'Marco, bodega exterior, paper bag' },
      { name: '1B · Hand on the handle' }
    ] },
    { name: 'Bodega interior', shots: [{ name: '2A · Clerk looks up' }] }
  ],
  descriptions: [
    { kind: 'character', name: 'Marco (lead)', description: '40s, worn canvas jacket, three-day stubble.' },
    { kind: 'location', name: 'Corner bodega', description: 'Neon sign, steel shutters, wet asphalt.' }
  ],
  todos: ['Create Marco character sheet', 'Create bodega location plate']
}));
const hpr = Store.getProject(hp.id);
ok('plan: scenes key imported as concepts', hpr.concepts.length === 2 && hpr.concepts[0].name === 'Bodega exterior');
ok('plan: trailing description split off the scene name', hpr.concepts[0].desc === 'dusk, wet street');
ok('plan: labels honored and derived', hpr.concepts[0].shots[0].label === '1A' &&
   hpr.concepts[0].shots[1].label === '1B' && hpr.concepts[1].shots[0].label === '2A');
ok('plan: label-led names kept as given', hpr.concepts[0].shots[0].name === '1A · Man enters the bodega');
ok('plan: no flat "Shot N" fallback', hpr.concepts[0].shots[1].name === '1B · Hand on the handle');
const pb = hpr.concepts[0].shots[0].builder;
ok('plan: four descriptive fields land on the builder as data', pb.subject === 'a man, 40s' &&
   pb.action === 'pushes the door' && pb.environment === 'corner bodega, dusk' && pb.cameraIntent === 'low 35mm dolly-in');
ok('plan: per-shot breakdown carried', hpr.concepts[0].shots[0].breakdown === 'Marco, bodega exterior, paper bag');
ok('plan: todos imported', Store.listTodos(hp.id).length === 2);
const hrefs = Store.listReferences(hp.id);
ok('plan: locked descriptions become typed references', hrefs.length === 2 &&
   hrefs.filter(r => r.kind === 'location').length === 1);
ok('plan: descriptions carry facts, never a prompt', hrefs[0].fields.desc.indexOf('canvas jacket') !== -1 && hrefs[0].prompt === '');
ok('plan: nothing is marked generated', hrefs.every(r => !r.imagePath));
// old plans using "concepts" must still import
reset();
const op = Store.createProject({ name: 'OldPlan' });
Store.scaffoldFromPlan(op.id, JSON.stringify({ concepts: [{ name: 'Legacy', shots: [{ name: 'a' }] }] }));
ok('plan: legacy "concepts" key still accepted', Store.getProject(op.id).concepts[0].name === 'Legacy');
ok('plan: malformed JSON is inert', Store.scaffoldFromPlan(op.id, '{not json') !== null &&
   Store.getProject(op.id).concepts.length === 1);

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

// ── K. Scene names: a bare "Scene N" head is replaced by the descriptive half ──
reset();
const np = Store.createProject({ name: 'NameTest' });
Store.scaffoldFromPlan(np.id, JSON.stringify({ scenes: [
  { name: 'Scene 1 — Festival grounds, golden hour: we land inside the weekend', shots: [{ name: 'a' }] },
  { name: 'Hotel room, night before — the outfit is laid out', shots: [{ name: 'b' }] },
  { name: 'Just a plain name', shots: [{ name: 'c' }] }
] }));
const nc = Store.getProject(np.id).concepts;
ok('scene name: generic "Scene 1" head replaced by its description', nc[0].name === 'Festival grounds, golden hour');
ok('scene name: remainder kept as desc', nc[0].desc === 'we land inside the weekend');
ok('scene name: a real name is left alone', nc[1].name === 'Hotel room, night before' && nc[1].desc === 'the outfit is laid out');
ok('scene name: no em-dash means no desc', nc[2].name === 'Just a plain name' && nc[2].desc === '');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
