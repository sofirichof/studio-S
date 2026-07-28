# Studio S beta report — 2026-07-28

Tester persona: freelance director, comfortable with creative tools, no interest in how the app
is built. Job: turn a one-page prose brief for a coffee-roastery brand film into prompts I could
actually paste into an image generator, with no script and no reference images to start from.
Ran end-to-end: wrote the brief, created a project, worked the setup questions, acted as the
"paste into Claude" handoff myself and wrote the plan, imported it back in, opened references and
shots, and pushed on a few edge cases (hand edit, hand-added reference, reload). Read no file in
`src/` or `docs/` before this report was written.

## 1. Did you finish the job?

Partially, and not in a way I'd be comfortable handing to a client without more work. The plan
import itself is genuinely good — 15 shots, 4 references and 7 to-dos all came back exactly as
written, correctly organized by concept/scene/shot, and the Prompt Builder correctly reassembles
every field I wrote (subject, action, environment, off-camera, prop state, negative prompt) into
readable, well-structured prose. But two things stopped me from calling this "done": first,
simply opening an already-imported reference to check it very nearly destroyed it — the edit
screen showed blank fields and, one click later, a raw prompt full of unfilled `[BRACKETS]`
instead of my actual text (see finding #1). Second, every compiled shot prompt — even the ones
with no person in frame, or with the face deliberately excluded — comes back demanding "a lone
figure," visible skin pores, flyaway hair, and "realistic eye reflections" (finding #2). I would
send the reference-sheet prompts to a client as-is. I would not paste the shot prompts into GPT
Image without manually deleting that block first, and for the establishing shot in particular
(an intentionally empty storefront) I'd end up with a stranger standing in my shop.

## 2. Findings, worst first

**Finding: opening an imported reference to edit it silently sets up data loss.**
- What I was trying to do: check the imported "Elena" character reference sheet before generating
  anything, the way any director would sanity-check the setup.
- What I expected: the wizard would show me my already-written reference text so I could tweak it.
- What happened: Step 2 of the edit wizard ("Character details") showed every field — man/woman,
  age, ethnicity, skin tone, hair, evidence, eye colour, accessory — completely empty, populated
  only with generic example placeholder text (including "man" for a character I'd written as a
  woman, and specifics like "Puerto Rican" and "thin gold-rimmed round glasses" that have nothing
  to do with my import). Step 3, "Compiled prompt — paste into your image generator," labelled
  "your edits are what gets saved," showed the raw unfilled template
  (`a [AGE] [ETHNICITY/NATIONALITY] [man/woman], [SKIN TONE]...`) instead of my real, finished
  prompt. Clicking Save there would have overwritten my working reference with that template. I
  confirmed by inspecting the app's own saved data that my real prompt was still intact, and that
  a reference I built by hand through the same wizard (a roasting-drum prop) *does* compile
  correctly — so the wizard itself works, but plan-import never fills in the per-attribute fields
  it depends on, only the free-text description and the already-finished prompt. Editing anything
  imported through the normal Edit button is a trap.
- Severity: blocker.
- Would a real user have stopped here? Yes — and the dangerous part is they might not notice
  until after clicking Save.

**Finding: every compiled shot prompt adds a person, a face, and skin/hair detail whether or not
the shot has one.**
- What I was trying to do: get a finished, sendable prompt for the film's opening shot (an empty
  storefront, nobody in frame — Elena is off-camera, "not yet visible") and for a hands-only
  insert that explicitly excludes her face.
- What I expected: a prompt describing an empty room, and a prompt describing only a hand.
- What happened: both compiled prompts included, verbatim, "...a lone figure, shot on a
  large-sensor cinema camera... visible skin pores and fabric weave detail, flyaway hair strands,
  realistic eye reflections, subtle asymmetry, avoid supermodel perfection, naturalistic
  performance, no exaggerated expressions." This is baked into the "Naturalistic classic"
  cinematography look and gets appended unconditionally — it doesn't check whether the shot's own
  subject/action fields mention a person at all. For the empty establishing shot this would very
  likely generate a stranger standing in the frame, undercutting the entire "before anyone else is
  awake" beat the client brief was built around.
- Severity: broken.
- Would a real user have stopped here? Yes, the moment the generated image didn't match the shot.

**Finding: "Style / look set" in the prompt-strength checklist never checks off.**
- What I was trying to do: get the shot's prompt-strength meter past "75% — good, add detail," or
  at least understand what it wanted.
- What I expected: picking a cinematography look (I picked "Naturalistic classic," which was
  already shown highlighted) would satisfy it.
- What happened: the item stayed flagged incomplete regardless of what I clicked on that screen.
  Nothing on the Look step indicates what actually would satisfy it.
- Severity: confusing.
- Would a real user have stopped here? Not stopped, but wasted time hunting for a setting that, as
  far as I could find, isn't on that screen.

**Finding: no way to tag a shot as having zero people in frame.**
- What I was trying to do: correctly categorize the empty establishing shot and the empty-street
  cutaway.
- What I expected: a "none / empty frame" option alongside single / few / crowd.
- What happened: forced to pick "Single subject" and a Subject type ("Architecture"/"Landscape")
  for shots that have no one in them — simply inaccurate, and it may be part of why the person
  boilerplate above gets added even to empty shots.
- Severity: rough edge.
- Would a real user have stopped here? No, but would guess and stay unsure it was right.

**Finding: the app's own Claude-facing setup instructions don't match what the Prompt Builder
scores as "complete."**
- What I was trying to do: follow the handoff instructions exactly as given, then expect the
  resulting shots to show as fully built in the builder.
- What I expected: a plan built exactly to the app's own spec would score well.
- What happened: the JSON schema the instructions dictate has no "look," "time of day," or
  "lighting" concept at all, yet the builder's completeness checklist scores all three — so a
  perfectly-followed import is permanently capped below 100%, with no indication anywhere in the
  handoff text that these fields exist until you open each shot yourself in the UI.
- Severity: rough edge.
- Would a real user have stopped here? No, but would likely suspect the import was broken when it
  wasn't.

**Finding: no supported way to say "this deliverable reuses another concept's shots."**
- What I was trying to do: set up the Social cutdown, which my own brief describes explicitly as
  "same footage, just a different edit" — not a second shoot.
- What I expected: some way to reference the Hero film's shots directly.
- What happened: the schema requires a full, separate shot list per concept, so I had to duplicate
  three shots' worth of fields by hand and note in free text that they were reused. Nothing stops
  the two copies drifting apart later.
- Severity: rough edge.
- Would a real user have stopped here? No, but they'd be maintaining duplicate data forever.

**Finding: no closing-beat purpose that isn't tied to shot size.**
- What I was trying to do: tag the film's last beat (the door sign flipping from CLOSED to OPEN,
  shot close) with its real editorial role.
- What I expected: something like a "button" / closing-insert category, independent of framing.
- What happened: the only end-of-film category is "final wide," which presumes an actual wide
  shot. Had to either mistag it or add a caveat in free text.
- Severity: cosmetic.
- Would a real user have stopped here? No.

**Finding: the app talks about "Claude" directly to a non-technical creative user.**
- The home screen and new-project screen both read "point Claude at your assets folder" and "the
  studio scaffolds concepts and shots for you" — accurate, but written for someone who already
  knows this is an AI pipeline, not for "a freelance director... completely uninterested in how
  this one is built."
- Severity: cosmetic.
- Would a real user have stopped here? No, but it breaks the illusion of a finished creative tool.

**Minor / cosmetic, noted in passing:**
- Chip-style pickers are inconsistently built: the Subject-purpose chips (Establishing, Master...)
  are real clickable buttons; the Look, Time-of-day and Lighting chips are plain non-interactive
  elements under the hood. Invisible to a mouse user, but inconsistent and harder for automation
  or assistive tech.
- The Camera step's live shot preview always shows a generic standing-person silhouette, even for
  a shot with nobody in it (the empty establishing shot).

## 3. The three things that most got in your way, ranked

1. **Editing an imported reference nearly destroyed it, silently.** This is the one that would
   have actually cost me real work — a one-click "just checking" action away from losing a
   finished character sheet, with the UI actively labelling the destructive screen "your edits are
   what gets saved."
2. **Every shot prompt needs manual cleanup before use.** The unconditional person/skin/hair
   boilerplate means none of the compiled stills prompts are actually "ready to paste," which
   directly contradicts the promise of the whole workflow — I have to read and edit every single
   one before it's usable, and for empty or hands-only shots I have to catch and remove content
   that would visibly break the shot.
3. **The instructions and the UI don't agree on what "done" means.** Following the app's own
   handoff text to the letter still leaves every shot stuck at "good, add detail" with three
   checklist items (style/look, and — separately — time of day and lighting on the Environment
   step) that the instructions never mention and that don't obviously map to anything I wrote.

## 4. What you expected the app to do and it did not

- Expected opening an imported reference to show me what I'd imported. It showed blank fields and,
  one step later, an unfilled template.
- Expected an "establishing" or "hero product" shot with no person in it to render distraction-free.
  Got unconditional face/skin/hair language regardless of content.
- Expected clicking the already-highlighted cinematography look to satisfy "Style / look set." It
  never did, on that screen or any other I found.
- Expected the Social cutdown — explicitly a re-edit of existing footage per my own brief — to be
  able to reference the Hero film's shots. Had to fully duplicate them by hand.

## 5. Anything you only understood after the fact

- The "man," "Puerto Rican," and "thin gold-rimmed round glasses" text in the character-edit wizard
  read, at a glance, like real saved data — specific enough to be believable. I only confirmed it
  was generic placeholder text by checking the app's own saved data directly; a real user has no
  equivalent way to check and would likely believe their import was in front of them.
- The Step 3 "Compiled prompt" screen only makes sense once you understand it's recompiled fresh
  from Step 2's granular fields every time, rather than showing whatever prompt the reference
  already carries. Nothing in the UI states this, and it's the opposite of how Step 1 of the same
  wizard behaves (the Name field does show your real saved value).
- Where the beat sheet is actually supposed to live only becomes clear by trial and error: the
  handoff instructions say to write one, but the three named PDF deliverables (breakdown, shot
  list, locked descriptions) never mention it, so I had to guess it belongs at the top of the
  breakdown document.
- One genuine positive I only appreciated once I'd seen the JSON schema: the Prompt Builder UI
  translates the schema's technical field names (`offCamera`, `propState`, `cameraIntent`) into
  plain language ("Off camera," "Prop state," "What happens in the shot") for the human-facing
  screens — the jargon stays confined to the Claude-facing handoff text and never reaches the
  director using the app.

## 6. Final prompt text, verbatim

**Shot 1A (GPT Image, stills, "Storefront, still dark" — the empty establishing shot):**

> Cinematic film still. Photorealistic. A wide shot of the roastery's front window and door seen
> from the street side; hand-painted signage on the glass; interior still unlit except for a
> single lamp glow deep in the room, the space is empty and still; no motion in frame; one warm
> light glowing far inside the dark room — corner coffee roastery storefront, pre-dawn blue hour,
> wet-look pavement reflecting the blue sky, hand-painted gold lettering on the glass, brass door
> handle catching a sliver of the interior lamp, motivated naturalistic light, single soft key,
> deep restrained shadows, muted earthy palette, classical balanced composition, 24mm, shot at eye
> level, subject centred in frame, shallow depth of field, background thrown soft, a lone figure,
> shot on a large-sensor cinema camera, wide dynamic range, natural colour and skin tones,
> film-like highlight rolloff, natural imperfections, candid, unposed moment, subtle film grain,
> slight chromatic aberration at frame edges, visible skin pores and fabric weave detail, flyaway
> hair strands, realistic eye reflections, subtle asymmetry, avoid supermodel perfection,
> naturalistic performance, no exaggerated expressions. 16:9. Off camera: Elena inside, at the back
> counter, not yet visible in this crop. Continuity: before: door locked, hanging sign reads
> CLOSED. during: unchanged. after: unchanged. Avoid: visible crew, modern cars, other pedestrians,
> daylight sky.

Note the "a lone figure... flyaway hair strands... realistic eye reflections" clause above — this
shot has nobody in frame. That block is exactly finding #2.

**Reference asset — Elena (head roaster / barista), character reference sheet:**

> Cinematic character reference sheet, split-frame layout, photorealistic.
>
> Left panel — facial close-up: a early-to-mid-30s Latina woman, warm brown skin, the entire head
> fully inside the frame including all the hair, nothing cropped, dark brown hair worn in a low bun
> with a few loose strands framing her face, faint fine lines at the corners of her eyes and a
> small scar through the left eyebrow, deep brown eyes, small gold stud earrings, real skin texture
> with visible pores, calm focused neutral expression, looking straight into lens. Shot on 85mm
> portrait lens, shallow depth of field, soft cinematic key light with gentle fill.
>
> Right panel — full-body front and back views side by side: the same woman shown twice within
> this panel — on the left, a full-body front view facing the camera; on the right, a full-body
> back view photographed from directly behind. In both, she stands straight in a normal relaxed
> pose, arms hanging down at her sides, full height in frame head-to-toe, lean functional build
> (1.68m), warm brown skin, dark brown hair in a low bun, same small gold stud earrings, same
> outfit: faded olive canvas apron, straight cut, tied at the waist with a visible knot at the back;
> charcoal waffle-knit long-sleeve top, sleeves pushed up to the forearm; straight-leg dark indigo
> trousers, slightly worn at the knee; brown leather clogs, softened and creased from daily wear.
> The front view shows her face, the gold stud earrings, and the apron's front pocket seam; the
> back view shows the back of her head, hair, shoulders, the apron's knotted ties and the seams of
> the waffle-knit top, and the rear of the trousers and clogs. Both figures matched in framing,
> scale and lighting for consistency. Shot on 35mm lens, even full-length lighting.
>
> Look: clean studio character sheet, plain solid grey background (#8a8a8a), seamless, consistent
> character across all views, soft diffused cinematic lighting, muted natural color grade, fine
> detail, true-to-life skin tones, vertical divider lines separating each view.

This one I would actually send to a client or paste into an image generator as-is.

---

## Appendix: what I got wrong

Read the source after writing the report above, as instructed, to check whether anything I called
broken is actually working as designed. Nothing in the top findings was — if anything, the source
makes them more clear-cut, and more precisely diagnosable, than what I could see from the UI alone.
Nothing here rewrites the original findings; it just adds the confirmed cause.

- **Finding #1 (reference edit destroys imported data) — confirmed, not user error.**
  `references.html`'s `openWizard()` does `fields: r && r.fields ? Object.assign({}, r.fields) : {}`
  — it copies whatever `fields` object the reference already has, verbatim. An imported reference's
  `fields` only ever contains `{ desc: "..." }` (the free-text description from the plan JSON); it
  never contains the granular per-kind keys (age, ethnicity, hair, evidence, eye colour, accessory...)
  that `PromptCompile.fieldsFor(kind)` renders inputs for and `compileReferencePrompt()` recompiles
  from. So editing an imported reference always starts from blank granular fields and always
  recompiles into the unfilled bracket template — there is no code path that reconciles the two
  shapes. A hand-added reference works fine because the wizard fills `fields` with the right keys
  itself. This is exactly the bug it looked like from the outside.

- **Finding #2 (unconditional person/skin/hair boilerplate) — confirmed, and the fix already
  half-exists in the code.** `promptcompile.js`'s `realismBaseline(opts)` explicitly supports
  `{ people: false }` to drop the skin/hair/eye clauses — the comment above it says this is "so a
  landscape or product still can opt out." But the only call site, `promptbuilder.html:557`, calls
  `PC.realismBaseline()` with no arguments at all, so `people` defaults to `true` on every single
  shot, always. The feature was built and then never wired to the shot's own Subject type or
  density. Separately, "a lone figure" is not part of that boilerplate — it's `DICT.density.single`
  compiling literally, which is a direct consequence of finding #4 (no zero-person density value to
  choose instead).

- **Finding #3 ("Style / look set" never checks off) — confirmed, and mislabeled.** The checklist
  condition is `has(s.prefixOverride)` — it is checking the disabled "Override global style prefix
  for this shot" field, not the Cinematography-look chip selection at all. Picking a look can never
  satisfy an item labelled "Style / look set" unless you also turn on and fill in the per-shot
  override, which most shots correctly should never need. The label doesn't match what it measures.

- **Findings #4, #6, #7 — confirmed as genuine gaps, not something I missed in the UI.**
  `DICT.density` in `promptcompile.js` has exactly three values (`single`, `few`, `crowd`), no
  zero-person option. `store.js`'s shot schema has no linking/reference field between shots or
  concepts (checked for anything like `linkedShot`/`sourceShot`). `SHOT_PURPOSES` in `store.js` is
  exactly the 14 values shown in the UI — no closing/button category exists.
