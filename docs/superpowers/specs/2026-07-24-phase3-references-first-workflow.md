# Phase 3 — References-first workflow

Date: 2026-07-24
Status: the real project — design, then slice
Priority: third (needs a working generator under it), but this is the point of the whole effort.

## Locked principle

The app IS the prompt generator. **Claude never writes prompts.** The reference-sheet and
location prompts Sofia had to get from Claude in the 2026-07-23 session are exactly what the
app must now produce itself — encoded as deterministic, app-owned recipes.

## The two workflows (Sofia's words)

1. **Still-to-video** — "I'm creating that still image on ChatGPT with the references, so that
   doesn't change." The app writes the video prompt from the still. **This already works and
   must not be broken.**
2. **References-first (the Higgsfield way) — the work she actually does now, which "doesn't
   really exist yet in the app":** make the references (character sheets, location stills)
   first, then write the video/still prompts "with calls back to the assets I have to make in
   correspondence with the reference." Not just video — it applies to stills in the other
   generators too.

## Locked decisions (2026-07-24)

- **The toggle is the workflow, not the syntax.** Expose a mode switch — **references-first** vs
  **still-to-video** (the two workflows above). That is the only asset-related choice the user
  makes. How each model *attaches* references is **derived automatically** from the chosen model +
  surface — never a manual toggle (a user must not be able to set @-tags on a Kling-native run).
- **Assets are two axes, not one:**
  - *Model capability* — how a model ingests refs: **array** vs **start/end-frame**
    (`videoRefMode()`).
  - *Platform surface* — whether the surface uses **@-tags** (`usesAtTags()`), which follows the
    **platform (Higgsfield), not the model.** "Kling run on Higgsfield with @-tags" is a valid
    combination. (See `2026-07-17-model-surface-two-axis.md`.)
- **Attach modes for the locked model set:**
  - **ChatGPT / Nano Banana Pro / Seedream** — references described *in the prompt text* (still).
  - **Kling** — **start frame** (image-to-video); `videoRefMode('frame')`.
  - **Cinema Studio / Seedance** — reference-**array** + **@-tags** on the Higgsfield surface;
    `videoRefMode('array')` + `usesAtTags()`.
- Model set = the locked list in Phase 2. Research profiles inform these idioms but are **not
  loaded at runtime** (context only).

## What to build

A references-first mode where the app, deterministically, does the whole loop:

**A. Create the reference/asset prompts.**
- **Character reference-sheet recipe** (encode exactly what we landed on): a **4-angle
  full-body turnaround** (front, ¾, side, back) **plus one hero head-and-shoulders close-up**
  for face lock. **No expression strip.** Neutral grey seamless, even soft ~5500K light,
  photoreal. Realism levers baked in: a CAPTURE line (e.g. 85mm / Portra 400, natural grain,
  real depth of field), a SKIN line (pores, peach fuzz, real asymmetry, subsurface
  scattering), and a NEGATIVE line banning plastic/CGI/wax. Parameterized by the character's
  locked description (from the Phase 4 handoff docs).
- **Location recipe:** 3/4 wide angle, lived-in not showroom, **generic/unbranded — no logos,
  no text**, photoreal, 16:9, white balance per scene time-of-day. Realism levers:
  photographic capture line, contact shadows, no floating/warped objects.
  **Realism is a band, not a dial to max** — clean-but-real, not over-grunged ("too gritty"
  was a rejection). Bias toward well-kept/real unless the brief says otherwise.

**B. Generate + approve-as-you-go.** As the user runs the generator, they approve the prompts
they like; approved prompts persist to the asset/shot.

**C. Write callback prompts.** Video/still prompts reference the approved assets by handle.
Reuse the existing `promptcompile.js` machinery: `weaveReferences` (Higgsfield @-tag
declaration pattern) and `videoRefMode()` (array vs start/end-frame per model). The approved
character/location assets are the reference set woven into the callbacks.

**D. Export a document.** At the end, export a PDF (not markdown) like the ones produced by
hand on MilkPEP — character descriptions + reference-sheet prompts + location prompts +
per-shot breakdown. PDF is the required format (Sofia asked for PDF three times).

## Build on what exists

- **`store.js` v2 "agency spine"** already models `clients → projects → deliverables → typed
  assets → versions → people`. Typed assets = characters, locations, props. Only the store
  layer exists; **no UI reads the new objects yet** — this phase is where UI starts consuming
  them. See `docs/superpowers/specs/2026-07-15-agency-spine-slice1-store-design.md`. Keep
  `listReferences` back-compat shims working. Extend `tests/store-v2.test.cjs`.
- **`references.html`** is the asset prompt maker/manager — the natural home to extend for
  character/location recipes.
- Don't break the still-to-video path in `promptbuilder.html`.

## Slice it

This is too big for one diff. Suggested slices (use the `production-quality-review` skill for
spec-first planning per slice):
1. Character reference-sheet recipe → generate + approve + persist as a typed asset.
2. Location recipe → same.
3. Callback prompts weaving approved assets (extend `weaveReferences` usage).
4. Document (PDF) export of the assembled project.

## Definition of done

- A user can run a references-first project **end to end inside the app** — generate character
  sheets, generate locations, then video/still prompts that call back to those assets — with
  **zero trips to Claude**.
- Reference prompts meet the standard: **real, never fake, never too gritty**; turnaround +
  hero close-up, no expression strip; lived-in unbranded locations.
- Export produces a PDF matching the hand-made MilkPEP deliverables.
- Still-to-video path unchanged. `npm test` green.

## Out of scope

- Project-creation setup that feeds this (the locked descriptions) → Phase 4.
