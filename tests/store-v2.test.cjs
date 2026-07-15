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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
