// Seedance 2 / Cinema Studio adapter. Run: node tests/seedance.test.cjs
//
// The design rests on one claim — that adding this path changed no other model's
// output. Section A is that claim as a golden-string fixture, and if it fails
// nothing else in here matters.
const fs = require('fs');
const path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
global.window = {};
eval(src('promptcompile.js'));
const PC = global.window.PromptCompile;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }

const PB = src('promptbuilder.html');
const STORE = src('store.js');

// A People shot with everything set, so no slot is skipped by a `has()` guard.
function shot(over) {
  return Object.assign({
    stillModel: 'gpt', videoModel: 'higgsfield', density: 'few',
    lookMode: 'dp', camMode: 'specific', dp: 'khondji',
    comp: 'mc', shot: 'close', angle: 'low', lens: '85',
    move: 'push', depth: 'shallow', framing: ['ots'], duration: '6',
    subject: 'Marco, mid-30s, charcoal work jacket',
    action: 'the paper bag held out, hands not yet touching',
    environment: 'corner bodega interior, counter frame right',
    cameraIntent: 'THE-JUSTIFICATION-PROSE. Shot at the master wide 24mm it disappears.',
    purpose: 'reaction', offCamera: 'the clerk off frame right',
    propState: 'before: bag full. during: bag extended. after: bag released',
    negative: 'a second bag, visible crew',
    chips: {}
  }, over || {});
}
const emit = (over, opts) => PC.compileVideo(shot(over), Object.assign({ model: 'higgsfield' }, opts || {}));
const REF = (id, name, kind, desc) => ({ id: id, name: name, kind: kind, fields: desc ? { desc: desc } : {} });

// ── A. GOLDEN — every other model frozen ──────────────────────────────────────
{
  const golden = require('./golden-promptcompile.json');
  const s = () => ({
    stillModel: 'gpt', videoModel: 'kling', density: 'few',
    lookMode: 'dp', camMode: 'specific', dp: 'deakins',
    comp: 'mc', shot: 'wide', angle: 'eye', lens: '24',
    move: 'push', depth: 'shallow', framing: ['ots'], duration: '6',
    subject: 'Marco at the counter', action: 'the bag held out',
    environment: 'bodega interior, counter frame right',
    cameraIntent: 'Her decision lands here. Shot wide it disappears.',
    purpose: 'master', offCamera: 'the clerk off frame right',
    propState: 'before: bag full. after: released',
    look: '', notes: 'scratch', negative: 'a second bag, visible crew',
    prefixOverride: false, charRefIds: [], propRefIds: [], locRefId: null, styleRefId: null,
    chips: { tod: 4, light: [0, 3], feel: 1, grade: 2, realism: [4, 7], ar: 3, type: 1, campick: 0, cambody: 3, lensformat: 1 }
  });
  const now = {};
  ['kling', 'seedance', 'higgsfield', 'unknown', undefined].forEach((m) => {
    const st = s(); st.videoModel = m;
    now['compileVideo/' + String(m)] = PC.compileVideo(st, { scene: 'A wide establishing shot of a woman, subject centred in frame.', model: m });
    now['compileVideo/noScene/' + String(m)] = PC.compileVideo(st, { model: m });
    now['compileVideo/bare/' + String(m)] = PC.compileVideo({}, { model: m });
  });
  ['gpt', 'nano', 'seedream', 'unknown'].forEach((m) => {
    ['', '16:9', '9:16', '1:1', '2.39:1'].forEach((ar) => {
      now['stillLead/' + m + '/' + (ar || 'noAr')] = PC.stillLead(m, { ar: ar });
    });
  });
  now['realismBaseline/people'] = PC.realismBaseline();
  now['realismBaseline/peopleTrue'] = PC.realismBaseline({ people: true });
  now['realismBaseline/peopleFalse'] = PC.realismBaseline({ people: false });
  now['cameraCraft'] = PC.cameraCraft();
  now['OPTS/order'] = Object.keys(PC.OPTS).reduce((a, g) => { a[g] = PC.OPTS[g].map((o) => o.label); return a; }, {});
  now['DICT/order'] = Object.keys(PC.DICT).reduce((a, c) => { a[c] = Object.keys(PC.DICT[c]); return a; }, {});

  let drift = [];
  Object.keys(now).forEach((k) => {
    if (!(k in golden)) return;   // higgsfield (rewritten) + seedance (retired id) are meant to move
    if (JSON.stringify(now[k]) !== JSON.stringify(golden[k])) drift.push(k);
  });
  ok('GOLDEN: no other model moved (' + drift.join(', ') + ')', drift.length === 0);
  ok('GOLDEN: fixture actually covers kling + all three stills models',
    'compileVideo/kling' in golden && 'stillLead/gpt/16:9' in golden
    && 'stillLead/nano/16:9' in golden && 'stillLead/seedream/16:9' in golden);
  ok('GOLDEN: the 3 deliberately-changed keys are excluded, not silently frozen',
    !('compileVideo/higgsfield' in golden));
}

// ── B. The inheritance is severed — the root cause of four separate bugs ──
{
  const withScene = emit({}, { scene: 'SENTINEL-STILLS-PROMPT visible skin pores flyaway hair strands.' });
  ok('never reads opts.scene', withScene.indexOf('SENTINEL-STILLS-PROMPT') === -1);
  ok('never inherits the stills craft chain', withScene.indexOf('flyaway hair strands') === -1);
  ok('scene presence changes nothing', withScene === emit({}));
  // The action appears once. Today's clause-join emits it in the scene AND as motion.
  const a = 'the paper bag held out, hands not yet touching';
  ok('action emitted exactly once', withScene.split(a).length - 1 === 1);
  ok('environment emitted exactly once',
    withScene.split('corner bodega interior, counter frame right').length - 1 === 1);
  ok('no `within :` grammar break is constructible', withScene.indexOf('within :') === -1);
}

// ── C. Slot order and the §2 global rules ──
{
  const out = emit({ chips: { tod: 4, light: [1], grade: 2, realism: [4] } }, { refs: [REF('r1', 'Maya', 'character', 'mid-30s')] });
  const ORDER = ['Style', 'Lighting', 'Color', 'Camera', 'Skin', 'Acting', 'Physics',
    'Composition', 'Continuity', 'Technical', 'Audio', 'Characters', 'Scene', 'CUT 1'];
  const seen = out.split('\n').map((l) => (l.match(/^([A-Za-z ]+?)(?::| — )/) || [])[1]).filter(Boolean);
  const idx = seen.map((l) => ORDER.indexOf(l)).filter((i) => i >= 0);
  ok('slots emit in spec order', idx.every((v, i) => i === 0 || v > idx[i - 1]));
  ok('slots join with ". " inside, newline between', /\nLighting: /.test(out));
  ok('Style leads with 8K IMAX', /^Style: 8K IMAX\. Photorealistic/.test(out));
  ok('Technical carries no resolution token', /Technical: 24fps smooth motion\. No jitter\.$/m.test(out));
  ok('Audio is unconditional', out.indexOf('Audio: Environmental SFX only. No music. No subtitles.') !== -1);
  ok('the corpus typo is corrected to "lighting"',
    out.indexOf('lightning') === -1);
  // An empty slot is omitted entirely, never emitted with nothing after it.
  // lubezki is the look with no palette at all, so Color: has genuinely nothing.
  const bare = emit({ dp: 'lubezki', chips: {}, environment: '', offCamera: '', propState: '', subject: '', action: '' });
  const labelled = bare.split('\n').filter((l) => !/^CUT 1 — /.test(l));
  ok('empty slots omitted entirely',
    labelled.every((l) => !/^[A-Za-z ]+: *$/.test(l)) && bare.indexOf('Color:') === -1);
  ok('Continuity absent with no references', bare.indexOf('Continuity:') === -1);
  ok('Continuity present with a reference',
    emit({}, { refs: [REF('r1', 'Maya', 'character')] }).indexOf('Continuity: No identity drift.') !== -1);
}

// ── D. Blocker 1 — the People gate cannot depend on People being index 0 ──
{
  const people = () => emit({ chips: { type: 0 } }).indexOf('Skin:') !== -1;
  const product = () => emit({ chips: { type: 1 } }).indexOf('Skin:') !== -1;
  ok('gate: People fires', people());
  ok('gate: Product suppressed', !product());
  ok('gate: unset fires (identical to today)', emit({ chips: {} }).indexOf('Skin:') !== -1);
  ok('gate: density none suppressed', emit({ density: 'none', chips: { type: 0 } }).indexOf('Skin:') === -1);

  // Reorder CHIP_OPTS.type. A label-resolving gate survives; an index comparison inverts.
  const orig = PC.CHIP_OPTS.type.slice();
  PC.CHIP_OPTS.type.unshift(PC.CHIP_OPTS.type.splice(orig.length - 1, 1)[0]); // Abstract to the front
  const peopleIdx = PC.CHIP_OPTS.type.findIndex((o) => o.label === 'People');
  const stillWorks = emit({ chips: { type: peopleIdx } }).indexOf('Skin:') !== -1
    && emit({ chips: { type: PC.CHIP_OPTS.type.findIndex((o) => o.label === 'Product') } }).indexOf('Skin:') === -1;
  PC.CHIP_OPTS.type.length = 0; orig.forEach((o) => PC.CHIP_OPTS.type.push(o));
  ok('gate: survives reordering CHIP_OPTS.type (People no longer index 0)', stillWorks);
  ok('gate: People restored to index 0 after the test', PC.CHIP_OPTS.type[0].label === 'People');
}

// ── E. Blocker 2 — phantom defaults resolved at emission ──
{
  // khondji presets a 35mm film body. chips.cambody is undefined (the chip renders
  // selected while state stays unset), so the gauge must still emit.
  const k = emit({ dp: 'khondji', chips: {} });
  ok('gauge emits from the look default with chips.cambody undefined',
    k.indexOf('35mm film stock, visible grain in the shadows') !== -1);
  ok('gauge label survives (a measurement, not a trademark)', k.indexOf('35mm film stock') !== -1);
  // A digital-body look emits no body name and no invented artifact list.
  const p = emit({ dp: 'pfister', chips: {} });
  ok('digital body emits neither its name nor invented artifacts',
    !/\bSony\b|\bVenice\b|\bARRI\b|\bAlexa\b|RED V-Raptor/i.test(p) && p.indexOf('film stock') === -1);
  ok('chipLabel falls back to the `on` option when state is undefined',
    PC.chipLabel('lensformat', undefined) === 'Spherical' && PC.chipLabel('campick', undefined) === 'Filmic');
  ok('chipLabel resolves a real index', PC.chipLabel('type', 1) === 'Product');
  ok('chipLabel: type has no `on` default, so unset resolves to nothing',
    PC.chipLabel('type', undefined) === '');
}

// ── F. Camera: ordered claimants, first writer wins ──
{
  const gaugeSet = emit({ dp: 'khondji', chips: { realism: [1] } });   // Film grain + CA
  ok('gauge suppresses the Film grain chip',
    gaugeSet.indexOf('fine film grain, subtle chromatic aberration') === -1);
  const noGauge = emit({ dp: 'pfister', chips: { realism: [1] } });
  ok('Film grain chip emits when no gauge claimed Camera:',
    noGauge.indexOf('fine film grain, subtle chromatic aberration') !== -1);
  const ana = emit({ dp: 'pfister', chips: { lensformat: 1, realism: [2] } });   // Lens flare
  ok('anamorphic suppresses the Lens flare chip', ana.indexOf('gentle lens flare') === -1);
  ok('anamorphic emits its artifact list once',
    ana.split('2x anamorphic squeeze').length - 1 === 1);
  const anaBoth = emit({ dp: 'pfister', camMode: 'auto', chips: { lensformat: 1, campick: 4 } });
  ok('anamorphic never emitted twice when both controls say so',
    anaBoth.split('2x anamorphic squeeze').length - 1 === 1);
  ok('campick contributes nothing else when it implied anamorphic',
    anaBoth.indexOf('filmic colour grade') === -1);
  // The 35mm collision: the lens is always qualified so it can never read as a gauge.
  const both = emit({ lens: '35', dp: 'khondji', chips: {} });
  ok('lens is qualified as "35mm lens", never bare', both.indexOf('35mm lens') !== -1);
  ok('gauge is qualified as "35mm film stock"', both.indexOf('35mm film stock') !== -1);
  // camMode scopes which control is live — both would otherwise emit.
  ok('specific mode reads cambody, not campick',
    emit({ camMode: 'specific', dp: 'khondji', chips: {} }).indexOf('filmic colour grade') === -1);
  ok('auto mode reads campick, not cambody',
    emit({ camMode: 'auto', dp: 'khondji', chips: {} }).indexOf('film stock') === -1);
}

// ── G. Look mode — never read a stale s.dp ──
{
  const feel = emit({ lookMode: 'feel', camMode: 'auto', dp: 'khondji', chips: { feel: 1 } });
  ok('By-feel emits none of the stale dp look language',
    feel.indexOf('high-contrast chiaroscuro') === -1 && feel.indexOf('sodium-vapour') === -1);
  ok('By-feel emits its own §5 wording',
    feel.indexOf('contre-jour backlight, camera on shadow side') !== -1);
  const none = emit({ lookMode: 'feel', camMode: 'auto', dp: 'khondji', chips: {} });
  ok('By-feel with nothing picked contributes no look, and does NOT fall back to dp',
    none.indexOf('high-contrast chiaroscuro') === -1 && none.indexOf('contre-jour') === -1);
  // FEEL is keyed by label, so reordering OPTS.feel must not change the output.
  const before = emit({ lookMode: 'feel', camMode: 'auto', chips: { feel: 1 } });
  const orig = PC.OPTS.feel.slice();
  PC.OPTS.feel.reverse();
  const after = emit({ lookMode: 'feel', camMode: 'auto', chips: { feel: PC.OPTS.feel.findIndex((o) => o.label === 'Moody & contrasty') } });
  PC.OPTS.feel.length = 0; orig.forEach((o) => PC.OPTS.feel.push(o));
  ok('FEEL keyed by label, not index (survives an OPTS.feel reorder)', before === after);
  // Nostalgic film describes a capture medium, so it claims Camera: not Lighting:.
  const nost = emit({ lookMode: 'feel', camMode: 'auto', chips: { feel: 6 } });
  ok('Nostalgic film emits halation into Camera:', nost.indexOf('gentle halation') !== -1);
  ok('Nostalgic film references the highlights when no practical is lit',
    nost.indexOf('gentle halation around the highlights') !== -1);
  const nostPrac = emit({ lookMode: 'feel', camMode: 'auto', chips: { feel: 6, light: [3] } });
  ok('Nostalgic film references the practicals once slot 2 introduced them',
    nostPrac.indexOf('gentle halation around the practicals') !== -1);
  ok('Practical drops the unsourceable bracket', nostPrac.indexOf('Practical sources only') !== -1
    && nostPrac.indexOf('[') === -1);
}

// ── H. Rule 9 — People-scoped language never reaches an ungated slot ──
{
  const prod = emit({ dp: 'young', chips: { type: 1 } });     // young's note has skin-tone language
  const prod2 = emit({ dp: 'morrison', chips: { type: 1 } }); // so does morrison's
  const SKIN = /skin|complexion|pore|vellus|capillary|micro-expression|breath|eye-line|catch-light|reacting|unposed/i;
  ok('Product shot: no skin/performance/identity language anywhere (young)', !SKIN.test(prod));
  ok('Product shot: no skin/performance/identity language anywhere (morrison)', !SKIN.test(prod2));
  ok('Product shot still gets its look palette', prod2.indexOf('lived-in colour') !== -1);
  ok('People shot does get the gated constants', SKIN.test(emit({ dp: 'young', chips: { type: 0 } })));
}

// ── I. Acting: base never pruned; gate 2 touches the append, not the chip ──
{
  const posed = emit({ dp: 'anderson', chips: { type: 0 } });
  const plain = emit({ dp: 'khondji', chips: { type: 0 } });
  const BASE = 'Hollywood — micro-pauses before reactions, precise eye-line, living eyes with catch-lights, chest rise from breathing.';
  ok('Acting base emitted verbatim for a posed look', posed.indexOf(BASE) !== -1);
  ok('Acting base emitted verbatim for an unposed look', plain.indexOf(BASE) !== -1);
  ok('posed look suppresses only the appended sentence',
    posed.indexOf('Characters never standing') === -1 && plain.indexOf('Characters never standing') !== -1);
  ok('anderson is the only posed look', Object.keys(PC.seedanceLooks())
    .filter((k) => PC.seedanceLooks()[k].posed).join(',') === 'anderson');
  ok('anderson contributes planimetric staging to Style:, not Composition:',
    /Style:[^\n]*planimetric staging/.test(posed) && !/Composition:[^\n]*planimetric/.test(posed));
  // An explicit chip is never discarded by a gate reading a different control.
  const candid = emit({ dp: 'anderson', chips: { type: 0, realism: [10] } });
  ok('gate 2 does NOT suppress an explicitly clicked Candid / unposed',
    candid.indexOf('Candid, unposed') !== -1);
}

// ── J. Realism extras — all eleven disposed as tabled ──
{
  const at = (i, over) => emit(Object.assign({ chips: Object.assign({ type: 0, realism: [i] }, (over || {}).chips) }, over || {}));
  ok('realism: Motion blur drops (shutter constant covers it)',
    at(0).split('180° shutter').length - 1 === 1 && at(0).indexOf('natural motion blur') === -1);
  ok('realism: Visible breath drops (Acting carries it)', at(3).split('breathing').length - 1 === 1);
  ok('realism: Dust particles → Physics', /Physics:[^\n]*Drifting dust particles/.test(at(4)));
  ok('realism: Bokeh + parallax drops (depth always set)', at(5).indexOf('bokeh') === -1);
  ok('realism: Wet ground → Physics', /Physics:[^\n]*Wet ground holds reflections/.test(at(6)));
  ok('realism: Cloth physics → Physics', /Physics:[^\n]*Cloth and hair carry their own mass/.test(at(7)));
  ok('realism: Micro-texture drops rather than inventing a string',
    at(8).indexOf('micro-texture') === -1 && at(8).indexOf('Fine surface') === -1);
  ok('realism: Natural imperfections reuses the corpus ✓ no-AI-gloss wording',
    /Style:[^\n]*No AI gloss/.test(at(9)) && at(9).indexOf('plastic sheen') === -1);
  ok('realism: Candid / unposed → Acting', /Acting:[^\n]*Candid, unposed/.test(at(10)));
}

// ── K. purpose → the CUT header justification ──
{
  const hdr = (p, over) => {
    const o = emit(Object.assign({ purpose: p }, over || {}));
    return (o.match(/^CUT 1 — (.*):$/m) || [])[1] || '';
  };
  ok('purpose: establishing', hdr('establishing').indexOf('so the geography of the space reads clearly') !== -1);
  ok('purpose: insert is rewritten with no hole', hdr('insert').indexOf('so the detail holds at this scale') !== -1);
  ok('purpose: product detail is rewritten with no hole',
    hdr('product detail').indexOf('so the material and finish read clearly') !== -1);
  ok('purpose: match action omits in v1', hdr('match action').indexOf('so ') === -1);
  ok('purpose: transition omits', hdr('transition').indexOf('so ') === -1);
  ok('purpose: cutaway interpolates the subject',
    hdr('cutaway').indexOf('so Marco, mid-30s, charcoal work jacket reads clearly') !== -1);
  ok('purpose: cutaway with no subject omits rather than emitting a placeholder',
    hdr('cutaway', { subject: '' }).indexOf('so ') === -1);
  ok('purpose: unset omits', hdr('').indexOf('so ') === -1);
  ok('purpose: final wide asserts no framing',
    hdr('final wide').indexOf('wide') === -1 && hdr('final wide').indexOf("resolved state") !== -1);
  // Every store purpose is either mapped or deliberately omitted — no silent gaps.
  const vocab = (STORE.slice(STORE.indexOf('var SHOT_PURPOSES'), STORE.indexOf('// A plan predating'))
    .replace(/\/\/[^\n]*/g, '')            // comments quote purpose names too
    .match(/'([^']+)'/g) || []).map((x) => x.replace(/'/g, ''));
  const OMITTED = ['match action', 'transition'];
  const unmapped = vocab.filter((p) => OMITTED.indexOf(p) === -1 && hdr(p).indexOf('so ') === -1);
  ok('every purpose is mapped or explicitly omitted (' + unmapped.join(', ') + ')', unmapped.length === 0);
}

// ── L. cameraIntent never reaches the prompt ──
{
  const out = emit({});
  ok('cameraIntent text appears nowhere in the emitted prompt',
    out.indexOf('THE-JUSTIFICATION-PROSE') === -1);
  ok('the counterfactual half especially never reaches it', out.indexOf('master wide 24mm') === -1);
  ok('purpose IS read by the compile path', src('promptcompile.js').indexOf('PURPOSE_X') !== -1
    && emit({ purpose: 'reaction' }).indexOf('so the face through the beat reads clearly') !== -1);
}

// ── M. References: handles, roles, and the attachment note ──
{
  const refs = [REF('r1', 'Maya (Loop lead)', 'character', 'mid-30s, cropped dark hair'),
                REF('r2', 'Paper bag', 'prop', 'kraft, creased'),
                REF('r3', 'Warm restaurant — birthday dinner (night)', 'location'),
                REF('r4', 'Filmic', 'look')];
  const out = emit({ chips: { type: 0 } }, { refs: refs });
  ok('handle: parentheticals stripped', out.indexOf('MAYA (@maya)') !== -1);
  ok('handle: em-dash suffix stripped', out.indexOf('(@warm-restaurant)') !== -1);
  ok('handle: paired with its description, always',
    out.indexOf('MAYA (@maya) — mid-30s, cropped dark hair') !== -1);
  ok('role: character → Characters:', /Characters:[^\n]*@maya/.test(out));
  ok('role: location → Scene:', /Scene:[^\n]*@warm-restaurant/.test(out));
  ok('role: prop → the CUT body', /Paper bag \(@paper-bag\)/.test(out.slice(out.indexOf('CUT 1'))));
  ok('handle collisions get a numeric suffix', emit({ chips: { type: 0 } }, {
    refs: [REF('a', 'Maya (lead)', 'character'), REF('b', 'Maya (double)', 'character')]
  }).indexOf('@maya-2') !== -1);
  ok('atHandle is untouched for the other models',
    PC.summarize === undefined && src('promptcompile.js').indexOf("function atHandle") !== -1);
  // Characters: gates on attachment, NOT on subject type (decision #15).
  ok('Characters: emits on a Product shot when a character is attached',
    emit({ chips: { type: 1 } }, { refs: [refs[0]] }).indexOf('Characters:') !== -1);
  ok('Characters: absent when nothing is attached', emit({ chips: { type: 0 } }).indexOf('Characters:') === -1);
  // The attachment-order note is handoff text and must never be inside the prompt.
  const note = PC.videoNote(shot(), { model: 'higgsfield', refs: refs });
  ok('note lists every reference in order',
    note === 'Attach in this order: 1 Maya (Loop lead) · 2 Paper bag · 3 Warm restaurant — birthday dinner (night) · 4 Filmic');
  ok('note is NOT inside the prompt', out.indexOf('Attach in this order') === -1);
  ok('note empty for other models', PC.videoNote(shot(), { model: 'kling', refs: refs }) === '');
  ok('note empty with no refs', PC.videoNote(shot(), { model: 'higgsfield', refs: [] }) === '');
}

// ── N. The adapter emits no negatives — the downstream tail owns them ──
{
  ok('adapter emits no Avoid: block', emit({}).indexOf('Avoid:') === -1);
  ok('adapter never reads s.negative', emit({}).indexOf('a second bag') === -1
    && emit({ negative: 'SENTINEL-BAN' }).indexOf('SENTINEL-BAN') === -1);
  ok('exactly one Avoid: construction site remains in the builder',
    (PB.match(/' Avoid: '/g) || []).length === 1);
  ok('the continuity tails skip the video half for Seedance',
    PB.indexOf('if (!seedance && has(compiled.video)) compiled.video += clause;') !== -1);
  ok('weaveReferences keeps the woven stills but not the woven video',
    PB.indexOf('seedance ? { stills: woven.stills, video: compiled.video } : woven') !== -1);
}

// ── O. The look table is DERIVED — every phrase verbatim in its dpTraits note ──
{
  const notes = {};
  (PB.slice(PB.indexOf("{ id:'deakins'"), PB.indexOf("id:'villeneuve'") + 400)
    .match(/id:'([a-z]+)', label:'[^']*', note:'([^']*)'/g) || []).forEach((m) => {
    const p = /id:'([a-z]+)', label:'[^']*', note:'([^']*)'/.exec(m);
    notes[p[1]] = p[2];
  });
  ok('parsed all ten dpTraits notes', Object.keys(notes).length === 10);
  const LOOKS = PC.seedanceLooks();
  let stale = [];
  Object.keys(LOOKS).forEach((id) => {
    ['lighting', 'palette', 'style'].forEach((f) => {
      (LOOKS[id][f] || []).forEach((frag) => {
        if (!notes[id] || notes[id].indexOf(frag) === -1) stale.push(id + '.' + f + ':' + frag);
      });
    });
  });
  ok('every look-table phrase is verbatim from its note (' + stale.join(', ') + ')', stale.length === 0);
  const DROPPED = ['wide lenses', 'roaming long takes', 'handheld intimacy', 'large-format clarity',
    'textured grain', 'gentle halation', 'crisp anamorphic contrast', 'in-camera realism',
    'rich skin tones on darker complexions', 'documentary-true skin tones'];
  const all = Object.keys(LOOKS).map((id) =>
    [].concat(LOOKS[id].lighting || [], LOOKS[id].palette || [], LOOKS[id].style || []).join(' ')).join(' ');
  const leaked = DROPPED.filter((d) => all.indexOf(d) !== -1);
  ok('none of the ten dropped phrases leaked in (' + leaked.join(', ') + ')', leaked.length === 0);
  ok('the look never contributes composition', !/composition|symmetry|centred subjects|negative space|framing|monolithic scale/i.test(all));
  ok('every look carries a body default', Object.keys(LOOKS).every((id) => !!LOOKS[id].body));

  // Three-way id drift guard: LOOK_LABELS ↔ dpTraits() ↔ the adapter table.
  const labelIds = (STORE.slice(STORE.indexOf('var LOOK_LABELS'), STORE.indexOf('function resolveLook'))
    .match(/: '([a-z]+)'/g) || []).map((x) => x.replace(/[:' ]/g, ''));
  ok('LOOK_LABELS covers all ten looks (villeneuve was the omission)', labelIds.length === 10);
  ok('drift: every dpTraits id is in LOOK_LABELS',
    Object.keys(notes).every((id) => labelIds.indexOf(id) !== -1));
  ok('drift: every dpTraits id is in the adapter table',
    Object.keys(notes).every((id) => !!LOOKS[id]));
  ok('drift: no orphan in the adapter table',
    Object.keys(LOOKS).every((id) => !!notes[id]));
}

// ── P. Model collapse — one chip, one id, stored shots coerced ──
{
  ok('the separate Seedance profile is gone', PB.indexOf("id:'seedance'") === -1);
  ok('higgsfield relabelled for both', PB.indexOf("label:'Seedance / Cinema Studio'") !== -1);
  ok('the retired id coerces on load', PB.indexOf("seedance: 'higgsfield'") !== -1);
  ok('aisetup no longer offers Seedance separately',
    src('aisetup.html').indexOf('value="seedance"') === -1);
  ok('VIDEO_TAILS.seedance is unreachable and gone',
    src('promptcompile.js').indexOf("seedance: 'Technical: 24fps") === -1);
  ok('usesAtTags still keys off higgsfield, so handles now fire for both',
    PB.indexOf("this.state.videoModel === 'higgsfield' && this.state.atTags !== false") !== -1);
  // The old ungated People language in VIDEO_TAILS.higgsfield is gone with it.
  ok('the ungated skin language in the old tail no longer reaches a product shot',
    emit({ chips: { type: 1 } }).indexOf('pore-level skin realism') === -1);
}

// ── Q. CHIP_OPTS is the single source the UI reads too ──
{
  ok('CHIP_OPTS exported', !!PC.CHIP_OPTS && !!PC.CHIP_OPTS.type && !!PC.CHIP_OPTS.cambody);
  ['type', 'campick', 'cambody', 'lensformat', 'ar'].forEach((g) => {
    ok('UI reads CHIP_OPTS for ' + g, PB.indexOf("this.chipOpts('" + g + "')") !== -1);
  });
  ok('no inline chip literal survives in the builder',
    PB.indexOf("{label:'People'}") === -1 && PB.indexOf("{label:'Filmic', on:true}") === -1
    && PB.indexOf("{label:'Spherical', on:true}") === -1 && PB.indexOf("{label:'16:9', on:true}") === -1
    && PB.indexOf("['ARRI Alexa 35','RED V-Raptor'") === -1);
  ok('cambody keeps its computed per-look default in the UI',
    PB.indexOf("o.label === presetBody") !== -1);
  ok('chipOpts helper exists', PB.indexOf('chipOpts(name) {') !== -1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
