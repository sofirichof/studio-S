// Studio S — shared client data store (vanilla, no build step).
// Loaded before nav.js on every page. Exposes window.Store.
// Single localStorage document under KEY; one read/parse, one write/serialize.
(function () {
  var KEY = 'aifs.v1';
  var VERSION = 1;

  function now() { try { return Date.now(); } catch (e) { return 0; } }
  function newId(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }

  function _default() {
    return {
      version: VERSION,
      settings: {
        configured: false,
        claudeApiKey: '',
        defaultOutputFolder: '',
        defaultVideoModel: 'kling'
      },
      projects: [],
      references: [],
      ui: { activeProjectId: '', activeConceptId: '', activeShotId: '' }
    };
  }

  // Canonical per-shot builder defaults — the single source of truth that
  // promptbuilder.html seeds its fields from, so store and UI never drift.
  function defaultBuilder() {
    return {
      stillModel: 'gpt', videoModel: 'kling', density: 'few',
      lookMode: 'dp', camMode: 'specific', dp: 'deakins',
      comp: 'mc', shot: 'wide', angle: 'eye', lens: '24',
      move: 'push', depth: 'shallow', framing: [],
      subject: '', environment: '', look: '', notes: '', negative: '',
      prefixOverride: false,
      charRefIds: [], propRefIds: [], locRefId: null, styleRefId: null
    };
  }

  function load() {
    var raw;
    try { raw = window.localStorage.getItem(KEY); }
    catch (e) { return _default(); }
    if (!raw) return _default();
    try {
      var doc = JSON.parse(raw);
      if (!doc || typeof doc !== 'object') throw new Error('bad doc');
      // Shallow shape guard + forward-compat defaults.
      var d = _default();
      doc.version = doc.version || VERSION;
      doc.settings = Object.assign(d.settings, doc.settings || {});
      doc.projects = Array.isArray(doc.projects) ? doc.projects : [];
      doc.references = Array.isArray(doc.references) ? doc.references : [];
      doc.ui = Object.assign(d.ui, doc.ui || {});
      return doc;
    } catch (e) {
      // Don't wipe on corruption — back up the bad blob, return defaults.
      try { window.localStorage.setItem(KEY + '.bak', raw); } catch (e2) {}
      return _default();
    }
  }

  var lastSaveOk = true;
  function save(doc) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(doc));
      lastSaveOk = true;
    } catch (e) {
      // Don't fail silently — a full/unavailable store means the change is NOT
      // persisted and will vanish on reload. Surface it so callers can react.
      lastSaveOk = false;
      try { console.error('Studio S: could not save — storage full or unavailable. Changes may be lost on reload.', e); } catch (e2) {}
    }
    return doc;
  }

  // ── settings ──
  function getSettings() { return Object.assign({}, load().settings); }
  function setSettings(patch) {
    var doc = load();
    doc.settings = Object.assign(doc.settings, patch || {});
    // Saving a non-empty Claude key means the app is configured — this is the
    // gate the onboarding screen checks, so a saved key always stops the wizard
    // from reappearing on every launch.
    if (doc.settings.claudeApiKey) doc.settings.configured = true;
    save(doc);
    return Object.assign({}, doc.settings);
  }
  function isConfigured() {
    // The API key is optional at setup (addable later in AI setup), so the
    // launch gate is the flag alone — requiring the key here would loop
    // key-less users back into onboarding forever.
    return !!load().settings.configured;
  }
  function markConfigured() { return setSettings({ configured: true }); }

  // ── projects / concepts / shots ──
  function listProjects() { return load().projects; }
  function getProject(id) {
    return load().projects.filter(function (p) { return p.id === id; })[0] || null;
  }
  function createProject(opts) {
    opts = opts || {};
    var doc = load();
    var firstConceptId = newId('cpt');
    var firstShotId = newId('shot');
    var p = {
      id: newId('prj'),
      name: opts.name || 'Untitled project',
      assetsFolder: opts.assetsFolder || '',
      outputFolder: opts.outputFolder || doc.settings.defaultOutputFolder || '',
      createdAt: now(), updatedAt: now(),
      todos: [],
      concepts: [
        { id: firstConceptId, name: 'Concept 1',
          shots: [ { id: firstShotId, name: 'Shot 1', label: '1A', status: 'draft', builder: defaultBuilder() } ] }
      ]
    };
    doc.projects.push(p);
    doc.ui.activeProjectId = p.id;
    doc.ui.activeConceptId = firstConceptId;
    doc.ui.activeShotId = firstShotId;
    save(doc);
    return p;
  }
  function getStylePrefix(id) {
    var p = getProject(id);
    return (p && p.stylePrefix) || '';
  }
  function setStylePrefix(id, text) {
    return updateProject(id, { stylePrefix: text });
  }
  function updateProject(id, patch) {
    var doc = load();
    var p = doc.projects.filter(function (x) { return x.id === id; })[0];
    if (p) { Object.assign(p, patch || {}); p.updatedAt = now(); save(doc); }
    return p || null;
  }
  function deleteProject(id) {
    var doc = load();
    doc.projects = doc.projects.filter(function (x) { return x.id !== id; });
    doc.references = doc.references.filter(function (r) { return r.projectId !== id; });
    if (doc.ui.activeProjectId === id) {
      doc.ui.activeProjectId = ''; doc.ui.activeConceptId = ''; doc.ui.activeShotId = '';
    }
    save(doc);
  }

  function addConcept(projectId, opts) {
    var doc = load();
    var p = doc.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return null;
    var c = { id: newId('cpt'), name: (opts && opts.name) || ('Concept ' + (p.concepts.length + 1)), shots: [] };
    p.concepts.push(c); p.updatedAt = now(); save(doc);
    return c;
  }
  // Shot labels: concept number + letter — 1A, 1B, … 1Z, 1AA, 2A …
  function shotLetter(i) {
    var s = '';
    do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return s;
  }
  function shotLabel(conceptIndex, shotIndex) {
    return (conceptIndex + 1) + shotLetter(shotIndex);
  }
  function addShot(projectId, conceptId, opts) {
    opts = opts || {};
    var doc = load();
    var p = doc.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return null;
    var c = p.concepts.filter(function (x) { return x.id === conceptId; })[0];
    if (!c) return null;
    var ci = p.concepts.indexOf(c);
    var s = {
      id: newId('shot'),
      name: opts.name || ('Shot ' + (c.shots.length + 1)),
      label: opts.label || shotLabel(ci, c.shots.length),
      status: 'draft',
      builder: opts.builder || defaultBuilder()
    };
    c.shots.push(s); p.updatedAt = now();
    doc.ui.activeShotId = s.id; doc.ui.activeConceptId = c.id;
    save(doc);
    return s;
  }
  function renameShot(projectId, conceptId, shotId, name) {
    var doc = load();
    var p = doc.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return null;
    var c = p.concepts.filter(function (x) { return x.id === conceptId; })[0];
    if (!c) return null;
    var s = c.shots.filter(function (x) { return x.id === shotId; })[0];
    if (s) { s.name = name; p.updatedAt = now(); save(doc); }
    return s || null;
  }
  function updateShotBuilder(ids, builderPatch) {
    ids = ids || {};
    var doc = load();
    var p = doc.projects.filter(function (x) { return x.id === ids.projectId; })[0];
    if (!p) return null;
    var c = p.concepts.filter(function (x) { return x.id === ids.conceptId; })[0];
    if (!c) return null;
    var s = c.shots.filter(function (x) { return x.id === ids.shotId; })[0];
    if (!s) return null;
    s.builder = Object.assign(s.builder || defaultBuilder(), builderPatch || {});
    p.updatedAt = now(); save(doc);
    return s;
  }

  // ── project to-dos (scaffolded from the AI-handoff plan; user-toggleable) ──
  function listTodos(projectId) {
    var p = getProject(projectId);
    return (p && Array.isArray(p.todos)) ? p.todos : [];
  }
  function toggleTodo(projectId, index) {
    var doc = load();
    var p = doc.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p || !Array.isArray(p.todos) || !p.todos[index]) return null;
    p.todos[index].done = !p.todos[index].done;
    p.updatedAt = now(); save(doc);
    return p.todos[index];
  }

  // ── references ──
  function listReferences(projectId) {
    return load().references.filter(function (r) {
      return projectId ? r.projectId === projectId : true;
    });
  }
  function addReference(projectId, opts) {
    opts = opts || {};
    var doc = load();
    var r = {
      id: newId('ref'), projectId: projectId,
      name: opts.name || 'Untitled', kind: opts.kind || 'character',
      note: opts.note || '', shotCount: 0, createdAt: now(),
      fields: opts.fields || {},        // per-kind wizard answers
      prompt: opts.prompt || '',        // compiled generator-ready prompt
      imagePath: opts.imagePath || ''   // path to externally generated result image
    };
    doc.references.push(r); save(doc);
    return r;
  }
  function getReference(refId) {
    return load().references.filter(function (r) { return r.id === refId; })[0] || null;
  }
  function updateReference(refId, patch) {
    var doc = load();
    var r = doc.references.filter(function (x) { return x.id === refId; })[0];
    if (!r) return null;
    ['name', 'kind', 'note', 'fields', 'prompt', 'imagePath'].forEach(function (k) {
      if (patch[k] !== undefined) r[k] = patch[k];
    });
    save(doc);
    return r;
  }
  function deleteReference(refId) {
    var doc = load();
    var before = doc.references.length;
    doc.references = doc.references.filter(function (r) { return r.id !== refId; });
    if (doc.references.length === before) return false;
    // Un-attach from any shot builder that points at it.
    doc.projects.forEach(function (p) {
      (p.concepts || []).forEach(function (c) {
        (c.shots || []).forEach(function (s) {
          var b = s.builder;
          if (!b) return;
          if (b.locRefId === refId) b.locRefId = null;
          if (b.styleRefId === refId) b.styleRefId = null;
          ['charRefIds', 'propRefIds'].forEach(function (k) {
            if (Array.isArray(b[k])) b[k] = b[k].filter(function (id) { return id !== refId; });
          });
        });
      });
    });
    save(doc);
    return true;
  }

  // ── active selection (validated against current data) ──
  function getActive() {
    var doc = load();
    var p = doc.projects.filter(function (x) { return x.id === doc.ui.activeProjectId; })[0] || doc.projects[0] || null;
    var c = null, s = null;
    if (p) {
      c = p.concepts.filter(function (x) { return x.id === doc.ui.activeConceptId; })[0] || p.concepts[0] || null;
      if (c) s = c.shots.filter(function (x) { return x.id === doc.ui.activeShotId; })[0] || c.shots[0] || null;
    }
    return {
      projectId: p ? p.id : '', conceptId: c ? c.id : '', shotId: s ? s.id : '',
      project: p, concept: c, shot: s
    };
  }
  function setActive(patch) {
    var doc = load();
    patch = patch || {};
    // Callers pass short keys ({projectId,conceptId,shotId}); doc.ui stores them
    // active-prefixed. Map both forms so either works.
    if ('projectId' in patch) doc.ui.activeProjectId = patch.projectId;
    if ('conceptId' in patch) doc.ui.activeConceptId = patch.conceptId;
    if ('shotId' in patch) doc.ui.activeShotId = patch.shotId;
    if ('activeProjectId' in patch) doc.ui.activeProjectId = patch.activeProjectId;
    if ('activeConceptId' in patch) doc.ui.activeConceptId = patch.activeConceptId;
    if ('activeShotId' in patch) doc.ui.activeShotId = patch.activeShotId;
    // Switching project (without naming a concept/shot) clears the stale pointers
    // so getActive falls through to that project's first concept/shot.
    if (('projectId' in patch || 'activeProjectId' in patch) && !('conceptId' in patch) && !('activeConceptId' in patch)) {
      doc.ui.activeConceptId = '';
      doc.ui.activeShotId = '';
    }
    save(doc);
    return getActive();
  }

  // Tolerant scaffold from a plan file's JSON content. Never throws.
  function scaffoldFromPlan(projectId, planContent) {
    var doc = load();
    var p = doc.projects.filter(function (x) { return x.id === projectId; })[0];
    if (!p) return null;
    var plan = null;
    try { plan = JSON.parse(planContent); } catch (e) { return p; }
    if (!plan || typeof plan !== 'object') return p;
    // Optional "todos" from the AI handoff plan — strings or {label, done}.
    if (Array.isArray(plan.todos)) {
      p.todos = plan.todos.map(function (t) {
        if (t && typeof t === 'object') return { label: String(t.label || t.name || ''), done: !!t.done };
        return { label: String(t || ''), done: false };
      }).filter(function (t) { return t.label; });
    }
    var concepts = plan.concepts || plan.tasks || [];
    if (!Array.isArray(concepts) || !concepts.length) return p;
    p.concepts = concepts.map(function (c, i) {
      c = (c && typeof c === 'object') ? c : {};
      var shots = (c.shots || []);
      // Plan concept names may carry a one-line description after " — ".
      var rawName = c.name || c.title || ('Concept ' + (i + 1));
      var parts = String(rawName).split(' — ');
      return {
        id: newId('cpt'),
        name: parts[0],
        desc: c.desc || c.description || parts.slice(1).join(' — ') || '',
        shots: (Array.isArray(shots) && shots.length ? shots : [{}]).map(function (sh, j) {
          sh = (sh && typeof sh === 'object') ? sh : {};
          // Honor the plan's label ("1A", "2C"…) when well-formed; else generate.
          var lbl = String(sh.label || '').trim().toUpperCase();
          if (!/^\d+[A-Z]+$/.test(lbl)) lbl = shotLabel(i, j);
          return {
            id: newId('shot'),
            name: sh.name || sh.title || ('Shot ' + (j + 1)),
            label: lbl,
            status: 'draft',
            builder: defaultBuilder()
          };
        })
      };
    });
    if (p.concepts[0]) {
      doc.ui.activeProjectId = p.id;
      doc.ui.activeConceptId = p.concepts[0].id;
      doc.ui.activeShotId = p.concepts[0].shots[0] ? p.concepts[0].shots[0].id : '';
    }
    p.updatedAt = now(); save(doc);
    return p;
  }

  window.Store = {
    load: load, save: save, saveOk: function () { return lastSaveOk; },
    getSettings: getSettings, setSettings: setSettings,
    isConfigured: isConfigured, markConfigured: markConfigured,
    listProjects: listProjects, getProject: getProject,
    createProject: createProject, deleteProject: deleteProject,
    addConcept: addConcept, addShot: addShot, renameShot: renameShot,
    updateShotBuilder: updateShotBuilder,
    listTodos: listTodos, toggleTodo: toggleTodo,
    listReferences: listReferences, addReference: addReference,
    getReference: getReference, updateReference: updateReference,
    deleteReference: deleteReference,
    getActive: getActive, setActive: setActive,
    getStylePrefix: getStylePrefix, setStylePrefix: setStylePrefix,
    scaffoldFromPlan: scaffoldFromPlan,
    defaultBuilder: defaultBuilder,
    shotLabel: shotLabel
  };
})();
