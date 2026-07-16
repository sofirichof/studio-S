// Studio S — auto-update check.
//
// Two entry points, one code path:
//  • Automatic: runs once at app launch (guarded per session), on any page that
//    includes this script — shows a banner if a newer signed build exists.
//  • Manual: window.Updater.checkNow() runs the same check on demand (ignoring the
//    once-per-launch guard) and resolves a status the caller can display inline.
//
// Notes:
//  • No-ops outside the Tauri app (e.g. browser QA) — never throws on the web preview.
//  • Uses the global Tauri APIs (withGlobalTauri: true) — no bundler/import needed.
//  • Never uses window.confirm/prompt (the wry webview mangles them); the UI is a
//    self-styled banner injected into the page.
(function () {
  var T = window.__TAURI__;
  function inApp() { return !!(T && T.updater && typeof T.updater.check === 'function'); }

  function relaunch() {
    if (T && T.process && typeof T.process.relaunch === 'function') return T.process.relaunch();
    // Fallback: nothing we can do to relaunch; the install still applies next open.
  }

  function banner(update) {
    if (document.getElementById('afs-update-banner')) return;
    var wrap = document.createElement('div');
    wrap.id = 'afs-update-banner';
    wrap.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
      'z-index:2147483647', 'display:flex', 'align-items:center', 'gap:14px',
      'padding:12px 16px', 'background:#16161D', 'color:#fff', 'border-radius:12px',
      "font-family:'Host Grotesk',system-ui,sans-serif", 'font-size:13px',
      'box-shadow:0 8px 30px rgba(0,0,0,0.35)', 'max-width:calc(100vw - 32px)'
    ].join(';');

    var label = document.createElement('span');
    var v = update && update.version ? ' (v' + update.version + ')' : '';
    label.textContent = 'A new version of Studio S is available' + v + '.';
    label.style.cssText = 'font-weight:400;letter-spacing:-0.01em;';

    var later = document.createElement('button');
    later.textContent = 'Later';
    later.style.cssText = 'height:32px;padding:0 12px;background:transparent;border:none;color:#9A9AA8;font:inherit;font-weight:500;cursor:pointer;';
    later.onclick = function () { wrap.remove(); };

    var go = document.createElement('button');
    go.textContent = 'Update & restart';
    go.style.cssText = 'height:32px;padding:0 16px;background:#0217D3;border:none;border-radius:8px;color:#fff;font:inherit;font-weight:500;cursor:pointer;';
    go.onclick = function () {
      go.disabled = true;
      later.style.display = 'none';
      label.textContent = 'Downloading update…';
      Promise.resolve()
        .then(function () { return update.downloadAndInstall(); })
        .then(function () { label.textContent = 'Restarting…'; return relaunch(); })
        .catch(function (e) {
          label.textContent = 'Update failed — try again later.';
          go.style.display = 'none';
          later.style.display = '';
          later.textContent = 'Dismiss';
          console.error('[updater] install failed:', e);
        });
    };

    wrap.appendChild(label);
    wrap.appendChild(later);
    wrap.appendChild(go);
    document.body.appendChild(wrap);
  }

  // The one check path. Resolves a status object; shows the banner when an update
  // is available. `manual` only affects logging (auto stays quiet on errors).
  function doCheck(manual) {
    if (!inApp()) return Promise.resolve({ status: 'unavailable' });
    return Promise.resolve()
      .then(function () { return T.updater.check(); })
      .then(function (update) {
        // v2 returns an Update object (or null); some versions expose `.available`.
        if (!update || update.available === false) return { status: 'current' };
        banner(update);
        return { status: 'available', version: (update && update.version) || '' };
      })
      .catch(function (e) {
        if (!manual) console.warn('[updater] check skipped:', e);
        return { status: 'error', error: String(e && e.message || e) };
      });
  }

  // Manual entry point for a "Check for updates" button. Always exposed (even in
  // the browser) so callers can show the "desktop app only" message.
  window.Updater = {
    checkNow: function () { return doCheck(true); },
    inApp: inApp,
    getVersion: function () {
      try { if (T && T.app && typeof T.app.getVersion === 'function') return T.app.getVersion(); } catch (e) {}
      return Promise.resolve('');
    }
  };

  // ── automatic check on launch ──
  if (!inApp()) return;
  // Once per app launch, and not on the very first paint. sessionStorage (not a
  // window global) survives in-app navigation and clears when the app closes, so
  // the check fires once per open rather than on every page load.
  try {
    if (sessionStorage.getItem('afsUpdateChecked')) return;
    sessionStorage.setItem('afsUpdateChecked', '1');
  } catch (e) {
    if (window.__afsUpdateChecked) return;
    window.__afsUpdateChecked = true;
  }
  function run() { doCheck(false); }
  // Give the UI a moment so the check never competes with first paint.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(run, 1500);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(run, 1500); });
  }
})();
