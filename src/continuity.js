// Studio S — structural continuity validator (Phase 3 step B1).
// Pure functions over a scene's shots. No UI, no rendering, no prompt changes —
// callers decide how to surface `findings` (that's step C). Every rule here is
// one that tripped correctly in the manual dry run; the semantic checks that
// need judgment (prop regression, eyeline compatibility) are a separate pass
// (B2/B3) once B2 has designed that contract.
(function () {
  // Keep in sync with SHOT_PURPOSES in store.js. Duplicated (not read live off
  // Store) so this module stays usable standalone; the drift-guard test in
  // tests/continuity.test.cjs fails if the two lists disagree.
  var SHOT_PURPOSES = ['establishing', 'master', 'two-shot', 'group', 'single',
    'reaction', 'insert', 'product detail', 'cutaway', 'location texture',
    'match action', 'transition', 'final wide', 'hero product'];
  var NON_ACTION_PURPOSES = ['reaction', 'insert', 'product detail', 'location texture'];
  var SEQUENCE_MARKERS = ['then', 'after which', 'and then'];
  var CAMERA_KEYS = ['shot', 'lens', 'angle', 'depth', 'move'];

  function has(v) { return !!String(v == null ? '' : v).trim(); }
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cameraSignature(b) { return CAMERA_KEYS.map(function (k) { return b[k]; }).join('|'); }

  // Checks a single scene's shots against every structural rule. `characterNames`
  // is the concept's cast — the descriptions the plan wrote up as the
  // consistency bible — so this stays a pure function over data the caller
  // already has, rather than reaching into Store itself.
  function checkScene(scene, characterNames) {
    var shots = (scene && scene.shots) || [];
    characterNames = characterNames || [];
    var findings = [];
    function flag(shotLabel, rule, message, severity) {
      findings.push({ shotLabel: shotLabel || '', rule: rule, message: message, severity: severity || 'warn' });
    }

    var establishingSeen = 0;
    var distinctSetups = {};
    var hasNonAction = false;

    shots.forEach(function (sh, i) {
      var b = sh.builder || {};
      var label = sh.label || ('#' + (i + 1));

      if (!has(b.offCamera)) flag(label, 'continuity-offcamera', 'No off-camera note — anyone who left the crop is undocumented.', 'warn');
      if (!has(b.propState)) flag(label, 'continuity-propstate', 'No prop-state note — nothing carried forward from the last shot.', 'warn');

      if (!has(b.purpose)) {
        flag(label, 'purpose-missing', 'No editorial purpose set.', 'error');
      } else if (SHOT_PURPOSES.indexOf(b.purpose) === -1) {
        flag(label, 'purpose-vocab', 'Purpose "' + b.purpose + '" is not in the vocabulary.', 'error');
      } else {
        if (b.purpose === 'establishing') {
          establishingSeen++;
          if (establishingSeen > 1) flag(label, 'establishing-once', 'More than one "establishing" shot in this scene.', 'error');
          if (i !== 0) flag(label, 'establishing-first', '"establishing" must be the scene\'s first shot.', 'error');
        }
        if (NON_ACTION_PURPOSES.indexOf(b.purpose) !== -1) hasNonAction = true;
      }

      distinctSetups[cameraSignature(b)] = true;

      var action = String(b.action || '');
      SEQUENCE_MARKERS.forEach(function (marker) {
        var re = new RegExp('\\b' + marker.replace(/ /g, '\\s+') + '\\b', 'i');
        if (re.test(action)) flag(label, 'action-sequence', 'Action reads as a sequence ("' + marker + '") — one frozen instant only.', 'warn');
      });

      characterNames.forEach(function (name) {
        var re = new RegExp(escapeRe(name), 'i');
        if (!re.test(String(b.subject || '')) && !re.test(String(b.offCamera || ''))) {
          flag(label, 'character-unaccounted', '"' + name + '" is not in subject or offCamera.', 'warn');
        }
      });
    });

    if (shots.length && Object.keys(distinctSetups).length < Math.ceil(shots.length / 2)) {
      flag('', 'camera-repetition', 'Fewer than half the shots in this scene have a distinct camera setup.', 'warn');
    }
    if (shots.length && !hasNonAction) {
      flag('', 'coverage-balance', 'No reaction / insert / product detail / location texture shot in this scene.', 'warn');
    }

    return findings;
  }

  window.Continuity = { checkScene: checkScene };
})();
