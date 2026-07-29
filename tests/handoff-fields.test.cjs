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
  comp: 'ml', density: 'single', framing: ['ots'], duration: '4',
  look: 'Noir chiaroscuro'
};
// A few handoff keys deliberately land under a different builder key — the plan
// speaks a user-facing vocabulary the builder stores internally. Verified by
// what they resolve TO, not by name.
const MAPPED = {
  look: (b) => b.dp === 'khondji' && b.lookMode === 'dp'
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
    if (MAPPED[k]) {
      ok('handoff field "' + k + '" resolves on import', MAPPED[k](b));
      return;
    }
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

// ── 4b. The decisions log must survive import ──
// It is the record of where the plan departs from the brief — the thing the
// user approves or rejects. Dropping it silently would be worse than not
// asking for it.
{
  const pid3 = Store.createProject({ name: 'Decisions' }).id;
  Store.scaffoldFromPlan(pid3, JSON.stringify({
    concepts: [{ name: 'C', kind: 'video', scenes: [{ name: 'S', shots: [{ label: '1A' }] }] }],
    decisions: [
      { found: 'Brief asks for a sunrise and a sunset in one continuous scene',
        action: 'left as briefed', detail: 'Built both as briefed', why: 'Intern level — not mine to resolve' },
      { found: 'No product named anywhere', action: 'changed', detail: 'Treated the bag as hero', why: 'Nothing else could be' },
      { notAnEntry: true }          // junk must be dropped, not imported
    ]
  }));
  const p3 = Store.getProject(pid3);
  ok('decisions import', Array.isArray(p3.decisions) && p3.decisions.length === 2);
  ok('decision fields are kept verbatim',
    !!p3.decisions && p3.decisions[0].action === 'left as briefed'
    && p3.decisions[0].why === 'Intern level — not mine to resolve');
  ok('malformed decision entries are dropped',
    !!p3.decisions && p3.decisions.every(d => d.found));

  const pid4 = Store.createProject({ name: 'No decisions' }).id;
  Store.scaffoldFromPlan(pid4, JSON.stringify({
    concepts: [{ name: 'C', kind: 'video', scenes: [{ name: 'S', shots: [{ label: '1A' }] }] }]
  }));
  ok('a plan with no decisions still imports', !!Store.getProject(pid4));
}

// ── 5. Setup questions: every option must actually change the instructions ──
// A <select> option with no matching directive silently falls back to the
// default — the user picks "full coverage", nothing changes, and nothing errors.
{
  // Every setup <select> in the panel must appear here. Discovered from the
  // markup rather than trusted, so adding a dropdown without a directive map
  // fails instead of silently no-opping.
  const SELECTS = {
    'setup-script': 'SCRIPT',
    'setup-shots': 'SHOTS',
    'setup-refs': 'REFS',
    'setup-freedom': 'FREEDOM',
    'setup-type': 'TYPE'
  };
  const inMarkup = [...np.matchAll(/<select id="(setup-[a-z]+)"/g)].map(m => m[1]);
  inMarkup.forEach(id => ok('select "' + id + '" is covered by this test', !!SELECTS[id]));
  ok('no stale select in the test list',
    Object.keys(SELECTS).every(id => inMarkup.indexOf(id) !== -1));
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

  ['scriptDirective', 'shotsDirective', 'refsDirective', 'typeDirective', 'freedomDirective'].forEach(d =>
    ok(d + ' is interpolated into the instructions', np.indexOf('${' + d + '}') !== -1));

  // Intern is literal, and that has to beat the script answer — otherwise
  // "execute the brief literally" and "write a full script first" are both live
  // and the agent picks whichever it read last.
  ok('intern overrides the script directive',
    np.indexOf("if (s.freedom === 'intern')") !== -1
    && np.indexOf('overrides this project\\\'s script setting') !== -1);
  ok('decisions is required at every level, not just the permissive ones',
    np.indexOf('"decisions" IS REQUIRED AT EVERY FREEDOM LEVEL') !== -1);
  ok('the decisions log is also asked for in the STEP 4 PDF',
    np.indexOf('Decisions and departures from the brief') !== -1);
  ok('setupChanged handler exists', np.indexOf('setupChanged: () => {') !== -1);

  // Model advice must react to the answers and use real model ids — a stale or
  // invented id sends the user somewhere that does not exist.
  ok('model advice is rendered on setup change and on folder pick',
    (np.match(/this\.renderModelAdvice\(\)/g) || []).length >= 2);
  ok('model advice names Opus 5 for heavy runs', np.indexOf("'Claude Opus 5'") !== -1);
  ok('model advice names Sonnet 5 for literal runs', np.indexOf("'Claude Sonnet 5'") !== -1);
  ok('model advice has a target element', np.indexOf('id="model-advice-name"') !== -1
    && np.indexOf('id="model-advice-why"') !== -1);
  ok('no retired model ids in the advice',
    !/claude-3|Opus 4\.|Sonnet 4\.|claude-2/.test(np.slice(np.indexOf('modelAdvice(s) {'), np.indexOf('renderModelAdvice()'))));
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

// ── 9. Control-combination defects found in review ──
// All four were the same root cause: eight independent enums across three
// tabs, joined unconditionally, none aware of any other. Two of them were the
// DEFAULT state rather than a rare mis-selection, which is why they shipped.
{
  // Article: "A aerial shot" / "A extreme close-up" were broken English.
  ok('article is chosen from the size label, not hardcoded',
    pb.indexOf("/^[aeiou]/i.test(sizeLabel) ? 'An ' : 'A '") !== -1);
  ok("the hardcoded 'A ' is gone", pb.indexOf("parts.push('A ' + this.shotLabelShort") === -1);

  // Aerial fixes its own height; `angle` defaults to 'eye', so every aerial
  // shot claimed eye level until this.
  ok('aerial suppresses the angle clause',
    pb.indexOf("const angleTxt = s.shot === 'aerial' ? '' : T('angle', s.angle);") !== -1);
  ok('the film array uses the suppressed angle', pb.indexOf('const film = [angleTxt,') !== -1);

  // Vowel-initial sizes, from the real label map.
  const labels = (pb.match(/extreme:'([^']+)'[\s\S]*?aerial:'([^']+)'/) || []);
  ok('extreme close-up is vowel-initial (so "An")', /^[aeiou]/i.test(labels[1] || ''));
  ok('aerial shot is vowel-initial (so "An")', /^[aeiou]/i.test(labels[2] || ''));
}

// ── 10. Video gaps: duration and the Seedance technical block ──
{
  global.window.PromptCompile = undefined;
  eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'promptcompile.js'), 'utf8'));
  const PC = global.window.PromptCompile;

  const withDur = PC.compileVideo({ action: 'she turns', duration: '4' }, { scene: 'A wide shot', model: 'seedance' });
  const noDur = PC.compileVideo({ action: 'she turns' }, { scene: 'A wide shot', model: 'seedance' });
  ok('duration reaches the video prompt', withDur.indexOf('Duration: 4 seconds.') !== -1);
  ok('duration is silent when unset', noDur.indexOf('Duration:') === -1);
  ok('duration never reaches a stills prompt',
    PC.compileReferencePrompt('prop', 'x', {}).stills.indexOf('Duration:') === -1);

  ok('seedance gets the technical block',
    withDur.indexOf('Technical: 24fps smooth motion. 8K detail. No jitter.') !== -1);
  ok('kling is left untouched',
    PC.compileVideo({}, { scene: 'A wide shot', model: 'kling' }).indexOf('Technical:') === -1);
  ok('the technical block trails the duration',
    withDur.indexOf('Duration:') < withDur.indexOf('Technical:'));
  ok('audio is deliberately still unspecified — remove this when the field lands',
    withDur.toLowerCase().indexOf('audio') === -1 && withDur.toLowerCase().indexOf('sound') === -1);

  // duration is a validated control, so a junk value from a plan is dropped.
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8');
  const block = (src.split('var SHOT_CONTROLS')[1] || '').split('};')[0];
  ok('duration is in SHOT_CONTROLS (so plans can set it and junk is dropped)',
    block.indexOf('duration:') !== -1);
  const offered = ((np.split('"duration": "')[1] || '').split('"')[0]).split('|').map(s => s.trim()).filter(Boolean);
  ok('the handoff offers duration values', offered.length > 1);
  offered.forEach(v => ok('store accepts duration=' + v, block.indexOf("'" + v + "'") !== -1));

  // Project view sums what the shots actually say.
  const pj = fs.readFileSync(path.join(__dirname, '..', 'src', 'projects.html'), 'utf8');
  ok('project view derives runtime from the shots', pj.indexOf('durTotals') !== -1);
  ok('project view reports shots with no length set', pj.indexOf('with no length') !== -1);
  ok('runtime is rendered in the concept header', pj.indexOf('+ runtimeLabel +') !== -1);
}

// ── 11. Beta-report blockers ──
{
  // (a) Editing an imported reference must never replace a finished sheet with
  //     a husk. A plan supplies the prompt but not the per-attribute fields, so
  //     recompiling from them yields a template full of [BRACKET] holes.
  ok('unfilledSlots detects an unfilled template',
    RT.unfilledSlots(RT.fill('character', {})) > 5);
  ok('unfilledSlots is zero on a real sentence',
    RT.unfilledSlots('Cinematic character reference sheet, split-frame layout.') === 0);
  ok('a fully filled sheet has no holes',
    RT.unfilledSlots(RT.fill('prop', {
      SUBJECT: 'a spyglass', GLOSS: 'telescope', ORIENTATION: 'tilted', MUSTREAD: 'the tubes',
      PARTS: 'brass body', MATERIALLIGHT: 'specular brass', ASPECT: '4:5'
    })) === 0);

  const rh = fs.readFileSync(path.join(__dirname, '..', 'src', 'references.html'), 'utf8');
  ok('the wizard remembers the prompt a reference already carries',
    rh.indexOf('existingPrompt: (r && r.prompt)') !== -1);
  ok('it refuses to show a husk over a real prompt',
    rh.indexOf('const keepExisting = !!w.existingPrompt && holes > 0;') !== -1);
  ok('the textarea renders the kept prompt, not the recompile',
    rh.indexOf('this.esc(shown)') !== -1);
  ok('the user is told why the fields are blank',
    rh.indexOf('arrived in a plan as a finished sheet') !== -1);

  // (b) An empty frame must not ask for a face. realismBaseline always accepted
  //     { people: false }; nothing drove it until density gained "none".
  const block = (fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8')
    .split('var SHOT_CONTROLS')[1] || '').split('};')[0];
  ok('density offers "none"', block.indexOf("'none'") !== -1);
  ok('the handoff offers density none', np.indexOf('"density": "none | single | few | crowd"') !== -1);
  ok('the handoff explains what none is for', np.indexOf('It is not cosmetic') !== -1);
  ok('the builder offers a No-one chip', pb.indexOf("dBtn('none','No one in frame')") !== -1);
  ok('density none reaches the prompt',
    pb.indexOf("s.density === 'none'") !== -1);
  ok('the people opt-out is finally driven',
    pb.indexOf("PC.realismBaseline({ people: s.density !== 'none' })") !== -1);

  global.window.PromptCompile = undefined;
  eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'promptcompile.js'), 'utf8'));
  const PC2 = global.window.PromptCompile;
  const withPeople = PC2.realismBaseline().join(' ');
  const without = PC2.realismBaseline({ people: false }).join(' ');
  ok('the default still asks for skin/hair/eye detail', /skin pores/.test(withPeople));
  ok('an empty frame does not', !/skin pores|flyaway hair|eye reflections/.test(without));
  ok('"none" compiles to a positive empty-frame clause',
    PC2.term('density', 'none', '').indexOf('no people in frame') !== -1);
}

// ── 12. Look: the checklist bug and the handoff gap ──
{
  // The checklist tested `prefixOverride` — the per-shot "override the project
  // style prefix" flag — and called it "Style / look set". Picking a look could
  // never satisfy it, and nothing on screen said why.
  // Scope the assertion to the checks array itself. Testing only that the right
  // fields appear somewhere lets a mutation re-add prefixOverride alongside
  // them and still pass — which is exactly what happened first time.
  // Comments in this block legitimately name the old field to explain the fix,
  // so strip them — the assertion is about the code, not the prose.
  const checksBlock = pb.slice(pb.indexOf('const checks = ['), pb.indexOf('const done = checks'))
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ok('the checklist no longer consults prefixOverride at all',
    checksBlock.indexOf('prefixOverride') === -1);
  ok('the look check reads the actual look fields',
    checksBlock.indexOf("s.lookMode === 'dp' && has(s.dp)") !== -1
    && checksBlock.indexOf("s.lookMode === 'feel'") !== -1);

  // The handoff had no concept of a look, so a perfectly-followed plan was
  // permanently capped below 100%.
  ok('the handoff asks for a look', np.indexOf('"look":') !== -1);
  ok('the handoff explains how to choose one', np.indexOf('keep a scene consistent') !== -1);

  // Drift: the plan speaks in brand-free labels; the builder keys them by DP
  // surname internally. Those must stay in step, and the surnames must never
  // reach the handoff text.
  const labels = Store.lookLabels();
  ok('the store exposes the look labels', labels.length >= 8);
  const offered = ((np.split('"look": "')[1] || '').split('"')[0])
    .split('|').map(s => s.trim()).filter(Boolean);
  ok('the handoff offers every look the store accepts', offered.length === labels.length);
  offered.forEach(o => ok('handoff look "' + o + '" resolves', !!Store.resolveLook(o)));

  const dpBlock = pb.slice(pb.indexOf('dpTraits() {'), pb.indexOf('dpTraits() {') + 2200);
  labels.forEach((l) => {
    const id = Store.resolveLook(l);
    ok('builder still has an entry for "' + l + '"', dpBlock.indexOf("id:'" + id + "'") !== -1);
  });
  // The surnames are internal ids only — they are a legal-risk term and must
  // not appear in anything the user pastes.
  ['deakins', 'lubezki', 'khondji', 'anderson'].forEach(n =>
    ok('"' + n + '" never appears in the handoff text', np.toLowerCase().indexOf(n) === -1));

  ok('a look imports', (function () {
    const id = Store.createProject({ name: 'look' }).id;
    Store.scaffoldFromPlan(id, JSON.stringify({ concepts: [{ name: 'C', kind: 'video',
      scenes: [{ name: 'S', shots: [{ label: '1A', look: 'Noir chiaroscuro' }] }] }] }));
    const b = Store.getProject(id).concepts[0].scenes[0].shots[0].builder;
    return b.dp === 'khondji' && b.lookMode === 'dp';
  })());
  ok('an unrecognised look leaves the default alone', (function () {
    const id = Store.createProject({ name: 'look2' }).id;
    Store.scaffoldFromPlan(id, JSON.stringify({ concepts: [{ name: 'C', kind: 'video',
      scenes: [{ name: 'S', shots: [{ label: '1A', look: 'Neon Vaporwave' }] }] }] }));
    return Store.getProject(id).concepts[0].scenes[0].shots[0].builder.dp === 'deakins';
  })());
}

// ── 7. The reuse instruction must match the importer that reads it ──
// This is the same class of bug as `negative`: the handoff asks the planning
// agent for a shape, and nothing on the app side understands it, so the work
// evaporates without an error. Here the cost is worse than a lost field — a
// cutdown whose shots silently arrive EMPTY.
{
  ok('the handoff teaches reuse', np.indexOf('A CUTDOWN RE-CUTS THE HERO') !== -1);
  ok('the handoff names the field exactly as the importer reads it',
    np.indexOf('"reuseOf"') !== -1 || np.indexOf('"reuseOf":') !== -1);
  ok('the reuse example carries both concept and label',
    /"reuseOf":\s*\{\s*"concept":\s*"[^"]+",\s*"label":\s*"[^"]+"\s*\}/.test(np));
  ok('the handoff says duration is the one per-use field',
    np.indexOf('"duration" is the ONE field a reusing shot may set') !== -1);
  // The example lives in the SECOND concept on purpose: section 1 above parses
  // the first shot block for a field list, and reuseOf is a different SHAPE of
  // shot rather than another field of an ordinary one.
  ok('reuseOf is kept out of the ordinary-shot field list', asked.indexOf('reuseOf') === -1);

  // End to end: the documented example imports and resolves.
  const rid = Store.createProject({ name: 'Handoff reuse' }).id;
  Store.scaffoldFromPlan(rid, JSON.stringify({ concepts: [
    { name: 'Hero film', kind: 'video', scenes: [{ name: 'Bodega', shots: [
      { label: '1A' }, { label: '1B' },
      { label: '2C', subject: 'the frame the cutdown wants', duration: '6' }
    ] }] },
    { name: 'Social cutdown', kind: 'video', scenes: [{ name: 'Bodega', shots: [
      { label: '1A', reuseOf: { concept: 'Hero film', label: '2C' }, duration: '2' }
    ] }] }
  ] }));
  const rp = Store.getProject(rid);
  const rcut = rp.concepts[1];
  const rres = Store.resolveShot({ projectId: rid, conceptId: rcut.id,
    sceneId: rcut.scenes[0].id, shotId: rcut.scenes[0].shots[0].id });
  ok('the documented reuse example resolves to the hero shot',
    !!rres && rres.reuse && rres.reuse.ok === true
    && rres.builder.subject === 'the frame the cutdown wants');
  ok('the documented example takes its own duration', rres.builder.duration === '2');

  // The builder must FOLLOW a pointer rather than open it as a blank shot —
  // typing into a pointer forks the frame, which is what reuse prevents.
  ok('the builder follows a reuse pointer to its source',
    pb.indexOf('a.shot.reuseOf') !== -1 && pb.indexOf('Store.resolveShot(') !== -1);

  const pv2 = fs.readFileSync(path.join(__dirname, '..', 'src', 'projects.html'), 'utf8');
  ok('the project view resolves reuse rather than reading builders raw',
    pv2.indexOf('Store.resolveShotIn') !== -1);
  ok('the project view warns before deleting a shot others reuse',
    pv2.indexOf('Store.reuseDependents(') !== -1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
