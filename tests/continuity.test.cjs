// Phase 3 step B1 — structural continuity validator. Run: node tests/continuity.test.cjs
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
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'continuity.js'), 'utf8'));
const Continuity = global.window.Continuity;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }

// Default fixture models an IMPORTED shot — purpose is only required of those.
function shot(label, b) {
  return { id: 'sh_' + label, label: label, source: 'plan', builder: Object.assign({
    subject: '', action: '', environment: '', offCamera: '', propState: '', purpose: '',
    shot: 'wide', lens: '24', angle: 'eye', depth: 'shallow', move: 'static'
  }, b) };
}

// ── A deliberately broken scene that must trip every rule ──
{
  const scene = {
    name: 'Broken scene',
    shots: [
      shot('1A', { purpose: 'establishing', subject: 'A man enters the room', action: 'He crosses to the window.' }),
      shot('1B', { purpose: 'establishing', subject: 'A woman waits', action: 'She waits, then leaves.', propState: 'bag packed' }),
      shot('1C', { purpose: '', subject: 'A hand lifts the cup', offCamera: 'someone off frame' }),
      shot('1D', { purpose: 'not-a-real-purpose', subject: 'Final beat', offCamera: 'x', propState: 'y' })
    ]
  };
  const findings = Continuity.checkScene(scene, ['Marco']);
  const rules = findings.map(f => f.rule);
  ['continuity-offcamera', 'continuity-propstate', 'purpose-missing', 'purpose-vocab',
    'establishing-once', 'establishing-first', 'camera-repetition', 'coverage-balance',
    'action-sequence', 'character-unaccounted'
  ].forEach(r => ok('trips ' + r, rules.indexOf(r) !== -1));

  ok('every finding has shotLabel/rule/message/severity keys', findings.every(f =>
    'shotLabel' in f && 'rule' in f && 'message' in f && 'severity' in f));
  ok('returns findings, does not render anything', typeof Continuity.checkScene(scene, []) === 'object' && Array.isArray(findings));
}

// ── A clean scene must not trip anything (no false positives) ──
{
  const scene = {
    name: 'Clean scene',
    shots: [
      shot('1A', { purpose: 'establishing', subject: 'Marco stands in the doorway', action: 'He hesitates.',
        offCamera: 'the clerk behind the counter, frame right', propState: 'bag full, held low',
        shot: 'wide', lens: '24', angle: 'eye', depth: 'shallow', move: 'static' }),
      shot('1B', { purpose: 'master', subject: 'Marco approaches the counter', action: 'He sets the bag down.',
        offCamera: 'the clerk still behind the counter', propState: 'bag now on the counter, still full',
        shot: 'medium', lens: '35', angle: 'eye', depth: 'shallow', move: 'push' }),
      shot('1C', { purpose: 'reaction', subject: 'The clerk looks up', action: 'Her eyes narrow.',
        offCamera: 'Marco just outside frame left, weight forward', propState: 'bag on the counter, unopened',
        shot: 'close', lens: '85', angle: 'eye', depth: 'shallow', move: 'static' })
    ]
  };
  const findings = Continuity.checkScene(scene, ['Marco']);
  ok('clean scene produces no findings', findings.length === 0);
}

// ── Drift guard: continuity.js's vocabulary must match store.js's ──
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'continuity.js'), 'utf8');
  const Store = global.window.Store;
  ok('continuity vocabulary matches Store.shotPurposes()',
    Store.shotPurposes().every(v => src.indexOf("'" + v + "'") !== -1));
}

// ── Hand-built shots are exempt from purpose-missing ──
// A director building a shot in the app holds the editorial intent in their
// head; the builder has no purpose control, so demanding one would be a
// permanent error nobody could clear.
{
  const handBuilt = { id: 'sh_x', label: '1A', builder: {
    subject: 'a', action: 'b', environment: 'c', offCamera: 'd', propState: 'e',
    purpose: '', shot: 'wide', lens: '24', angle: 'eye', depth: 'shallow', move: 'static'
  } };
  const rules = Continuity.checkScene({ name: 'S', shots: [handBuilt] }, [])
    .map(function (f) { return f.rule; });
  ok('hand-built shot is not nagged for a purpose', rules.indexOf('purpose-missing') === -1);

  const imported = Object.assign({}, handBuilt, { source: 'plan' });
  const impRules = Continuity.checkScene({ name: 'S', shots: [imported] }, [])
    .map(function (f) { return f.rule; });
  ok('an imported shot still is', impRules.indexOf('purpose-missing') !== -1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
