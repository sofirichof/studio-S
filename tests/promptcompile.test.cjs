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
ok('plain: video gains identity lock', r.video.indexOf('100% match') !== -1 && r.video.indexOf('Maya Chen') !== -1);
ok('opts omitted === atTags off', PC.weaveReferences(base(), [charRef('Maya Chen')]).stills ===
   PC.weaveReferences(base(), [charRef('Maya Chen')], {}).stills);

// ── C. atTags mode — @handles, descriptions kept ──
r = PC.weaveReferences(base(), [charRef('Maya Chen', 'mid-30s, cropped dark hair'), locRef('Loft Kitchen')], { atTags: true });
ok('at: handle strips spaces', r.stills.indexOf('@MayaChen') !== -1);
ok('at: raw name gone', r.stills.indexOf('Maya Chen') === -1);
ok('at: description survives alongside', r.stills.indexOf('@MayaChen (mid-30s, cropped dark hair)') !== -1);
ok('at: location tagged', r.stills.indexOf('set in @LoftKitchen') !== -1);
ok('at: video identity lock uses @handle', r.video.indexOf('@MayaChen') !== -1);

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


// ── G. compileVideo — composed from full state, not one word ──
const st = (o) => Object.assign({ move: 'push', subject: 'a woman pouring coffee', environment: 'a sunlit loft kitchen' }, o);
r = PC.compileVideo(st({ action: 'She pours the coffee, then looks up as the door opens' }));
ok('video: action beat included verbatim', r.indexOf('She pours the coffee, then looks up as the door opens') !== -1);
ok('video: camera stated separately', r.indexOf('Camera:') !== -1);
ok('video: one move, no cuts lock', r.indexOf('one camera move only, no cuts') !== -1);
ok('video: ambient motion clause', r.indexOf('Ambient motion') !== -1);
ok('video: positive continuity lock', r.indexOf('same subject, wardrobe and lighting') !== -1);
ok('video: environment reaches ambient clause', r.indexOf('sunlit loft kitchen') !== -1);
ok('video: does not re-describe the subject', r.indexOf('a woman pouring coffee') === -1);

// regression: two different shots must produce meaningfully different video prompts
const vA = PC.compileVideo(st({ action: 'She pours, then looks up as the door opens' }));
const vB = PC.compileVideo({ move: 'tracking', action: 'He sprints across the intersection, dodging a cab', environment: 'a rain-slick downtown street' });
ok('video: two shots differ beyond one word', vA !== vB && vB.indexOf('sprints') !== -1 && vA.indexOf('pours') !== -1);

// fallbacks
r = PC.compileVideo(st({ action: '' }));
ok('video: no action -> natural-motion fallback', r.indexOf('natural motion true to the scene') !== -1);
r = PC.compileVideo({});
ok('video: empty state still returns a usable prompt', r.length > 40 && r.indexOf('Camera:') !== -1);
ok('video: unknown move falls back', PC.compileVideo({ move: 'zoomwhip' }).indexOf('moves subtly') !== -1);

// ── H. weaveReferences reaches the video prompt ──
r = PC.weaveReferences({ stills: 'A shot.', video: PC.compileVideo(st({ action: 'she waves' })) }, [charRef('Maya Chen', 'mid-30s')], { atTags: true });
ok('video weave: @handle in video prompt', r.video.indexOf('@MayaChen') !== -1);
ok('video weave: 100% match lock', r.video.indexOf('100% match') !== -1);
r = PC.weaveReferences({ stills: 'A shot.', video: 'Animate.' }, [lookRef('Kodak look')]);
ok('video weave: look-only refs leave video untouched', r.video === 'Animate.');


// ── I. @-mode: reference declarations lead the video prompt (Adil/platform pattern) ──
r = PC.weaveReferences({ stills: 'A shot.', video: 'Animate the still. She waves.' }, [charRef('Maya Chen', 'mid-30s'), locRef('Loft Kitchen')], { atTags: true });
ok('at: video opens with handle declarations', r.video.indexOf('@MayaChen') === 0 || r.video.indexOf('@MayaChen') < r.video.indexOf('Animate'));
ok('at: 100% match lock retained', r.video.indexOf('100% match') !== -1);
ok('plain mode: refs still trail the video', PC.weaveReferences({ stills: 'A shot.', video: 'Animate.' }, [charRef('Maya')]).video.indexOf('Animate') === 0);


// ── J. video carries the FULL scene when the caller passes it (Sofia: not just movement) ──
r = PC.compileVideo(st({ action: 'She pours, then looks up' }), { scene: 'A wide establishing shot of a woman pouring coffee — a sunlit loft, 24mm' });
ok('video: leads with the passed scene', r.indexOf('A wide establishing shot of a woman pouring coffee') === 0);
ok('video: scene + action + camera all present', r.indexOf('a sunlit loft') !== -1 && r.indexOf('She pours, then looks up') !== -1 && r.indexOf('Camera:') !== -1);
ok('video: scene not thrown away (lens survives)', r.indexOf('24mm') !== -1);


// ── K. dictionary: every control resolves to a phrase, model-aware ──
ok('term: angle low', PC.term('angle','low','kling').indexOf('low-angle') !== -1);
ok('term: depth shallow', PC.term('depth','shallow') === 'shallow depth of field, background thrown soft');
ok('term: comp centre', PC.term('comp','mc').indexOf('centred') !== -1);
ok('term: framing ots', PC.term('framing','ots') === 'over-the-shoulder framing');
ok('term: density crowd', PC.term('density','crowd').indexOf('crowd') !== -1);
ok('term: move via dict', PC.term('move','push') === 'the camera pushes in slowly');
ok('term: unknown control empty', PC.term('nope','x') === '');
ok('term: unknown value empty', PC.term('angle','sideways') === '');
ok('term: every angle value maps', ['eye','low','high','dutch'].every(v => PC.term('angle',v).length > 0));
ok('term: every depth value maps', ['shallow','layered','deep'].every(v => PC.term('depth',v).length > 0));
ok('term: every comp cell maps', ['tl','tc','tr','ml','mc','mr','bl','bc','br'].every(v => PC.term('comp',v).length > 0));
ok('term: every framing value maps', ['Symmetrical','lead','frame','Negative space','ots'].every(v => PC.term('framing',v).length > 0));
ok('term: model-aware falls back to core when no override', PC.term('move','push','veo3_1') === PC.term('move','push'));
ok('compileVideo: move sourced from dict', PC.compileVideo({ move:'tracking' }).indexOf('tracks with the subject') !== -1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
