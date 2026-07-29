/* Studio S — shared asset-prompt compiler.
   Pure functions only: no DOM, no Store. Loaded as a plain script (like store.js)
   and consumed by references.html (asset wizard) and promptbuilder.html (weave). */
(function () {
  'use strict';

  var KINDS = [
    { id: 'character', label: 'Character' },
    { id: 'location',  label: 'Location' },
    { id: 'prop',      label: 'Prop' },
    { id: 'look',      label: 'Style look' },
    { id: 'product',   label: 'Product' }
  ];

  // Per-kind wizard field definitions. `key` is the storage key on ref.fields.
  var FIELDS = {
    character: [
      { key: 'desc',     label: 'Physical description', type: 'textarea', placeholder: 'e.g. Woman in her early 30s, athletic build, short dark curls, warm confident presence' },
      { key: 'wardrobe', label: 'Wardrobe',             type: 'textarea', placeholder: 'e.g. Charcoal wool coat over a cream turtleneck, gold hoop earrings' },
      { key: 'features', label: 'Distinguishing features', type: 'text',  placeholder: 'e.g. Freckles across the nose, small scar on left eyebrow' },
      { key: 'mood',     label: 'Expression / energy',  type: 'text',     placeholder: 'e.g. Relaxed half-smile, unhurried' }
    ],
    location: [
      { key: 'desc',   label: 'Space description', type: 'textarea', placeholder: 'e.g. Sun-drenched loft kitchen with terracotta floors and open shelving' },
      { key: 'tod',    label: 'Time of day',       type: 'text',     placeholder: 'e.g. Golden hour' },
      { key: 'light',  label: 'Lighting',          type: 'text',     placeholder: 'e.g. Warm natural side-light through tall windows' },
      { key: 'dressing', label: 'Key set dressing', type: 'text',    placeholder: 'e.g. Copper pans, a bowl of lemons, linen towels' }
    ],
    prop: [
      { key: 'desc',     label: 'Object description', type: 'textarea', placeholder: 'e.g. Vintage brass desk lamp with a green glass shade' },
      { key: 'material', label: 'Material / finish',  type: 'text',     placeholder: 'e.g. Aged brass, softly worn patina' },
      { key: 'scale',    label: 'Scale / context',    type: 'text',     placeholder: 'e.g. Sits on a walnut desk, roughly forearm height' }
    ],
    look: [
      { key: 'desc',    label: 'Style description', type: 'textarea', placeholder: 'e.g. Naturalistic documentary look, soft contrast, honest skin texture' },
      { key: 'grade',   label: 'Colour grade',      type: 'text',     placeholder: 'e.g. Warm highlights, muted teal shadows' },
      { key: 'texture', label: 'Grain / texture',   type: 'text',     placeholder: 'e.g. Fine 35mm film grain, gentle halation' }
    ],
    product: [
      { key: 'desc',      label: 'Product description', type: 'textarea', placeholder: 'e.g. Matte white skincare bottle with a bamboo cap' },
      { key: 'material',  label: 'Packaging / material', type: 'text',    placeholder: 'e.g. Frosted recycled glass, embossed logo' },
      { key: 'preserve',  label: 'Must stay accurate',  type: 'text',     placeholder: 'e.g. Label typography, cap proportions, brand blue' }
    ]
  };

  function kinds() { return KINDS.slice(); }

  // The References wizard fills the SAME reverse-engineered sheets the handoff
  // ships to the planning agent (src/reftemplates.js), so a reference built by
  // hand and one built from a plan come out identical. FIELDS below is the
  // pre-template fallback, kept only for when reftemplates.js hasn't loaded.
  function fieldsFor(kind) {
    if (window.RefTemplates && window.RefTemplates.fields) return window.RefTemplates.fields(kind);
    return (FIELDS[kind] || FIELDS.character).slice();
  }

  var has = function (v) { return !!(v && String(v).trim()); };
  var clean = function (v) { return String(v).trim().replace(/\.$/, ''); };

  // Compile an asset reference into a generator-ready stills prompt (+ short
  // video note). Same clause-join style as promptbuilder's compilePrompt().
  function compileReferencePrompt(kind, name, fields) {
    fields = fields || {};
    // Template path — the reverse-engineered sheet, same as the handoff ships.
    if (window.RefTemplates && window.RefTemplates.fill) {
      return {
        stills: window.RefTemplates.fill(kind, fields),
        video: 'Reference asset — attach the generated still to image-to-video shots that feature it; no standalone animation needed.'
      };
    }
    // Legacy one-liner. Only reached if reftemplates.js failed to load.
    var f = function (k) { return has(fields[k]) ? clean(fields[k]) : ''; };
    var parts = [];
    if (kind === 'character') {
      parts.push('Character reference' + (has(name) ? ' — ' + clean(name) : '') + ': ' + (f('desc') || 'a person'));
      if (f('wardrobe')) parts.push('wearing ' + f('wardrobe'));
      if (f('features')) parts.push(f('features'));
      if (f('mood')) parts.push(f('mood'));
      parts.push('neutral background, even soft light, full detail on face and wardrobe for identity consistency');
    } else if (kind === 'location') {
      parts.push('Location reference' + (has(name) ? ' — ' + clean(name) : '') + ': ' + (f('desc') || 'an interior space'));
      if (f('tod')) parts.push(f('tod'));
      if (f('light')) parts.push(f('light'));
      if (f('dressing')) parts.push('with ' + f('dressing'));
      parts.push('wide coverage of the space, no people');
    } else if (kind === 'prop') {
      parts.push('Prop reference' + (has(name) ? ' — ' + clean(name) : '') + ': ' + (f('desc') || 'an object'));
      if (f('material')) parts.push(f('material'));
      if (f('scale')) parts.push(f('scale'));
      parts.push('clean studio plate, accurate materials and proportions');
    } else if (kind === 'look') {
      parts.push('Style reference' + (has(name) ? ' — ' + clean(name) : '') + ': ' + (f('desc') || 'a cinematic look'));
      if (f('grade')) parts.push('graded ' + f('grade'));
      if (f('texture')) parts.push(f('texture'));
    } else { // product
      parts.push('Product reference' + (has(name) ? ' — ' + clean(name) : '') + ': ' + (f('desc') || 'a product'));
      if (f('material')) parts.push(f('material'));
      if (f('preserve')) parts.push('keep exactly accurate: ' + f('preserve'));
      parts.push('clean studio lighting, true-to-life colour');
    }
    var stills = parts.join(', ').replace(/, ,/g, ',') + '.';
    var video = 'Reference asset — attach the generated still to image-to-video shots that feature it; no standalone animation needed.';
    return { stills: stills, video: video };
  }

  // One-clause description of a reference for weaving into a shot prompt:
  // every filled wizard field, joined in schema order.
  // Higgsfield matches an element by an @-handle, which cannot contain spaces.
  function atHandle(name) {
    var slug = String(name || '').replace(/[^A-Za-z0-9]/g, '');
    return slug ? '@' + slug : '';
  }

  function summarize(ref, atTags) {
    var fields = ref.fields || {};
    var vals = fieldsFor(ref.kind)
      .map(function (f) { return has(fields[f.key]) ? clean(fields[f.key]) : ''; })
      .filter(Boolean);
    var label = ref.name;
    if (atTags) {
      var handle = atHandle(ref.name);
      if (handle) label = handle;
    }
    return vals.length ? label + ' (' + vals.join(', ') + ')' : label;
  }

  // Fold attached references into a compiled shot prompt {stills, video}.
  // refs: array of reference records ({name, kind, fields}). Pure.
  // opts.atTags renders each reference as an @-handle for Higgsfield.
  // Stills get a trailing clause; the video prompt gets an identity-lock
  // sentence, since the video generation is what actually consumes the
  // attached reference media on models that accept it.
  function weaveReferences(compiled, refs, opts) {
    refs = (refs || []).filter(Boolean);
    if (!refs.length || !compiled || !has(compiled.stills)) return compiled;
    var atTags = !!(opts && opts.atTags);
    var name = function (r) { return summarize(r, atTags); };
    var featured = refs.filter(function (r) { return r.kind !== 'look' && r.kind !== 'location'; });
    var places = refs.filter(function (r) { return r.kind === 'location'; });
    var looks = refs.filter(function (r) { return r.kind === 'look'; });
    var clauses = [];
    if (featured.length) clauses.push('featuring ' + featured.map(name).join('; '));
    if (places.length) clauses.push('set in ' + places.map(name).join('; '));
    if (looks.length) clauses.push('in the style of ' + looks.map(name).join('; '));
    var stills = compiled.stills.replace(/\.$/, '') + ' — ' + clauses.join('; ') + '.';
    var video = compiled.video;
    if (has(video) && (featured.length || places.length)) {
      var idRefs = featured.concat(places);
      var vMode = (opts && opts.videoRefMode) || 'array';
      if (vMode === 'frame') {
        // Kling accepts ONLY a start/end frame — no reference arrays (T1:
        // param schemas expose start_image/end_image, no image_references). So the
        // identity rides on the generated still, not on @-tags or a ref list.
        video = video.replace(/\.$/, '') + ' The starting frame already establishes ' +
          idRefs.map(function (r) { return r.name; }).join(', ') + ' — keep them identical for the full shot.';
      } else if (atTags) {
        // Higgsfield / Seedance: declare each asset handle up top, then lock it.
        var decls = idRefs.map(function (r) { return summarize(r, true); }).join(' · ');
        video = decls + '. ' + video.replace(/\.$/, '') + '. Each tagged reference stays a 100% match.';
      } else {
        video = video.replace(/\.$/, '') + ' ' + (featured.length ? 'Featured references stay a 100% match: ' : 'Location reference stays a 100% match: ') + idRefs.map(name).join('; ') + '.';
      }
    }
    return { stills: stills, video: video };
  }

  // Compose the video prompt from the FULL builder state: the composed scene
  // (subject, environment, look, lens — passed in via opts.scene) PLUS the time
  // dimension the still can't carry. Sofia's complaint was "video prompts aren't
  // just the movement" — so the scene leads, then subject action, then one
  // motivated camera move stated separately, ambient motion, and positive
  // continuity locks. Order and rules follow the harvested creator prompts and
  // vendor formulas (RESEARCH-LOG claims 16, 21, 25, 28; docs/research/creator-prompts).
  // ── Prompt dictionary ────────────────────────────────────────────────────
  // Every creative control the builder exposes maps here to the language that
  // reaches the model. `core` is the universal phrase (standard cinematography
  // vocabulary — the same wording the harvested creator prompts use); `perModel`
  // holds an override ONLY where the research verified a real difference. Where
  // research is silent, the term is universal — inventing per-model wording is
  // the exact thing the research discipline forbids. Contested items (lens as mm
  // vs FOV) are deliberately absent — the raw value passes through until the
  // Gen Log clicker A/B settles it (RESEARCH-LOG claims 10-11).
  var DICT = {
    angle: {
      eye:   { core: 'shot at eye level' },
      low:   { core: 'low-angle shot looking up at the subject' },
      high:  { core: 'high-angle shot looking down at the subject' },
      dutch: { core: 'canted dutch-angle framing' }
    },
    depth: {
      shallow: { core: 'shallow depth of field, background thrown soft' },
      layered: { core: 'layered depth, foreground, midground and background all legible' },
      deep:    { core: 'deep focus, sharp from front to back' }
    },
    comp: {
      tl: { core: 'subject placed top-left' }, tc: { core: 'subject placed top-centre' }, tr: { core: 'subject placed top-right' },
      ml: { core: 'subject on the left third' }, mc: { core: 'subject centred in frame' }, mr: { core: 'subject on the right third' },
      bl: { core: 'subject placed bottom-left' }, bc: { core: 'subject placed bottom-centre' }, br: { core: 'subject placed bottom-right' }
    },
    framing: {
      Symmetrical: { core: 'symmetrical composition' },
      lead: { core: 'strong leading lines' },
      frame: { core: 'a frame-within-a-frame composition' },
      'Negative space': { core: 'generous negative space' },
      ots: { core: 'over-the-shoulder framing' }
    },
    density: {
      // An empty frame is a positive instruction, not the absence of one — and
      // it is what finally drives realismBaseline's `people` opt-out, which had
      // existed unused since the baseline shipped.
      none:   { core: 'no people in frame, the space is empty' },
      single: { core: 'a lone figure' },
      few:    { core: 'a few figures' },
      crowd:  { core: 'set among a dense crowd' }
    },
    move: {
      static:   { core: 'the camera is locked off, no camera move' },
      push:     { core: 'the camera pushes in slowly' },
      pan:      { core: 'the camera pans gently' },
      tracking: { core: 'the camera tracks with the subject' },
      handheld: { core: 'the camera is subtly handheld' }
    }
  };

  // Per-model capability profile — how each video model actually takes identity
  // references (verified from the platform param schemas, RESEARCH-LOG claim 15):
  //   'array' → ingests image/audio reference arrays (Seedance, Higgsfield/Soul)
  //   'frame' → start/end frame only, no reference arrays (Kling)
  // This is a real capability difference, not phrasing — so it changes the prompt
  // per model. Standard film vocabulary stays universal (research found no
  // per-model wording difference).
  var VIDEO_CAPS = {
    seedance:   { refs: 'array' },
    higgsfield: { refs: 'array' },
    kling:      { refs: 'frame' }
  };
  function videoRefMode(model) {
    return (VIDEO_CAPS[model] && VIDEO_CAPS[model].refs) || 'array';
  }

  // ── Phase-1 wiring ─────────────────────────────────────────────────────────
  // Builder controls that were authored but never reached the STILLS prompt.
  // Each chip selection maps to the exact clause that enters the compiled prompt,
  // so editing the control visibly changes output (the reported "doesn't respond
  // to my choices"). Labels are PLAIN text — promptbuilder's phraseChips() renderer
  // HTML-escapes them; the option ORDER here MUST match the chips rendered there.
  var OPTS = {
    tod: [
      { label: 'Dawn',        clause: 'at dawn' },
      { label: 'Golden hour', clause: 'at golden hour' },
      { label: 'Midday',      clause: 'in flat midday light' },
      { label: 'Dusk',        clause: 'at dusk' },
      { label: 'Night',       clause: 'at night' }
    ],
    light: [
      { label: 'Natural',        clause: 'natural light' },
      { label: 'Soft / diffused', clause: 'soft diffused light' },
      { label: 'Hard / direct',   clause: 'hard directional light' },
      { label: 'Practical',       clause: 'lit by practical sources' },
      { label: 'Studio',          clause: 'controlled studio lighting' }
    ],
    feel: [
      { label: 'Warm & natural',    clause: 'warm naturalistic light, soft contrast, honest colour' },
      { label: 'Moody & contrasty', clause: 'moody low-key lighting, deep shadows, high contrast' },
      { label: 'Soft & dreamy',     clause: 'soft diffused light, gentle haze, dreamy pastel tones' },
      { label: 'Bold & saturated',  clause: 'bold saturated colour, punchy contrast, vivid light' },
      { label: 'Naturalistic doc',  clause: 'naturalistic documentary look, available light, true-to-life skin' },
      { label: 'Clean & commercial', clause: 'clean commercial lighting, crisp and bright, polished finish' },
      { label: 'Nostalgic film',    clause: 'nostalgic film look, warm faded grade, fine grain' }
    ],
    grade: [
      { label: 'Warm',          clause: 'warm colour grade' },
      { label: 'Cool',          clause: 'cool colour grade' },
      { label: 'Muted',         clause: 'muted, desaturated grade' },
      { label: 'High contrast', clause: 'high-contrast grade' },
      { label: 'Teal & orange', clause: 'teal-and-orange grade' },
      { label: 'Pastel',        clause: 'soft pastel grade' }
    ],
    realism: [
      { label: 'Motion blur',           clause: 'natural motion blur' },
      { label: 'Film grain + CA',       clause: 'fine film grain and subtle chromatic aberration' },
      { label: 'Lens flare',            clause: 'gentle lens flare' },
      { label: 'Visible breath',        clause: 'visible breath in the air' },
      { label: 'Dust particles',        clause: 'dust particles drifting in the light' },
      { label: 'Bokeh + parallax',      clause: 'creamy bokeh and layered depth' },
      { label: 'Wet ground',            clause: 'wet reflective ground' },
      { label: 'Cloth physics',         clause: 'natural cloth movement' },
      { label: 'Micro-texture',         clause: 'fine micro-texture on skin and surfaces' },
      { label: 'Natural imperfections', clause: 'natural imperfections, no plastic sheen' },
      { label: 'Candid / unposed',      clause: 'candid, unposed framing' }
    ],
    // Aspect ratio isn't prose — resolved here only so stillLead() can format it
    // (stillLead() appends the ratio per model). Order matches the builder.
    ar: [
      { label: '16:9',    clause: '16:9' },
      { label: '9:16',    clause: '9:16' },
      { label: '1:1',     clause: '1:1' },
      { label: '2.39:1',  clause: '2.39:1' }
    ]
  };
  // Single-select chip → its clause (idx into OPTS[name]). '' if unset/unknown.
  function chipClause(name, idx) {
    var g = OPTS[name];
    if (!g || idx === undefined || idx === null || idx < 0 || idx >= g.length) return '';
    return g[idx].clause || '';
  }
  // Multi-select chip → array of clauses (idxs = array of indices).
  function chipClauses(name, idxs) {
    if (!Array.isArray(idxs)) return [];
    return idxs.map(function (i) { return chipClause(name, i); }).filter(Boolean);
  }

  // The "what happens in the shot" field, frozen as a still's moment. compileVideo
  // already consumes s.action as motion; the still needs the same beat as a
  // captured instant. Pure so the builder and tests share it.
  function stillAction(action) { return has(action) ? clean(action) : ''; }

  // Light per-model stills treatment (Phase 1 goal: make model choice change the
  // text at all — full quality is Phase 2). Uses only real, verifiable per-model
  // syntax already documented in the builder's stillProfiles() rules; no invented
  // wording (the research discipline forbids it). `pre` leads, `post` trails.
  var STILL_LEADS = {
    gpt:      { pre: 'Photorealistic. ', post: function (ar) { return ar ? ' ' + ar + '.' : ''; } },
    nano:     { pre: 'Photograph. ',     post: function (ar) { return (ar ? ' ' + ar + ',' : '') + ' 4K.'; } },
    seedream: { pre: '',                 post: function (ar) { return ' Ultra-sharp 4K, accurate materials' + (ar ? ', ' + ar : '') + '.'; } }
  };
  function stillLead(model, opts) {
    var e = STILL_LEADS[model];
    if (!e) return { pre: '', post: '' };
    var ar = (opts && opts.ar) ? opts.ar : '';
    return { pre: e.pre || '', post: (e.post ? e.post(ar) : '') };
  }

  // Resolve a control value to its phrase for a model. Per-model override wins
  // when present; otherwise the universal core. Empty string if unmapped.
  function term(control, value, model) {
    var group = DICT[control]; if (!group) return '';
    var entry = group[value]; if (!entry) return '';
    if (model && entry.perModel && has(entry.perModel[model])) return entry.perModel[model];
    return entry.core || '';
  }
  // VIDEO_TAILS is gone. Both of its entries served one target: 'seedance' (a
  // Technical: line) and 'higgsfield' (a Performance:/Physics:/Style: tail whose
  // People language was hardcoded and UNGATED, so it shipped `pore-level skin
  // realism` for a shot of a water glass). The adapter emits those as proper slots
  // and gates them, and the retired 'seedance' id coerces to 'higgsfield' on load,
  // so neither entry could fire again. Kling never had one.

  // ── CHIP_OPTS — the single source for the chip groups whose option lists used to
  // live as inline literals in promptbuilder.html. Both the UI render calls and the
  // Seedance adapter read these, which fixes two bugs at once:
  //
  //   1. Single-select chips store an INDEX (promptbuilder.html:941), not a label,
  //      so an adapter comparing `chips.type` to a string is wrong — it survives
  //      only while 'People' happens to sit at index 0 and 0 is falsy.
  //   2. chips() falls back to each option's `on` flag for DISPLAY while state stays
  //      undefined (:981-987), so a chip can look selected and read as unset.
  //      Emission needs the same default the renderer shows.
  //
  // `cambody` is labels-only: its default is computed per look (the dpPresets body),
  // so it lives on SEEDANCE_LOOK[...].body instead of an `on` flag here.
  var CHIP_OPTS = {
    type: [{ label: 'People' }, { label: 'Product' }, { label: 'Architecture' },
           { label: 'Landscape' }, { label: 'Vehicle' }, { label: 'Abstract' }],
    campick: [{ label: 'Filmic', on: true }, { label: 'Crisp digital' }, { label: 'Vintage' },
              { label: 'Documentary' }, { label: 'Anamorphic widescreen' }],
    cambody: [{ label: 'ARRI Alexa 35' }, { label: 'RED V-Raptor' }, { label: 'Sony Venice 2' },
              { label: '35mm film' }, { label: '16mm film' }],
    lensformat: [{ label: 'Spherical', on: true }, { label: 'Anamorphic' }],
    ar: [{ label: '16:9', on: true }, { label: '9:16' }, { label: '1:1' }, { label: '2.39:1' }]
  };
  // Resolve a single-select chip index to its label, falling back to the option
  // marked `on` when state is undefined — matching what the chip renders.
  function chipLabel(group, idx) {
    var g = CHIP_OPTS[group] || OPTS[group];
    if (!g) return '';
    if (idx === undefined || idx === null || idx < 0 || idx >= g.length) {
      for (var i = 0; i < g.length; i++) if (g[i].on) return g[i].label;
      return '';
    }
    return g[idx].label || '';
  }
  function chipLabels(group, idxs) {
    var g = CHIP_OPTS[group] || OPTS[group];
    if (!g || !Array.isArray(idxs)) return [];
    return idxs.map(function (i) { return (g[i] && g[i].label) || ''; }).filter(Boolean);
  }

  // ── Seedance 2 / Cinema Studio adapter ──────────────────────────────────────
  // Fourteen labelled slots in a fixed order, composed from the shot's OWN fields.
  // It never reads the compiled stills prompt: that inheritance is what put
  // `visible skin pores` on a shot of a water glass, emitted the action and the
  // environment twice, and re-described a plate the start frame already holds.
  // Composing from source makes all three structurally impossible.
  //
  // Spec: docs/research/seedance-emission-spec.md. `✓` = verbatim from a shipped
  // corpus prompt, `~` = composed, `?` = invented. Never paraphrase a ✓ string.

  // Invariant constants. `8K IMAX` leads slot 1 unconditionally: it is a register
  // token (large-format cinema bias), not a resolution claim — practitioner-
  // confirmed 2026-07-29 as holding regardless of the generator's resolution
  // setting. `8K detail` was a different string in a different slot that read as an
  // output spec with no observation behind it, so it is gone. Note `No artificial
  // lighting`: the corpus carries the typo `lightning`, which a video model may
  // render as weather.
  var SD = {
    style: '8K IMAX. Photorealistic — no 3D render, no game engine.',                         // ✓
    camera: 'Physical cine lens. 180° shutter motion blur.',                                  // ✓
    skin: 'Pore-level realism — vellus hair, asymmetric moles, capillary flush, '
      + 'pore-shadow matching on-set light.',                                                 // ✓
    acting: 'Hollywood — micro-pauses before reactions, precise eye-line, living eyes '
      + 'with catch-lights, chest rise from breathing.',                                      // ✓
    actingUnposed: 'Characters never standing, always reacting.',                              // ✓
    physics: 'Gravity and inertia respected — mass has real weight, correct contact '
      + 'shadows. No floating props.',                                                        // ✓
    technical: '24fps smooth motion. No jitter.',                                              // ✓
    audio: 'Environmental SFX only. No music. No subtitles.',                                  // ✓
    noGloss: 'No AI gloss.',                                                                   // ✓
    anamorphic: '2x anamorphic squeeze; horizontal streak flares off the practicals; oval '
      + 'vertically-stretched bokeh; subtle barrel distortion at the frame edges; natural '
      + 'anamorphic vignetting with softened falloff in the corners.'                         // ✓
  };

  // Look → its Seedance slots. DERIVED BY HAND from dpTraits() in
  // promptbuilder.html:442-451. Stored as ARRAYS of verbatim fragments rather than
  // pre-joined strings, because splitting a note yields non-contiguous pieces
  // (lubezki's lighting is the note's 1st and 4th phrases) — and a joined string
  // could never satisfy the verbatim guard that catches a note being edited while
  // this split goes stale. Marked `~`: app text, never corpus-evidenced.
  //
  // Composition is absent on purpose. `comp` and `framing` always have a value, so
  // the look never contributes there — and every composition clause in the ten
  // notes is already a chip, not actually composition, or unactionable vibe.
  //
  // Dropped, never reassigned: any phrase naming a lens, a move, a body, a format,
  // grain/halation, photorealism, or skin. Ten in total. The last two matter most —
  // `rich skin tones on darker complexions` and `documentary-true skin tones` read
  // as colour, so a naive split lands them in the UNGATED Color: slot and a product
  // shot is told about skin tones: the People gate defeated through a side door.
  var SEEDANCE_LOOK = {
    deakins:    { lighting: ['motivated naturalistic light, single soft key, deep restrained shadows'],
                  palette: ['muted earthy palette'], body: 'ARRI Alexa 35' },
    lubezki:    { lighting: ['natural and available light only', 'magic-hour glow'],
                  palette: [], body: 'ARRI Alexa 35' },
    hoytema:    { lighting: ['hard practical sources, atmospheric haze'],
                  palette: ['cool blue-grey palette'], body: 'Sony Venice 2' },
    fraser:     { lighting: ['soft directional key'],
                  palette: ['desaturated warmth'], body: 'Sony Venice 2' },
    young:      { lighting: ['low-key underexposed shadows', 'amber practicals, painterly negative fill'],
                  palette: [], body: 'ARRI Alexa 35' },
    khondji:    { lighting: ['high-contrast chiaroscuro'],
                  palette: ['sodium-vapour ambers and sickly greens, deep blacks'], body: '35mm film' },
    morrison:   { lighting: ['honest soft daylight'],
                  palette: ['warm naturalism', 'lived-in colour'], body: '35mm film' },
    // `crisp anamorphic contrast` is dropped WHOLE rather than split: keeping
    // `crisp … contrast` would put wording here that appears nowhere in the note,
    // and `anamorphic` asserts an optical format `lensformat` owns. pfister also
    // presets a DIGITAL body, so the look would contradict its own camera.
    pfister:    { lighting: ['hard key light'],
                  palette: ['cool steel highlights'], body: 'Sony Venice 2' },
    // The only posed look, and the only one contributing `style`: `planimetric
    // staging` is the one composition claim the chips cannot express, and it is a
    // staging register rather than frame geometry.
    anderson:   { lighting: ['even soft light'], palette: ['pastel storybook palette'],
                  style: ['planimetric staging'], posed: true, body: '35mm film' },
    villeneuve: { lighting: ['fog and silhouette'],
                  palette: ['monochrome tonal fields', 'minimal palette'], body: 'Sony Venice 2' }
  };

  // By-feel looks. Keyed by LABEL, resolved from OPTS.feel by index, because
  // index-keying breaks silently the moment that array is reordered. Wording is
  // §5's, which deliberately differs from DICT's feel clauses — the adapter owns its
  // own table. `Nostalgic film` describes a capture medium rather than light, so it
  // contributes nothing here and claims Camera: instead (see cameraSlot).
  var SEEDANCE_FEEL = {
    'Warm & natural':     { lighting: ['warm available light'], palette: ['muted natural grade'] },     // ~
    'Moody & contrasty':  { lighting: ['contre-jour backlight, camera on shadow side'], palette: [] },  // ✓
    'Soft & dreamy':      { lighting: ['soft diffused light, gentle highlight bloom'], palette: [] },   // ~
    'Bold & saturated':   { lighting: [], palette: ['saturated colour, deep blacks'] },                 // ~
    'Naturalistic doc':   { lighting: ['Natural light only. Key light from sky and windows only'], palette: [] }, // ✓
    'Clean & commercial': { lighting: ['even soft light, low contrast'], palette: ['clean neutral grade'] }, // ~
    'Nostalgic film':     { lighting: [], palette: [] }
  };

  // Editorial purpose → the noun for the CUT header's justification. The corpus form
  // `so [X] reads clearly` is evidenced five times; only X varies, and X is a factual
  // statement about the shot rather than a wording gamble. `insert` and `product
  // detail` name the PROPERTY that must read instead of the object, because subject
  // already names the object and the shot-size chip already says the frame is close
  // on it — what is stated nowhere is the risk. `match action` needs a second cut to
  // match across; `transition`'s job is the cut, not the frame. Both omit.
  var PURPOSE_X = {
    'establishing':     'the geography of the space',
    'master':           'the geography and where each person sits in it',
    'two-shot':         'both faces and the space between them',
    'group':            'every face in the group',
    'single':           'the subject, isolated from the room',
    'reaction':         'the face through the beat',
    'cutaway':          '{subject}',
    'location texture': 'the surface and material character of the place',
    'final wide':       'the scene\'s resolved state',
    'hero product':     '{subject} as the subject of the frame',
    'button':           'the closing beat'
  };
  var PURPOSE_WHOLE = {
    'insert':         'so the detail holds at this scale',
    'product detail': 'so the material and finish read clearly'
  };

  // CUT-header wording. The corpus states camera position relative to the subject or
  // the set, never "eye level".
  var SD_SHOT = { extreme: 'tight close-up, eyes to lips in frame', close: 'Close-up',
    mcu: 'chest-up medium', medium: 'Medium', mfull: 'three-quarter figure',
    wide: 'Full-figure wide', aerial: 'Overhead top-down' };
  var SD_ANGLE = { eye: '', low: 'low angle', high: 'overhead top-down', dutch: 'tilted' };
  var SD_MOVE = { static: 'static', push: 'ultra-slow push-in', pan: 'slow pan',
    tracking: 'side tracking, whipping to keep the subject in frame',
    handheld: 'handheld, breathing frame' };
  var SD_DEPTH = { shallow: 'shallow depth of field', layered: 'layered depth', deep: 'deep focus' };
  var SD_FRAMING = { Symmetrical: 'symmetrical composition', lead: 'leading lines toward the subject',
    frame: 'framed through a foreground element', 'Negative space': 'negative space',
    ots: 'over-the-shoulder' };

  // Time of day and lighting for slot 2. §5: name a light STATE, not an hour. The
  // Practical row drops §3's `[practicals named in Location]` bracket — unsourceable,
  // and establishing practicals as a CATEGORY is all the definite reference in the
  // halation clause needs.
  var SD_TOD = { Dawn: 'dawn blue-golden transition', 'Golden hour': 'first golden rim light grazing',
    Midday: 'flat overhead midday light, short hard shadows', Dusk: 'deep blue evening twilight',
    Night: 'warm tungsten spill' };
  var SD_LIGHT = {
    Natural: 'Natural light only. Key light from sky and windows only. No artificial lighting',
    Practical: 'Practical sources only',
    'Soft / diffused': 'soft, even, diffused lighting, gentle and low-contrast',
    'Hard / direct': 'hard single-source key light, no fill light softening the contrast',
    Studio: 'studio lighting'
  };

  // Look-table fragments are stored separately so each stays verbatim; they read as
  // one clause.
  function join(frags) {
    return (Array.isArray(frags) ? frags : (frags ? [frags] : [])).filter(Boolean).join(', ');
  }

  // The short name behind both the handle and the display label: parentheticals and
  // em-dash suffixes are library bookkeeping, not what the element is called.
  // `Maya (Loop lead)` is Maya; `Warm restaurant — birthday dinner (night)` is Warm
  // restaurant.
  function shortName(name) {
    var t = String(name || '').replace(/\([^)]*\)/g, ' ')
      .split(/\s+—\s+|\s+--\s+/)[0].replace(/\s+/g, ' ').trim();
    return t || String(name || '').trim();
  }
  // A Higgsfield element is referenced as @handle on the site; the <<<uuid>>> form in
  // the corpus is a server-side export artifact, not what a human types. Deliberately
  // NOT atHandle() — that one strips punctuation without lowercasing (`@MayaLooplead`)
  // and the other models rely on it.
  function slugHandle(name, seen) {
    var base = shortName(name).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!base) base = 'ref';
    if (!seen) return '@' + base;
    var n = base, i = 2;
    while (seen[n]) { n = base + '-' + i; i++; }
    seen[n] = true;
    return '@' + n;
  }

  // Skin: and Acting: are pure constants — invented content with no input from the
  // shot — so they need an external gate or they fire for a water glass. Characters:
  // is NOT gated here: it is sourced entirely from attached references and therefore
  // already self-gating.
  //
  // Monotone in the safe direction: an unset control leaves today's behaviour alone,
  // a set control only ever removes invented content. Resolved through chipLabel so
  // it can never depend on People being index 0.
  function peopleSlots(s, chips) {
    if (s.density === 'none') return false;
    var t = chips.type;
    if (t === undefined || t === null) return true;
    return chipLabel('type', t) === 'People';
  }

  function lookFor(s, chips) {
    if (s.lookMode === 'dp') return SEEDANCE_LOOK[s.dp] || null;
    // By-feel: s.dp is STALE here — switching mode only rewrites camMode, so dp keeps
    // its old value (deakins by default). Reading it would emit naturalistic-classic
    // lighting for someone who picked "Bold & saturated".
    if (chips.feel === undefined || chips.feel === null) return null; // no default: contributes nothing
    return SEEDANCE_FEEL[chipLabel('feel', chips.feel)] || null;
  }

  function compileVideo(s, opts) {
    s = s || {};
    opts = opts || {};
    // Seedance 2 / Cinema Studio composes its own slots and never falls through
    // to the clause-join below, which stays exactly as it was for every other
    // model. One branch is the entire integration surface.
    if (opts.model === 'higgsfield') return emitSeedance(s, opts);
    var parts = [];
    // Scene — the whole shot, reused from the still so subject/look/lens are
    // carried into the video, not discarded. Falls back to a bare animate line.
    var scene = has(opts.scene) ? clean(opts.scene) : '';
    parts.push(scene ? scene + '.' : 'Animate the still with natural motion true to the scene.');
    // Subject action — what happens across the clip, stated before the camera.
    if (has(s.action)) parts.push(clean(s.action) + '.');
    // Camera — one motivated move, separate from subject motion.
    var moveTxt = term('move', s.move, opts.model) || 'the camera moves subtly';
    parts.push('Camera: ' + moveTxt + (has(s.action) ? ', following the action' : '') + '; one camera move only, no cuts.');
    // Ambient / environmental motion.
    parts.push('Ambient motion stays subtle and physical — air, light and background life move naturally' + (has(s.environment) ? ' within ' + clean(s.environment).toLowerCase() : '') + '.');
    // Positive continuity locks.
    parts.push('Hold the framing; same subject, wardrobe and lighting for the full shot.');
    // Clip length. Appended after the clause-join, never woven into it — same
    // rule as the continuity tail. Silent when unset rather than guessing.
    if (has(s.duration)) parts.push('Duration: ' + clean(s.duration) + ' seconds.');
    return parts.join(' ');
  }

  // Time of day and lighting wording for slot 2. §5: name a light STATE, not an
  // hour. The Practical row drops §3's `[practicals named in Location]` bracket —
  // unsourceable, and establishing practicals as a category is all the definite
  // reference in the halation clause needs.
  var SD_TOD = { Dawn: 'dawn blue-golden transition', 'Golden hour': 'first golden rim light grazing',
    Midday: 'flat overhead midday light, short hard shadows', Dusk: 'deep blue evening twilight',
    Night: 'warm tungsten spill' };
  var SD_LIGHT = {
    Natural: 'Natural light only. Key light from sky and windows only. No artificial lighting',
    Practical: 'Practical sources only',
    'Soft / diffused': 'soft, even, diffused lighting, gentle and low-contrast',
    'Hard / direct': 'hard single-source key light, no fill light softening the contrast',
    Studio: 'studio lighting'
  };

  // Emit the fourteen slots. Every value has exactly one destination, which is
  // what makes the duplication the old path produced structurally impossible.
  function emitSeedance(s, opts) {
    var chips = s.chips || {};
    var refs = (opts && Array.isArray(opts.refs)) ? opts.refs.filter(Boolean) : [];
    var people = peopleSlots(s, chips);
    var look = lookFor(s, chips) || {};
    var realism = chipLabels('realism', chips.realism);
    var lights = chipLabels('light', chips.light);
    var hasRealism = function (x) { return realism.indexOf(x) !== -1; };
    var out = [];
    var push = function (label, bits) {
      var body = (bits || []).filter(function (b) { return has(b); })
        .map(function (b) { return String(b).trim().replace(/\.$/, ''); }).join('. ');
      if (body) out.push(label + ': ' + body + '.');
    };

    // 1 Style — 8K IMAX leads. `no AI gloss` is triggered by the Natural
    // imperfections chip, which is corpus-✓ wording already in §3 slot 1; the
    // adapter never reads s.negative (the downstream Avoid: tail owns it, and
    // emitting it here too would print it twice).
    push('Style', [SD.style, join(look.style), hasRealism('Natural imperfections') ? SD.noGloss : '']);

    // 2 Lighting — the look is often the only source, since tod/light have no default.
    var lightBits = [join(look.lighting), SD_TOD[chipLabel('tod', chips.tod)] || ''];
    if (chips.tod === undefined || chips.tod === null) lightBits[1] = '';
    lights.forEach(function (l) { if (SD_LIGHT[l]) lightBits.push(SD_LIGHT[l]); });
    push('Lighting', lightBits);

    // 3 Color
    var gradeLabel = (chips.grade === undefined || chips.grade === null) ? '' : chipLabel('grade', chips.grade);
    push('Color', [join(look.palette), gradeLabel ? gradeLabel.toLowerCase() + ' grade' : '']);

    // 4 Camera — one slot, ordered claimants, first writer wins (rule 11).
    push('Camera', cameraSlot(s, chips, look, realism, lights));

    // 5 Skin · 6 Acting — pure constants, so gated. Acting's base is never pruned;
    // only the appended second sentence is suppressed, and only for a posed look.
    if (people) push('Skin', [SD.skin]);
    if (people) {
      push('Acting', [SD.acting, look.posed ? '' : SD.actingUnposed,
        hasRealism('Candid / unposed') ? 'Candid, unposed' : '']);
    }

    // 7 Physics
    push('Physics', [SD.physics,
      hasRealism('Cloth physics') ? 'Cloth and hair carry their own mass' : '',
      hasRealism('Wet ground') ? 'Wet ground holds reflections' : '',
      hasRealism('Dust particles') ? 'Drifting dust particles' : '']);

    // 8 Composition — comp and framing only. The look never contributes: both
    // always have a value, and every composition clause in the ten notes is
    // already a chip, not composition, or unactionable.
    var compBits = [term('comp', s.comp) || ''];
    (Array.isArray(s.framing) ? s.framing : []).forEach(function (f) {
      if (SD_FRAMING[f]) compBits.push(SD_FRAMING[f]);
    });
    push('Composition', compBits);

    // 9 Continuity — the single-shot sentence form is all unsourceable brackets,
    // and with one cut there is nothing to be continuous with. This clause has a
    // real source and a real job: reference adherence inside one shot.
    if (refs.length) push('Continuity', ['No identity drift']);

    // 10 Technical · 11 Audio — Audio is unconditional: both in-scope model ids
    // generate sound, and leaving it unstated means invented music over the clip.
    push('Technical', [SD.technical]);
    push('Audio', [SD.audio]);

    // 12 Characters — gated on attachment, NOT on subject type. Its content is
    // sourced, so it self-gates; a product shot with a person in it is ordinary.
    var seen = {};
    var chars = refs.filter(function (r) { return r.kind === 'character'; });
    var props = refs.filter(function (r) { return r.kind === 'prop' || r.kind === 'product'; });
    var places = refs.filter(function (r) { return r.kind === 'location'; });
    var looks = refs.filter(function (r) { return r.kind === 'look'; });
    var handleOf = {};
    refs.forEach(function (r) { handleOf[r.id || r.name] = slugHandle(r.name, seen); });
    var describe = function (r) {
      var facts = (r.fields && has(r.fields.desc)) ? clean(r.fields.desc) : '';
      // Handle AND description, always. If the element isn't attached on the
      // Higgsfield side the tag is inert, and a silently ignored reference tag is
      // indistinguishable from ordinary drift — the words carry the load.
      return shortName(r.name).toUpperCase() + ' (' + handleOf[r.id || r.name] + ')'
        + (facts ? ' — ' + facts : '');
    };
    if (chars.length) out.push('Characters: ' + chars.map(describe).join('. ') + '.');

    // 13 Scene — place, then who is outside the crop, then the entry prop state.
    var ps = splitPropState(s.propState);
    var sceneBits = [s.environment];
    if (places.length) {
      sceneBits[0] = has(s.environment)
        ? clean(s.environment) + ' (' + handleOf[places[0].id || places[0].name] + ')'
        : String(places[0].name) + ' (' + handleOf[places[0].id || places[0].name] + ')';
    }
    sceneBits.push(s.offCamera, ps.before);
    push('Scene', sceneBits);

    // 14 CUT 1 — header is the setup plus the purpose justification; body is the
    // beat. The action goes ONLY here, which is the duplication fix.
    out.push(cutBlock(s, ps, props, handleOf));
    return out.join('\n');
  }

  // Camera: has five possible claimants. Ordered, and each is skipped once an
  // earlier one has written, so the slot can never say the same thing twice.
  function cameraSlot(s, chips, look, realism, lights) {
    var bits = [SD.camera];
    // campick and cambody are mutually exclusive in the UI — `camMode` decides
    // which one is rendered at all (`auto` shows the feel chips, `specific` the
    // body list). Reading both would emit a body AND a feel clause for a shot
    // where only one was ever offered. This is the mode acting as SCOPE, not as a
    // proxy for a collision: the anamorphic precedence below still ignores it.
    var specific = s.camMode !== 'auto';
    var bodyLabel = !specific ? ''
      : (chips.cambody === undefined || chips.cambody === null)
        ? (look.body || '')                     // the look's preset body — the only default that exists
        : chipLabel('cambody', chips.cambody);
    var gauge = /^(\d+)mm film$/.exec(bodyLabel || '');
    var lensformatLabel = chipLabel('lensformat', chips.lensformat);
    var campickLabel = specific ? '' : chipLabel('campick', chips.campick);
    var wantsAnamorphic = lensformatLabel === 'Anamorphic' || campickLabel === 'Anamorphic widescreen';
    var practicalWord = lights.indexOf('Practical') !== -1 ? 'the practicals' : 'the highlights';

    // 1. Film gauge — label AND artifacts. The gauge is a measurement, not a
    //    product name, and nothing else in the builder can express that 16mm is
    //    coarse where 35mm is fine. A digital body emits NEITHER its name (a
    //    trademark) nor artifacts (none are evidenced for it — inventing a list
    //    would be exactly the saturation this adapter exists to avoid).
    if (gauge) {
      bits.push(gauge[1] + 'mm film stock, visible grain in the shadows, gentle halation around '
        + practicalWord);
    }
    // 2. Anamorphic — lensformat wins; campick's duplicate option only fires when
    //    lensformat didn't, and contributes nothing else in that case.
    if (wantsAnamorphic) bits.push(SD.anamorphic);
    else if (campickLabel && campickLabel !== 'Anamorphic widescreen') {
      var feelClause = { Filmic: 'filmic colour grade with soft highlight rolloff and fine film grain',
        'Crisp digital': 'clean digital capture, wide dynamic range, no grain',
        Vintage: 'late-60s glass character on a modern digital sensor',
        Documentary: 'available-light capture, natural colour' }[campickLabel];
      if (feelClause) bits.push(feelClause);
    }
    // 3. Film grain + CA chip — redundant once a gauge has stated its grain.
    if (!gauge && realism.indexOf('Film grain + CA') !== -1) {
      bits.push('fine film grain, subtle chromatic aberration at the frame edges');
    }
    // 4. Lens flare chip — the anamorphic list already carries streak flares.
    if (!wantsAnamorphic && realism.indexOf('Lens flare') !== -1) bits.push('gentle lens flare');
    // 5. Nostalgic film's capture medium. Its §5 row names a [stock] nothing can
    //    source, so only the artifacts survive — and only when no gauge already
    //    said the same thing. A DEFINITE reference needs its referent introduced,
    //    which is why the practicals/highlights swap is driven by slot 2.
    if (!gauge && s.lookMode === 'feel' && chipLabel('feel', chips.feel) === 'Nostalgic film'
        && chips.feel !== undefined && chips.feel !== null) {
      bits.push('visible grain in the shadows, gentle halation around ' + practicalWord);
    }
    return bits;
  }

  // The handoff asks for prop state as BEFORE / DURING / AFTER, so read those
  // labels when they're there and fall back to treating the whole field as the
  // entry state when they aren't. Scene: takes `before`; the cut body takes the
  // rest, so no half is ever stated twice.
  function splitPropState(v) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return { before: '', during: '', after: '' };
    var grab = function (k, next) {
      var re = new RegExp(k + '\\s*:\\s*([\\s\\S]*?)(?=(?:' + next + ')\\s*:|$)', 'i');
      var m = re.exec(t);
      return m ? m[1].trim().replace(/[.,;]\s*$/, '') : '';
    };
    var before = grab('before', 'during|after');
    if (!before) return { before: t, during: '', after: '' };
    return { before: before, during: grab('during', 'after'), after: grab('after', '$a') };
  }

  function cutBlock(s, ps, props, handleOf) {
    var head = [];
    if (SD_SHOT[s.shot]) head.push(SD_SHOT[s.shot]);
    if (s.angle && SD_ANGLE[s.angle]) head.push(SD_ANGLE[s.angle]);
    if (has(s.lens)) head.push(s.lens + 'mm lens');   // always qualified — a bare 35mm collides with 35mm film
    if (SD_MOVE[s.move]) head.push(SD_MOVE[s.move]);
    if (SD_DEPTH[s.depth]) head.push(SD_DEPTH[s.depth]);
    var why = purposeClause(s);
    if (why) head.push(why);
    var body = [];
    // The action lives ONLY here. Today's compiler puts it in the scene clause and
    // again as motion, which is the duplication the slot model removes.
    if (has(s.action)) body.push(clean(s.action));
    if (has(ps.during)) body.push(ps.during);
    if (props.length) {
      body.push(props.map(function (r) {
        return String(r.name) + ' (' + handleOf[r.id || r.name] + ')';
      }).join(', ') + ' in shot');
    }
    if (has(ps.after)) body.push(ps.after);
    return 'CUT 1 — ' + (head.join(', ') || 'as described') + ':\n'
      + (body.length ? body.join('. ') + '.' : 'Hold the frame.');
  }

  // `so [X] reads clearly` — evidenced five times, and X is a fact about the shot.
  // Empty subject drops the clause rather than emitting a placeholder.
  function purposeClause(s) {
    var p = String(s.purpose == null ? '' : s.purpose).trim();
    if (!p) return '';
    if (PURPOSE_WHOLE[p]) return PURPOSE_WHOLE[p];
    var x = PURPOSE_X[p];
    if (!x) return '';
    if (x.indexOf('{subject}') !== -1) {
      if (!has(s.subject)) return '';
      x = x.replace('{subject}', clean(s.subject));
    }
    return 'so ' + x + ' reads clearly';
  }

  // The attachment-order line. HANDOFF text, not prompt text — one corpus form is
  // positional, so the likeliest real failure is attaching elements in a different
  // order than the prompt assumes. Kept out of the copyable body deliberately.
  function videoNote(s, opts) {
    if (!opts || opts.model !== 'higgsfield') return '';
    var refs = Array.isArray(opts.refs) ? opts.refs.filter(Boolean) : [];
    if (!refs.length) return '';
    return 'Attach in this order: ' + refs.map(function (r, i) {
      return (i + 1) + ' ' + r.name;
    }).join(' · ');
  }

  // The always-on "make it read as a real photograph, not AI" craft stack —
  // restored from the proven older recipe's naturalismTags. Deliberately
  // brand/name-free: no camera makes, film stocks or real DP names (those are
  // the legal-risk terms, and it's the descriptive craft — not the name — the
  // model actually acts on). Human-skin cues are gated on `people` (default on)
  // so a landscape or product still can opt out via { people: false }. Returns
  // an array of clauses, mirroring chipClauses so compilePrompt appends it the
  // same way.
  function realismBaseline(opts) {
    var people = !(opts && opts.people === false);
    var universal = [
      'natural imperfections',
      'candid, unposed moment',
      'subtle film grain',
      'slight chromatic aberration at frame edges'
    ];
    var human = [
      'visible skin pores and fabric weave detail',
      'flyaway hair strands',
      'realistic eye reflections, subtle asymmetry',
      'avoid supermodel perfection',
      'naturalistic performance, no exaggerated expressions'
    ];
    return people ? universal.concat(human) : universal;
  }

  // Brand-free cinema-camera / film-look craft — the sanitized descendant of the
  // old recipe's camera line (which named ARRI/Kodak, i.e. the legal-risk brands).
  // The model acts on the descriptive craft, not the brand name, so only the craft
  // survives. Stills only, always on. Kept separate from realismBaseline so the
  // two can be tuned (and legally re-checked) independently.
  function cameraCraft() {
    return [
      'shot on a large-sensor cinema camera',
      'wide dynamic range',
      'natural colour and skin tones',
      'film-like highlight rolloff'
    ];
  }

  window.PromptCompile = {
    kinds: kinds,
    fieldsFor: fieldsFor,
    compileReferencePrompt: compileReferencePrompt,
    weaveReferences: weaveReferences,
    compileVideo: compileVideo,
    term: term,
    DICT: DICT,
    videoRefMode: videoRefMode,
    OPTS: OPTS,
    CHIP_OPTS: CHIP_OPTS,
    chipLabel: chipLabel,
    chipLabels: chipLabels,
    chipClause: chipClause,
    chipClauses: chipClauses,
    // Seedance / Cinema Studio adapter surface. videoNote is the attachment-order
    // handoff line, deliberately separate from the prompt so it can't be copied.
    videoNote: videoNote,
    seedanceLooks: function () { return SEEDANCE_LOOK; },
    seedanceFeel: function () { return SEEDANCE_FEEL; },
    stillAction: stillAction,
    stillLead: stillLead,
    realismBaseline: realismBaseline,
    cameraCraft: cameraCraft
  };
})();
