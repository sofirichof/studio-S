// Reference-sheet templates — character / prop-product / location.
//
// SOURCE OF TRUTH. Reverse-engineered from shipped prompts in a dedicated
// session; the long-form reasoning lives in docs/research/hero-prompt-templates.md
// and the fill-and-send copies in docs/research/copy-paste-templates.md.
// Do not "improve" the constant text from memory or general prompting instinct —
// it is what makes these work. If a change is needed, take it back to that
// research and update both copies (a drift test in tests/handoff-fields.test.cjs
// fails if they diverge).
//
// ONE SOURCE, TWO RENDERINGS:
//   forHandoff(kind) — every {{TOKEN}} becomes a [BRACKET: hint] for the
//                      planning agent to fill. Inlined into the pasted
//                      instructions by buildClaudeInstructions().
//   fill(kind, vals) — every {{TOKEN}} becomes the user's wizard answer.
//                      Used by PromptCompile.compileReferencePrompt(), so the
//                      References wizard produces the same sheet by hand.
// Unanswered tokens stay visible as [BRACKET] rather than vanishing — a hole
// you can see beats a sentence that quietly lost its subject.
//
// WHY IT SHIPS IN THE APP: the planning agent runs against the user's OWN
// project folder, which will never contain the research doc, and the app has no
// filesystem write command to put it there. The only way the agent sees these
// is inlined into the pasted handoff.
(function () {

  // ── Field schemas. `key` doubles as the wizard field id and the {{TOKEN}}. ──
  var FIELDS = {
    character: [
      { key: 'GENDER', label: 'Man or woman', type: 'text', placeholder: 'man', hint: 'man/woman' },
      { key: 'AGE', label: 'Age', type: 'text', placeholder: '30s', hint: 'AGE' },
      { key: 'ETHNICITY', label: 'Ethnicity / nationality', type: 'text', placeholder: 'Puerto Rican', hint: 'ETHNICITY/NATIONALITY' },
      { key: 'SKIN', label: 'Skin tone', type: 'text', placeholder: 'warm medium-brown skin', hint: 'SKIN TONE' },
      { key: 'HAIR', label: 'Hair', type: 'textarea', placeholder: 'short black hair, tight curls, worn brushed back', hint: 'HAIR: length + texture + colour + how it is worn' },
      { key: 'EVIDENCE', label: 'Character evidence', type: 'textarea', placeholder: 'deep smile lines, a small scar through the left brow, sun freckles across the nose', hint: 'CHARACTER EVIDENCE — freckles / wrinkles / age spots / receding hairline / scars' },
      { key: 'EYES', label: 'Eye colour', type: 'text', placeholder: 'dark brown', hint: 'EYE COLOUR' },
      { key: 'ACCESSORY', label: 'Accessory, in full', type: 'text', placeholder: 'thin gold-rimmed round glasses', hint: 'ACCESSORY IN FULL' },
      { key: 'EXPRESSION', label: 'Expression', type: 'text', placeholder: 'unsmiling', hint: 'EXPRESSION' },
      { key: 'BUILD', label: 'Build', type: 'text', placeholder: 'lean, narrow-shouldered', hint: 'BUILD' },
      { key: 'HEIGHT', label: 'Height in metres', type: 'text', placeholder: '1.78', hint: 'HEIGHT' },
      { key: 'GARMENTS', label: 'Outfit', type: 'textarea', placeholder: 'a boxy charcoal work jacket in heavy cotton twill with a torn left cuff, a washed white tee, straight dark indigo jeans', hint: 'GARMENT 1 — fit + colour + material + one specific detail], [GARMENT 2], [GARMENT 3' },
      { key: 'FOOTWEAR', label: 'Footwear', type: 'text', placeholder: 'scuffed tan leather boots', hint: 'FOOTWEAR' },
      { key: 'LAYERING', label: 'What the front view shows', type: 'text', placeholder: 'how the jacket sits open over the tee', hint: 'NAME THE LAYERING' },
      { key: 'FAKEABLE', label: 'Parts the model will cheat', type: 'textarea', placeholder: 'the jacket back yoke and its two seams, the rear pocket stitching', hint: 'THE SPECIFIC FAKEABLE PARTS' }
    ],
    prop: [
      { key: 'SUBJECT', label: 'Subject', type: 'text', placeholder: 'a brass spyglass', hint: 'SUBJECT' },
      { key: 'GLOSS', label: 'Disambiguating gloss', type: 'text', placeholder: 'collapsible nautical telescope', hint: 'DISAMBIGUATING GLOSS' },
      { key: 'ORIENTATION', label: 'Orientation', type: 'text', placeholder: 'lying slightly tilted toward camera', hint: 'ORIENTATION — e.g. lying slightly tilted toward camera' },
      { key: 'MUSTREAD', label: 'What must read clearly', type: 'text', placeholder: 'the draw-tube segments and the engraved ring', hint: 'WHAT MUST READ' },
      { key: 'PARTS', label: 'Part-by-part sweep', type: 'textarea', placeholder: 'body in aged brass with a softly worn patina; the draw tubes machined, edges polished bright from use; the grip wrapped in dark oiled leather, slightly cracked; the objective lens clear with a faint cool cast', hint: 'PART-BY-PART SWEEP — for each part: material + finish + one wear detail. Body, then controls, then grip, then glass, then markings' },
      { key: 'MATERIALLIGHT', label: 'Per-material light behaviour', type: 'textarea', placeholder: 'metallic specular falloff on the brass, matte grain on the leather, clear glass refraction at the lens', hint: 'PER-MATERIAL LIGHT BEHAVIOUR: metallic specular falloff on brass, matte grain on leather, clear glass refraction at the lens' },
      { key: 'SUBJECTHEX', label: 'Subject colour hex (optional)', type: 'text', placeholder: '#8C6A3F', hint: 'SUBJECT COLOUR (#HEX), restated for every part that uses it' },
      { key: 'DESIGNLANG', label: 'Design language (optional)', type: 'text', placeholder: 'built like rugged broadcast hardware', hint: 'DESIGN LANGUAGE BY CLASS' },
      { key: 'GUARDRAILS', label: 'Taste guardrails (optional)', type: 'text', placeholder: 'not a toy colour, no glossy plastic, no toy-like look', hint: 'TASTE GUARDRAILS' },
      { key: 'ASPECT', label: 'Aspect ratio', type: 'text', placeholder: '4:5', hint: 'ASPECT RATIO' }
    ],
    location: [
      { key: 'VARIANT', label: 'Does the image model already know this place?', type: 'select', options: [
        { value: 'A', label: 'No — generic or invented (block it out fully)' },
        { value: 'B', label: 'Yes — strong archetype (spend on materials + signatures)' }
      ], hint: '' },
      { key: 'SUBJECT', label: 'Subject', type: 'text', placeholder: 'a corner bodega interior', hint: 'SUBJECT' },
      { key: 'LIGHTSTATE', label: 'Named light state', type: 'text', placeholder: 'dawn blue-golden transition', hint: 'NAMED LIGHT STATE — e.g. dawn blue-golden transition / warm cozy evening' },
      { key: 'ARCH', label: 'Architecture', type: 'textarea', placeholder: 'off-white stucco walls, dark grey roof trim, charcoal brick entrance', hint: 'ARCHITECTURE: material + colour per element' },
      { key: 'SIZE', label: 'Rough size in m² (variant A)', type: 'text', placeholder: '30', hint: 'N' },
      { key: 'STYLE', label: 'Style (variant A)', type: 'text', placeholder: 'mid-century, lived-in', hint: 'STYLE' },
      { key: 'CAMERA', label: 'Camera position (variant A)', type: 'textarea', placeholder: 'at standing height near the doorway, angled slightly down so the counter leads the eye back', hint: 'HEIGHT] near the [POSITION IN THE SPACE], angled [HOW] so [WHAT THAT ACHIEVES' },
      { key: 'FOREGROUND', label: 'Foreground (variant A)', type: 'textarea', placeholder: 'a stack of crates angled toward camera, catching the window light along their top edges', hint: 'OBJECTS — each with its orientation toward camera or another object, and the lighting consequence' },
      { key: 'MIDDLE', label: 'Middle depth (variant A)', type: 'textarea', placeholder: 'the counter running left to right, register facing away from camera', hint: 'as above' },
      { key: 'BACKGROUND', label: 'Background (variant A)', type: 'textarea', placeholder: 'the fridge wall, its strip lights throwing a cold pool onto the floor', hint: 'as above], [PRACTICAL LIGHT SOURCE + its own pool of light' },
      { key: 'EXITS', label: 'Windows / doors (variant A)', type: 'textarea', placeholder: 'street door frame left, standing open onto a wet pavement', hint: 'windows / doors / exits, and what is beyond them' },
      { key: 'LIGHTMIX', label: 'The lighting mix (variant A)', type: 'textarea', placeholder: 'warm sodium street light mixing with the cold fridge strips, gentle warm-cool contrast', hint: 'THE MIX, reconciling every local source' },
      { key: 'COMPOSITION', label: 'Composition (variant A)', type: 'textarea', placeholder: 'counter on the left third, shelves receding right, doorway anchoring the bottom corner', hint: 'SUBJECT] on the [left third], [what recedes where], [what anchors which corner], [negative space where' },
      { key: 'OBJECTS', label: 'Objects (variant B)', type: 'textarea', placeholder: 'a vending machine beside the entrance, a bicycle against the wall, a low planter', hint: 'OBJECT placed relative to the architecture], [OBJECT], [OBJECT' },
      { key: 'SIGNATURES', label: 'Genre signatures (variant B)', type: 'textarea', placeholder: 'overhead utility wires stretching across the sky; a hand-painted shop sign', hint: 'GENRE SIGNATURE 1 — overhead utility wires stretching across the sky], [GENRE SIGNATURE 2' },
      { key: 'LAYERED', label: 'See-through detail (variant B, optional)', type: 'textarea', placeholder: 'shutters partially open, revealing soft pink curtains through the glass', hint: 'LAYERED / SEE-THROUGH DETAIL' },
      { key: 'PALETTE', label: 'Palette', type: 'text', placeholder: 'warm amber against cold blue, dirty cream, one red accent on the awning', hint: 'COLOUR A] against [COLOUR B], [COLOUR C], [ACCENT — must be an object actually in frame' },
      { key: 'LENS', label: 'Lens + depth of field', type: 'text', placeholder: '35mm, deep focus holding the counter and the back wall', hint: 'mm], [DOF + WHAT IS IN FOCUS' },
      { key: 'STOCK', label: 'Stock or sensor + its artifacts', type: 'textarea', placeholder: 'Kodak Portra 400 — grain in the shadows, halation around the practicals, corner falloff', hint: 'STOCK OR SENSOR] — [ITS ARTIFACTS: grain in the shadows, halation around the practicals, corner falloff' },
      { key: 'ASPECT', label: 'Aspect ratio', type: 'text', placeholder: '2.39:1', hint: 'ASPECT RATIO' },
      { key: 'MOOD', label: 'Mood, one line (optional)', type: 'text', placeholder: 'the quiet before the shop opens', hint: 'Mood: ONE LINE — keep only if the frame contains its evidence' }
    ]
  };
  FIELDS.product = FIELDS.prop;

  // ── Raw templates. {{TOKEN}} matches a FIELDS key. ──
  var CHARACTER = [
    'Cinematic character reference sheet, split-frame layout, photorealistic.',
    '',
    'Left panel — facial close-up: a {{AGE}} {{ETHNICITY}} {{GENDER}}, {{SKIN}}, the entire head fully',
    'inside the frame including all the hair, nothing cropped, {{HAIR}}, {{EVIDENCE}}, {{EYES}} eyes,',
    '{{ACCESSORY}}, real skin texture with visible pores, calm {{EXPRESSION}} neutral expression,',
    'looking straight into lens. Shot on 85mm portrait lens, shallow depth of field, soft cinematic',
    'key light with gentle fill.',
    '',
    'Right panel — full-body front and back views side by side: the same {{GENDER}} shown twice within',
    'this panel — on the left, a full-body front view facing the camera; on the right, a full-body back',
    'view photographed from directly behind. In both, {{PRON}} stands straight in a normal relaxed pose,',
    'arms hanging down at {{POSS}} sides, full height in frame head-to-toe, {{BUILD}} ({{HEIGHT}}m),',
    '{{SKIN}}, {{HAIR}}, same {{ACCESSORY}}, same outfit: {{GARMENTS}}, {{FOOTWEAR}}. The front view',
    'shows {{POSS}} face, {{ACCESSORY}}, and {{LAYERING}}; the back view shows the back of {{POSS}} head,',
    'hair, shoulders, {{FAKEABLE}} and the rear of the trousers and footwear. Both figures matched in',
    'framing, scale and lighting for consistency. Shot on 35mm lens, even full-length lighting.',
    '',
    'Look: clean studio character sheet, plain solid grey background (#8a8a8a), seamless, consistent',
    'character across all views, soft diffused cinematic lighting, muted natural color grade, fine',
    'detail, true-to-life skin tones, vertical divider lines separating each view.'
  ].join('\n');

  var PROP = [
    '{{KIND}} sheet, single hero view. {{SUBJECT}} ({{GLOSS}}), shown as one clean three-quarter',
    'angle, {{ORIENTATION}}, so {{MUSTREAD}} reads clearly.',
    '',
    '{{PARTS}}. {{DESIGNLANG}} {{SUBJECTHEX}}',
    '',
    'Studio product lighting: soft key from upper left, gentle fill, subtle rim light along the top edge',
    'to separate the object from the background. Material accuracy emphasized — {{MATERIALLIGHT}}.',
    '',
    'Centered composition, full object in frame with comfortable margin. Flat solid neutral grey',
    'background (#8a8a8a), seamless, no gradient, no shadow spill beyond a soft contact shadow under the',
    'object. No props, no text, no callouts. {{GUARDRAILS}}',
    '',
    'Photoreal, high detail, sharp focus across the whole object, even resolution. {{ASPECT}}.'
  ].join('\n');

  var LOCATION_A = [
    'Cinematic film frame, three-quarter view of {{SUBJECT}} at {{LIGHTSTATE}}, no people — a movie set',
    'still, not an interior-design catalog photo. Around {{SIZE}} square metres, {{ARCH}}, {{STYLE}},',
    'lived-in.',
    '',
    'Camera {{CAMERA}}.',
    '',
    'Foreground: {{FOREGROUND}}.',
    'Middle depth: {{MIDDLE}}.',
    'Background: {{BACKGROUND}}.',
    'Sides: {{EXITS}}.',
    '',
    'Lighting: {{LIGHTMIX}}, well-exposed interior.',
    'Palette: {{PALETTE}}.',
    'Composition: {{COMPOSITION}}.',
    'Camera and lens: {{LENS}}. {{STOCK}}.',
    '{{ASPECT}}. Photorealistic.',
    'Mood: {{MOOD}}.'
  ].join('\n');

  var LOCATION_B = [
    'Three-quarter view of {{SUBJECT}} at {{LIGHTSTATE}}, no people. {{ARCH}}. {{OBJECTS}}.',
    '{{SIGNATURES}}. {{LAYERED}}',
    'Palette: {{PALETTE}}. {{LENS}}. {{STOCK}}. {{ASPECT}}.',
    'Mood: {{MOOD}}.'
  ].join('\n');

  var FILL_RULES = {
    character: [
      'FILL RULES',
      '  • Never write the abstraction. Not "late 60s" — deep age lines, forehead wrinkles, light age',
      '    spots, receding hairline, thinning hair. The age comes from the evidence.',
      '  • The fakeable-parts list is re-authored every single time, aimed at whatever the model would',
      '    cheat. Denim jacket → seams. Bathrobe → back panel and hanging belt ends.',
      '  • Skin tone, hair and accessories are deliberately restated in the right panel. Keep the repeat.',
      '  • Height is load-bearing. Do not drop it.',
      '  • Matching an existing face? Prepend: "…split-frame layout, photorealistic, matching the exact',
      '    face and identity of the person in the reference image."',
      '  • Groomed character? Add "[brushed-up brow, soft neutral shadow, glossy lip]; skin finish dewy"',
      '    to the left panel and drop "visible pores" — it pulls the other way.',
      '  • Jewellery: enumerate as a stack, do not fold into the identity clause.'
    ].join('\n'),
    prop: [
      'FILL RULES',
      '  • Lock BOTH hexes — background and subject. The shipped prompts each did only one.',
      '  • "Sharp focus across the whole object", never shallow DOF. A spec sheet needs everything legible.',
      '  • The gloss is free insurance: spyglass (collapsible nautical telescope).',
      '  • Logos: describe the geometry and the count, do not name the mark — one large four-point star',
      '    with a smaller star beside it.',
      '  • Wear is what sells age. Patina in the seams, worn edges, subtle wear on machined edges.',
      '  • One aspect ratio. Not "square or 4:5".'
    ].join('\n'),
    location: [
      'FILL RULES',
      '  • Signage: never ban text — carve it out. "hand-painted lettering shapes (illegible, no readable text)"',
      '  • Every object needs an orientation, not just a description. State the geometry then its lighting',
      '    consequence: "monitor seen from behind — dark back panel toward the sofa, only a faint cool rim',
      '    of light around its edges and a pale spill on the chair and wall behind it."',
      '  • Specify light twice: once locally at each practical with its own pool, once globally as the mix.',
      '  • Props characterise, they do not decorate. That is what makes it a set and not a showroom.',
      '  • Variant B trades away time of day, light direction, palette and lens. Fine for a one-off',
      '    establisher; IT CANNOT CUT WITH A SECOND SHOT OF THE SAME PLACE. If it lives in a sequence,',
      '    use variant A.',
      '  • Both: state an aspect ratio and lock a hex.'
    ].join('\n')
  };
  FILL_RULES.product = FILL_RULES.prop;

  function rawFor(kind, variant) {
    if (kind === 'location') return variant === 'B' ? LOCATION_B : LOCATION_A;
    if (kind === 'prop' || kind === 'product') return PROP;
    return CHARACTER;
  }
  function fieldsFor(kind) { return (FIELDS[kind] || FIELDS.character).slice(); }
  function kindWord(kind) { return kind === 'product' ? 'Product' : 'Prop'; }

  // Pronouns follow the man/woman answer; anything else stays neutral.
  function pronouns(gender) {
    var g = String(gender || '').trim().toLowerCase();
    if (g === 'woman' || g === 'female' || g === 'she') return { PRON: 'she', POSS: 'her' };
    if (g === 'man' || g === 'male' || g === 'he') return { PRON: 'he', POSS: 'his' };
    return { PRON: 'they', POSS: 'their' };
  }

  function substitute(raw, resolve) {
    return raw.replace(/\{\{([A-Z0-9]+)\}\}/g, function (_, token) { return resolve(token); });
  }

  // Handoff rendering: tokens become the bracketed hints the agent fills.
  function forHandoff(kind, variant) {
    var byKey = {};
    fieldsFor(kind).forEach(function (f) { byKey[f.key] = f; });
    var body = substitute(rawFor(kind, variant), function (token) {
      if (token === 'KIND') return kindWord(kind);
      if (token === 'PRON') return '[he/she]';
      if (token === 'POSS') return '[his/her]';
      var f = byKey[token];
      return '[' + ((f && f.hint) || token) + ']';
    });
    return body + '\n\n' + (FILL_RULES[kind] || FILL_RULES.character);
  }

  // Wizard rendering: tokens become the user's answers. Unanswered tokens stay
  // bracketed so the hole is visible in the compiled prompt.
  function fill(kind, values) {
    values = values || {};
    var variant = String(values.VARIANT || 'A').trim().toUpperCase();
    var byKey = {};
    fieldsFor(kind).forEach(function (f) { byKey[f.key] = f; });
    var pr = pronouns(values.GENDER);
    return substitute(rawFor(kind, variant), function (token) {
      if (token === 'KIND') return kindWord(kind);
      if (token === 'PRON') return pr.PRON;
      if (token === 'POSS') return pr.POSS;
      var v = values[token];
      if (v != null && String(v).trim()) return String(v).trim().replace(/\.$/, '');
      var f = byKey[token];
      // Optional fields drop out cleanly rather than leaving a hole.
      if (f && /optional/i.test(f.label)) return '';
      return '[' + ((f && f.hint) || token) + ']';
    }).replace(/[ \t]+/g, ' ').replace(/ +\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Does this compiled sheet still contain unfilled [BRACKET] slots? Used to
  // refuse to overwrite a real, finished prompt with a husk — a plan import
  // supplies the finished sheet but not the per-attribute fields, so a naive
  // recompile produces a template full of holes.
  function unfilledSlots(text) {
    var m = String(text || '').match(/\[[A-Z][A-Z0-9 /|:,.'()+-]{2,}\]/g);
    return m ? m.length : 0;
  }

  window.RefTemplates = {
    fields: fieldsFor,
    fill: fill,
    unfilledSlots: unfilledSlots,
    forHandoff: forHandoff,
    character: forHandoff('character'),
    prop: forHandoff('prop'),
    product: forHandoff('prop'),
    location: 'VARIANT A — WEAK ARCHETYPE (generic, unnamed or invented). Nothing is pinned, so block it out by depth plane.\n' + forHandoff('location', 'A') + '\n\nVARIANT B — STRONG ARCHETYPE (the model already knows this place).\nSpend on materials and two genre signatures instead of blocking every depth plane:\n\n' + forHandoff('location', 'B'),
    all: function () {
      return [
        'CHARACTER REFERENCE SHEET — for the PERSON. Costume gets its own sheet.\n' + this.character,
        'PROP / PRODUCT SHEET\n' + this.prop,
        'LOCATION PLATE — variant A unless the model already knows the place.\n' + this.location
      ].join('\n\n----------------------------------------\n\n');
    }
  };
})();
