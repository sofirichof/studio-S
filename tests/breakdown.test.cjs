// In-app breakdown verification (src/breakdown.js + the New-project page
// contract). Run: node tests/breakdown.test.cjs
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }

function load(win) {
  const w = Object.assign({}, win || {});
  (new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'breakdown.js'), 'utf8')))(w);
  return w.Breakdown;
}

// ── A. request shape ──
{
  const B = load();
  const r = B.buildRequest({ system: 'PLAN INSTRUCTIONS', script: 'INT. ELEVATOR — DAY', projectName: 'Elevator pitch', folder: '/x/y' });
  ok('model is the current Opus', r.body.model === 'claude-opus-5-5');
  ok('streaming-sized max_tokens', r.body.max_tokens >= 32000);
  ok('effort set explicitly (Opus 5.5 defaults to medium)', r.body.output_config && r.body.output_config.effort === 'high');
  ok('no thinking budget / disabled (both 400 on Opus 5.5)', r.body.thinking === undefined);
  ok('refusal fallback on, with its beta', r.body.fallbacks === 'default' && r.betas === 'server-side-fallback-2026-07-01');
  ok('instructions are the cached system block', Array.isArray(r.body.system) && r.body.system[0].text === 'PLAN INSTRUCTIONS' && r.body.system[0].cache_control.type === 'ephemeral');
  ok('script rides in the user turn with project + folder', r.body.messages.length === 1 && r.body.messages[0].role === 'user'
    && r.body.messages[0].content.indexOf('Project: Elevator pitch') !== -1 && r.body.messages[0].content.indexOf('Assets folder: /x/y') !== -1
    && r.body.messages[0].content.indexOf('INT. ELEVATOR') !== -1);
  ok('no prefill (assistant turn) — removed on 4.6+', !r.body.messages.some((m) => m.role === 'assistant'));
  let threw = false; try { B.buildRequest({ system: 'x', script: '   ' }); } catch (e) { threw = true; }
  ok('empty script refused', threw);
}

// ── B. parsing ──
{
  const B = load();
  const plan = { concepts: [{ name: 'Hero', kind: 'video', scenes: [{ name: 'S1', shots: [{ label: '1A' }] }] }] };
  ok('bare JSON', B.parsePlan(JSON.stringify(plan)).concepts.length === 1);
  ok('fenced JSON', B.parsePlan('Here you go:\n```json\n' + JSON.stringify(plan) + '\n```\nDone.').concepts[0].name === 'Hero');
  ok('prose around JSON', B.parsePlan('Sure.\n' + JSON.stringify(plan) + '\nLet me know.').concepts[0].scenes[0].shots[0].label === '1A');
  ok('old scenes-only shape accepted', B.parsePlan(JSON.stringify({ scenes: [] })).scenes.length === 0);
  const bad = (t) => { try { B.parsePlan(t); return false; } catch (e) { return true; } };
  ok('no JSON → error', bad('no plan here'));
  ok('invalid JSON → error', bad('{"concepts": [,]}'));
  ok('JSON without plan keys → error', bad('{"hello": 1}'));
}

// ── C. start() / status() / run() against a stubbed shell (shell-side jobs) ──
async function runChecks() {
  const plan = { concepts: [{ name: 'Hero', kind: 'video', scenes: [] }] };
  // `seq` is the series of breakdown_status answers; the last one repeats.
  const mk = (seq, opts) => {
    const calls = []; let i = 0;
    const win = { __TAURI__: { core: { invoke: async (cmd, args) => {
      calls.push([cmd, args]);
      if (cmd === 'breakdown_start') { if (opts && opts.startThrows) throw new Error(opts.startThrows); return 'bd_1'; }
      if (cmd === 'breakdown_status') { const j = seq[Math.min(i, seq.length - 1)]; i++; return j; }
      return null;
    } } } };
    return { B: load(win), calls };
  };
  let m = mk([{ status: 'running', chars: 1200 }, { status: 'done', chars: 4000, text: JSON.stringify(plan), stop_reason: 'end_turn', usage: { output_tokens: 10 } }]);
  ok('start: returns the job id and sends key/body/betas', (await m.B.start({ apiKey: 'sk-ant-test', system: 'S', script: 'x' })) === 'bd_1'
    && m.calls[0][0] === 'breakdown_start' && m.calls[0][1].apiKey === 'sk-ant-test' && m.calls[0][1].body.model === 'claude-opus-5-5' && m.calls[0][1].betas);
  ok('status: reads the job', (await m.B.status('bd_1')).status === 'running');
  m = mk([{ status: 'running', chars: 1200 }, { status: 'done', chars: 4000, text: JSON.stringify(plan), stop_reason: 'end_turn', usage: { output_tokens: 10 } }]);
  const progress = [];
  let out = await m.B.run({ apiKey: 'sk-ant-test', system: 'S', script: 'A script.', pollMs: 5, onProgress: (p) => progress.push(p.chars) });
  ok('run: starts a job and polls it to the end', m.calls[0][0] === 'breakdown_start' && m.calls.filter((c) => c[0] === 'breakdown_status').length === 2);
  ok('run: returns the parsed plan + stop reason + usage', out.plan.concepts[0].name === 'Hero' && out.stopReason === 'end_turn' && out.usage.output_tokens === 10);
  ok('run: progress reaches the page while running', progress.length === 1 && progress[0] === 1200);
  let err = null; try { await mk([{ status: 'done', text: '{}', stop_reason: 'max_tokens' }]).B.run({ apiKey: 'k', system: 'S', script: 'x', pollMs: 5 }); } catch (e) { err = e; }
  ok('run: max_tokens is a clear error', err && /output limit/.test(err.message));
  err = null; try { await mk([{ status: 'done', text: '', stop_reason: 'refusal' }]).B.run({ apiKey: 'k', system: 'S', script: 'x', pollMs: 5 }); } catch (e) { err = e; }
  ok('run: refusal is a clear error', err && /declined/.test(err.message));
  err = null; try { await mk([{ status: 'error', error: 'Anthropic API error 401: bad key' }]).B.run({ apiKey: 'k', system: 'S', script: 'x', pollMs: 5 }); } catch (e) { err = e; }
  ok('run: a failed job surfaces its error', err && /401/.test(err.message));
  err = null; try { await mk([null]).B.run({ apiKey: 'k', system: 'S', script: 'x', pollMs: 5 }); } catch (e) { err = e; }
  ok('run: a vanished job is an error, not a hang', err && /vanished/.test(err.message));
  err = null; try { await mk([], { startThrows: 'Network error' }).B.run({ apiKey: 'k', system: 'S', script: 'x' }); } catch (e) { err = e; }
  ok('run: start failures propagate', err && /Network/.test(err.message));
  err = null; try { await load().run({ apiKey: 'k', system: 'S', script: 'x' }); } catch (e) { err = e; }
  ok('run: outside Tauri → clear error', err && /desktop app/.test(err.message));
  err = null; try { await mk([]).B.run({ apiKey: '', system: 'S', script: 'x' }); } catch (e) { err = e; }
  ok('run: missing key → points at AI setup', err && /AI setup/.test(err.message));
  ok('finish: done job → plan', m.B.finish({ status: 'done', text: JSON.stringify(plan), stop_reason: 'end_turn' }).plan.concepts.length === 1);
}

// ── D. New-project page contract: folder → script → Break down, Claude as follow-on ──
{
  const np = (fs.readFileSync(path.join(__dirname, '..', 'src', 'newproject.html'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'src', 'planinstructions.js'), 'utf8'));
  const iDrop = np.indexOf('id="np-drop"');
  const iFound = np.indexOf('id="np-script-found"');
  const iScript = np.indexOf('id="np-script"');
  const iBreak = np.indexOf('id="breakdown-btn"');
  const iClaude = np.indexOf('id="claude-panel"');
  const iFallback = np.indexOf('<details id="plan-fallback"');
  ok('page: drop zone, then the found-script line, then Break down, then the Claude card, then the fallback',
    iDrop !== -1 && iFound !== -1 && iBreak !== -1 && iClaude !== -1 && iFallback !== -1 && iDrop < iFound && iFound < iBreak && iBreak < iClaude && iClaude < iFallback);
  // The script comes from the folder; pasting is tucked away for folders without one.
  const iPaste = np.indexOf('<details id="np-paste"');
  ok('page: paste is a collapsed fallback, not a step', iPaste !== -1 && iScript > iPaste && iScript < np.indexOf('</details>', iPaste) && !/<details id="np-paste"[^>]*\sopen[\s>]/.test(np));
  ok('page: Break down reads the folder script unless something was pasted', np.indexOf('currentScript()') !== -1 && np.indexOf('const pasted = ') !== -1);
  ok('page: no-script-in-folder state opens the paste fallback', np.indexOf('No script found in that folder') !== -1);
  ok('page: Break down is wired', np.indexOf('onclick="{{ breakdown }}"') !== -1 && np.indexOf('Breakdown.run(') !== -1);
  ok('page: chosen folder goes through read_script_files', np.indexOf("invoke('read_script_files'") !== -1);
  ok('page: drops are handled window-wide by nav.js, not here', np.indexOf("tauri://drag-drop") === -1);
  ok('page: plan is imported through the existing importer', np.indexOf('Store.scaffoldFromPlan(') !== -1);
  ok('page: no key → points at AI setup', np.indexOf('aisetup.html') !== -1);
  ok('page: loads breakdown.js', np.indexOf('<script src="./breakdown.js"></script>') !== -1);
  ok('page: api mode tells the model to answer with the JSON alone', np.indexOf('Respond with the plan as ONE JSON document') !== -1);
  ok('page: file-writing handoff text still exists for the fallback', np.indexOf('Write the plan as JSON to:') !== -1);
  const rs = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'lib.rs'), 'utf8');
  ok('rust: streaming proxy, job runner + script reader registered', /generate_handler!\[[^\]]*anthropic_messages_stream[^\]]*breakdown_start[^\]]*breakdown_status[^\]]*read_script_files/.test(rs));
  ok('rust: jobs live in managed state and finish off the IPC', rs.indexOf('.manage(BreakdownJobs::default())') !== -1 && rs.indexOf('tauri::async_runtime::spawn') !== -1 && rs.indexOf('"breakdown-done"') !== -1);
  ok('rust: stream parses text deltas, stop reason, emits progress', rs.indexOf('content_block_delta') !== -1 && rs.indexOf('stop_reason') !== -1 && rs.indexOf('"anthropic-stream"') !== -1);
  ok('rust: betas header optional on both proxies', (rs.match(/anthropic-beta/g) || []).length >= 2);
}

runChecks().then(() => {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
});
