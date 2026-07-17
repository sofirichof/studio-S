// PromptCompile verification (weaveReferences + @-tag mode). Run: node tests/promptcompile.test.cjs
const fs = require('fs');
const path = require('path');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'src', 'promptcompile.js'), 'utf8'));
const PC = global.window.PromptCompile;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }

const base = () => ({ stills: 'A wide establishing shot of a woman.', video: 'Animate the still: slow push-in.' });
const charRef = (name, desc) => ({ name: name, kind: 'character', fields: desc ? { desc: desc } : {} });
const locRef = (name) => ({ name: name, kind: 'location', fields: {} });
const lookRef = (name) => ({ name: name, kind: 'look', fields: {} });

// ── A. passthrough when nothing to weave ──
ok('no refs: compiled unchanged', PC.weaveReferences(base(), []).stills === base().stills);
ok('null refs: compiled unchanged', PC.weaveReferences(base(), null).stills === base().stills);
ok('empty stills: untouched', PC.weaveReferences({ stills: '', video: 'x' }, [charRef('Maya')]).stills === '');
ok('null compiled: returned as-is', PC.weaveReferences(null, [charRef('Maya')]) === null);
ok('refs with null holes filtered', PC.weaveReferences(base(), [null, charRef('Maya'), undefined]).stills.indexOf('Maya') !== -1);

// ── B. default mode — plain names, no @ ──
let r = PC.weaveReferences(base(), [charRef('Maya Chen', 'mid-30s'), locRef('Loft Kitchen')]);
ok('plain: featuring by name', r.stills.indexOf('featuring Maya Chen (mid-30s)') !== -1);
ok('plain: set in location', r.stills.indexOf('set in Loft Kitchen') !== -1);
ok('plain: no @ introduced', r.stills.indexOf('@') === -1);
ok('plain: video untouched', r.video === base().video);
ok('opts omitted === atTags off', PC.weaveReferences(base(), [charRef('Maya Chen')]).stills ===
   PC.weaveReferences(base(), [charRef('Maya Chen')], {}).stills);

// ── C. atTags mode — @handles, descriptions kept ──
r = PC.weaveReferences(base(), [charRef('Maya Chen', 'mid-30s, cropped dark hair'), locRef('Loft Kitchen')], { atTags: true });
ok('at: handle strips spaces', r.stills.indexOf('@MayaChen') !== -1);
ok('at: raw name gone', r.stills.indexOf('Maya Chen') === -1);
ok('at: description survives alongside', r.stills.indexOf('@MayaChen (mid-30s, cropped dark hair)') !== -1);
ok('at: location tagged', r.stills.indexOf('set in @LoftKitchen') !== -1);
ok('at: video untouched', r.video === base().video);

// ── D. handle slugging edge cases ──
const slug = (name) => PC.weaveReferences(base(), [charRef(name)], { atTags: true }).stills;
ok('slug: punctuation stripped', slug("O'Brien-Smith Jr.").indexOf('@OBrienSmithJr') !== -1);
ok('slug: digits kept', slug('Robot 3000').indexOf('@Robot3000') !== -1);
r = slug('———'); // no alphanumerics → no handle; falls back to the raw name
ok('slug: unsluggable name falls back to raw name', r.indexOf('———') !== -1 && r.indexOf('@') === -1);

// ── E. grouping clauses hold in both modes ──
r = PC.weaveReferences(base(), [charRef('Maya'), locRef('Loft'), lookRef('Portra Film')], { atTags: true });
ok('groups: featuring/set in/style order', (() => {
  const f = r.stills.indexOf('featuring'), s = r.stills.indexOf('set in'), st = r.stills.indexOf('in the style of');
  return f !== -1 && s !== -1 && st !== -1 && f < s && s < st;
})());
ok('groups: look gets @ too', r.stills.indexOf('@PortraFilm') !== -1);

// ── F. output shape ──
r = PC.weaveReferences(base(), [charRef('Maya')], { atTags: true });
ok('shape: single trailing period', /\.$/.test(r.stills) && !/\.\.$/.test(r.stills));
ok('shape: em-dash join preserved', r.stills.indexOf(' — featuring') !== -1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
