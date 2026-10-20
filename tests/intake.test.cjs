// Intake verification: a folder becomes a project with a plan, as a
// shell-side job that any page can resume. Run: node tests/intake.test.cjs
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const PLAN = { concepts: [{ name: 'Hero', kind: 'video', scenes: [{ name: 'S1', shots: [{ label: '1A', name: '1A · Open' }, { label: '1B', name: '1B · Close' }] }] }] };

// A page's worth of window: real store/breakdown/planinstructions/reftemplates,
// stubbed Tauri shell and location.
function makeWindow(opts) {
  opts = opts || {};
  const mem = {};
  const calls = [];
  let statusSeq = opts.statusSeq || [];
  let si = 0;
  const win = {
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
    sessionStorage: { _m: {}, getItem(k) { return k in this._m ? this._m[k] : null; }, setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; } },
    location: { pathname: opts.pathname || '/src/home.html', href: '' },
    addEventListener() {}, dispatchEvent(e) { calls.push(['event', e.type]); return true; },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    __TAURI__: opts.noTauri ? undefined : {
      core: { invoke: async (cmd, args) => {
        calls.push([cmd, args]);
        if (cmd === 'read_script_files') { if (opts.readThrows) throw new Error(opts.readThrows); return opts.intake || { dir: '/P/Elevator pitch', files: [{ name: 'script.md', content: 'INT. ELEVATOR' }] }; }
        if (cmd === 'breakdown_start') return 'bd_7';
        if (cmd === 'breakdown_status') { const j = statusSeq[Math.min(si, statusSeq.length - 1)]; si++; return j === undefined ? null : j; }
        return null;
      } },
      dialog: { open: async () => (opts.pick === undefined ? '/P/Elevator pitch' : opts.pick) },
      event: { listen: async (name, cb) => { calls.push(['listen', name]); return () => {}; } }
    }
  };
  if (opts.noTauri) delete win.__TAURI__;
  const run = (file) => (new Function('window', 'document', src(file)))(win, undefined);
  run('store.js'); run('breakdown.js'); run('reftemplates.js'); run('planinstructions.js'); run('intake.js');
  if (opts.key) win.Store.setSettings({ claudeApiKey: opts.key });
  return { win, calls, mem };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // ── A. a folder with a script and a key → project + running job → Home ──
  {
    const { win, calls } = makeWindow({ key: 'sk-ant-x', pathname: '/src/projects.html' });
    const r = await win.Intake.start('/P/Elevator pitch');
    const st = win.Store.getIntake();
    const p = win.Store.listProjects()[0];
    ok('start: project created from the folder name, folder attached, active', r === true && p && p.name === 'Elevator pitch' && p.assetsFolder === '/P/Elevator pitch' && win.Store.getActive().projectId === p.id);
    ok('start: job started with the API-mode instructions and the folder script', calls.some((c) => c[0] === 'breakdown_start' && /ONE JSON document/.test(c[1].body.system[0].text) && /INT\. ELEVATOR/.test(c[1].body.messages[0].content)));
    ok('start: state running with job id + script name', st && st.state === 'running' && st.jobId === 'bd_7' && st.scriptName === 'script.md' && st.projectId === p.id);
    ok('start: goes to Home from another page', win.location.href === 'home.html');
    // dropping the same folder again while running does nothing new
    const n = calls.filter((c) => c[0] === 'breakdown_start').length;
    await win.Intake.start('/P/Elevator pitch');
    ok('start: one job at a time', calls.filter((c) => c[0] === 'breakdown_start').length === n);
  }
  // ── B. resume follows the job and imports the plan ──
  {
    const { win } = makeWindow({ key: 'sk-ant-x', statusSeq: [{ status: 'running', chars: 800 }, { status: 'done', chars: 3000, text: JSON.stringify(PLAN), stop_reason: 'end_turn' }] });
    await win.Intake.start('/P/Elevator pitch');
    await wait(1300);
    const st = win.Store.getIntake();
    const p = win.Store.getProject(st.projectId);
    const shots = p.concepts.reduce((n, c) => n + c.scenes.reduce((m, s) => m + s.shots.length, 0), 0);
    ok('resume: plan imported into the project', shots === 2 && p.concepts[0].name === 'Hero');
    ok('resume: state done with the shot count', st.state === 'done' && st.shots === 2 && st.jobId === null);
    ok('cardHtml: done offers the shot list', /Open the shot list/.test(win.Intake.cardHtml(st)) && /data-intake="open"/.test(win.Intake.cardHtml(st)));
    win.Intake.act('open');
    ok('act open: lands on the project overview', win.location.href === 'projects.html' && win.sessionStorage.getItem('sg-open-overview') === p.id && win.Store.getIntake() === null);
  }
  // ── C. resume surfaces a failed job ──
  {
    const { win } = makeWindow({ key: 'sk-ant-x', statusSeq: [{ status: 'error', error: 'Anthropic API error 529: overloaded' }] });
    await win.Intake.start('/P/Elevator pitch');
    await wait(100);
    const st = win.Store.getIntake();
    ok('resume: job error → state error with the message', st.state === 'error' && /529/.test(st.error));
    ok('cardHtml: error offers retry', /data-intake="retry"/.test(win.Intake.cardHtml(st)));
  }
  // ── D. no script in the folder ──
  {
    const { win, calls } = makeWindow({ key: 'sk-ant-x', intake: { dir: '/P/Empty', files: [] } });
    await win.Intake.start('/P/Empty');
    const st = win.Store.getIntake();
    ok('no-script: project still created, no job', st.state === 'no-script' && win.Store.listProjects().length === 1 && !calls.some((c) => c[0] === 'breakdown_start'));
    ok('cardHtml: no-script says what it looks for', /\.fountain/.test(win.Intake.cardHtml(st)));
  }
  // ── E. no API key ──
  {
    const { win, calls } = makeWindow({});
    await win.Intake.start('/P/Elevator pitch');
    const st = win.Store.getIntake();
    ok('no-key: project created, no job, points at AI setup', st.state === 'no-key' && st.scriptName === 'script.md' && !calls.some((c) => c[0] === 'breakdown_start') && /aisetup\.html/.test(win.Intake.cardHtml(st)));
  }
  // ── F. already planned folder → open, don't double the shots ──
  {
    const { win, calls } = makeWindow({ key: 'sk-ant-x' });
    const p = win.Store.createProject({ name: 'Elevator pitch', assetsFolder: '/P/Elevator pitch' });
    win.Store.scaffoldFromPlan(p.id, JSON.stringify(PLAN));
    await win.Intake.start('/P/Elevator pitch');
    const st = win.Store.getIntake();
    ok('has-shots: reuses the project, starts nothing', st.state === 'has-shots' && st.projectId === p.id && win.Store.listProjects().length === 1 && !calls.some((c) => c[0] === 'breakdown_start'));
  }
  // ── G. errors reading the path ──
  {
    const { win } = makeWindow({ key: 'sk-ant-x', readThrows: "Can't read that path" });
    await win.Intake.start('/nope');
    ok('read error → state error', win.Store.getIntake().state === 'error' && /read that path/.test(win.Store.getIntake().error));
  }
  // ── H. pick(): folder dialog in the app, the page outside it ──
  {
    const { win, calls } = makeWindow({ key: 'sk-ant-x' });
    await win.Intake.pick();
    ok('pick: dialog → start', calls.some((c) => c[0] === 'read_script_files' && c[1].path === '/P/Elevator pitch'));
    const w2 = makeWindow({ noTauri: true });
    await w2.win.Intake.pick();
    ok('pick: outside the app falls back to the page', w2.win.location.href === 'newproject.html');
    const w3 = makeWindow({ key: 'k', pick: null });
    ok('pick: cancelled dialog does nothing', (await w3.win.Intake.pick()) === false && w3.win.Store.listProjects().length === 0);
  }
  // ── I. source contracts: the drop works everywhere, Home routes the card ──
  {
    const nav = src('nav.js');
    ok('nav: window-wide drop overlay feeds Intake.start', nav.indexOf("'tauri://drag-drop'") !== -1 && nav.indexOf('Intake.start(paths[0])') !== -1 && nav.indexOf('sg-drop-overlay') !== -1);
    ok('nav: resumes a running job on every page', nav.indexOf('Intake.resume()') !== -1);
    const home = src('home.html');
    ok('home: New project picks a folder', home.indexOf('Intake.pick()') !== -1 && home.indexOf("act === 'new'") !== -1);
    ok('home: hero shows the intake card and routes its actions', home.indexOf('Intake.cardHtml(intake)') !== -1 && home.indexOf("Intake.act(el.getAttribute('data-intake'))") !== -1 && home.indexOf("'intake-changed'") !== -1);
    ok('home: the dropped folder\'s project is the one shown', home.indexOf('Store.getProject(intake.projectId)') !== -1);
    const pages = fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => f.endsWith('.html') && src(f).indexOf('<script src="./nav.js"></script>') !== -1);
    const missing = pages.filter((f) => { const h = src(f); const iNav = h.indexOf('<script src="./nav.js">'); return ['breakdown.js', 'reftemplates.js', 'planinstructions.js', 'intake.js'].some((n) => { const i = h.indexOf('<script src="./' + n + '">'); return i === -1 || i > iNav; }); });
    ok('every sidebar page loads the intake stack before nav.js (' + pages.length + ' pages)', missing.length === 0 || (console.log('   missing on: ' + missing.join(', ')), false));
    const pj = src('projects.html');
    ok('projects: honours the open-overview handoff', pj.indexOf("sessionStorage.getItem('sg-open-overview')") !== -1 && pj.indexOf('this.openOverview(want)') !== -1);
    const pi = src('planinstructions.js');
    ok('planinstructions: shared, with the api mode', pi.indexOf('window.PlanInstructions = { build: build }') !== -1 && pi.indexOf('Respond with the plan as ONE JSON document') !== -1 && pi.indexOf('this.') === -1);
    const st = src('store.js');
    ok('store: ui.intake accessors', st.indexOf('getIntake: getIntake, setIntake: setIntake') !== -1);
  }
  // ── J. the live line narrates the stream ──
  {
    const { win } = makeWindow({});
    const L = win.Intake.liveLine;
    ok('live: shot label + name', L('..."shots": [{"label": "1B", "name": "1B \u00B7 Hand on the door handle", "subject": "') === 'Shot 1B \u00B7 Hand on the door handle');
    ok('live: scene name', L('"scenes": [{"name": "Elevator car, floor 45 \u2014 the rehearsal", "shots": [') === 'Scene \u00B7 Elevator car, floor 45 \u2014 the rehearsal');
    ok('live: concept name (followed by kind)', L('{"concepts": [{"name": "Elevator Pitch \u2014 45s hero", "kind": "video",') === 'Concept \u00B7 Elevator Pitch \u2014 45s hero');
    ok('live: descriptions block', L('"descriptions": [{"kind": "character", "facts": {') === 'Describing the characters and places');
    ok('live: before any text → rotating phrases', L('', Date.now()) === 'Reading the script' && L('', Date.now() - 2600) === 'Finding the concepts');
    const card = win.Intake.cardHtml({ state: 'running', scriptName: 'script.md', startedAt: Date.now(), chars: 9600, tail: '"name": "2A \u00B7 Doors part"' });
    ok('card: running shows the live line big, the numbers small, and an indeterminate bar', /Shot 2A \u00B7 Doors part/.test(card) && /sg-shimmer/.test(card) && /2,400 tokens/.test(card) && card.indexOf('tokens of plan so far') === -1);
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
main();
