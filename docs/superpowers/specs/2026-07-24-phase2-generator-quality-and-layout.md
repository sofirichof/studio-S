# Phase 2 — Generator quality & layout

Date: 2026-07-24
Status: ready after Phase 1
Priority: second — makes the working generator actually good and correctly placed.

## Locked principle

The app IS the prompt generator. **Claude never writes prompts.** Everything here is
deterministic composition — better rules, not a model in the loop.

## The symptoms (Sofia's words)

> "It shows it on the right instead of at the end — it gives away the illusion of the
> building." … "The prompts aren't even good."

## Problem in the code

- The live prompt is painted by `renderRail()` into the `#pb-rail` **sidebar**. A sidebar
  reads as chrome, not as the artifact you're building.
- `compilePrompt()` composes by **gluing fixed fragments** — e.g.
  `"A wide shot of X — Y, , 24mm, <angle phrase>, <comp phrase>."` The seams show: double
  commas, comma-splices, clauses that don't grammatically join. A lookup-and-glue table
  (`DICT` + `term`) caps quality by construction.

## Work

1. **Move the prompt from the rail to the end of the flow.** The assembling prompt should
   grow as steps are completed and land as the final artifact of the build — not live in the
   sidebar. Keep an optional compact live preview if useful, but the *home* of the prompt is
   the end. (Layout move; `compilePrompt` stays the single source.)
2. **Compose at the sentence level, not the clause level.** Replace fragment-gluing with a
   small deterministic composer: build discrete grammatical clauses (subject clause, action
   clause, environment clause, camera clause, style clause), each valid on its own, then join
   with real punctuation. No empty `, ,` artifacts; no trailing-comma seams.
3. **Per-model formatting rules (deterministic).** Apply the selected model's output shape by
   rule, seeded from `stillProfiles()` / `videoProfiles()`:
   - Midjourney → append `--ar 16:9 --style raw --stylize <n>` flags.
   - GPT Image → full-sentence Image/Content/Style brief structure.
   - FLUX → concise photoreal, hold back sharpness keywords.
   - Video (Kling/Sora) → frame-anchored, camera-first (respect `videoRefMode('frame')`).
   - Video (Seedance/Higgsfield/Runway) → @-tag / reference-array phrasing
     (`videoRefMode('array')`).
4. **Optional, deterministic variation.** If output feels robotic, use a *seeded* phrase bank
   (stable per shot) so wording reads written without becoming nondeterministic.
5. **Model config as data (loader).** Stop hardcoding `stillProfiles()` / `videoProfiles()` in
   `promptbuilder.html`. Move them to data files the app loads — the schema defined in
   `docs/research/MODEL-PROFILE-TEMPLATE.md` (the JSON block per model). A research session then
   updates a profile file and the app picks it up with no code change; the per-model formatting
   rules in step 3 read from `prompt_idiom` / `reference_mode` on the loaded profile. This is the
   "make the app read the research" fix — keep it small: a loader + the existing profile fields,
   not a new schema.

## Definition of done

- The compiled prompt renders at the end of the flow and reads as written prose — no double
  commas, no dangling fragments.
- Switching model changes the prompt's *formatting/structure* (flags, brief shape), verifiably.
- Output is fully deterministic (same inputs → same prompt) and works offline.
- Model profiles load from data files (per `MODEL-PROFILE-TEMPLATE.md`), not hardcoded arrays;
  editing a profile file changes the app with no code change.
- `npm test` green, with cases asserting no `, ,` seams and correct per-model formatting.

## Out of scope

- New asset types / references-first pipeline → Phase 3.
- Handoff → Phase 4.
