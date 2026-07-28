// Studio S — one renderer for every validator's findings.
//
// continuity.js and coherence.js both emit { rule, message, severity } on
// purpose, so there is exactly one place that decides what a warning looks
// like. Two nearly-identical warning UIs would drift within a release.
//
// Rules of the surface, all deliberate:
//   • NOTHING BLOCKS. Every finding is advisory. An aerial dutch shot or a
//     centred negative-space frame can be a real choice; the app notices, it
//     does not overrule.
//   • `info` renders muted and is NOT counted. If an informational note carries
//     the same weight as a contradiction, you learn to ignore all three.
//   • No dismissal in v1. A dismissible warning becomes a warning everyone
//     dismisses, and the rules that fire here are defects you would fix rather
//     than live with. If it is ever needed, acknowledge a RULE on a SHOT.
(function () {
  var STYLE = {
    error: { dot: '#FF002E', text: '#B00020', label: 'Problem' },
    warn:  { dot: '#9A5B00', text: '#9A5B00', label: 'Check' },
    info:  { dot: '#9A9AA8', text: '#9A9AA8', label: 'Note' }
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function list(findings) { return Array.isArray(findings) ? findings : []; }

  // Counts drive the rollup badges. `info` is excluded from `total` so the
  // number on a scene header always means "things worth looking at".
  function count(findings) {
    var c = { error: 0, warn: 0, info: 0, total: 0 };
    list(findings).forEach(function (f) {
      var s = STYLE[f.severity] ? f.severity : 'warn';
      c[s] += 1;
      if (s !== 'info') c.total += 1;
    });
    return c;
  }

  // A small count badge, or '' when there is nothing worth showing.
  function badge(findings) {
    var c = count(findings);
    if (!c.total) return '';
    var colour = c.error ? STYLE.error.dot : STYLE.warn.dot;
    return '<span style="display:inline-flex;align-items:center;justify-content:center;'
      + 'min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:' + colour + ';'
      + 'color:#fff;font-size:10px;font-weight:500;line-height:1;">' + c.total + '</span>';
  }

  // A single dot for a shot card — presence, not count.
  function dot(findings) {
    var c = count(findings);
    if (!c.total) return '';
    var colour = c.error ? STYLE.error.dot : STYLE.warn.dot;
    return '<span title="' + c.total + ' to check" style="display:inline-block;width:6px;height:6px;'
      + 'border-radius:50%;background:' + colour + ';flex-shrink:0;"></span>';
  }

  // The full list. `opts.title` prefixes it; `opts.compact` drops the heading.
  function render(findings, opts) {
    opts = opts || {};
    var fs = list(findings);
    if (!fs.length) return '';
    var order = { error: 0, warn: 1, info: 2 };
    var sorted = fs.slice().sort(function (a, b) {
      return (order[a.severity] == null ? 1 : order[a.severity])
        - (order[b.severity] == null ? 1 : order[b.severity]);
    });
    var rows = sorted.map(function (f) {
      var s = STYLE[f.severity] || STYLE.warn;
      // Continuity findings carry a shotLabel and no controls; coherence
      // findings the reverse. Joining the parts that exist avoids the dangling
      // "1B · —" separator when only one of them is present.
      var where = [
        f.shotLabel ? esc(f.shotLabel) : '',
        (Array.isArray(f.controls) && f.controls.length) ? esc(f.controls.join(' + ')) : ''
      ].filter(Boolean).join(' · ');
      return '<div style="display:flex;gap:7px;align-items:flex-start;padding:3px 0;">'
        + '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:'
        + s.dot + ';margin-top:5px;flex-shrink:0;"></span>'
        + '<p style="font-size:11.5px;line-height:1.45;color:' + s.text + ';">'
        + (where ? '<span style="opacity:.75;">' + where + ' — </span>' : '')
        + esc(f.message) + '</p></div>';
    }).join('');
    var heading = opts.compact ? '' :
      '<p style="font-size:11px;font-weight:500;color:#16161D;margin-bottom:4px;">'
      + esc(opts.title || 'Worth checking') + '</p>';
    return '<div style="background:#FFFBF2;border:1px solid rgba(154,91,0,.18);'
      + 'border-radius:8px;padding:9px 11px;margin:8px 0;">' + heading + rows + '</div>';
  }

  window.Findings = { render: render, count: count, badge: badge, dot: dot, STYLE: STYLE };
})();
