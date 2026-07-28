// Studio S — camera/look coherence checks.
//
// Eight controls across three tabs, each a closed enum, none aware of any
// other, all joined unconditionally. Nothing validated the COMBINATION, so
// the app happily compiled prompts that contradict themselves — and two of the
// worst cases were the DEFAULT state, not a rare mis-selection:
//   • `angle` defaults to 'eye', so every aerial shot claimed eye level
//     (now fixed in the join — aerial suppresses the angle clause).
//   • `comp` defaults to 'mc', so every negative-space shot also asked for the
//     subject centred.
//
// Pure functions over one shot's builder. No UI, no Store, no rendering —
// callers decide how to surface `findings`, exactly like continuity.js. Same
// finding contract: { rule, message, severity }.
//
// These WARN, they never block. An aerial dutch shot or a centred negative-
// space frame can be deliberate; the app's job is to notice, not to overrule.
(function () {
  // Realism chips are stored by label. Keep in sync with promptcompile's
  // realism group; the drift test fails if this label stops existing.
  var BOKEH_CHIP = 'Bokeh + parallax';
  var LONG_LENSES = ['85'];
  var CLOSE_SIZES = ['extreme', 'close'];

  function has(v) { return !!String(v == null ? '' : v).trim(); }
  function chipList(b, group) {
    var chips = (b && b.chips) || {};
    var v = chips[group];
    return Array.isArray(v) ? v : (has(v) ? [v] : []);
  }

  function checkShot(builder) {
    var b = builder || {};
    var findings = [];
    function flag(rule, message, severity) {
      findings.push({ rule: rule, message: message, severity: severity || 'warn' });
    }

    var framing = Array.isArray(b.framing) ? b.framing : [];
    var realism = chipList(b, 'realism');

    // 1. Direct contradiction, and it spans two tabs so you cannot see both at
    //    once: "deep focus, sharp from front to back" + "creamy bokeh".
    if (b.depth === 'deep' && realism.indexOf(BOKEH_CHIP) !== -1) {
      flag('depth-bokeh',
        'Deep focus and "' + BOKEH_CHIP + '" contradict each other — the prompt asks for everything sharp and for creamy bokeh in the same breath. Drop one.',
        'error');
    }

    // 2. Physically impossible rather than merely inconsistent: a long lens at
    //    insert distance cannot hold front-to-back sharpness.
    if (LONG_LENSES.indexOf(String(b.lens)) !== -1
      && b.depth === 'deep'
      && CLOSE_SIZES.indexOf(b.shot) !== -1) {
      flag('lens-depth-distance',
        b.lens + 'mm at this distance cannot hold deep focus — on a tabletop insert that is not a look, it is impossible. Use a shorter lens or accept shallow.',
        'warn');
    }

    // 3. Negative space means the subject sits off-centre. `comp` defaults to
    //    'mc', so this fires on the default state rather than a mis-click.
    if (b.comp === 'mc' && framing.indexOf('Negative space') !== -1) {
      flag('comp-negative-space',
        'Negative space with the subject centred pulls against itself — negative space needs the subject off-centre to read. Move the placement or drop the framing.',
        'warn');
    }

    // 4. Not a conflict any more — the join suppresses it — but the control is
    //    still sitting there looking like it does something.
    if (b.shot === 'aerial' && has(b.angle) && b.angle !== 'eye') {
      flag('aerial-angle-ignored',
        'Aerial already fixes the camera height, so the angle is not used in the prompt. Nothing is broken; the control just has no effect here.',
        'info');
    }

    return findings;
  }

  window.Coherence = { checkShot: checkShot, BOKEH_CHIP: BOKEH_CHIP };
})();
