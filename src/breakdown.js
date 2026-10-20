// Studio S — in-app breakdown: script in, plan out. Exposes window.Breakdown.
//
// The one place the app calls a model at runtime. It asks Claude for the same
// plan JSON the "Plan with Claude" handoff produces (same instructions, same
// importer downstream), through the Rust proxy in src-tauri/src/lib.rs so the
// API key never leaves the shell. Streams so a long plan (a 30-shot project is
// ~25k output tokens) neither times out nor sits silent.
//
// It does NOT write shot prompts — the plan carries facts; PromptCompile still
// composes every prompt (README hard rule 2). Reference sheets are the one
// exception the instructions already make.
(function () {
  'use strict';

  var MODEL = 'claude-opus-5-5';
  var MAX_TOKENS = 48000;
  // Server-side refusal fallback: if the model declines (rare for a script),
  // the API re-runs the request on a fallback model inside the same call.
  var BETAS = 'server-side-fallback-2026-07-01';

  function tauri() {
    var t = window.__TAURI__;
    return (t && t.core && t.core.invoke) ? t : null;
  }

  // The Messages API request. `system` is the planning instructions (long and
  // stable → cached); the script rides in the user turn.
  function buildRequest(opts) {
    opts = opts || {};
    var script = String(opts.script || '').trim();
    if (!script) throw new Error('No script or brief to break down.');
    var head = [];
    if (opts.projectName) head.push('Project: ' + opts.projectName);
    if (opts.folder) head.push('Assets folder: ' + opts.folder);
    var user = (head.length ? head.join('\n') + '\n\n' : '') + 'SCRIPT / BRIEF:\n\n' + script;
    return {
      betas: BETAS,
      body: {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: 'high' },
        fallbacks: 'default',
        system: [{ type: 'text', text: String(opts.system || ''), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }]
      }
    };
  }

  // The model is told to answer with the JSON document alone, but a stray
  // sentence or a code fence must not sink the import.
  function parsePlan(text) {
    var s = String(text || '');
    var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1];
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a === -1 || b === -1 || b <= a) throw new Error('The response held no JSON plan.');
    var plan;
    try { plan = JSON.parse(s.slice(a, b + 1)); }
    catch (e) { throw new Error('The plan came back as invalid JSON: ' + e.message); }
    if (!plan || typeof plan !== 'object') throw new Error('The plan is not an object.');
    if (!Array.isArray(plan.concepts) && !Array.isArray(plan.scenes)) throw new Error('The plan has no concepts or scenes.');
    return plan;
  }

  // Run the breakdown. Resolves { plan, text, stopReason, usage }.
  // onProgress({ chars }) fires as output streams in.
  function run(opts) {
    opts = opts || {};
    var t = tauri();
    if (!t) return Promise.reject(new Error('Breakdown runs in the Studio S desktop app only.'));
    var apiKey = String(opts.apiKey || '').trim();
    if (!apiKey) return Promise.reject(new Error('No Claude API key — add one in AI setup.'));
    var req = buildRequest(opts);
    var unlisten = null;
    var listening = (t.event && t.event.listen)
      ? t.event.listen('anthropic-stream', function (e) {
          try { if (opts.onProgress) opts.onProgress(e.payload || {}); } catch (err) {}
        }).then(function (fn) { unlisten = fn; })
      : Promise.resolve();
    return listening.then(function () {
      return t.core.invoke('anthropic_messages_stream', { apiKey: apiKey, body: req.body, betas: req.betas });
    }).then(function (res) {
      if (unlisten) { try { unlisten(); } catch (e) {} }
      res = res || {};
      if (res.stop_reason === 'refusal') throw new Error('Claude declined to break this one down.');
      if (res.stop_reason === 'max_tokens') throw new Error('The plan ran past the output limit — split the script and try again.');
      var plan = parsePlan(res.text);
      return { plan: plan, text: res.text, stopReason: res.stop_reason || '', usage: res.usage || null };
    }, function (err) {
      if (unlisten) { try { unlisten(); } catch (e) {} }
      throw err;
    });
  }

  window.Breakdown = { MODEL: MODEL, MAX_TOKENS: MAX_TOKENS, buildRequest: buildRequest, parsePlan: parsePlan, run: run };
})();
