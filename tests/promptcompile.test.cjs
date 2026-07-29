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


// ── L. per-model: reference handling differs by model capability ──
const vbase = () => ({ stills: 'A shot of a woman.', video: PC.compileVideo({ action:'she waves', move:'push' }, { scene:'A shot of a woman' }) });
let seed = PC.weaveReferences(vbase(), [charRef('Maya Chen','mid-30s')], { videoRefMode: 'array' });
let king = PC.weaveReferences(vbase(), [charRef('Maya Chen','mid-30s')], { videoRefMode: 'frame' });
ok('per-model: array mode weaves a 100% match ref', seed.video.indexOf('100% match') !== -1);
ok('per-model: frame mode binds to the start frame instead', king.video.indexOf('starting frame already establishes') !== -1 && king.video.indexOf('Maya Chen') !== -1);
ok('per-model: frame mode does NOT emit ref-array language', king.video.indexOf('100% match') === -1);
ok('per-model: Kling and Seedance produce DIFFERENT video prompts', seed.video !== king.video);
ok('videoRefMode: seedance=array', PC.videoRefMode('seedance') === 'array');
ok('videoRefMode: kling=frame', PC.videoRefMode('kling') === 'frame');
ok('videoRefMode: higgsfield=array', PC.videoRefMode('higgsfield') === 'array');
ok('videoRefMode: unknown defaults to array', PC.videoRefMode('mystery') === 'array');

// ── M. Phase-1 wiring: controls that now reach the STILLS prompt ──
// action → still (frozen beat)
ok('stillAction: returns cleaned beat', PC.stillAction('She reaches for the door.') === 'She reaches for the door');
ok('stillAction: blank -> empty', PC.stillAction('') === '' && PC.stillAction(undefined) === '');

// feel / grade / tod / light / realism chips resolve to clauses
ok('chipClause: feel maps', PC.chipClause('feel', 0).indexOf('warm naturalistic') !== -1);
ok('chipClause: feel last maps', PC.chipClause('feel', 6).indexOf('nostalgic film') !== -1);
ok('chipClause: grade maps', PC.chipClause('grade', 4) === 'teal-and-orange grade');
ok('chipClause: tod maps', PC.chipClause('tod', 1) === 'at golden hour');
ok('chipClause: light maps', PC.chipClause('light', 0) === 'natural light');
ok('chipClause: out-of-range empty', PC.chipClause('feel', 99) === '' && PC.chipClause('feel', -1) === '');
ok('chipClause: undefined idx empty', PC.chipClause('feel', undefined) === '');
ok('chipClause: unknown group empty', PC.chipClause('nope', 0) === '');
ok('chipClauses: realism multi maps', (() => {
  const cs = PC.chipClauses('realism', [1, 4]);
  return cs.length === 2 && cs[0].indexOf('film grain') !== -1 && cs[1].indexOf('dust') !== -1;
})());
ok('chipClauses: non-array -> empty', PC.chipClauses('realism', undefined).length === 0);
ok('chipClauses: drops unknown indices', PC.chipClauses('realism', [0, 999]).length === 1);

// every option in each wired group has a non-empty clause (no silent gaps)
ok('OPTS: every wired clause is non-empty', ['tod','light','feel','grade','realism'].every(
  g => PC.OPTS[g].every(o => o.clause && o.clause.length > 0)));

// per-model stills lead — model choice now changes the compiled text
ok('stillLead: gpt leads photorealistic', PC.stillLead('gpt').pre.indexOf('Photorealistic') !== -1);
ok('stillLead: nano leads photograph + 4K', PC.stillLead('nano').pre.indexOf('Photograph') !== -1 && PC.stillLead('nano').post.indexOf('4K') !== -1);
ok('stillLead: ar formatted into gpt/nano/seedream', PC.stillLead('gpt', { ar: '1:1' }).post.indexOf('1:1') !== -1 && PC.stillLead('seedream', { ar: '1:1' }).post.indexOf('1:1') !== -1);
ok('stillLead: unknown model -> no lead', PC.stillLead('mystery').pre === '' && PC.stillLead('mystery').post === '');
ok('stillLead: two models produce different treatment', JSON.stringify(PC.stillLead('gpt')) !== JSON.stringify(PC.stillLead('seedream')));
// Phase 4 slice 1 — pruned model set. Retired ids must carry no treatment, while
// 'higgsfield' (the SURFACE key behind the "Cinema Studio" label) keeps its behavior.
ok('pruned: retired still models have no lead', ['flux', 'mj'].every((m) => PC.stillLead(m).pre === '' && PC.stillLead(m).post === ''));
ok('pruned: cinema studio surface key still takes ref arrays', PC.videoRefMode('higgsfield') === 'array');

// ── N. realism baseline — the always-on "real photo, not AI" craft stack ──
const rb = PC.realismBaseline();
ok('baseline: returns several clauses', Array.isArray(rb) && rb.length >= 8);
ok('baseline: carries the key anti-AI cue', rb.join(', ').indexOf('avoid supermodel perfection') !== -1);
ok('baseline: film grain + naturalism present', rb.join(', ').indexOf('subtle film grain') !== -1 && rb.join(', ').indexOf('naturalistic performance') !== -1);
// legal guard: no camera makes, film stocks, or real DP names may ever appear
ok('baseline: brand/name-free (legal)', !/ARRI|Alexa|Kodak|Fuji|Vision3|Eterna|Deakins|Lubezki|Wong Kar|Doyle|Willis/i.test(rb.join(' ')));
ok('baseline: people=false drops human-skin cues', PC.realismBaseline({ people: false }).join(' ').indexOf('skin pores') === -1);
ok('baseline: default keeps human-skin cues', rb.join(' ').indexOf('skin pores') !== -1);
ok('baseline: universal cues survive people=false', PC.realismBaseline({ people: false }).indexOf('subtle film grain') !== -1);
ok('baseline: deterministic (same output twice)', JSON.stringify(PC.realismBaseline()) === JSON.stringify(PC.realismBaseline()));

// ── O. camera/film craft — brand-free cinema-look ──
const cc = PC.cameraCraft();
ok('camera: returns clauses', Array.isArray(cc) && cc.length >= 3);
ok('camera: carries the real craft (dynamic range + rolloff)', cc.join(', ').indexOf('wide dynamic range') !== -1 && cc.join(', ').indexOf('highlight rolloff') !== -1);
ok('camera: brand/name-free (legal)', !/ARRI|Alexa|RED|Sony|Venice|Blackmagic|Kodak|Fuji|Vision3|Eterna/i.test(cc.join(' ')));
ok('camera: deterministic', JSON.stringify(PC.cameraCraft()) === JSON.stringify(PC.cameraCraft()));

// ── P. Seedance / Cinema Studio adapter vs the legacy clause-join ──
// 'higgsfield' no longer gets the old prose tail: it composes 14 labelled slots
// from source fields instead. What still has to hold is that NOTHING else moved.
const vhf = PC.compileVideo({ move: 'push', action: 'she waves' }, { model: 'higgsfield' });
const vkl = PC.compileVideo({ move: 'push', action: 'she waves' }, { model: 'kling' });
ok('adapter: higgsfield emits labelled slots, not prose', /^Style: /.test(vhf) && vhf.indexOf('\nCUT 1 — ') !== -1);
ok('adapter: the old prose tail is gone', vhf.indexOf('Performance: pore-level skin realism') === -1);
ok('adapter: kling still gets the clause-join', vkl.indexOf('Camera: the camera pushes in slowly') !== -1);
ok('adapter: kling never sees a slot label', vkl.indexOf('\nStyle: ') === -1 && vkl.indexOf('CUT 1') === -1);
ok('adapter: higgsfield and kling differ', vhf !== vkl);
ok('adapter: no model -> legacy path', PC.compileVideo({ move: 'push' }).indexOf('CUT 1') === -1);
// Still load-bearing: a body name is a trademark and must never reach a prompt.
ok('adapter: brand/name-free (legal)', !/ARRI|Alexa|Kodak|Fuji|RED V-Raptor|Sony|Venice|Deakins|Lubezki|Khondji|Anderson/i.test(vhf));
ok('adapter: deterministic', PC.compileVideo({ move: 'push', action: 'she waves' }, { model: 'higgsfield' }) === vhf);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
