// Studio S — shared client data store (vanilla, no build step).
// Loaded before nav.js on every page. Exposes window.Store.
// Single localStorage document under KEY; one read/parse, one write/serialize.
//
// Schema v2 (agency spine): clients → projects → deliverables + typed assets +
// versions + people. v1 (projects → concepts → shots + flat references) migrates
// forward, non-destructively: concepts/shots are PRESERVED on the project (the
// prompt-builder still reads them); flat references fold into typed reference
// assets (with the wizard's fields/prompt/imagePath carried through). No UI reads
// the new objects yet — later slices build on them.
(function () {
  var KEY = 'aifs.v1';
  var VERSION = 2;

  function now() { try { return Date.now(); } catch (e) { return 0; } }
  function newId(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }
  function byId(arr, id) { return (arr || []).filter(function (x) { return x.id === id; })[0] || null; }

  function _default() {
    return {
      version: VERSION,
      settings: {
        configured: false,
        onboarded: false,
        claudeApiKey: '',
        defaultOutputFolder: '',
        defaultVideoModel: 'kling',
        defaultModel: '',
        defaultStillsModel: ''
      },
      clients: [],
      projects: [],
      deliverables: [],
      assets: [],
      versions: [],
      people: [],
      ui: { activeProjectId: '', activeConceptId: '', activeShotId: '', activeClientId: '', activeDeliverableId: '' }
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

  // Empty brand kit — the governed source every project inherits (live-read).
  function defaultBrand() {
    return {
      styleLook: '', palette: [], logo: '',
      mandatories: '', legal: '',
      personas: [],       // [{ name, note }]
      phrasingRules: [],  // approved-phrasing strings
      whitelists: []      // { name, values:[] } or bare strings
    };
  }

  // Deliverable spec skeleton (ratio/runtime/platform/legal).
  function defaultSpecs() {
    return { ratio: '', runtime: '', platform: '', legal: '' };
  }

  // ── migration v1 → v2 ────────────────────────────────────────────────────
  // Idempotent (guarded on doc.version). Non-destructive: concepts/shots stay on
  // the project. Deliberately does NOT project concepts→deliverables or
  // shots→generated assets (nothing was generated; the Seed slice supplies demo
  // content). Flat references fold into typed reference assets, fields carried.
  function migrate(doc) {
    if ((doc.version || 1) >= 2) return false;

    doc.clients = Array.isArray(doc.clients) ? doc.clients : [];
    doc.deliverables = Array.isArray(doc.deliverables) ? doc.deliverables : [];
    doc.assets = Array.isArray(doc.assets) ? doc.assets : [];
    doc.versions = Array.isArray(doc.versions) ? doc.versions : [];
    doc.people = Array.isArray(doc.people) ? doc.people : [];

    var legacyClientId = '';
    function ensureLegacyClient() {
      if (legacyClientId) return legacyClientId;
      var c = { id: newId('cli'), name: 'Unassigned', brand: defaultBrand(), createdAt: now(), updatedAt: now() };
      doc.clients.push(c);
      legacyClientId = c.id;
      return legacyClientId;
    }

    (doc.projects || []).forEach(function (p) {
      if (!p.clientId) p.clientId = ensureLegacyClient();
      if (typeof p.status !== 'string') p.status = 'active';
      if (typeof p.brief !== 'string') p.brief = '';
      if (!p.timeline || typeof p.timeline !== 'object') p.timeline = { start: '', end: '' };
      if (!Array.isArray(p.team)) p.team = [];
    });

    // flat references[] → typed reference assets (carry the wizard's data)
    (Array.isArray(doc.references) ? doc.references : []).forEach(function (r) {
      var proj = (doc.projects || []).filter(function (x) { return x.id === r.projectId; })[0];
      doc.assets.push({
        // Preserve the original reference id so shot-builder links
        // (charRefIds / styleRefId / …) stay valid after the fold.
        id: r.id || newId('ast'), type: 'reference',
        clientId: proj ? proj.clientId : '', projectId: r.projectId || '', deliverableId: '',
        name: r.name || 'Untitled', note: r.note || '',
        kind: r.kind || 'character', fields: r.fields || {}, prompt: r.prompt || '', imagePath: r.imagePath || '',
        createdAt: r.createdAt || now(), updatedAt: now()
      });
    });
    delete doc.references; // folded into assets; no longer a separate source

    doc.version = 2;
    return true;
  }

  function load() {
    var raw;
    try { raw = window.localStorage.getItem(KEY); }
    catch (e) { return _default(); }
    if (!raw) return _default();
    try {
      var doc = JSON.parse(raw);
      if (!doc || typeof doc !== 'object') throw new Error('bad doc');
      // Shallow shape guard + forward-compat defaults for every top-level array.
      var d = _default();
      doc.settings = Object.assign(d.settings, doc.settings || {});
      doc.projects = Array.isArray(doc.projects) ? doc.projects : [];
      doc.clients = Array.isArray(doc.clients) ? doc.clients : [];
      doc.deliverables = Array.isArray(doc.deliverables) ? doc.deliverables : [];
      doc.assets = Array.isArray(doc.assets) ? doc.assets : [];
      doc.versions = Array.isArray(doc.versions) ? doc.versions : [];
      doc.people = Array.isArray(doc.people) ? doc.people : [];
      doc.ui = Object.assign(d.ui, doc.ui || {});
      // v1 → v2 (folds references, bumps version); no-op once at v2.
      var migrated = migrate(doc);
      // Backfill shot labels (1A, 1B…) on data that predates them. Idempotent.
      doc.projects.forEach(function (p) {
        (p.concepts || []).forEach(function (c, ci) {
          (c.shots || []).forEach(function (s, si) {
            if (!s.label) s.label = shotLabel(ci, si);
          });
        });
      });
      if (migrated) save(doc); // persist the one-time migration
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

  // ── clients (governance root) ──
  function listClients() { return load().clients; }
  function getClient(id) { return byId(load().clients, id); }
  function createClient(opts) {
    opts = opts || {};
    var doc = load();
    var c = { id: newId('cli'), name: opts.name || 'Untitled client',
      brand: Object.assign(defaultBrand(), opts.brand || {}), createdAt: now(), updatedAt: now() };
    doc.clients.push(c); save(doc);
    return c;
  }
  function updateClient(id, patch) {
    patch = patch || {};
    var doc = load();
    var c = byId(doc.clients, id);
    if (!c) return null;
    if (patch.name !== undefined) c.name = patch.name;
    if (patch.brand) c.brand = Object.assign(c.brand || defaultBrand(), patch.brand);
    c.updatedAt = now(); save(doc);
    return c;
  }
  function updateBrand(id, brandPatch) {
    var doc = load();
    var c = byId(doc.clients, id);
    if (!c) return null;
    c.brand = Object.assign(c.brand || defaultBrand(), brandPatch || {});
    c.updatedAt = now(); save(doc);
    return c;
  }
  function deleteClient(id) {
    var doc = load();
    doc.clients = doc.clients.filter(function (x) { return x.id !== id; });
    // Don't cascade-delete projects — just null their client link.
    doc.projects.forEach(function (p) { if (p.clientId === id) p.clientId = ''; });
    doc.assets.forEach(function (a) { if (a.clientId === id) a.clientId = ''; });
    save(doc);
  }

  // ── projects / concepts / shots ──
  function listProjects(clientId) {
    var ps = load().projects;
    return clientId ? ps.filter(function (p) { return p.clientId === clientId; }) : ps;
  }
  function getProject(id) { return byId(load().projects, id); }
  function getProjectBrand(id) {
    // LIVE resolution — never snapshotted, so brand edits propagate everywhere.
    var p = getProject(id);
    if (!p) return null;
    var c = getClient(p.clientId);
    return c ? c.brand : null;
  }
  function createProject(opts) {
    opts = opts || {};
    var doc = load();
    var firstConceptId = newId('cpt');
    var firstShotId = newId('shot');
    var p = {
      id: newId('prj'),
      clientId: opts.clientId || '',
      name: opts.name || 'Untitled project',
      assetsFolder: opts.assetsFolder || '',
      outputFolder: opts.outputFolder || doc.settings.defaultOutputFolder || '',
      status: opts.status || 'active',
      brief: opts.brief || '',
      timeline: opts.timeline || { start: '', end: '' },
      team: opts.team || [],
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
    var p = byId(doc.projects, id);
    if (p) { Object.assign(p, patch || {}); p.updatedAt = now(); save(doc); }
    return p || null;
  }
  function deleteProject(id) {
    var doc = load();
    doc.projects = doc.projects.filter(function (x) { return x.id !== id; });
    var deadDelIds = doc.deliverables.filter(function (d) { return d.projectId === id; }).map(function (d) { return d.id; });
    doc.deliverables = doc.deliverables.filter(function (d) { return d.projectId !== id; });
    doc.assets = doc.assets.filter(function (a) { return a.projectId !== id; });
    doc.versions = doc.versions.filter(function (v) { return deadDelIds.indexOf(v.deliverableId) === -1; });
    if (doc.ui.activeProjectId === id) {
      doc.ui.activeProjectId = ''; doc.ui.activeConceptId = ''; doc.ui.activeShotId = '';
    }
    save(doc);
  }

  function addConcept(projectId, opts) {
    var doc = load();
    var p = byId(doc.projects, projectId);
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
    var p = byId(doc.projects, projectId);
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
    var p = byId(doc.projects, projectId);
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
    var p = byId(doc.projects, ids.projectId);
    if (!p) return null;
    var c = p.concepts.filter(function (x) { return x.id === ids.conceptId; })[0];
    if (!c) return null;
    var s = c.shots.filter(function (x) { return x.id === ids.shotId; })[0];
    if (!s) return null;
    s.builder = Object.assign(s.builder || defaultBuilder(), builderPatch || {});
    p.updatedAt = now(); save(doc);
    return s;
  }

  // ── deliverables ──
  function listDeliverables(projectId) {
    return load().deliverables.filter(function (d) { return projectId ? d.projectId === projectId : true; });
  }
  function getDeliverable(id) { return byId(load().deliverables, id); }
  function createDeliverable(projectId, opts) {
    opts = opts || {};
    var doc = load();
    var d = {
      id: newId('dlv'), projectId: projectId,
      name: opts.name || 'Untitled deliverable',
      specs: Object.assign(defaultSpecs(), opts.specs || {}),
      status: opts.status || 'not-started',
      currentVersionId: '',
      attachedAssetIds: Array.isArray(opts.attachedAssetIds) ? opts.attachedAssetIds : [],
      createdAt: now(), updatedAt: now()
    };
    doc.deliverables.push(d); save(doc);
    return d;
  }
  function updateDeliverable(id, patch) {
    patch = patch || {};
    var doc = load();
    var d = byId(doc.deliverables, id);
    if (!d) return null;
    ['name', 'status', 'specs', 'currentVersionId', 'attachedAssetIds'].forEach(function (k) {
      if (patch[k] !== undefined) d[k] = patch[k];
    });
    d.updatedAt = now(); save(doc);
    return d;
  }
  function deleteDeliverable(id) {
    var doc = load();
    doc.deliverables = doc.deliverables.filter(function (x) { return x.id !== id; });
    doc.assets = doc.assets.filter(function (a) { return a.deliverableId !== id; });
    doc.versions = doc.versions.filter(function (v) { return v.deliverableId !== id; });
    save(doc);
  }

  // ── assets (typed: reference | generated | cut) ──
  function listAssets(filter) {
    filter = filter || {};
    return load().assets.filter(function (a) {
      if (filter.type && a.type !== filter.type) return false;
      if (filter.projectId && a.projectId !== filter.projectId) return false;
      if (filter.clientId && a.clientId !== filter.clientId) return false;
      if (filter.deliverableId && a.deliverableId !== filter.deliverableId) return false;
      if (filter.kind && a.kind !== filter.kind) return false;
      return true;
    });
  }
  function getAsset(id) { return byId(load().assets, id); }
  function createAsset(opts) {
    opts = opts || {};
    var doc = load();
    var a = {
      id: newId('ast'), type: opts.type || 'reference',
      clientId: opts.clientId || '', projectId: opts.projectId || '', deliverableId: opts.deliverableId || '',
      name: opts.name || 'Untitled', note: opts.note || '',
      createdAt: now(), updatedAt: now()
    };
    if (a.type === 'reference') {
      a.kind = opts.kind || 'character'; a.fields = opts.fields || {};
      a.prompt = opts.prompt || ''; a.imagePath = opts.imagePath || '';
    } else if (a.type === 'generated') {
      a.recipe = opts.recipe || { model: '', prompt: '', cost: 0 };
      a.builder = opts.builder || defaultBuilder();
      a.status = opts.status || 'draft';
    } else if (a.type === 'cut') {
      a.url = opts.url || ''; a.frameioUrl = opts.frameioUrl || ''; a.round = opts.round || 0;
    }
    doc.assets.push(a); save(doc);
    return a;
  }
  function updateAsset(id, patch) {
    patch = patch || {};
    var doc = load();
    var a = byId(doc.assets, id);
    if (!a) return null;
    ['name', 'note', 'clientId', 'projectId', 'deliverableId', 'kind', 'fields', 'prompt',
     'imagePath', 'recipe', 'builder', 'status', 'url', 'frameioUrl', 'round'].forEach(function (k) {
      if (patch[k] !== undefined) a[k] = patch[k];
    });
    a.updatedAt = now(); save(doc);
    return a;
  }
  function deleteAsset(id) {
    var doc = load();
    doc.assets = doc.assets.filter(function (x) { return x.id !== id; });
    doc.versions = doc.versions.filter(function (v) { return v.assetId !== id; });
    save(doc);
    return true;
  }

  // ── versions / reviews ──
  function listVersions(deliverableId) {
    return load().versions.filter(function (v) { return deliverableId ? v.deliverableId === deliverableId : true; });
  }
  function createVersion(deliverableId, opts) {
    opts = opts || {};
    var doc = load();
    var existing = doc.versions.filter(function (v) { return v.deliverableId === deliverableId; });
    existing.forEach(function (v) { v.isCurrent = false; });
    var v = {
      id: newId('ver'), deliverableId: deliverableId,
      round: opts.round || (existing.length + 1),
      reviewer: opts.reviewer || '', status: opts.status || 'needs-review',
      frameioUrl: opts.frameioUrl || '', note: opts.note || '',
      isCurrent: true, assetId: opts.assetId || '', createdAt: now()
    };
    doc.versions.push(v);
    var d = byId(doc.deliverables, deliverableId);
    if (d) { d.currentVersionId = v.id; d.updatedAt = now(); }
    save(doc);
    return v;
  }
  function updateVersion(id, patch) {
    patch = patch || {};
    var doc = load();
    var v = byId(doc.versions, id);
    if (!v) return null;
    ['round', 'reviewer', 'status', 'frameioUrl', 'note', 'isCurrent', 'assetId'].forEach(function (k) {
      if (patch[k] !== undefined) v[k] = patch[k];
    });
    save(doc);
    return v;
  }
  function deleteVersion(id) {
    var doc = load();
    var v = byId(doc.versions, id);
    doc.versions = doc.versions.filter(function (x) { return x.id !== id; });
    if (v) {
      var d = byId(doc.deliverables, v.deliverableId);
      if (d && d.currentVersionId === id) {
        var rest = doc.versions.filter(function (x) { return x.deliverableId === v.deliverableId; });
        d.currentVersionId = rest.length ? rest[rest.length - 1].id : '';
      }
    }
    save(doc);
  }
  // Register a production cut: drop a link → a cut asset + a current version.
  function registerCut(deliverableId, opts) {
    opts = opts || {};
    var doc = load();
    var d = byId(doc.deliverables, deliverableId);
    if (!d) return null;
    var existing = doc.versions.filter(function (v) { return v.deliverableId === deliverableId; });
    var round = opts.round || (existing.length + 1);
    var asset = {
      id: newId('ast'), type: 'cut',
      clientId: opts.clientId || '', projectId: d.projectId, deliverableId: deliverableId,
      name: opts.name || ('Cut R' + round), note: opts.note || '',
      url: opts.url || '', frameioUrl: opts.frameioUrl || '', round: round,
      createdAt: now(), updatedAt: now()
    };
    doc.assets.push(asset);
    existing.forEach(function (v) { v.isCurrent = false; });
    var v = {
      id: newId('ver'), deliverableId: deliverableId, round: round,
      reviewer: opts.reviewer || '', status: opts.status || 'needs-review',
      frameioUrl: opts.frameioUrl || '', note: opts.note || '',
      isCurrent: true, assetId: asset.id, createdAt: now()
    };
    doc.versions.push(v);
    d.currentVersionId = v.id; d.updatedAt = now();
    save(doc);
    return { asset: asset, version: v };
  }

  // ── people ──
  function listPeople() { return load().people; }
  function getPerson(id) { return byId(load().people, id); }
  function createPerson(opts) {
    opts = opts || {};
    var doc = load();
    var pp = { id: newId('per'), name: opts.name || 'Unnamed', role: opts.role || '' };
    doc.people.push(pp); save(doc);
    return pp;
  }
  function updatePerson(id, patch) {
    patch = patch || {};
    var doc = load();
    var pp = byId(doc.people, id);
    if (!pp) return null;
    if (patch.name !== undefined) pp.name = patch.name;
    if (patch.role !== undefined) pp.role = patch.role;
    save(doc);
    return pp;
  }
  function deletePerson(id) {
    var doc = load();
    doc.people = doc.people.filter(function (x) { return x.id !== id; });
    doc.projects.forEach(function (p) {
      if (Array.isArray(p.team)) p.team = p.team.filter(function (pid) { return pid !== id; });
    });
    save(doc);
  }

  // ── project to-dos (scaffolded from the AI-handoff plan; user-toggleable) ──
  function listTodos(projectId) {
    var p = getProject(projectId);
    return (p && Array.isArray(p.todos)) ? p.todos : [];
  }
  function toggleTodo(projectId, index) {
    var doc = load();
    var p = byId(doc.projects, projectId);
    if (!p || !Array.isArray(p.todos) || !p.todos[index]) return null;
    p.todos[index].done = !p.todos[index].done;
    p.updatedAt = now(); save(doc);
    return p.todos[index];
  }

  // ── references (back-compat shims over typed reference assets) ──
  // The References wizard + prompt builder still call these; they now read/write
  // assets[] filtered to type 'reference', preserving the legacy object shape.
  function listReferences(projectId) {
    return listAssets({ type: 'reference', projectId: projectId || undefined });
  }
  function addReference(projectId, opts) {
    opts = opts || {};
    var proj = getProject(projectId);
    return createAsset({
      type: 'reference', projectId: projectId, clientId: proj ? proj.clientId : '',
      name: opts.name || 'Untitled', kind: opts.kind || 'character', note: opts.note || '',
      fields: opts.fields || {}, prompt: opts.prompt || '', imagePath: opts.imagePath || ''
    });
  }
  function getReference(refId) {
    var a = getAsset(refId);
    return (a && a.type === 'reference') ? a : null;
  }
  function updateReference(refId, patch) {
    var a = getAsset(refId);
    if (!a || a.type !== 'reference') return null;
    var allowed = {};
    ['name', 'kind', 'note', 'fields', 'prompt', 'imagePath'].forEach(function (k) {
      if (patch[k] !== undefined) allowed[k] = patch[k];
    });
    return updateAsset(refId, allowed);
  }
  function deleteReference(refId) {
    var a = getAsset(refId);
    if (!a || a.type !== 'reference') return false;
    var doc = load();
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
    doc.assets = doc.assets.filter(function (x) { return x.id !== refId; });
    doc.versions = doc.versions.filter(function (v) { return v.assetId !== refId; });
    save(doc);
    return true;
  }

  // ── active selection (validated against current data) ──
  function getActive() {
    var doc = load();
    var p = byId(doc.projects, doc.ui.activeProjectId) || doc.projects[0] || null;
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
    if ('clientId' in patch) doc.ui.activeClientId = patch.clientId;
    if ('deliverableId' in patch) doc.ui.activeDeliverableId = patch.deliverableId;
    // Switching project (without naming a concept/shot) clears the stale pointers
    // so getActive falls through to that project's first concept/shot.
    if (('projectId' in patch || 'activeProjectId' in patch) && !('conceptId' in patch) && !('activeConceptId' in patch)) {
      doc.ui.activeConceptId = '';
      doc.ui.activeShotId = '';
    }
    save(doc);
    return getActive();
  }

  // ── dashboard aggregation (read helper for the Work dashboard slice) ──
  function getWork(opts) {
    opts = opts || {};
    var doc = load();
    var me = opts.personId || '';
    var clientName = {};
    doc.clients.forEach(function (c) { clientName[c.id] = c.name; });

    var activeProjects = doc.projects
      .filter(function (p) { return (p.status || 'active') !== 'archived'; })
      .map(function (p) {
        var dels = doc.deliverables.filter(function (d) { return d.projectId === p.id; });
        return {
          id: p.id, name: p.name, status: p.status || 'active',
          clientId: p.clientId, clientName: clientName[p.clientId] || '—',
          deliverableCount: dels.length,
          blockedCount: dels.filter(function (d) { return d.status === 'blocked'; }).length,
          inReviewCount: dels.filter(function (d) { return d.status === 'in-review'; }).length,
          updatedAt: p.updatedAt || 0
        };
      })
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

    function projName(id) { var p = byId(doc.projects, id); return p ? p.name : '—'; }
    function decorate(d) {
      var v = byId(doc.versions, d.currentVersionId);
      return {
        id: d.id, name: d.name, projectId: d.projectId, projectName: projName(d.projectId),
        status: d.status, specs: d.specs,
        currentVersion: v ? { id: v.id, round: v.round, reviewer: v.reviewer, status: v.status, frameioUrl: v.frameioUrl } : null,
        updatedAt: d.updatedAt || 0
      };
    }

    var inReview = doc.deliverables.filter(function (d) { return d.status === 'in-review'; }).map(decorate);
    var blocked = doc.deliverables.filter(function (d) { return d.status === 'blocked'; }).map(decorate);
    var needsMe = [];
    if (me) {
      doc.versions.forEach(function (v) {
        if (v.reviewer === me && v.status === 'needs-review') {
          var d = byId(doc.deliverables, v.deliverableId);
          if (d) needsMe.push(decorate(d));
        }
      });
    }
    return {
      activeProjects: activeProjects, inReview: inReview, blocked: blocked, needsMe: needsMe,
      counts: { projects: activeProjects.length, inReview: inReview.length, blocked: blocked.length, needsMe: needsMe.length }
    };
  }

  // Tolerant scaffold from a plan file's JSON content. Never throws.
  function scaffoldFromPlan(projectId, planContent) {
    var doc = load();
    var p = byId(doc.projects, projectId);
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
    // clients
    listClients: listClients, getClient: getClient, createClient: createClient,
    updateClient: updateClient, updateBrand: updateBrand, deleteClient: deleteClient,
    getProjectBrand: getProjectBrand,
    // projects / concepts / shots
    listProjects: listProjects, getProject: getProject,
    createProject: createProject, updateProject: updateProject, deleteProject: deleteProject,
    addConcept: addConcept, addShot: addShot, renameShot: renameShot,
    updateShotBuilder: updateShotBuilder,
    // deliverables
    listDeliverables: listDeliverables, getDeliverable: getDeliverable,
    createDeliverable: createDeliverable, updateDeliverable: updateDeliverable, deleteDeliverable: deleteDeliverable,
    // assets
    listAssets: listAssets, getAsset: getAsset, createAsset: createAsset,
    updateAsset: updateAsset, deleteAsset: deleteAsset,
    // versions
    listVersions: listVersions, createVersion: createVersion, updateVersion: updateVersion,
    deleteVersion: deleteVersion, registerCut: registerCut,
    // people
    listPeople: listPeople, getPerson: getPerson, createPerson: createPerson,
    updatePerson: updatePerson, deletePerson: deletePerson,
    // todos
    listTodos: listTodos, toggleTodo: toggleTodo,
    // references (shims)
    listReferences: listReferences, addReference: addReference,
    getReference: getReference, updateReference: updateReference, deleteReference: deleteReference,
    // active selection + dashboard
    getActive: getActive, setActive: setActive, getWork: getWork,
    getStylePrefix: getStylePrefix, setStylePrefix: setStylePrefix,
    scaffoldFromPlan: scaffoldFromPlan,
    defaultBuilder: defaultBuilder, defaultBrand: defaultBrand, defaultSpecs: defaultSpecs,
    shotLabel: shotLabel
  };
})();
