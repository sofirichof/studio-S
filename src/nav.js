// Shared navigation wiring for the Tauri build.
// Uses event delegation so navigation survives the DC runtime re-rendering
// the sidebar (per-node listeners would go stale on every re-render).
(function () {
  var MAP = {
    'home': 'home.html',
    'prompt builder': 'promptbuilder.html',
    'references': 'references.html',
    'multi-shot': 'multishot.html',
    'projects': 'projects.html',
    'palmier': 'palmier.html',
    'finishing': 'finishing.html',
    'workflow guide': 'workflow.html',
    'ai setup': 'aisetup.html'
  };

  function go(url) { window.location.href = url; }

  // Resolve a click to a nav destination, but ONLY when it lands inside an actual
  // sidebar row (.nav-item). Earlier this walked the whole ancestor chain matching
  // any nearby label text, which wrongly hijacked buttons like "New project" (it
  // found the page's "Projects" heading and reloaded the page). Scoping to .nav-item
  // keeps real nav working without swallowing content clicks.
  function navTargetFor(el) {
    var row = el.closest ? el.closest('.nav-item') : null;
    if (!row) return null;
    var spans = row.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) {
      var key = (spans[i].textContent || '').trim().toLowerCase();
      if (MAP[key]) return MAP[key];
    }
    return null;
  }

  // Single delegated click handler — never goes stale.
  // (The old "Finish setup" hijack that forced promptbuilder.html is gone —
  // index.html's Done step owns its own destinations now.)
  document.addEventListener('click', function (e) {
    var dest = navTargetFor(e.target);
    if (dest) { e.preventDefault(); go(dest); }
  }, true);

  // OmniEdit was a non-functional mockup — removed. Hide any leftover nav rows
  // for it centrally so we don't have to edit every page's sidebar markup.
  var REMOVED = { 'omniedit': 1 };

  // Make sidebar rows look clickable (cosmetic only; clicks work via delegation),
  // and hide removed features.
  function markCursors() {
    var spans = document.querySelectorAll('span');
    spans.forEach(function (s) {
      var key = (s.textContent || '').trim().toLowerCase();
      if (REMOVED[key] && s.parentElement) { s.parentElement.style.display = 'none'; return; }
      if (MAP[key] && s.parentElement) s.parentElement.style.cursor = 'pointer';
    });
  }

  // Replace leftover hardcoded campaign names with the real active project.
  function norm(s){ return (s||'').trim().toLowerCase().replace(/[‒-―]/g,'-'); }
  var MOCK_NAMES = { 'us bank - rotation 4': 1, 'us bank — rotation 4': 1, 'us bank': 1, 'rotation 4 (cmc)': 1, 'us bank — super bowl lxi': 1, 'nike — air max 2026': 1 };
  var MOCK_NORM = {}; Object.keys(MOCK_NAMES).forEach(function(k){ MOCK_NORM[norm(k)] = 1; });
  function decorateProjectName() {
    if (!window.Store) return;
    var active = Store.getActive();
    var name = active && active.project ? active.project.name : 'No project';
    var nodes = document.querySelectorAll('span, option');
    nodes.forEach(function (n) {
      if (n.children && n.children.length) return; // leaf only
      if (MOCK_NORM[norm(n.textContent)]) n.textContent = name;
    });
  }

  // ── Sidebar project dropdown ──
  // Every page except projects.html (which owns #project-select) gets its
  // sidebar select managed here: populated from the Store, active project
  // selected, and switching wired to setActive + reload. Pages missing the
  // dropdown entirely (workflow, aisetup) get one inserted so the sidebar is
  // identical everywhere.
  var CARET = '<svg style="position:absolute;right:8px;top:50%;transform:translateY(-50%);pointer-events:none;" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#9A9AA8" stroke-width="1.5" stroke-linecap="round"><path d="M3 5l3 3 3-3"></path></svg>';
  var SELECT_CSS = 'width:100%;height:32px;background:#F7F5EF;border:1px solid rgba(16,16,32,.08);border-radius:8px;padding:0 28px 0 10px;font-family:\'Host Grotesk\',system-ui,sans-serif;font-size:12px;color:#16161D;appearance:none;cursor:pointer;font-weight:500;visibility:hidden;';
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function initProjectSelect() {
    if (!window.Store) return;
    var sidebar = document.querySelector('div[style*="border-right"]');
    if (!sidebar) return;
    var scroll = sidebar.children[1];
    if (!scroll) return;
    var sel = scroll.querySelector('select');
    if (sel && sel.id === 'project-select') return; // projects.html manages its own

    if (!sel) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'padding:0 8px;margin-bottom:16px;';
      wrap.innerHTML = '<div style="position:relative;"><select style="' + SELECT_CSS + '"></select>' + CARET + '</div>';
      scroll.insertBefore(wrap, scroll.firstChild);
      sel = wrap.querySelector('select');
    }

    var projects = Store.listProjects();
    var active = Store.getActive();
    var html = projects.length
      ? projects.map(function (p) {
          return '<option value="' + escHtml(p.id) + '"' + (p.id === active.projectId ? ' selected' : '') + '>' + escHtml(p.name) + '</option>';
        }).join('')
      : '<option value="">No project yet</option>';
    // Only rewrite when stale (signature check — innerHTML re-serializes
    // attributes so comparing it directly always looks different).
    var sig = projects.map(function (p) { return p.id + ':' + p.name; }).join('|') + '@' + active.projectId;
    if (sel.getAttribute('data-sg-sig') !== sig) {
      sel.innerHTML = html;
      sel.setAttribute('data-sg-sig', sig);
    }
    sel.style.cursor = 'pointer';
    sel.onchange = function () {
      if (sel.value) { Store.setActive({ projectId: sel.value }); window.location.reload(); }
    };
    // Reveal only once populated. Pages author the sidebar select hidden
    // (visibility:hidden) so the placeholder never flashes before the real
    // projects load, and so a DC-runtime re-render that reverts to the authored
    // markup stays invisible until this repopulates it (BUG-09).
    sel.style.visibility = 'visible';
  }

  // ── Theme wiring (theme.css) ──
  // Inject the shared stylesheet + film-leader ribbon once, and convert the
  // page's active nav row (inline #EEF0FF pill) into the blue REC pill.
  function initTheme() {
    if (!document.head || !document.body) return;
    if (!document.getElementById('sg-theme-css')) {
      var link = document.createElement('link');
      link.id = 'sg-theme-css';
      link.rel = 'stylesheet';
      link.href = './theme.css';
      document.head.appendChild(link);
    }
    if (!document.querySelector('.sg-ribbon')) {
      var ribbon = document.createElement('div');
      ribbon.className = 'sg-ribbon';
      document.body.appendChild(ribbon);
    }
    // Active row: sidebar row with the inline soft-blue background and the
    // 2px accent-bar child. Detected by computed style so spacing variants
    // in each page's inline markup don't matter.
    var sidebar = document.querySelector('div[style*="border-right"]');
    if (!sidebar) return;
    // The DC runtime re-serializes style attributes (e.g. `background:#EEF0FF`
    // becomes `background: rgb(238, 240, 255)`), so match on computed style,
    // not the attribute text.
    var rows = sidebar.querySelectorAll('div');
    rows.forEach(function (row) {
      if (row.classList.contains('sg-nav-active')) return;
      if (getComputedStyle(row).backgroundColor !== 'rgb(238, 240, 255)') return;
      if (!row.querySelector('span')) return;
      row.classList.add('sg-nav-active');
      // hide the old 2px left accent bar
      Array.prototype.forEach.call(row.children, function (c) {
        if (c.tagName === 'DIV' && c.offsetWidth <= 3) c.style.background = 'transparent';
      });
      if (!row.querySelector('.sg-recdot')) {
        var dot = document.createElement('div');
        dot.className = 'sg-recdot';
        row.appendChild(dot);
      }
    });
  }

  // ── Home nav row ──
  // home.html is new; older pages' authored sidebars don't have a Home row.
  // Inject one centrally (same pattern as the project select) so every page
  // gets it without editing each sidebar's markup.
  function initHomeRow() {
    var sidebar = document.querySelector('div[style*="border-right"]');
    if (!sidebar) return;
    var scroll = sidebar.children[1];
    if (!scroll) return;
    var spans = scroll.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) {
      if ((spans[i].textContent || '').trim().toLowerCase() === 'home') return; // already there
    }
    // Insert after the project-select wrap (first child) when present.
    var row = document.createElement('div');
    row.className = 'nav-item';
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:0 12px;height:36px;border-radius:8px;margin-bottom:2px;color:#5A5A6B;cursor:pointer;';
    row.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6.5L8 2l6 4.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5z"></path><path d="M6 14V9h4v5"></path></svg><span style="font-size:14px;">Home</span>';
    var first = scroll.firstChild;
    var anchor = (first && first.querySelector && first.querySelector('select')) ? first.nextSibling : first;
    scroll.insertBefore(row, anchor);
  }

  function init() { markCursors(); decorateProjectName(); initProjectSelect(); initHomeRow(); initTheme(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
  // Re-run cosmetics after the DC runtime re-renders (navigation itself is delegated).
  var mo = new MutationObserver(function () {
    // Guard against feedback loops from our own text edits. try/finally so a
    // throw inside init() can't kill the observer for the rest of the session.
    mo.disconnect();
    try { init(); } catch (e) {}
    finally { mo.observe(document.body, { childList: true, subtree: true }); }
  });
  // Attach immediately when the DOM is already parsed — waiting only for
  // DOMContentLoaded misses pages where nav.js runs after it fired, leaving
  // DC-runtime re-renders unobserved (e.g. the OmniEdit row reappearing and
  // shifting the sidebar on some tabs).
  function attachObserver() {
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState !== 'loading') attachObserver();
  else document.addEventListener('DOMContentLoaded', attachObserver);
})();
