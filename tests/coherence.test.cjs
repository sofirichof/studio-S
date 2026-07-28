// Camera/look coherence checks. Run: node tests/coherence.test.cjs
const fs = require('fs');
const path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'coherence.js'), 'utf8'));
const C = global.window.Coherence;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }
const rules = b => C.checkShot(b).map(f => f.rule);
// Severity of one rule, or '' when the rule did not fire — so a disabled rule
// reports a clean failure instead of throwing on undefined.
const sev = (b, rule) => (C.checkShot(b).find(f => f.rule === rule) || {}).severity || '';
// The app's real defaults — every case below starts from what a user actually
// gets, because two of these defects only appear in the default state.
const dflt = b => Object.assign({
  comp: 'mc', shot: 'wide', angle: 'eye', lens: '24',
  move: 'push', depth: 'shallow', framing: [], chips: {}
}, b);

// ── A clean shot trips nothing ──
ok('default shot is clean', rules(dflt({})).length === 0);
ok('empty builder does not throw', Array.isArray(C.checkShot()) && C.checkShot().length === 0);

// ── deep focus + bokeh: direct contradiction, spans two tabs ──
{
  const b = dflt({ depth: 'deep', chips: { realism: ['Bokeh + parallax'] } });
  ok('deep + bokeh is caught', rules(b).indexOf('depth-bokeh') !== -1);
  ok('deep + bokeh is an error, not a nudge', sev(b, 'depth-bokeh') === 'error');
  ok('shallow + bokeh is fine',
    rules(dflt({ depth: 'shallow', chips: { realism: ['Bokeh + parallax'] } })).indexOf('depth-bokeh') === -1);
  ok('deep alone is fine', rules(dflt({ depth: 'deep' })).indexOf('depth-bokeh') === -1);
  ok('other realism chips do not false-positive',
    rules(dflt({ depth: 'deep', chips: { realism: ['Lens flare', 'Wet ground'] } })).indexOf('depth-bokeh') === -1);
}

// ── 85mm + deep + insert distance: physically impossible ──
{
  ok('85mm + deep + extreme is caught',
    rules(dflt({ lens: '85', depth: 'deep', shot: 'extreme' })).indexOf('lens-depth-distance') !== -1);
  ok('85mm + deep + close is caught',
    rules(dflt({ lens: '85', depth: 'deep', shot: 'close' })).indexOf('lens-depth-distance') !== -1);
  ok('85mm + deep on a WIDE is not flagged (distance makes it possible)',
    rules(dflt({ lens: '85', depth: 'deep', shot: 'wide' })).indexOf('lens-depth-distance') === -1);
  ok('24mm + deep + extreme is fine',
    rules(dflt({ lens: '24', depth: 'deep', shot: 'extreme' })).indexOf('lens-depth-distance') === -1);
  ok('85mm + shallow + extreme is fine',
    rules(dflt({ lens: '85', depth: 'shallow', shot: 'extreme' })).indexOf('lens-depth-distance') === -1);
}

// ── centre + negative space: fires on the DEFAULT comp ──
{
  ok('negative space on the default centre comp is caught',
    rules(dflt({ framing: ['Negative space'] })).indexOf('comp-negative-space') !== -1);
  ok('negative space off-centre is fine',
    rules(dflt({ comp: 'ml', framing: ['Negative space'] })).indexOf('comp-negative-space') === -1);
  ok('centre without negative space is fine',
    rules(dflt({ framing: ['ots'] })).indexOf('comp-negative-space') === -1);
}

// ── aerial + angle: informational, since the join now suppresses it ──
{
  const b = dflt({ shot: 'aerial', angle: 'low' });
  ok('aerial + a real angle is noted', rules(b).indexOf('aerial-angle-ignored') !== -1);
  ok('it is info, not a warning — nothing is broken', sev(b, 'aerial-angle-ignored') === 'info');
  ok('aerial on the default eye angle is silent (there is nothing to tell)',
    rules(dflt({ shot: 'aerial' })).indexOf('aerial-angle-ignored') === -1);
}

// ── Findings contract matches continuity.js so one renderer can take both ──
{
  const f = C.checkShot(dflt({ depth: 'deep', chips: { realism: ['Bokeh + parallax'] } }))[0];
  ok('a finding was produced to inspect', !!f);
  ok('finding has rule/message/severity', !!(f && f.rule && f.message && f.severity));
  ok('message says what to do about it',
    !!f && /Drop one|Use a shorter|Move the placement|no effect/.test(f.message));
}

// ── Drift: the bokeh chip label must still exist in promptcompile ──
{
  const pc = fs.readFileSync(path.join(__dirname, '..', 'src', 'promptcompile.js'), 'utf8');
  ok('the bokeh chip label still exists in the realism group',
    pc.indexOf("'" + C.BOKEH_CHIP + "'") !== -1);
  ok('deep focus still compiles to a front-to-back clause',
    pc.indexOf('deep focus, sharp from front to back') !== -1);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
