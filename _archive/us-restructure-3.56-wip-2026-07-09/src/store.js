// Studio S — shared client data store (vanilla, no build step).
// Loaded before nav.js on every page. Exposes window.Store.
// Single localStorage document under KEY; one read/parse, one write/serialize.
//
// Schema v2 (the "us" repositioning — see docs/us-repositioning-plan.md §4):
// the store is a source of truth per CLIENT and PROJECT. Core objects:
//   clients      — governance root: brand kit, personas, phrasing, whitelists
//   projects     — belong to a client; carry status, brief, timeline, team
//   deliverables — required outputs per project (ratio/runtime/platform/legal)
//   assets       — UNIFIED + TYPED: reference | generated | cut (production)
//   versions     — review rounds per deliverable (round/reviewer/status/link)
//   people       — maker / reviewer / account / creative / producer
// Legacy v1 (projects → concepts → shots + flat references) migrates forward
// non-destructively: concepts stay on the project for the Generate surface,
// and are ALSO projected into deliverables + generated assets.
(function () {
  var KEY = 'aifs.v1';
  var VERSION = 2;

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
      clients: [],
      projects: [],
      deliverables: [],
      assets: [],
      versions: [],
      people: [],
      ui: { activeClientId: '', activeProjectId: '', activeConceptId: '', activeShotId: '', activeDeliverableId: '' }
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
      prefixOverride: false
    };
  }

  // Empty brand kit — the governed source every project inherits.
  function defaultBrand() {
    return {
      styleLook: '', palette: [], logo: '',
      mandatories: '', legal: '',
      personas: [],       // [{ name, note }]
      phrasingRules: [],  // approved-phrasing strings
      whitelists: []      // e.g. { name:'49ers numbers', values:[...] } or strings
    };
  }

  // Deliverable spec skeleton (ratio/runtime/platform/legal) — see plan §4.
  function defaultSpecs() {
    return { ratio: '', runtime: '', platform: '', legal: '' };
  }

  // ── migration ──────────────────────────────────────────────────────────
  // v1 → v2. Idempotent (guarded on doc.version). Non-destructive: legacy
  // concepts/shots are PRESERVED on the project (the Generate surface still
  // reads them) and ALSO projected into the new deliverables + assets model.
  function migrate(doc) {
    if ((doc.version || 1) >= 2) return false;

    doc.clients = Array.isArray(doc.clients) ? doc.clients : [];
    doc.deliverables = Array.isArray(doc.deliverables) ? doc.deliverables : [];
    doc.assets = Array.isArray(doc.assets) ? doc.assets : [];
    doc.versions = Array.isArray(doc.versions) ? doc.versions : [];
    doc.people = Array.isArray(doc.people) ? doc.people : [];

    // A single holding client for pre-repositioning projects. Brand truth for
    // real clients (US Bank etc.) gets seeded separately — this just keeps the
    // governance root non-null so every project has a clientId.
    var legacyClientId = '';
    function ensureLegacyClient() {
      if (legacyClientId) return legacyClientId;
      var c = { id: newId('cli'), name: 'Unassigned', brand: defaultBrand(),
                createdAt: now(), updatedAt: now() };
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

      // concept → deliverable, shot → generated asset
      (Array.isArray(p.concepts) ? p.concepts : []).forEach(function (c) {
        var d = {
          id: newId('dlv'), projectId: p.id, name: c.name || 'Concept',
          specs: defaultSpecs(), status: 'in-progress', currentVersionId: '',
          fromConceptId: c.id, createdAt: now(), updatedAt: now()
        };
        doc.deliverables.push(d);
        (Array.isArray(c.shots) ? c.shots : []).forEach(function (s) {
          doc.assets.push({
            id: newId('ast'), type: 'generated',
            clientId: p.clientId, projectId: p.id, deliverableId: d.id,
            name: s.name || 'Shot', note: '', url: '',
            recipe: { model: (s.builder && s.builder.videoModel) || '', prompt: '', cost: 0 },
            builder: s.builder || defaultBuilder(),
            status: s.status || 'draft',
            fromShotId: s.id, createdAt: now(), updatedAt: now()
          });
        });
      });
    });

    // flat references[] → typed reference assets
    (Array.isArray(doc.references) ? doc.references : []).forEach(function (r) {
      var proj = (doc.projects || []).filter(function (x) { return x.id === r.projectId; })[0];
      doc.assets.push({
        id: newId('ast'), type: 'reference',
        clientId: proj ? proj.clientId : '', projectId: r.projectId || '', deliverableId: '',
        name: r.name || 'Untitled', note: r.note || '', url: '',
        kind: r.kind || 'character', refs: [],
        status: '', createdAt: r.createdAt || now(), updatedAt: now()
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
      // Shallow shape guard + forward-compat defaults.
      var d = _default();
      doc.version = doc.version || 1;
      doc.settings = Object.assign(d.settings, doc.settings || {});
      doc.projects = Array.isArray(doc.projects) ? doc.projects : [];
      doc.clients = Array.isArray(doc.clients) ? doc.clients : [];
      doc.deliverables = Array.isArray(doc.deliverables) ? doc.deliverables : [];
      doc.assets = Array.isArray(doc.assets) ? doc.assets : [];
      doc.versions = Array.isArray(doc.versions) ? doc.versions : [];
      doc.people = Array.isArray(doc.people) ? doc.people : [];
      doc.ui = Object.assign(d.ui, doc.ui || {});
      // Migrate forward in place, then persist once so it's not re-run.
      if (migrate(doc)) save(doc);
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

  // Small helpers to keep the CRUD blocks terse.
  function byId(arr, id) { return (arr || []).filter(function (x) { return x.id === id; })[0] || null; }

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
    var s = load().settings;
    return !!(s.configured && s.claudeApiKey);
  }
  function markConfigured() { return setSettings({ configured: true }); }

  // ── clients / brands (governance root) ──
  function listClients() { return load().clients; }
  function getClient(id) { return byId(load().clients, id); }
  function createClient(opts) {
    opts = opts || {};
    var doc = load();
    var c = {
      id: newId('cli'),
      name: opts.name || 'Untitled client',
      brand: Object.assign(defaultBrand(), opts.brand || {}),
      createdAt: now(), updatedAt: now()
    };
    doc.clients.push(c);
    doc.ui.activeClientId = c.id;
    save(doc);
    return c;
  }
  function updateClient(id, patch) {
    var doc = load();
    var c = byId(doc.clients, id);
    if (c) { Object.assign(c, patch || {}); c.updatedAt = now(); save(doc); }
    return c;
  }
  function updateBrand(id, brandPatch) {
    var doc = load();
    var c = byId(doc.clients, id);
    if (c) { c.brand = Object.assign(defaultBrand(), c.brand || {}, brandPatch || {}); c.updatedAt = now(); save(doc); }
    return c;
  }
  function deleteClient(id) {
    var doc = load();
    doc.clients = doc.clients.filter(function (x) { return x.id !== id; });
    // Orphaned projects keep working but lose their governance root; null it out
    // rather than cascade-deleting a client's whole book of work by accident.
    doc.projects.forEach(function (p) { if (p.clientId === id) p.clientId = ''; });
    doc.assets.forEach(function (a) { if (a.clientId === id) a.clientId = ''; });
    if (doc.ui.activeClientId === id) doc.ui.activeClientId = '';
    save(doc);
  }

  // ── projects (belong to a client) ──
  function listProjects(clientId) {
    var ps = load().projects;
    return clientId ? ps.filter(function (p) { return p.clientId === clientId; }) : ps;
  }
  function getProject(id) { return byId(load().projects, id); }
  function createProject(opts) {
    opts = opts || {};
    var doc = load();
    var firstConceptId = newId('cpt');
    var firstShotId = newId('shot');
    var p = {
      id: newId('prj'),
      clientId: opts.clientId || doc.ui.activeClientId || '',
      name: opts.name || 'Untitled project',
      status: opts.status || 'active',
      brief: opts.brief || '',
      timeline: opts.timeline || { start: '', end: '' },
      team: Array.isArray(opts.team) ? opts.team : [],
      assetsFolder: opts.assetsFolder || '',
      outputFolder: opts.outputFolder || doc.settings.defaultOutputFolder || '',
      createdAt: now(), updatedAt: now(),
      todos: [],
      concepts: [
        { id: firstConceptId, name: 'Concept 1',
          shots: [ { id: firstShotId, name: 'Shot 1', status: 'draft', builder: defaultBuilder() } ] }
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
  // A project's effective brand — the governed source generation should read.
  function getProjectBrand(id) {
    var p = getProject(id);
    if (!p) return null;
    var c = getClient(p.clientId);
    return c ? c.brand : null;
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
    // Cascade the new model: a project's deliverables, its assets, and the
    // versions hanging off those deliverables all go with it.
    var deadDeliverables = doc.deliverables.filter(function (d) { return d.projectId === id; }).map(function (d) { return d.id; });
    doc.deliverables = doc.deliverables.filter(function (d) { return d.projectId !== id; });
    doc.assets = doc.assets.filter(function (a) { return a.projectId !== id; });
    doc.versions = doc.versions.filter(function (v) { return deadDeliverables.indexOf(v.deliverableId) === -1; });
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
  function addShot(projectId, conceptId, opts) {
    opts = opts || {};
    var doc = load();
    var p = byId(doc.projects, projectId);
    if (!p) return null;
    var c = (p.concepts || []).filter(function (x) { return x.id === conceptId; })[0];
    if (!c) return null;
    var s = {
      id: newId('shot'),
      name: opts.name || ('Shot ' + (c.shots.length + 1)),
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
    var c = (p.concepts || []).filter(function (x) { return x.id === conceptId; })[0];
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
    var c = (p.concepts || []).filter(function (x) { return x.id === ids.conceptId; })[0];
    if (!c) return null;
    var s = c.shots.filter(function (x) { return x.id === ids.shotId; })[0];
    if (!s) return null;
    s.builder = Object.assign(s.builder || defaultBuilder(), builderPatch || {});
    p.updatedAt = now(); save(doc);
    return s;
  }

  // ── deliverables (required outputs per project) ──
  function listDeliverables(projectId) {
    return load().deliverables.filter(function (d) {
      return projectId ? d.projectId === projectId : true;
    });
  }
  function getDeliverable(id) { return byId(load().deliverables, id); }
  function createDeliverable(projectId, opts) {
    opts = opts || {};
    var doc = load();
    if (!byId(doc.projects, projectId)) return null;
    var d = {
      id: newId('dlv'), projectId: projectId,
      name: opts.name || 'Untitled deliverable',
      specs: Object.assign(defaultSpecs(), opts.specs || {}),
      status: opts.status || 'not-started',
      currentVersionId: '',
      createdAt: now(), updatedAt: now()
    };
    doc.deliverables.push(d);
    save(doc);
    return d;
  }
  function updateDeliverable(id, patch) {
    var doc = load();
    var d = byId(doc.deliverables, id);
    if (d) { Object.assign(d, patch || {}); d.updatedAt = now(); save(doc); }
    return d;
  }
  function deleteDeliverable(id) {
    var doc = load();
    doc.deliverables = doc.deliverables.filter(function (x) { return x.id !== id; });
    doc.assets = doc.assets.filter(function (a) { return a.deliverableId !== id; });
    doc.versions = doc.versions.filter(function (v) { return v.deliverableId !== id; });
    save(doc);
  }

  // ── assets (unified + typed: reference | generated | cut) ──
  function listAssets(filter) {
    filter = filter || {};
    return load().assets.filter(function (a) {
      if (filter.type && a.type !== filter.type) return false;
      if (filter.kind && a.kind !== filter.kind) return false;
      if (filter.clientId && a.clientId !== filter.clientId) return false;
      if (filter.projectId && a.projectId !== filter.projectId) return false;
      if (filter.deliverableId && a.deliverableId !== filter.deliverableId) return false;
      return true;
    });
  }
  function getAsset(id) { return byId(load().assets, id); }
  function createAsset(opts) {
    opts = opts || {};
    var doc = load();
    // Client defaults from the project when not given, so assets stay governed.
    var proj = opts.projectId ? byId(doc.projects, opts.projectId) : null;
    var a = {
      id: newId('ast'),
      type: opts.type || 'reference',
      clientId: opts.clientId || (proj ? proj.clientId : '') || doc.ui.activeClientId || '',
      projectId: opts.projectId || '',
      deliverableId: opts.deliverableId || '',
      name: opts.name || 'Untitled',
      note: opts.note || '',
      url: opts.url || '',
      status: opts.status || '',
      createdAt: now(), updatedAt: now()
    };
    if (a.type === 'reference') {
      a.kind = opts.kind || 'character';
      a.refs = Array.isArray(opts.refs) ? opts.refs : [];
    } else if (a.type === 'generated') {
      a.recipe = Object.assign({ model: '', prompt: '', cost: 0 }, opts.recipe || {});
      a.builder = opts.builder || defaultBuilder();
    } else if (a.type === 'cut') {
      a.cutType = opts.cutType || 'string-out';
      a.frameioUrl = opts.frameioUrl || '';
      a.round = opts.round || 1;
    }
    doc.assets.push(a);
    save(doc);
    return a;
  }
  function updateAsset(id, patch) {
    var doc = load();
    var a = byId(doc.assets, id);
    if (a) { Object.assign(a, patch || {}); a.updatedAt = now(); save(doc); }
    return a;
  }
  function deleteAsset(id) {
    var doc = load();
    doc.assets = doc.assets.filter(function (x) { return x.id !== id; });
    doc.versions = doc.versions.filter(function (v) { return v.assetId !== id; });
    save(doc);
  }

  // ── versions / reviews (rounds per deliverable) ──
  function listVersions(deliverableId) {
    return load().versions.filter(function (v) {
      return deliverableId ? v.deliverableId === deliverableId : true;
    });
  }
  function createVersion(deliverableId, opts) {
    opts = opts || {};
    var doc = load();
    var d = byId(doc.deliverables, deliverableId);
    if (!d) return null;
    var existing = doc.versions.filter(function (v) { return v.deliverableId === deliverableId; });
    var v = {
      id: newId('ver'), deliverableId: deliverableId,
      assetId: opts.assetId || '',
      round: opts.round || (existing.length + 1),
      reviewer: opts.reviewer || '',
      status: opts.status || 'needs-review',
      frameioUrl: opts.frameioUrl || '',
      note: opts.note || '',
      createdAt: now()
    };
    doc.versions.push(v);
    d.currentVersionId = v.id;
    d.updatedAt = now();
    save(doc);
    return v;
  }
  function updateVersion(id, patch) {
    var doc = load();
    var v = byId(doc.versions, id);
    if (v) { Object.assign(v, patch || {}); save(doc); }
    return v;
  }
  function deleteVersion(id) {
    var doc = load();
    var v = byId(doc.versions, id);
    doc.versions = doc.versions.filter(function (x) { return x.id !== id; });
    if (v) {
      var d = byId(doc.deliverables, v.deliverableId);
      if (d && d.currentVersionId === id) d.currentVersionId = '';
    }
    save(doc);
  }
  // Manual cut registration (plan §7): drop a link/file → a 'cut' asset PLUS a
  // version row are logged together, and the deliverable points at that version.
  function registerCut(deliverableId, opts) {
    opts = opts || {};
    var d = getDeliverable(deliverableId);
    if (!d) return null;
    var asset = createAsset({
      type: 'cut', projectId: d.projectId, deliverableId: deliverableId,
      name: opts.name || (opts.cutType || 'cut'),
      cutType: opts.cutType || 'rough', url: opts.url || '',
      frameioUrl: opts.frameioUrl || '', round: opts.round || 1
    });
    var version = createVersion(deliverableId, {
      assetId: asset.id, round: opts.round,
      reviewer: opts.reviewer, status: opts.status || 'needs-review',
      frameioUrl: opts.frameioUrl || '', note: opts.note || ''
    });
    return { asset: asset, version: version };
  }

  // ── people (maker / reviewer / account / creative / producer) ──
  function listPeople() { return load().people; }
  function getPerson(id) { return byId(load().people, id); }
  function createPerson(opts) {
    opts = opts || {};
    var doc = load();
    var person = {
      id: newId('per'), name: opts.name || 'Unnamed',
      role: opts.role || 'maker', email: opts.email || '',
      createdAt: now()
    };
    doc.people.push(person);
    save(doc);
    return person;
  }
  function updatePerson(id, patch) {
    var doc = load();
    var person = byId(doc.people, id);
    if (person) { Object.assign(person, patch || {}); save(doc); }
    return person;
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

  // ── references (back-compat shim over typed reference assets) ──
  // Legacy pages (references.html) call these; they now read/write assets so
  // there's a single source of truth. New code should use listAssets/createAsset.
  function listReferences(projectId) {
    return listAssets({ type: 'reference', projectId: projectId || undefined });
  }
  function addReference(projectId, opts) {
    opts = opts || {};
    return createAsset({
      type: 'reference', projectId: projectId,
      name: opts.name || 'Untitled', kind: opts.kind || 'character',
      note: opts.note || ''
    });
  }

  // ── Work dashboard aggregation (plan §6 — the hybrid front door) ──
  // Blends brand + projects + status into the four buckets the home view shows:
  // active projects, what's in review, what's blocked, and what needs me.
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
      counts: {
        clients: doc.clients.length,
        projects: activeProjects.length,
        inReview: inReview.length,
        blocked: blocked.length,
        needsMe: needsMe.length
      },
      activeProjects: activeProjects,
      inReview: inReview,
      blocked: blocked,
      needsMe: needsMe
    };
  }

  // ── active selection (validated against current data) ──
  function getActive() {
    var doc = load();
    var p = byId(doc.projects, doc.ui.activeProjectId) || doc.projects[0] || null;
    var c = null, s = null, cli = null;
    if (p) {
      cli = byId(doc.clients, p.clientId) || null;
      c = (p.concepts || []).filter(function (x) { return x.id === doc.ui.activeConceptId; })[0] || (p.concepts || [])[0] || null;
      if (c) s = c.shots.filter(function (x) { return x.id === doc.ui.activeShotId; })[0] || c.shots[0] || null;
    } else {
      cli = byId(doc.clients, doc.ui.activeClientId) || doc.clients[0] || null;
    }
    return {
      clientId: cli ? cli.id : '', projectId: p ? p.id : '', conceptId: c ? c.id : '', shotId: s ? s.id : '',
      client: cli, project: p, concept: c, shot: s
    };
  }
  function setActive(patch) {
    var doc = load();
    patch = patch || {};
    // Callers pass short keys ({clientId,projectId,conceptId,shotId,deliverableId});
    // doc.ui stores them active-prefixed. Map both forms so either works.
    if ('clientId' in patch) doc.ui.activeClientId = patch.clientId;
    if ('projectId' in patch) doc.ui.activeProjectId = patch.projectId;
    if ('conceptId' in patch) doc.ui.activeConceptId = patch.conceptId;
    if ('shotId' in patch) doc.ui.activeShotId = patch.shotId;
    if ('deliverableId' in patch) doc.ui.activeDeliverableId = patch.deliverableId;
    if ('activeClientId' in patch) doc.ui.activeClientId = patch.activeClientId;
    if ('activeProjectId' in patch) doc.ui.activeProjectId = patch.activeProjectId;
    if ('activeConceptId' in patch) doc.ui.activeConceptId = patch.activeConceptId;
    if ('activeShotId' in patch) doc.ui.activeShotId = patch.activeShotId;
    if ('activeDeliverableId' in patch) doc.ui.activeDeliverableId = patch.activeDeliverableId;
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
          return {
            id: newId('shot'),
            name: sh.name || sh.title || ('Shot ' + (j + 1)),
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
    // clients / brands
    listClients: listClients, getClient: getClient, createClient: createClient,
    updateClient: updateClient, updateBrand: updateBrand, deleteClient: deleteClient,
    // projects
    listProjects: listProjects, getProject: getProject,
    createProject: createProject, updateProject: updateProject, deleteProject: deleteProject,
    getProjectBrand: getProjectBrand,
    // concepts / shots (legacy generation surface)
    addConcept: addConcept, addShot: addShot, renameShot: renameShot,
    updateShotBuilder: updateShotBuilder,
    // deliverables
    listDeliverables: listDeliverables, getDeliverable: getDeliverable,
    createDeliverable: createDeliverable, updateDeliverable: updateDeliverable, deleteDeliverable: deleteDeliverable,
    // assets (unified typed)
    listAssets: listAssets, getAsset: getAsset, createAsset: createAsset,
    updateAsset: updateAsset, deleteAsset: deleteAsset,
    // versions / reviews
    listVersions: listVersions, createVersion: createVersion,
    updateVersion: updateVersion, deleteVersion: deleteVersion, registerCut: registerCut,
    // people
    listPeople: listPeople, getPerson: getPerson, createPerson: createPerson,
    updatePerson: updatePerson, deletePerson: deletePerson,
    // todos
    listTodos: listTodos, toggleTodo: toggleTodo,
    // references (back-compat shim)
    listReferences: listReferences, addReference: addReference,
    // dashboard + selection
    getWork: getWork, getActive: getActive, setActive: setActive,
    getStylePrefix: getStylePrefix, setStylePrefix: setStylePrefix,
    scaffoldFromPlan: scaffoldFromPlan,
    defaultBuilder: defaultBuilder, defaultBrand: defaultBrand, defaultSpecs: defaultSpecs
  };
})();
