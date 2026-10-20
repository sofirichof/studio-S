// Studio S — intake: a folder becomes a project with a plan. Exposes window.Intake.
//
// This is the app's front door. Drop a folder anywhere in the window (nav.js
// forwards the drop), or click New project and pick one: the folder becomes
// the project, the script inside it is read, and the breakdown starts on its
// own as a shell-side job. The job survives navigation — every page calls
// resume() on load — and Home shows its state on the project card. When it
// finishes, the plan is imported through the same importer the handoff uses.
//
// State lives in Store ui.intake:
//   { state, projectId, folder, scriptName, jobId, startedAt, chars, error, shots }
//   state: running | done | error | no-script | no-key | has-shots
(function () {
  'use strict';

  var POLL_MS = 1000;
  var polling = null;

  function tauri() {
    var t = window.__TAURI__;
    return (t && t.core && t.core.invoke) ? t : null;
  }
  function basename(p) { return String(p || '').split('/').filter(Boolean).pop() || 'Untitled project'; }
  function page() { return (window.location.pathname || '').split('/').pop() || ''; }
  function go(target) {
    if (page() === target) { announce(); return; }
    window.location.href = target;
  }
  // Pages that render the state (Home) listen for this instead of polling the store.
  function announce() {
    try { window.dispatchEvent(new window.CustomEvent('intake-changed', { detail: state() })); } catch (e) {}
  }
  function state() { return (window.Store && window.Store.getIntake) ? window.Store.getIntake() : null; }
  function set(patch) { var s = window.Store.setIntake(patch); announce(); return s; }
  function totalShots(p) {
    var n = 0;
    (p && p.concepts || []).forEach(function (c) { (c.scenes || []).forEach(function (s) { n += (s.shots || []).length; }); });
    return n;
  }
  // Real shots only: a new project carries one empty placeholder (label 1A,
  // no name, empty builder), which must not count as "already planned".
  function shotCount(p) {
    var n = 0;
    (p && p.concepts || []).forEach(function (c) {
      (c.scenes || []).forEach(function (s) {
        (s.shots || []).forEach(function (sh) {
          var b = sh.builder || {};
          if ((sh.name && String(sh.name).trim()) || b.subject || b.action || b.environment) n++;
        });
      });
    });
    return n;
  }

  // The project for a folder: reuse the one already attached to it, else create.
  function projectFor(dir) {
    var p = (window.Store.listProjects() || []).filter(function (x) { return x.assetsFolder === dir; })[0];
    if (!p) {
      var settings = window.Store.getSettings ? window.Store.getSettings() : {};
      p = window.Store.createProject({ name: basename(dir), assetsFolder: dir, outputFolder: settings.defaultOutputFolder || '' });
    }
    window.Store.setActive({ projectId: p.id });
    return p;
  }

  // Folder picker → start. Outside the app, falls back to the page that can
  // at least take a pasted script.
  function pick() {
    var t = tauri();
    if (!(t && t.dialog && t.dialog.open)) { window.location.href = 'newproject.html'; return Promise.resolve(false); }
    return t.dialog.open({ directory: true, multiple: false }).then(function (r) {
      var dir = typeof r === 'string' ? r : '';
      if (!dir) return false;
      return start(dir);
    });
  }

  // A dropped or chosen path (folder, or a script file: its parent is the folder).
  function start(path) {
    var t = tauri();
    if (!t || !window.Store) return Promise.resolve(false);
    var cur = state();
    if (cur && cur.state === 'running') {
      // One at a time. The card on Home says what's running.
      go('home.html');
      return Promise.resolve(false);
    }
    return t.core.invoke('read_script_files', { path: path }).then(function (info) {
      var dir = info.dir || path;
      var files = info.files || [];
      var p = projectFor(dir);
      if (shotCount(p) > 0) {
        // Already planned. Open it; a fresh breakdown would double the shots.
        set({ state: 'has-shots', projectId: p.id, folder: dir, shots: shotCount(p), jobId: null, error: null });
        go('home.html');
        return true;
      }
      if (!files.length) {
        set({ state: 'no-script', projectId: p.id, folder: dir, jobId: null, error: null });
        go('home.html');
        return true;
      }
      var settings = window.Store.getSettings ? window.Store.getSettings() : {};
      if (!settings.claudeApiKey) {
        set({ state: 'no-key', projectId: p.id, folder: dir, scriptName: files[0].name, jobId: null, error: null });
        go('home.html');
        return true;
      }
      var system = window.PlanInstructions.build(dir, null, { mode: 'api' });
      return window.Breakdown.start({
        apiKey: settings.claudeApiKey, system: system, script: files[0].content,
        projectName: p.name, folder: dir
      }).then(function (jobId) {
        set({ state: 'running', projectId: p.id, folder: dir, scriptName: files[0].name, jobId: jobId, startedAt: Date.now(), chars: 0, error: null });
        go('home.html');
        resume();
        return true;
      });
    }).catch(function (e) {
      set({ state: 'error', error: (e && e.message) || String(e), jobId: null });
      go('home.html');
      return false;
    });
  }

  // Called on every page load. If a job is running, follow it to the end and
  // import the plan the moment it finishes — whichever page the user is on.
  function resume() {
    var t = tauri();
    var s = state();
    if (!t || !s || s.state !== 'running' || !s.jobId || polling) return;
    if (t.event && t.event.listen) {
      t.event.listen('breakdown-progress', function (e) {
        var pl = (e && e.payload) || {};
        if (pl.jobId === s.jobId) set({ chars: pl.chars || 0, tail: pl.tail || '' });
      }).catch(function () {});
    }
    var tick = function () {
      window.Breakdown.status(s.jobId).then(function (job) {
        var now = state();
        if (!now || now.jobId !== s.jobId) { polling = null; return; }
        if (!job) { polling = null; set({ state: 'error', error: 'The breakdown job is gone — the app may have restarted. Drop the folder again.', jobId: null }); return; }
        if (job.status === 'running') {
          if ((job.chars || 0) !== (now.chars || 0)) set({ chars: job.chars || 0, tail: job.tail || '' });
          else announce(); // nothing new in the stream: still let the card breathe (rotating phrases, elapsed)
          polling = setTimeout(tick, POLL_MS); return;
        }
        polling = null;
        try {
          var res = window.Breakdown.finish(job);
          window.Store.scaffoldFromPlan(now.projectId, JSON.stringify(res.plan));
          var p = window.Store.getProject(now.projectId);
          // The finished count is everything the plan put in, cutdown pointers included.
          set({ state: 'done', shots: totalShots(p), jobId: null, error: null });
        } catch (e) {
          set({ state: 'error', error: (e && e.message) || String(e), jobId: null });
        }
      }, function (e) {
        polling = null;
        set({ state: 'error', error: (e && e.message) || String(e), jobId: null });
      });
    };
    polling = setTimeout(tick, 0);
  }

  function dismiss() { window.Store.setIntake(null); announce(); }

  // What the model is writing right now, read off the tail of the stream. The
  // plan is JSON, so the most recent "name" says where it is: a shot label
  // ("1B · …"), a scene, or a concept (followed by its "kind"). Before any
  // text arrives, a slow rotation of what the work actually is.
  var PHRASES = ['Reading the script', 'Finding the concepts', 'Blocking the scenes', 'Choosing the coverage', 'Directing the shots'];
  function liveLine(tail, startedAt) {
    var t = String(tail || '');
    var names = [], re = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g, m;
    while ((m = re.exec(t))) names.push({ name: m[1], at: m.index });
    var last = names[names.length - 1];
    if (last) {
      var after = t.slice(last.at);
      var sm = last.name.match(/^(\d+[A-Z])\s*(?:[\u00B7\-\u2014:]\s*)?(.*)$/);
      if (sm) return 'Shot ' + sm[1] + (sm[2] ? ' \u00B7 ' + sm[2] : '');
      if (/"kind"\s*:/.test(after)) return 'Concept \u00B7 ' + last.name;
      return 'Scene \u00B7 ' + last.name;
    }
    if (/"descriptions"/.test(t)) return 'Describing the characters and places';
    if (/"todos"/.test(t)) return 'Writing the production steps';
    var i = Math.floor(Math.max(0, Date.now() - (Number(startedAt) || Date.now())) / 2500) % PHRASES.length;
    return PHRASES[i];
  }

  // "3 min ago"-style elapsed label for the running state.
  function elapsed(startedAt) {
    var ms = Math.max(0, Date.now() - (Number(startedAt) || Date.now()));
    var sec = Math.round(ms / 1000);
    return sec < 60 ? sec + 's' : Math.floor(sec / 60) + ' min ' + (sec % 60) + 's';
  }

  // The card state Home renders for the intake's project. Plain HTML, the
  // page's own styles; actions carry data-intake="…" and Home routes them.
  function cardHtml(s) {
    s = s || state();
    if (!s) return '';
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; }); };
    var folder = s.folder ? '<span style="color:#9A9AA8;">' + esc(basename(s.folder)) + '</span>' : '';
    if (s.state === 'running') {
      var toks = Math.round((s.chars || 0) / 4);
      var line = liveLine(s.tail, s.startedAt);
      return '<div data-intake-card="running" style="margin-top:14px;">' +
        '<div style="display:flex;align-items:center;gap:10px;min-height:22px;">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:#0217D3;flex-shrink:0;animation:sg-pulse 1.2s ease-in-out infinite;"></span>' +
          '<span data-intake-live="' + esc(line) + '" style="font-size:15px;font-weight:500;color:#16161D;letter-spacing:-0.005em;animation:sg-in .4s ease;">' + esc(line) + '</span>' +
        '</div>' +
        '<div style="position:relative;height:4px;background:#ECEDF0;border-radius:999px;overflow:hidden;margin-top:12px;">' +
          '<div style="position:absolute;top:0;left:0;height:100%;width:34%;background:linear-gradient(90deg,rgba(2,23,211,0),#0217D3,rgba(2,23,211,0));border-radius:999px;animation:sg-shimmer 1.6s ease-in-out infinite;"></div>' +
        '</div>' +
        '<p style="font-size:11px;color:#9A9AA8;margin-top:8px;">Breaking down ' + esc(s.scriptName || 'the script') + (toks ? ' \u00B7 ' + toks.toLocaleString() + ' tokens' : '') + ' \u00B7 ' + elapsed(s.startedAt) + ' \u00B7 keep working, this finishes on its own</p>' +
        '<style>@keyframes sg-pulse{0%,100%{opacity:1}50%{opacity:.3}}@keyframes sg-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}@keyframes sg-shimmer{0%{left:-34%}100%{left:100%}}</style>' +
      '</div>';
    }
    if (s.state === 'done') {
      return '<div data-intake-card="done" style="margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
        '<span style="font-size:13px;color:#1D9E75;font-weight:500;">✓ ' + (s.shots || 0) + ' shot' + (s.shots === 1 ? '' : 's') + ' planned from ' + esc(s.scriptName || 'the script') + '</span>' +
        '<a href="#" data-intake="open" style="font-size:13px;color:#0217D3;font-weight:500;text-decoration:none;">Open the shot list →</a>' +
        '<a href="#" data-intake="dismiss" style="font-size:12px;color:#9A9AA8;text-decoration:none;margin-left:auto;">Dismiss</a>' +
      '</div>';
    }
    if (s.state === 'has-shots') {
      return '<div data-intake-card="has-shots" style="margin-top:12px;font-size:13px;color:#5A5A6B;">This folder is already planned (' + (s.shots || 0) + ' shots). ' +
        '<a href="#" data-intake="open" style="color:#0217D3;font-weight:500;text-decoration:none;">Open the shot list →</a>' +
        ' <a href="#" data-intake="dismiss" style="font-size:12px;color:#9A9AA8;text-decoration:none;margin-left:10px;">Dismiss</a></div>';
    }
    if (s.state === 'no-script') {
      return '<div data-intake-card="no-script" style="margin-top:12px;font-size:13px;color:#9A5B00;">No script in ' + folder + ' — it looks for .txt, .md and .fountain files. Add one and drop the folder again, ' +
        '<a href="#" data-intake="retry" style="color:#0217D3;font-weight:500;text-decoration:none;">or pick it now →</a>' +
        ' <a href="#" data-intake="dismiss" style="font-size:12px;color:#9A9AA8;text-decoration:none;margin-left:10px;">Dismiss</a></div>';
    }
    if (s.state === 'no-key') {
      return '<div data-intake-card="no-key" style="margin-top:12px;font-size:13px;color:#9A5B00;">Found ' + esc(s.scriptName || 'the script') + '. Breaking it down needs your Claude API key: ' +
        '<a href="aisetup.html" style="color:#0217D3;font-weight:500;text-decoration:none;">add it in AI setup →</a> then drop the folder again.' +
        ' <a href="#" data-intake="dismiss" style="font-size:12px;color:#9A9AA8;text-decoration:none;margin-left:10px;">Dismiss</a></div>';
    }
    if (s.state === 'error') {
      return '<div data-intake-card="error" style="margin-top:12px;font-size:13px;color:#FF002E;">' + esc(s.error || 'The breakdown failed.') + ' ' +
        (s.folder ? '<a href="#" data-intake="retry" style="color:#0217D3;font-weight:500;text-decoration:none;">Try again →</a>' : '') +
        ' <a href="#" data-intake="dismiss" style="font-size:12px;color:#9A9AA8;text-decoration:none;margin-left:10px;">Dismiss</a></div>';
    }
    return '';
  }

  // Route a click on one of the card's actions.
  function act(name) {
    var s = state();
    if (name === 'dismiss') { dismiss(); return; }
    if (name === 'open') {
      if (s && s.projectId) { window.Store.setActive({ projectId: s.projectId }); try { window.sessionStorage.setItem('sg-open-overview', s.projectId); } catch (e) {} }
      dismiss(); window.location.href = 'projects.html'; return;
    }
    if (name === 'retry') { if (s && s.folder) start(s.folder); }
  }

  window.Intake = { pick: pick, start: start, resume: resume, state: state, cardHtml: cardHtml, act: act, dismiss: dismiss, liveLine: liveLine };
})();
