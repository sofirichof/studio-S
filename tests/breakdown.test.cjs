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

// ── C. run() against a stubbed shell ──
async function runChecks() {
  const plan = { concepts: [{ name: 'Hero', kind: 'video', scenes: [] }] };
  const mk = (result, opts) => {
    const calls = []; let listeners = {};
    const win = { __TAURI__: {
      core: { invoke: async (cmd, args) => { calls.push([cmd, args]); if (listeners['anthropic-stream']) listeners['anthropic-stream']({ payload: { chars: 1200 } }); return typeof result === 'function' ? result() : result; } },
      event: { listen: async (name, cb) => { listeners[name] = cb; return () => { delete listeners[name]; }; } }
    } };
    if (opts && opts.noEvent) delete win.__TAURI__.event;
    return { B: load(win), calls, listeners };
  };
  let m = mk({ text: JSON.stringify(plan), stop_reason: 'end_turn', usage: { output_tokens: 10 } });
  const progress = [];
  let out = await m.B.run({ apiKey: 'sk-ant-test', system: 'S', script: 'A script.', onProgress: (p) => progress.push(p.chars) });
  ok('run: invokes the streaming proxy with key, body and betas', m.calls[0][0] === 'anthropic_messages_stream' && m.calls[0][1].apiKey === 'sk-ant-test' && m.calls[0][1].body.model === 'claude-opus-5-5' && m.calls[0][1].betas);
  ok('run: returns the parsed plan + stop reason + usage', out.plan.concepts[0].name === 'Hero' && out.stopReason === 'end_turn' && out.usage.output_tokens === 10);
  ok('run: progress events reach the page', progress.length === 1 && progress[0] === 1200);
  ok('run: stream listener removed afterwards', Object.keys(m.listeners).length === 0);
  m = mk({ text: '{}', stop_reason: 'max_tokens' });
  let err = null; try { await m.B.run({ apiKey: 'k', system: 'S', script: 'x' }); } catch (e) { err = e; }
  ok('run: max_tokens is a clear error', err && /output limit/.test(err.message));
  m = mk({ text: '', stop_reason: 'refusal' });
  err = null; try { await m.B.run({ apiKey: 'k', system: 'S', script: 'x' }); } catch (e) { err = e; }
  ok('run: refusal is a clear error', err && /declined/.test(err.message));
  m = mk(() => { throw new Error('Anthropic API error 401: bad key'); });
  err = null; try { await m.B.run({ apiKey: 'k', system: 'S', script: 'x' }); } catch (e) { err = e; }
  ok('run: proxy errors propagate and the listener is cleaned up', err && /401/.test(err.message) && Object.keys(m.listeners).length === 0);
  m = mk({ text: JSON.stringify(plan), stop_reason: 'end_turn' }, { noEvent: true });
  out = await m.B.run({ apiKey: 'k', system: 'S', script: 'x' });
  ok('run: works without the event API (no progress)', out.plan.concepts.length === 1);
  err = null; try { await load().run({ apiKey: 'k', system: 'S', script: 'x' }); } catch (e) { err = e; }
  ok('run: outside Tauri → clear error', err && /desktop app/.test(err.message));
  err = null; try { await mk({}).B.run({ apiKey: '', system: 'S', script: 'x' }); } catch (e) { err = e; }
  ok('run: missing key → points at AI setup', err && /AI setup/.test(err.message));
}

// ── D. New-project page contract: folder → script → Break down, Claude as follow-on ──
{
  const np = fs.readFileSync(path.join(__dirname, '..', 'src', 'newproject.html'), 'utf8');
  const iDrop = np.indexOf('id="np-drop"');
  const iScript = np.indexOf('id="np-script"');
  const iBreak = np.indexOf('id="breakdown-btn"');
  const iClaude = np.indexOf('id="claude-panel"');
  const iFallback = np.indexOf('<details id="plan-fallback"');
  ok('page: drop zone, then script, then Break down, then the Claude card, then the fallback',
    iDrop !== -1 && iScript !== -1 && iBreak !== -1 && iClaude !== -1 && iFallback !== -1 && iDrop < iScript && iScript < iBreak && iBreak < iClaude && iClaude < iFallback);
  ok('page: Break down is wired', np.indexOf('onclick="{{ breakdown }}"') !== -1 && np.indexOf('Breakdown.run(') !== -1);
  ok('page: dropped path goes through read_script_files', np.indexOf("tauri://drag-drop") !== -1 && np.indexOf("invoke('read_script_files'") !== -1);
  ok('page: plan is imported through the existing importer', np.indexOf('Store.scaffoldFromPlan(') !== -1);
  ok('page: no key → points at AI setup', np.indexOf('aisetup.html') !== -1);
  ok('page: loads breakdown.js', np.indexOf('<script src="./breakdown.js"></script>') !== -1);
  ok('page: api mode tells the model to answer with the JSON alone', np.indexOf('Respond with the plan as ONE JSON document') !== -1);
  ok('page: file-writing handoff text still exists for the fallback', np.indexOf('Write the plan as JSON to:') !== -1);
  const rs = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'lib.rs'), 'utf8');
  ok('rust: streaming proxy + script reader registered', /generate_handler!\[[^\]]*anthropic_messages_stream[^\]]*read_script_files/.test(rs));
  ok('rust: stream parses text deltas, stop reason, emits progress', rs.indexOf('content_block_delta') !== -1 && rs.indexOf('stop_reason') !== -1 && rs.indexOf('"anthropic-stream"') !== -1);
  ok('rust: betas header optional on both proxies', (rs.match(/anthropic-beta/g) || []).length >= 2);
}

runChecks().then(() => {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
});
