// Handoff ↔ importer drift guard. Run: node tests/handoff-fields.test.cjs
//
// Two failure modes this catches, both of which shipped silently before:
//   1. The handoff asks the planning agent for a field the importer drops
//      (`negative` did this — it compiles into the prompt but mapScenes never
//      set it, so every plan that supplied it lost it without a warning).
//   2. The handoff asks for a field nothing ever reads (`cameraIntent` did
//      this — the agent was told to write "the move and WHY" and no compiled
//      prompt referenced it, anywhere).
// Either way the plan author does work that evaporates. Nothing errors, so
// only a test notices.
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

// ── 1. Every shot key the handoff template asks for must survive import ──
// Parsed out of the template literal in newproject.html rather than hardcoded,
// so adding a key to the instructions without wiring it fails here.
const np = fs.readFileSync(path.join(__dirname, '..', 'src', 'newproject.html'), 'utf8');
const shotBlock = np.slice(np.indexOf('"label": "1A"'), np.indexOf('"breakdown"'));
const asked = [...new Set([...shotBlock.matchAll(/"([a-zA-Z]+)":/g)].map(m => m[1]))]
  .filter(k => k !== 'label' && k !== 'name');

ok('template still parses to a field list', asked.length >= 10);

// Build a plan that supplies every asked-for key with a legal value.
const legal = {
  subject: 'Marco in a charcoal jacket',
  action: 'the bag held out, hands not yet touching',
  environment: 'bodega interior, counter frame right',
  offCamera: 'the clerk off frame right, eyeline holding',
  propState: 'before: bag full. during: extended. after: released',
  negative: 'a second bag, visible crew',
  cameraIntent: 'The beat is her decision, so the frame isolates her. At the master lens it reads as coverage.',
  purpose: 'master',
  shot: 'close', lens: '85', angle: 'low', depth: 'layered', move: 'push',
  comp: 'ml', density: 'single', framing: ['ots']
};
const missing = asked.filter(k => !(k in legal));
ok('every asked-for key is covered by this test (' + missing.join(', ') + ')', missing.length === 0);

const pid = Store.createProject({ name: 'Handoff drift' }).id;
// scaffoldFromPlan takes the raw file CONTENT (a JSON string), not an object.
Store.scaffoldFromPlan(pid, JSON.stringify({
  concepts: [{
    name: 'C1', kind: 'video',
    scenes: [{ name: 'S1', shots: [Object.assign({ label: '1A', name: '1A · test' }, legal)] }]
  }]
}));
const scenes = Store.listScenes ? Store.listScenes(pid) : null;
const proj = Store.getProject(pid);
const firstShot = (function find(o) {
  if (!o || typeof o !== 'object') return null;
  if (Array.isArray(o.shots) && o.shots.length && o.shots[0].builder) return o.shots[0];
  for (const k of Object.keys(o)) { const r = find(o[k]); if (r) return r; }
  return null;
})(proj) || (scenes && scenes[0] && scenes[0].shots[0]);

ok('plan import produced a shot with a builder', !!(firstShot && firstShot.builder));

if (firstShot && firstShot.builder) {
  const b = firstShot.builder;
  asked.forEach(k => {
    const want = legal[k];
    const got = b[k];
    const same = Array.isArray(want) ? JSON.stringify(want) === JSON.stringify(got) : want === got;
    ok('handoff field "' + k + '" survives import (got: ' + JSON.stringify(got) + ')', same);
  });
}

// ── 2. No asked-for field may be one nothing reads ──
// A field is "read" if it appears in the compile path or is a known
// human-facing field. cameraIntent was removed from the handoff precisely
// because it satisfied neither.
const pb = fs.readFileSync(path.join(__dirname, '..', 'src', 'promptbuilder.html'), 'utf8');
const pc = fs.readFileSync(path.join(__dirname, '..', 'src', 'promptcompile.js'), 'utf8');
const compileSrc = pb.slice(pb.indexOf('compilePrompt()')) + pc;
const NOT_COMPILED = {
  // Drives validation + the shot-card badge. Never compiled, by design.
  purpose: true,
  // Deliberate reasoning artifact: the planning agent must justify its setup
  // BEFORE choosing values, which improves the choice whether or not anyone
  // reads the justification. It was previously requested with no consumer at
  // all, which is different — that was an accident, this is the point.
  cameraIntent: true
};
asked.forEach(k => {
  if (NOT_COMPILED[k]) return;
  ok('handoff field "' + k + '" is actually read by the compile path',
    compileSrc.indexOf(k) !== -1);
});

// The justification must be asked for BEFORE the controls it justifies —
// ordered after them, the agent rationalises choices it has already made.
const order = f => shotBlock.indexOf('"' + f + '":');
ok('cameraIntent is requested', order('cameraIntent') !== -1);
ok('cameraIntent precedes shot/lens/angle/depth',
  order('cameraIntent') < order('shot') && order('cameraIntent') < order('lens'));

// Non-compiled fields must still survive a builder save, or they vanish the
// first time the user edits that shot in the UI.
const pbKeys = pb.slice(pb.indexOf('builderKeys()'), pb.indexOf('builderKeys()') + 600);
Object.keys(NOT_COMPILED).forEach(k =>
  ok('"' + k + '" is in builderKeys (survives a UI save)', pbKeys.indexOf("'" + k + "'") !== -1));

// ── 3. Reference-sheet templates must reach the pasted instructions ──
// The planning agent runs against the user's own folder, which never contains
// the research doc, and the app cannot write files there. If the inlining
// breaks, the agent silently falls back to inventing its own reference prompts
// and nothing errors — so guard every link in that chain.
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'reftemplates.js'), 'utf8'));
const RT = global.window.RefTemplates;

ok('reftemplates.js exposes all three kinds',
  !!(RT && RT.character && RT.prop && RT.location));
ok('product reuses the prop sheet', RT.product === RT.prop);
// Anchors from the shipped prompts — if these vanish the template was reworded.
ok('character sheet keeps the split-frame layout', RT.character.indexOf('split-frame layout') !== -1);
ok('character sheet locks the grey hex', RT.character.indexOf('#8a8a8a') !== -1);
ok('prop sheet locks the grey hex', RT.prop.indexOf('#8a8a8a') !== -1);
ok('prop sheet keeps sharp-focus-throughout', RT.prop.indexOf('sharp focus across the whole object') !== -1);
ok('location plate keeps both variants',
  RT.location.indexOf('WEAK ARCHETYPE') !== -1 && RT.location.indexOf('STRONG ARCHETYPE') !== -1);
ok('all() concatenates every template', RT.all().length > (RT.character.length + RT.prop.length));

// reftemplates.js is a copy of docs/research/copy-paste-templates.md. Two
// copies drift. This catches the realistic case: the research doc gets revised
// and the shipped copy doesn't (or vice versa).
{
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'research', 'copy-paste-templates.md'), 'utf8');
  const ANCHORS = [
    'Cinematic character reference sheet, split-frame layout, photorealistic',
    'plain solid grey background (#8a8a8a), seamless',
    'sharp focus across the whole object',
    'Shot on 85mm portrait lens',
    'Shot on 35mm lens, even full-length lighting',
    'no shadow spill beyond a soft contact shadow'
  ];
  const shipped = RT.all();
  ANCHORS.forEach(a => {
    ok('anchor present in research doc: "' + a.slice(0, 40) + '…"', doc.indexOf(a) !== -1);
    ok('anchor present in shipped templates: "' + a.slice(0, 40) + '…"', shipped.indexOf(a) !== -1);
  });
}

ok('newproject.html loads reftemplates.js', np.indexOf('src="./reftemplates.js"') !== -1);
ok('instructions read the templates off window.RefTemplates',
  np.indexOf('window.RefTemplates && window.RefTemplates.all()') !== -1);
ok('instructions interpolate the templates', np.indexOf('${refTemplates}') !== -1);
ok('instructions announce the templates section', np.indexOf('REFERENCE SHEET TEMPLATES') !== -1);
ok('the shot no-prompts rule is scoped to shots, not references',
  np.indexOf('DO NOT WRITE GENERATION PROMPTS FOR SHOTS') !== -1
  && np.indexOf('THE ONE EXCEPTION IS REFERENCE SHEETS') !== -1);

// ── 4. An authored reference sheet must survive import ──
{
  const pid2 = Store.createProject({ name: 'Ref sheets' }).id;
  const sheet = 'Cinematic character reference sheet, split-frame layout, photorealistic. …';
  Store.scaffoldFromPlan(pid2, JSON.stringify({
    concepts: [{ name: 'C', kind: 'video', scenes: [{ name: 'S', shots: [{ label: '1A' }] }] }],
    descriptions: [
      { kind: 'character', name: 'Marco', description: 'facts', prompt: sheet },
      { kind: 'prop', name: 'Paper bag', description: 'facts' }   // older plan: no prompt
    ]
  }));
  const refs = Store.listReferences(pid2) || [];
  const marco = refs.find(r => r.name === 'Marco');
  const bag = refs.find(r => r.name === 'Paper bag');
  ok('references imported', !!(marco && bag));
  ok('authored reference sheet survives import', !!marco && marco.prompt === sheet);
  ok('a plan without a prompt still imports cleanly', !!bag && bag.prompt === '');
}

// ── 5. Setup questions: every option must actually change the instructions ──
// A <select> option with no matching directive silently falls back to the
// default — the user picks "full coverage", nothing changes, and nothing errors.
{
  const SELECTS = {
    'setup-script': 'SCRIPT',
    'setup-shots': 'SHOTS',
    'setup-refs': 'REFS',
    'setup-type': 'TYPE'
  };
  Object.keys(SELECTS).forEach(id => {
    const sel = np.slice(np.indexOf('id="' + id + '"'));
    const body = sel.slice(0, sel.indexOf('</select>'));
    const options = [...body.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);
    ok(id + ' has options', options.length >= 2);

    const mapName = SELECTS[id];
    const mapStart = np.indexOf('const ' + mapName + ' = {');
    ok(mapName + ' directive map exists', mapStart !== -1);
    const mapBody = np.slice(mapStart, np.indexOf('\n    };', mapStart));
    options.forEach(o => {
      // keys appear bare (auto:) or quoted ('write-script':)
      const bare = new RegExp('(^|[\\s{])' + o.replace(/[-]/g, '\\-') + '\\s*:');
      const quoted = mapBody.indexOf("'" + o + "'") !== -1;
      ok('option "' + o + '" (' + id + ') has a ' + mapName + ' directive',
        quoted || bare.test(mapBody));
    });
    ok(id + ' is wired to setupChanged', body.indexOf('setupChanged') !== -1
      || np.slice(np.indexOf('id="' + id + '"') - 400, np.indexOf('id="' + id + '"')).indexOf('setupChanged') !== -1);
  });

  ['scriptDirective', 'shotsDirective', 'refsDirective', 'typeDirective'].forEach(d =>
    ok(d + ' is interpolated into the instructions', np.indexOf('${' + d + '}') !== -1));
  ok('setupChanged handler exists', np.indexOf('setupChanged: () => {') !== -1);
  ok('readSetup falls back to defaults', np.indexOf('readSetup()') !== -1);
}

// ── 6. Template tokens ↔ wizard fields ──
// The same templates render two ways: {{TOKEN}} → [bracket] for the planning
// agent, {{TOKEN}} → the user's answer for the References wizard. A token with
// no matching field can never be filled by hand; a field with no token is a
// question whose answer goes nowhere. Both fail silently without this.
{
  const rt = fs.readFileSync(path.join(__dirname, '..', 'src', 'reftemplates.js'), 'utf8');
  const DERIVED = ['PRON', 'POSS', 'KIND'];  // derived from the gender answer and the kind itself
  const raws = {
    character: (rt.match(/var CHARACTER = \[([\s\S]*?)\]\.join/) || [])[1] || '',
    prop: (rt.match(/var PROP = \[([\s\S]*?)\]\.join/) || [])[1] || '',
    location: ((rt.match(/var LOCATION_A = \[([\s\S]*?)\]\.join/) || [])[1] || '')
      + ((rt.match(/var LOCATION_B = \[([\s\S]*?)\]\.join/) || [])[1] || '')
  };
  Object.keys(raws).forEach(kind => {
    ok(kind + ' raw template found', raws[kind].length > 0);
    const tokens = [...new Set([...raws[kind].matchAll(/\{\{([A-Z0-9]+)\}\}/g)].map(m => m[1]))];
    const keys = RT.fields(kind).map(f => f.key);
    tokens.forEach(t => ok('token {{' + t + '}} (' + kind + ') has a wizard field',
      keys.indexOf(t) !== -1 || DERIVED.indexOf(t) !== -1));
    // Location fields legitimately split across two variants, so only the
    // single-variant kinds get the reverse check.
    if (kind !== 'location') {
      keys.forEach(k => ok('field "' + k + '" (' + kind + ') reaches the template',
        tokens.indexOf(k) !== -1));
    }
  });

  RT.fields('character').concat(RT.fields('prop'), RT.fields('location')).forEach(f => {
    ok('field ' + f.key + ' has a label', !!f.label);
    ok('field ' + f.key + ' has a renderable type',
      ['text', 'textarea', 'select'].indexOf(f.type) !== -1);
    if (f.type === 'select') ok('select ' + f.key + ' has options', Array.isArray(f.options) && f.options.length > 1);
  });
}

// ── 7. fill() and forHandoff() behaviour ──
{
  const filled = RT.fill('character', {
    GENDER: 'woman', AGE: '30s', ETHNICITY: 'Korean', SKIN: 'fair skin',
    HAIR: 'black hair to the shoulders', EVIDENCE: 'a faint scar at the chin',
    EYES: 'dark brown', ACCESSORY: 'silver hoop earrings', EXPRESSION: 'level',
    BUILD: 'slight', HEIGHT: '1.65', GARMENTS: 'a navy overcoat',
    FOOTWEAR: 'black boots', LAYERING: 'the coat open over a grey knit',
    FAKEABLE: 'the coat back vent'
  });
  ok('fill substitutes answers', filled.indexOf('a 30s Korean woman') !== -1);
  ok('fill resolves pronouns from gender', filled.indexOf('she stands straight') !== -1
    && filled.indexOf('at her sides') !== -1);
  ok('fill keeps the constant text', filled.indexOf('plain solid grey background (#8a8a8a)') !== -1);
  ok('fill leaves no unsubstituted tokens', filled.indexOf('{{') === -1);

  const sparse = RT.fill('character', { GENDER: 'man' });
  ok('unanswered fields stay visible as brackets', sparse.indexOf('[SKIN TONE]') !== -1);
  ok('sparse fill still resolves pronouns', sparse.indexOf('he stands straight') !== -1);

  const prop = RT.fill('prop', { SUBJECT: 'a brass spyglass', ASPECT: '4:5' });
  ok('optional fields drop out instead of leaving a hole',
    prop.indexOf('[TASTE GUARDRAILS') === -1 && prop.indexOf('[DESIGN LANGUAGE') === -1);
  ok('required prop fields still show', prop.indexOf('[PART-BY-PART SWEEP') !== -1);

  const a = RT.fill('location', { VARIANT: 'A', SUBJECT: 'a bodega' });
  const b = RT.fill('location', { VARIANT: 'B', SUBJECT: 'a bodega' });
  ok('location variants produce different prompts', a !== b);
  ok('variant A blocks out depth planes', a.indexOf('Foreground:') !== -1);
  ok('variant B does not', b.indexOf('Foreground:') === -1);

  const handoff = RT.forHandoff('character');
  ok('forHandoff renders brackets, not answers', handoff.indexOf('[SKIN TONE]') !== -1);
  ok('forHandoff renders pronoun brackets', handoff.indexOf('[he/she]') !== -1);
  ok('forHandoff carries the fill rules', handoff.indexOf('FILL RULES') !== -1);
  ok('forHandoff leaves no unsubstituted tokens', handoff.indexOf('{{') === -1);
}

// ── 8. The wizard uses the same templates as the handoff ──
{
  const pcSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'promptcompile.js'), 'utf8');
  ok('fieldsFor delegates to RefTemplates',
    pcSrc.indexOf('window.RefTemplates && window.RefTemplates.fields') !== -1);
  ok('compileReferencePrompt delegates to RefTemplates.fill',
    pcSrc.indexOf('window.RefTemplates.fill(kind, fields)') !== -1);
  const refHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'references.html'), 'utf8');
  ok('references.html loads reftemplates.js before promptcompile.js',
    refHtml.indexOf('reftemplates.js') !== -1
    && refHtml.indexOf('reftemplates.js') < refHtml.indexOf('promptcompile.js'));
  ok('references.html can render a select field', refHtml.indexOf("f.type === 'select'") !== -1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
