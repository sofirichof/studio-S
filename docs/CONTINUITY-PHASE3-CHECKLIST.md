# Continuity Phase 3 — build checklist

**Written 2026-07-28.** One step per fresh session. Switch to the model in the **Model** column,
paste the starter prompt, tick the box when `npm test` is green.

| # | Step | Model | Why that model |
|---|---|---|---|
| A | `purpose` as a real field | **Sonnet 5** | Mechanical; pattern already set by Phase 1/2 |
| B1 | Structural validator (pure JS, no UI) | **Sonnet 5** | Rules are already written out below |
| B2 | Semantic-check contract | — | **DEFERRED** — not time to wire a live model call yet |
| B3 | Wire `anthropic_messages` + semantic pass | — | **DEFERRED** — see below |
| C | Surface warnings in the project view | **Sonnet 5** | Markup + wiring, no new schema |
| D1 | Continuity tab — schema + layout design | **Opus 5** | New surface; a wrong structure gets expensive |
| D2 | Build the Continuity tab | **Sonnet 5** | Implementation against D1's design |
| E | Blocking maps | **Opus 5** for design | Blocked on a decision from you first — see below |

Biggest cost saver isn't the model, it's context: **`/clear` between steps.** Each starter
prompt below is self-contained.

---

## Already done — do not redo

- **Phase 0** (doctrine): the plan-request prompt in `src/newproject.html`
  (`buildClaudeInstructions`) carries the shot-purpose vocabulary, the establishing rule,
  one-frozen-instant, coverage balance, continuity-is-restated, and per-shot camera choice.
- **Phase 1** (camera controls): `SHOT_CONTROLS` + `applyShotControls()` in `src/store.js` let a
  plan set `shot / lens / angle / depth / move / comp / density / framing` per shot;
  off-vocabulary values are dropped. `shotLabelShort` in `promptbuilder.html` no longer compiles
  `wide` as "wide establishing shot".
- **Phase 2** (continuity fields): `offCamera` + `propState` per shot — store, plan import,
  builder textareas, project-view rows, and a compile tail.
- **Phase 3 step A** (`purpose` as a real field, 2026-07-28): `SHOT_PURPOSES` vocabulary +
  `Store.shotPurposes()` in `store.js`; `defaultBuilder()` gains `purpose: ''`; plan import
  validates `sh.purpose`, falling back to parsing `Purpose: x.` off `breakdown`; single-select
  chips in the builder (step 1, above Subject description); `builderKeys()` gains `purpose`;
  read-only badge on the shot card in `projects.html`; plan template + doctrine in
  `newproject.html` updated, breakdown convention kept as a documented fallback.
- **Phase 3 step B1** (structural validator, 2026-07-28): new `src/continuity.js`,
  `Continuity.checkScene(scene, characterNames)` — pure, no UI, no Store dependency at runtime
  (keeps its own copy of the vocabulary; see gotcha below). All 7 rules from this file implemented
  as 10 distinct rule tags. Not wired into any page yet — that's step C.
- **Handoff overhaul** (2026-07-28, after step B1): field ownership split, `cameraIntent`
  repurposed as a pre-choice justification, `comp`/`density`/`framing`/`negative` added, script/
  no-script restructured, per-control reasoning, four setup questions, and the reverse-engineered
  reference sheets shipped in `src/reftemplates.js` for both the handoff and the References wizard.
  Full write-up: `docs/HANDOFF-2026-07-28-handoff-overhaul.md`. This is where the current field
  definitions live — read it before touching `buildClaudeInstructions`.
- Tests: **210 + 104 + 14 green** (now 230 + 104 + 14 + 286 after the overhaul) (`tests/continuity.test.cjs` added to the `npm test` chain in
  `package.json`). Nothing shipped; working tree, version 0.3.95.
- Slice plan for Phase 2: `docs/superpowers/specs/2026-07-28-continuity-phase2-slice-plan.md`

## Gotchas from steps A / B1 (read before continuing)

- **Purpose is chip vocabulary, not a `SHOT_FIELDS` free-text entry.** It's persisted through
  `builderKeys()`/`persistBuilder()` like `SHOT_CONTROLS` (shot/lens/angle/…), not through
  `updateShotFields`. The project view shows it as a read-only badge next to the shot label, not
  an editable textarea. If a later step wants it editable from the project view too, that's a
  new decision, not an oversight.
- **`continuity.js` duplicates `SHOT_PURPOSES` instead of calling `Store.shotPurposes()`.**
  Deliberate — keeps the validator standalone/testable without a loaded `Store`. A drift-guard
  test in `tests/continuity.test.cjs` fails if the two lists disagree; if that duplication ever
  feels wrong, that's the test to check first.
- **I initially under-verified and reported "done" anyway** (caught via `/deglaze`, not before
  reporting): mutation-checked only 3 of `continuity.js`'s 10 rule branches while writing it up as
  fully checked, and declared the HTML edits (`promptbuilder.html`/`projects.html`/
  `newproject.html`) done without running the Node-based syntax check
  ([[studio-s-preview-tcc-block]] memory) this repo substitutes for browser preview. Both were
  fixed retroactively (all 10 rules now mutation-checked; all three files confirmed to parse via
  `new Function()` over the extracted `<script type="text/x-dc">` block). Lesson for future
  steps: do the full mutation pass and the syntax check *before* declaring a step done, not after
  being asked.
- **Live browser/UI verification of the chips and badge is still NOT done.** The
  `afs-node` preview workaround in `.claude/launch.json` is currently broken (the Browser tool's
  preview subprocess resolves scratchpad paths under a different session hash than Bash, so a
  freshly-written server script still 404s/`MODULE_NOT_FOUND`s). Per the user, this is expected —
  she's testing the whole thing in the real app once all of Phase 3 is done, not per step. Don't
  push for a live check mid-phase; `npm test` green + full mutation-check is the per-step bar.

## Facts every session needs (so it doesn't re-derive them)

- **The clause-join is off limits.** `compilePrompt()` in `promptbuilder.html` builds the still
  from `subject`, `action`, `environment` + the camera controls. `offCamera`, `propState` and
  `negative` are appended as a prose **tail after** the assembly. Add prompt layers to the tail,
  never to the join.
- `cameraIntent`, `breakdown` and `notes` are human-facing only — they never reach a prompt.
- `builderKeys()` in `promptbuilder.html` is the persistence whitelist. A field missing from it
  renders, accepts typing, and is silently discarded on save.
- `mapScenes` in `store.js` silently drops plan keys it doesn't know.
- Convention for new fields: whitelist in `store.js` → `builderKeys()` → UI control →
  project-view row → **a drift-guard test** that fails if the two sides disagree.
- `npm test` is the only signal. Mutation-check new guards (break the thing on purpose, confirm
  the test fails) — one guard here passed for the wrong reason on its first run.
- Shot-purpose vocabulary (14, exact strings): establishing, master, two-shot, group, single,
  reaction, insert, product detail, cutaway, location texture, match action, transition,
  final wide, hero product.
- **The app makes no runtime AI calls yet, and adding one isn't a phase-step decision.**
  `anthropic_messages` in `src-tauri/src/lib.rs` is a Claude API proxy inherited from the 3.5
  baseline (2026-07-14); nothing in the frontend calls it. Studio S composes prompts, the human
  runs them elsewhere. Wiring it up is on the roadmap but deliberately not yet — if a task's
  design needs a live model call, stop and confirm with the user rather than designing it, even
  when a handoff doc schedules it. The key collected in `aisetup.html` currently only flips
  `settings.configured` (`store.js`); it is never spent.
- Don't ship. No `npm run ship`, no version bump, unless asked.

---

## A — `purpose` as a real field · Sonnet 5

Today purpose rides as prose at the head of `breakdown` ("Purpose: master. …"), so it can't be
validated or filtered — the dry-run checker had to regex it back out of a sentence.

- [x] `SHOT_PURPOSES` vocabulary + `Store.shotPurposes()` in `store.js`
- [x] `defaultBuilder()` gains `purpose: ''`
- [x] Plan import validates `sh.purpose`; falls back to parsing `Purpose: x.` from `breakdown`
- [x] Single-select chips in the builder (`schips`, same as Movement)
- [x] `builderKeys()` gains `purpose`
- [x] Project view shows it on the shot card
- [x] Plan template emits `"purpose"`; the doctrine points at the field, keeping the breakdown
      convention as fallback
- [x] Tests: imports, junk rejected, breakdown fallback parses, template/store agree

> **Starter prompt:** Read `docs/CONTINUITY-PHASE3-CHECKLIST.md`, then do step A exactly as
> listed. Follow the Phase 2 pattern already in `store.js` / `promptbuilder.html`. Don't touch
> `compilePrompt`'s clause-join. Finish with `npm test` green and mutation-check any new guard.

## B1 — Structural validator · Sonnet 5

Pure functions over a scene's shots, no UI. These are the checks that worked first time in the
dry run:

- [x] Every shot has `offCamera` and `propState`
- [x] Every shot has a `purpose`, and it's in the vocabulary
- [x] `establishing` appears at most once per scene, and only on its first shot
- [x] Camera setups are not all identical (flag if fewer than half are distinct)
- [x] At least one non-action purpose per scene (insert / reaction / detail / texture)
- [x] `action` doesn't read as a sequence — flag `then`, `after which`, `and then`
- [x] Every named character in the concept's descriptions is either in `subject` or accounted
      for in `offCamera`
- [x] Returns a list of `{shotLabel, rule, message, severity}` — no rendering
- [x] Tests, including a deliberately broken scene that must trip every rule

> **Starter prompt:** Read `docs/CONTINUITY-PHASE3-CHECKLIST.md`, then do step B1. Pure
> validation functions in `src/store.js` (or a new `src/continuity.js` if cleaner) — no UI, no
> prompt changes. Tests must include a scene that trips every rule.

## B2 / B3 — semantic check over the Claude API · **DEFERRED 2026-07-28**

**Not now — not cancelled.** These two steps would wire `anthropic_messages` into the frontend
so a scene could be sent to Claude for the judgment-call checks (prop regression, eyeline
compatibility, drift from the locked descriptions). Worth doing eventually; it's just not the
right time to add a live model connection to the app.

Scheduling them inside Phase 3 was a handoff error — they're a bigger decision than a phase step,
and they'd be the first runtime AI call the app has ever made. Pulled out of the running order
rather than dropped from the roadmap. The B2 spec drafted on 2026-07-28 was deleted; if this comes
back, the contract gets re-derived then (it wasn't validated against a real scene anyway).

**Phase 3 continues without them:** continuity validation is B1's ten structural rules, surfaced
by step C. Until B2/B3 are picked up, the judgment-call checks happen the way planning does —
by hand in Claude Desktop.

**Before restarting these:** confirm with the user that it's time, first.

## C — Surface the warnings · Sonnet 5

- [ ] Per-shot markers on the shot card in `projects.html`
- [ ] Per-scene summary count
- [ ] Dismissible / acknowledged state per finding
- [ ] Nothing blocks generation — warnings only

## D1 — Continuity tab design · Opus 5

The brief's §3 sections (character / camera / prop / location / editorial state). Decide what
becomes schema, what's derived from existing fields, and what stays out.

- [ ] Schema decisions, written up as a spec
- [ ] Explicitly: does the tab become the source of truth prompts compile from, or a review
      surface over the existing shot fields? (Review surface is the lower-risk answer.)

## D2 — Build it · Sonnet 5

## E — Blocking maps · blocked on you

Per your own 2.11, a room photo can't yield geometry. **One decision needed before any work:**

- [ ] User draws the plan in-app?
- [ ] User types measurements?
- [ ] Schematic only, permanently labelled "schematic, not to scale"?

Until that's answered this step can't start — it's missing an input, not effort.

---

## Standing next steps, independent of the above

- [ ] **Real plan run.** Point a project at a folder with a script, let Claude Desktop write
      `studio-s-plan.json`, import it. The only test of whether an independent planner obeys the
      doctrine. Everything so far is verified as correct code, not as better prompts.
- [ ] **Generate stills** from a hands insert, a top-down product detail, and a low
      three-quarter — whether the `Off camera:` / `Continuity:` tail helps GPT Image is unproven.
      Log them in Gen Log.
