# Phase 4 — Scene/shot list system, breakdown view, locked prompts, pruned models, handoff

Date: 2026-07-24 (expanded from the original handoff-only scope)
Status: IMPLEMENTED 2026-07-24 — slices 1-5 on `main` (9696ca8, 1e01e5c, c1b8a37, a27610b).
Browser-verified, `npm test` green, reviewed. **Not shipped** — no release cut.
Baseline: `15f357f` (v0.3.92) on `main` — Phase 1 (`941ea7c`) + Phase 2 (`e8b8043`) +
v0.3.91 (`be988b4`) + the v0.3.92 Higgsfield motion tail (`4adc4a0`) are all in.

## Locked principle

The app IS the prompt generator. **Claude never writes generation prompts.** Claude runs
**once, at project creation**, and its only job is to set the project up enough that the app can
generate the prompts. Setup = scenes, labelled shots, descriptive fields, breakdown, todo list,
and locked descriptions. **Never generation prompts.**

## Scope correction

The original version of this spec covered only the handoff. That was the tail, not the body. The
handoff is a small supporting piece of a larger app change: the app needs an editable, synced
scene/shot list, a breakdown/asset view, per-shot locked prompts, and a pruned model list
*first*. The handoff then feeds that system. Build order is 1 → 5 below; the handoff is last.

## Constraints that bound every slice

- **Additive and sliced.** Each slice implements, verifies, and commits independently.
- **Do not touch `compilePrompt` / `compileVideo` composition** — Phase 2 owns prompt
  composition. Slices here read its output; they never change how it composes.
- **`store.js` is the single source of truth.** `projects.html` and `promptbuilder.html` mutate
  the *same* shot objects through `Store`. No second data model, no divergent copies, no local
  caches that can drift.
- **Don't break the still-to-video path.**
- Not shipped. No `npm run ship`, no release, no publish.

---

## Slice 1 — Prune the model list (config only, smallest, do first)

`stillProfiles()` / `videoProfiles()` in `promptbuilder.html` stay **hardcoded** (not loaded from
data). Reduce them to the locked set:

- **Stills:** GPT Image (ChatGPT), Nano Banana Pro, Seedream 4.5
- **Video:** Kling 3.0, Cinema Studio, Seedance

Remove Sora, Runway Gen-4, FLUX.2, Midjourney v7 **everywhere** they surface:

| File | What |
| --- | --- |
| `promptbuilder.html` | `stillProfiles()` (L~648-653: `flux`, `mj`), `videoProfiles()` (L~665-670: `runway`, `sora`), and the two chip lists at L~1035-1036 — chips are matched to profiles **by label** (L~851-853), so both must move together |
| `multishot.html` | `modelName` map (L~107) |
| `aisetup.html` | `#video-model` `<select>` options (L~92) |
| `newproject.html` | `generatorGuide()` entries for `runway` / `sora` (removed wholesale in Slice 5) |

### The Higgsfield rename — label only, and why

**Verified, and it contradicts the brief:** the two-axis spec
(`2026-07-17-model-surface-two-axis.md`) is **not implemented**. There is no `surface` field
anywhere in `src/`. "Higgsfield" is currently a *video model id*, and three separate pieces of
logic key off that exact string:

- `usesAtTags()` — `promptbuilder.html:482` tests `this.state.videoModel === 'higgsfield'`
- `videoRefMode()` — `promptcompile.js:217` has a `higgsfield: { refs: 'array' }` entry
- the v0.3.92 motion-realism tail — `promptcompile.js:337`, keyed `higgsfield`

Renaming the **id** would therefore silently break @-handle tags, the reference-array mode, and
the motion tail — and would orphan `videoModel: 'higgsfield'` on every already-saved shot,
requiring a data migration this phase does not want.

**Decision: rename the user-facing `label` only** (`'Higgsfield'` → `'Cinema Studio'`), plus the
help copy that says "Higgsfield" at `promptbuilder.html:1036` / `:1067`. Keep `id: 'higgsfield'`
as the de-facto surface key. This is the only way to satisfy "keep the Higgsfield surface and
@-tag / reference-array logic intact" without a migration. Internal code comments may keep
saying `higgsfield` — that is the surface, and it is correct.

Actually introducing the `surface` axis stays **out of scope** (its own future slice).

**Verification:** exactly 3 still + 3 video models render; `usesAtTags()` still returns true for
Cinema Studio and the @-handles still appear in the compiled prompt; `grep -rE
"Sora|Runway|FLUX|Midjourney"` over `src/` (excluding `vendor/`) returns nothing user-facing.

---

## Slice 2 — Scene/shot list: editable and synced (the core change)

### Structure correction

`concepts` **are scenes** and get real scene names. Shots are labelled `1A / 1B / 1C / 2A` via
the existing `shotLabel(conceptIndex, shotIndex)` (`store.js:314`). Kill flat "Shot 1 / 2 / 3"
naming — it survives in `addShot()` (`store.js:327`) and `scaffoldFromPlan()` (`store.js:747`)
defaults.

### Store additions (`store.js`)

Existing: `addConcept`, `addShot`, `renameShot`, `updateShotBuilder`, `shotLabel`.
Add, all going through `load()` / `save()` and all re-deriving labels afterwards:

- `renameConcept(projectId, conceptId, name)`
- `removeConcept(projectId, conceptId)`
- `removeShot(projectId, conceptId, shotId)`
- `reorderConcept(projectId, conceptId, toIndex)`
- `reorderShot(projectId, conceptId, shotId, toIndex)`
- `updateShotFields(ids, patch)` — the descriptive fields: `subject`, `action`,
  `environment`, `cameraIntent`. Stored as **data**, model-agnostic, never composed text.
- `relabelProject(projectId)` — internal helper: walk concepts × shots and reassign
  `label = shotLabel(ci, si)`. Called after every add / remove / reorder so labels never go
  stale. Must be idempotent, matching the existing backfill at `store.js:144-150`.

Removing the active concept/shot must clear or move `doc.ui.activeConceptId` /
`activeShotId` rather than leaving a dangling pointer.

### UI, in **both** surfaces

`projects.html` (project overview, `renderOverview` ~L266-410) and `promptbuilder.html` get:
add / remove / rename / reorder for scenes and shots, and editing of the four descriptive
fields. Every mutation calls `Store`, then re-renders from `Store`.

**Sync verification (the actual acceptance test):** edit a shot name or a descriptive field in
the builder, navigate to the project view, and see the change — and the reverse. Because both
read through `Store` on render and `Store` reads `localStorage` on every `load()`, this holds as
long as neither surface keeps its own copy. The builder's `state` is the risk: it seeds from the
active shot (`seedFromActive`) and must write through on change, not at some later save step.

---

## Slice 3 — Locked prompts persist per shot and show on the project page

When a prompt is generated/locked in the builder, persist it **onto that shot**:

```js
shot.locked = { prompt: '…', video: '…', stillModel: 'gpt', videoModel: 'higgsfield', at: <ts> }
```

- Add a lock affordance in the builder's Review step (lock / unlock, showing locked state).
- Store: `lockShotPrompt(ids, payload)` / `unlockShotPrompt(ids)`.
- `projects.html` shows each shot's locked prompt (collapsed by default — a wall of prose is the
  bug Phase 4 was opened to fix; label stays the scannable thing) so the user can see the
  prompts they have created.
- Locking **does not** re-compose anything. It snapshots what `compilePrompt` /
  `compileVideo` already produced.

---

## Slice 4 — Breakdown / asset view (asset management only)

A per-shot view mapping each shot → the assets it needs, using the **existing** v2 typed-asset
and attached-asset plumbing (`charRefIds`, `propRefIds`, `locRefId`, `styleRefId` in the shot
builder state; `listAssets` / typed assets in `store.js`).

Each row: shot label + name, the characters / locations / props it calls for, and each one marked
**attached** or **MISSING** — so the user knows what to create before generating.

Out of scope here: generating those assets. This is the view, not the generator.

---

## Slice 5 — Handoff (supporting, small, last)

### App side (code)

`scaffoldFromPlan()` (`store.js:~715`) maps the imported plan into the Slice 2 model: scenes with
real names, shots with honored-or-derived labels, and the four descriptive fields carried through
as data. It already honors `plan.todos` and well-formed labels (`store.js:743-744`) — extend it
to read `subject` / `action` / `environment` / `cameraIntent`, plus the breakdown and locked
descriptions, and to stop defaulting names to `'Shot N'`.

### Template side (text)

Rewrite the Claude instruction in `newproject.html` (`buildClaudeInstructions`, and delete
`generatorGuide()` at L115-138 entirely) so Claude emits **setup only**:

1. **Scenes** with real names.
2. **Shots** with short, label-led names — `"1A · Man enters the bodega"` — **not prompts**.
3. **Descriptive fields** (`subject`, `action`, `environment`, `cameraIntent`) as data.
4. **Breakdown** per shot.
5. **Todo list** — what the user must produce.
6. **Locked descriptions** — character / prop / location facts (the consistency bible).

Remove all per-generator prompt-writing craft (L115-138) and every cut model. Human-facing docs
export as **PDF, not markdown** (Sofia asked three times). Update the `studio-s-plan.json` schema
only as far as the new fields require.

---

## Out of scope (deferred to Phase 3)

- Reference-sheet / location **generation** recipes
- The references-first generation loop
- PDF export of the breakdown from inside the app
- Introducing the real `surface` axis from the two-axis spec

## Definition of done

- Only the locked model set appears anywhere; `Higgsfield` reads as `Cinema Studio` with @-tag
  and ref-mode surface logic intact; grep finds no cut-model references.
- Scenes plus shots labelled `1A / 1B / …`; add / remove / rename / reorder all work; project
  view ⇄ builder stay in sync through `Store` (verified by editing in one and seeing it in the
  other).
- Locked prompts persist per shot and appear on the project page.
- Breakdown view lists each shot's required assets and flags what is missing.
- Handoff imports cleanly into the new scene/shot model; Claude authors zero generation prompts.
- Still-to-video path unchanged. `npm test` green. Browser-verified with screenshots of the
  project view and builder in sync. Committed per slice. **Not shipped.**
