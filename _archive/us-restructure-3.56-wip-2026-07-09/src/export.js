// Studio S — portable export (vanilla, no build step). Loaded after store.js.
// Exposes window.Exporter. Plan §9.6 ⑨: a JSON handoff of a client or a
// project, toward Claude Design / the platform. Per §5 the portable
// brand-asset schema is THE bridge, so the brand kit is foregrounded and the
// whole graph is nested + self-contained (no dangling internal IDs to resolve).
//
// Reads ONLY the public Store API — adds no store functions, mutates nothing
// (pure read + serialize), matching the seed.js precedent. Assembly is pure so
// it verifies under Node; the download helper is the only browser-only part.
(function () {
  var SCHEMA = 'studio-s.portable';
  var SCHEMA_VERSION = 1;

  function S() {
    if (!window.Store) throw new Error('Exporter requires Store (load store.js first)');
    return window.Store;
  }

  function slug(s) {
    return String(s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
  }
  function nowIso() { try { return new Date().toISOString(); } catch (e) { return ''; } }

  // ── node builders (nested + self-contained) ──
  function assetNode(a) {
    var n = { sourceId: a.id, type: a.type, name: a.name, note: a.note || '', url: a.url || '', status: a.status || '' };
    if (a.type === 'reference') { n.kind = a.kind || 'character'; n.refs = Array.isArray(a.refs) ? a.refs.slice() : []; }
    else if (a.type === 'generated') { n.recipe = Object.assign({ model: '', prompt: '', cost: 0 }, a.recipe || {}); }
    else if (a.type === 'cut') { n.cutType = a.cutType || ''; n.frameioUrl = a.frameioUrl || ''; n.round = a.round || 1; }
    return n;
  }

  function versionNode(v, currentId) {
    var Store = S();
    var cut = v.assetId ? Store.getAsset(v.assetId) : null;
    return {
      sourceId: v.id,
      round: v.round || null,
      reviewer: v.reviewer || '',
      status: v.status || '',
      frameioUrl: v.frameioUrl || '',
      note: v.note || '',
      isCurrent: !!(currentId && v.id === currentId),
      cut: cut ? { name: cut.name, cutType: cut.cutType || '', url: cut.url || '', frameioUrl: cut.frameioUrl || '' } : null
    };
  }

  function deliverableNode(d) {
    var Store = S();
    var versions = Store.listVersions(d.id).slice().sort(function (a, b) { return (a.round || 0) - (b.round || 0); });
    // Reference/generated assets attached to this deliverable. Cuts are already
    // inlined inside the version rows, so exclude type 'cut' here.
    var assets = Store.listAssets({ deliverableId: d.id }).filter(function (a) { return a.type !== 'cut'; });
    return {
      sourceId: d.id,
      name: d.name,
      specs: Object.assign({}, d.specs || {}),
      status: d.status || 'not-started',
      versions: versions.map(function (v) { return versionNode(v, d.currentVersionId); }),
      assets: assets.map(assetNode)
    };
  }

  function projectNode(p, peopleAcc) {
    var Store = S();
    (p.team || []).forEach(function (t) { if (t && t.personId) peopleAcc[t.personId] = true; });
    // Project-level assets = those not pinned to a deliverable (deliverable
    // assets live under their deliverable; cuts live inside versions).
    var loose = Store.listAssets({ projectId: p.id }).filter(function (a) { return !a.deliverableId && a.type !== 'cut'; });
    return {
      sourceId: p.id,
      name: p.name,
      status: p.status || 'active',
      brief: p.brief || '',
      timeline: Object.assign({ start: '', end: '' }, p.timeline || {}),
      team: (p.team || []).map(function (t) { return { personId: t.personId || '', name: t.name || '', role: t.role || '' }; }),
      deliverables: Store.listDeliverables(p.id).map(deliverableNode),
      assets: loose.map(assetNode)
    };
  }

  function peopleFor(idMap) {
    var Store = S();
    return Object.keys(idMap).map(function (pid) {
      var per = Store.getPerson(pid);
      return per ? { sourceId: per.id, name: per.name, role: per.role, email: per.email || '' } : null;
    }).filter(Boolean);
  }

  function wrap(kind, client, brand, projects, peopleAcc) {
    var Store = S();
    return {
      schema: SCHEMA,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      kind: kind,
      source: { app: 'Studio S', storeVersion: (Store.load() || {}).version || null },
      client: { sourceId: client.id, name: client.name, brand: brand },
      projects: projects,
      people: peopleFor(peopleAcc)
    };
  }

  // ── public: assemble a portable bundle for a whole client ──
  function exportClient(clientId) {
    var Store = S();
    var client = Store.getClient(clientId);
    if (!client) return null;
    var peopleAcc = {};
    var projects = Store.listProjects(clientId).map(function (p) { return projectNode(p, peopleAcc); });
    // Brand is read straight off the client (the LIVE governed source, ⑦).
    return wrap('client', client, Object.assign(Store.defaultBrand(), client.brand || {}), projects, peopleAcc);
  }

  // ── public: assemble a portable bundle for a single project ──
  // Carries the governed brand so the project is self-contained end-to-end.
  function exportProject(projectId) {
    var Store = S();
    var p = Store.getProject(projectId);
    if (!p) return null;
    var client = Store.getClient(p.clientId) || { id: '', name: 'Unassigned' };
    var brand = Store.getProjectBrand(projectId) || Store.defaultBrand();
    var peopleAcc = {};
    var node = projectNode(p, peopleAcc);
    return wrap('project', client, brand, [node], peopleAcc);
  }

  function toJSON(bundle) { return JSON.stringify(bundle, null, 2); }

  function filenameFor(bundle) {
    var label = bundle.kind === 'project' && bundle.projects[0] ? bundle.projects[0].name : bundle.client.name;
    var date = (bundle.exportedAt || '').slice(0, 10);
    return 'studio-s_' + bundle.kind + '_' + slug(label) + (date ? '_' + date : '') + '.json';
  }

  // ── browser-only: trigger a file download; fall back to clipboard ──
  function downloadBundle(bundle, filename) {
    if (!bundle) return null;
    var json = toJSON(bundle);
    var name = filename || filenameFor(bundle);
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      return json;
    } catch (e) {
      try { if (navigator.clipboard) navigator.clipboard.writeText(json); } catch (e2) {}
      return json;
    }
  }

  // One-call convenience for the UI triggers.
  function downloadClient(clientId) { return downloadBundle(exportClient(clientId)); }
  function downloadProject(projectId) { return downloadBundle(exportProject(projectId)); }

  window.Exporter = {
    exportClient: exportClient, exportProject: exportProject,
    toJSON: toJSON, filenameFor: filenameFor,
    downloadBundle: downloadBundle, downloadClient: downloadClient, downloadProject: downloadProject,
    SCHEMA: SCHEMA, SCHEMA_VERSION: SCHEMA_VERSION
  };
})();
