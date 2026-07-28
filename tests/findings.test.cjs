// The shared findings renderer. Run: node tests/findings.test.cjs
const fs = require('fs');
const path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'findings.js'), 'utf8'));
const F = global.window.Findings;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }

const err = { rule: 'depth-bokeh', message: 'Contradiction.', severity: 'error', controls: ['depth', 'realism'] };
const wrn = { rule: 'comp-negative-space', message: 'Pulls against itself.', severity: 'warn', controls: ['comp'] };
const inf = { rule: 'aerial-angle-ignored', message: 'No effect here.', severity: 'info', controls: ['angle'] };
// Continuity findings carry a shotLabel and NO controls — the other shape.
const cont = { rule: 'continuity-offcamera', message: 'No off-camera note.', severity: 'warn', shotLabel: '1B' };

// ── Counting: info never inflates the number on a badge ──
{
  const c = F.count([err, wrn, inf]);
  ok('counts each severity', c.error === 1 && c.warn === 1 && c.info === 1);
  ok('info is excluded from the total', c.total === 2);
  ok('empty input is safe', F.count([]).total === 0 && F.count().total === 0);
  ok('an unknown severity is treated as a warning', F.count([{ severity: 'nonsense' }]).warn === 1);
}

// ── Badge and dot appear only when there is something to act on ──
{
  ok('no badge when there is nothing but info', F.badge([inf]) === '');
  ok('no badge when empty', F.badge([]) === '');
  ok('badge shows the total', F.badge([err, wrn]).indexOf('>2<') !== -1);
  ok('badge goes red when any finding is an error', F.badge([err, wrn]).indexOf('#FF002E') !== -1);
  ok('badge stays amber with warnings only', F.badge([wrn]).indexOf('#9A5B00') !== -1);
  ok('no dot when there is nothing but info', F.dot([inf]) === '');
  ok('dot appears for a real finding', F.dot([wrn]).length > 0);
}

// ── Rendering ──
{
  ok('renders nothing when there are no findings', F.render([]) === '' && F.render() === '');

  const html = F.render([wrn, err, inf], { title: 'Worth checking' });
  ok('errors sort above warnings', html.indexOf('Contradiction.') < html.indexOf('Pulls against itself.'));
  ok('info sorts last', html.indexOf('No effect here.') > html.indexOf('Pulls against itself.'));
  ok('the title renders', html.indexOf('Worth checking') !== -1);
  ok('compact drops the heading', F.render([wrn], { title: 'X', compact: true }).indexOf('X') === -1);
  ok('info is muted, not shouted', html.indexOf('#9A9AA8') !== -1);

  // The dangling-separator bug: a shotLabel with no controls rendered "1B · —".
  const contHtml = F.render([cont]);
  ok('a shot-label finding shows its label', contHtml.indexOf('1B') !== -1);
  // Match on the pattern, not one exact spelling — the bug rendered "1B ·  —"
  // with a double space, which an indexOf('1B · —') check sails straight past.
  ok('no dangling separator when controls are absent', !/·\s*—/.test(contHtml));
  ok('no dangling separator when the label is absent', !/·\s*—/.test(F.render([wrn])));
  ok('both parts join cleanly when both exist',
    F.render([Object.assign({}, cont, { controls: ['depth'] })]).indexOf('1B · depth —') !== -1);

  // Findings text is user/model-authored — it must not be able to inject markup.
  const nasty = F.render([{ rule: 'x', severity: 'warn', message: '<img src=x onerror=alert(1)>' }]);
  ok('message is escaped', nasty.indexOf('<img') === -1 && nasty.indexOf('&lt;img') !== -1);
  ok('shotLabel is escaped',
    F.render([{ rule: 'x', severity: 'warn', message: 'm', shotLabel: '<b>' }]).indexOf('<b>') === -1);
}

// ── Both validators really do emit the same contract ──
{
  eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'coherence.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'continuity.js'), 'utf8'));
  const coh = global.window.Coherence.checkShot({ depth: 'deep', chips: { realism: ['Bokeh + parallax'] } });
  const con = global.window.Continuity.checkScene({ shots: [{ label: '1A', builder: {} }] }, []);
  ok('coherence findings render', F.render(coh).length > 0);
  ok('continuity findings render', F.render(con).length > 0);
  ok('one renderer takes both', F.render(coh.concat(con)).length > F.render(coh).length);
  ok('mixed findings count correctly', F.count(coh.concat(con)).total === coh.length + con.length);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
