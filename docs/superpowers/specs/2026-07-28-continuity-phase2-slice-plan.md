# Continuity Phase 2 — per-shot continuity fields

**Date:** 2026-07-28 · **Status:** implementing · **Phases 0–1:** done (see below)

## Why

Stills are generated one at a time from one shot's fields. The image model never sees the
other shots, so anything not restated in *this* shot's fields is gone: characters who left
the crop, which way the subject is facing, whether the bag is open, what's already packed.
Observed failures: a character present in the master vanished from the coverage; the
weekender's contents regressed between shots.

Phase 0 (doctrine, `newproject.html`) told the planner to pre-bake this into `subject` and
`environment` as prose. That works but conflates three different facts in one field, so it
can't be reviewed, corrected, or checked. Phase 2 gives the two facts that actually broke
their own fields.

## Scope

Two new per-shot text fields. Not a nested schema, not a ledger object — plain strings, same
shape as the four existing descriptive fields.

| Field | Holds | Fixes |
|---|---|---|
| `offCamera` | who is outside the crop and where, plus how the subject is oriented / where they're looking | 2.1 |
| `propState` | what each prop is doing right now — open, closed, packed, worn, held, which hand | 2.7 |

Deliberately **not** in scope: eyeline/screen-direction as its own field (it belongs with
`offCamera`), blocking maps, the Continuity tab, validation warnings. Those are Phase 3.

## How they reach the prompt

`compilePrompt()` already appends the `negative` field as a prose tail *after* the scene is
assembled ([promptbuilder.html:583](../../../src/promptbuilder.html)). Continuity rides the
same way — appended, never woven into the clause-join. The scene assembly is untouched.

Order follows the brief's §4.6 layering: scene → references → **off-camera continuity → prop
state** → negative constraints.

```
… wide shot of {subject}, {action} — {environment}, … {realism baseline}.
 Off camera: {offCamera}. Continuity: {propState}. Avoid: {negative}.
```

Applied to both stills and video, like `negative` — prop state during a move matters as much
as at the frozen instant.

## Files

1. **`src/store.js`** — `defaultBuilder()` gains both fields; `SHOT_FIELDS` gains both (so the
   project view can edit them); plan importer copies them.
2. **`src/promptbuilder.html`** — two textareas after Location; `builderKeys()` gains both
   (without this they never persist); the compile tail; one rail checklist row.
3. **`src/newproject.html`** — template emits both keys; the `CONTINUITY IS RESTATED` rule
   points at the fields instead of asking for prose in `subject`.
4. **`tests/store-v2.test.cjs`** — passthrough + a drift guard that `builderKeys()` and
   `SHOT_FIELDS` both know the new fields.

## Definition of done

- `npm test` green, with new assertions that fail when reverted (mutation-checked).
- A plan JSON carrying `offCamera` / `propState` imports with both fields populated.
- Both fields editable in the builder and persisted across a reload.
- The compiled still ends with the continuity tail before `Avoid:`.
- Nothing in the scene clause-join changed.

## What comes next

Phase 3 (A–E) is broken into one-session steps, each with the model to use, in
[`docs/CONTINUITY-PHASE3-CHECKLIST.md`](../../CONTINUITY-PHASE3-CHECKLIST.md).

## Not verified by this slice

Whether the planner actually fills the fields well, and whether the tail improves generated
images. That needs a real plan run plus generations — the standing next step after Phases 0–2.
