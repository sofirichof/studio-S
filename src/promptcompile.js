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
    return { stills: stills, video: compiled.video };
  }

  window.PromptCompile = {
    kinds: kinds,
    fieldsFor: fieldsFor,
    compileReferencePrompt: compileReferencePrompt,
    weaveReferences: weaveReferences
  };
})();
