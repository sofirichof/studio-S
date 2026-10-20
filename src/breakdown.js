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

  // Start the breakdown as a shell-side job (survives navigation). Resolves
  // the job id. Progress arrives as "breakdown-progress" {jobId, chars} events
  // and through status().
  function start(opts) {
    opts = opts || {};
    var t = tauri();
    if (!t) return Promise.reject(new Error('Breakdown runs in the Studio S desktop app only.'));
    var apiKey = String(opts.apiKey || '').trim();
    if (!apiKey) return Promise.reject(new Error('No Claude API key — add one in AI setup.'));
    var req;
    try { req = buildRequest(opts); } catch (e) { return Promise.reject(e); }
    return t.core.invoke('breakdown_start', { apiKey: apiKey, body: req.body, betas: req.betas });
  }
  function status(jobId) {
    var t = tauri();
    if (!t) return Promise.resolve(null);
    return t.core.invoke('breakdown_status', { id: jobId });
  }
  // Turn a finished job into a plan, or a clear error.
  function finish(job) {
    job = job || {};
    if (job.status === 'error') throw new Error(job.error || 'The breakdown failed.');
    if (job.stop_reason === 'refusal') throw new Error('Claude declined to break this one down.');
    if (job.stop_reason === 'max_tokens') throw new Error('The plan ran past the output limit — split the script and try again.');
    var plan = parsePlan(job.text);
    return { plan: plan, text: job.text, stopReason: job.stop_reason || '', usage: job.usage || null };
  }
  // Run to completion from one page: start, then poll until done.
  // onProgress({ chars }) fires as output streams in. Resolves finish(job).
  function run(opts) {
    opts = opts || {};
    return start(opts).then(function (jobId) {
      return new Promise(function (resolve, reject) {
        var tick = function () {
          status(jobId).then(function (job) {
            if (!job) return reject(new Error('The breakdown job vanished.'));
            if (job.status === 'running') {
              try { if (opts.onProgress) opts.onProgress({ chars: job.chars || 0 }); } catch (e) {}
              setTimeout(tick, opts.pollMs || 700);
              return;
            }
            try { resolve(finish(job)); } catch (e) { reject(e); }
          }, reject);
        };
        tick();
      });
    });
  }

  window.Breakdown = { MODEL: MODEL, MAX_TOKENS: MAX_TOKENS, buildRequest: buildRequest, parsePlan: parsePlan, start: start, status: status, finish: finish, run: run };
})();
