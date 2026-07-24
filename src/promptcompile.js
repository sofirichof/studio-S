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

  function fieldsFor(kind) {
    return (FIELDS[kind] || FIELDS.character).slice();
  }

  var has = function (v) { return !!(v && String(v).trim()); };
  var clean = function (v) { return String(v).trim().replace(/\.$/, ''); };

  // Compile an asset reference into a generator-ready stills prompt (+ short
  // video note). Same clause-join style as promptbuilder's compilePrompt().
  function compileReferencePrompt(kind, name, fields) {
    fields = fields || {};
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
        // Kling / Sora accept ONLY a start/end frame — no reference arrays (T1:
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
  //   'frame' → start/end frame only, no reference arrays (Kling, Sora)
  // This is a real capability difference, not phrasing — so it changes the prompt
  // per model. Standard film vocabulary stays universal (research found no
  // per-model wording difference).
  var VIDEO_CAPS = {
    seedance:   { refs: 'array' },
    higgsfield: { refs: 'array' },
    runway:     { refs: 'array' },
    kling:      { refs: 'frame' },
    sora:       { refs: 'frame' }
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
    // (Midjourney needs --ar; others append the ratio). Order matches the builder.
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
    seedream: { pre: '',                 post: function (ar) { return ' Ultra-sharp 4K, accurate materials' + (ar ? ', ' + ar : '') + '.'; } },
    flux:     { pre: '',                 post: function ()   { return ' photorealistic, natural skin and texture.'; } },
    mj:       { pre: '',                 post: function (ar) { return ' --ar ' + (ar || '16:9') + ' --style raw --v 7'; } }
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
  // Per-model motion-realism tail. Higgsfield/Cinema Studio only for now — Kling
  // is deliberately left alone (untested there; see the clicker discipline).
  // Wording follows the higgsfield-seedance-prompt skill, not the older app's
  // video line: performance/skin realism + physics (mass, inertia, contact), a
  // short photoreal STYLE suffix, and POSITIVE phrasing throughout — the skill
  // forbids prohibitions, so the old "no AI artifacts" is stated as its target
  // instead. No equipment, film-stock or DP names (skill rule + legal).
  var VIDEO_TAILS = {
    higgsfield: 'Performance: pore-level skin realism, living eyes with catch-lights, ' +
      'naturalistic micro-expressions, visible breath. Physics: cloth and hair move with ' +
      'real mass and inertia, contact shadows hold where bodies meet surfaces. ' +
      'Style: photoreal, fine grain.'
  };

  function compileVideo(s, opts) {
    s = s || {};
    opts = opts || {};
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
    // Motion-realism tail, per model (Higgsfield only; Kling untouched).
    if (VIDEO_TAILS[opts.model]) parts.push(VIDEO_TAILS[opts.model]);
    return parts.join(' ');
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
    chipClause: chipClause,
    chipClauses: chipClauses,
    stillAction: stillAction,
    stillLead: stillLead,
    realismBaseline: realismBaseline,
    cameraCraft: cameraCraft
  };
})();
