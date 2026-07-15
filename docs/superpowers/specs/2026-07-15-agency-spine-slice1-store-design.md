# Agency spine · Slice 1 — Data-model spine (store v2)

*Design spec · 2026-07-15. First slice of the "us"/agency-utility repositioning (parent plan: `docs/us-repositioning-plan.md`). Standing decisions & history: memory `studio-s-us-repositioning`.*

## Context

Studio S is being taken from a single-purpose prompt tool toward a cross-team creative-production manager. The direction was designed, built once (2026-07-09), graded **D on real use, and shelved.** On 2026-07-15 the shelving was lifted with a grounded reason: the D-grade's 18 defects (4 fatal) are enumerated in `_archive/us-restructure-3.56-wip-2026-07-09/README.md` and are **all implementation/copy/usability bugs** (hardcoded "commuters" demo in the review card, clipboard not wired, stray commas, fake durations, hardcoded sidebar) — **none is a schema/architecture defect.** So the v2 data model itself was never the problem, and most of those UI fixes have since been ported into the live 3.5 `src/` (see `docs/HANDOFF-2026-07-09.md`) or re-covered in the 2026-07-15 session (onboarding rebuild, Palmier-as-handoff, neutral sidebar, shot labels, References asset wizard).

**Build base (decided):** evolve the current, browser-verified 3.5 `src/store.js` (`VERSION = 1`) forward into the v2 schema. The archived `_archive/.../src/store.js` (a complete, working v2 store) is a **design reference for object shapes and the CRUD surface only** — its code does not re-enter `src/`.

This slice is the **store spine only. No UI is built or changed in Slice 1.** Later slices (Work dashboard, Project hub, Brands & Assets, Finish, generation-as-action, governance, export) build on top.

## Non-negotiable principle: additive and non-breaking

The D-grade blew up because a restructure shipped over the working app. Slice 1 must not repeat that. Therefore:

- Slice 1 **adds** the new objects and migrates references into them. It does **not remove** `concepts`, `shots`, or any field the current pages read, and it does **not touch any `.html` page.**
- After Slice 1, every existing page (`home`, `projects`, `references`, `promptbuilder`, `multishot`, `newproject`, `palmier`, …) renders and behaves exactly as it does today. The only observable difference is new capacity underneath.
- `references.html`'s wizard keeps working unchanged, via back-compat shims (below).

## Schema (v2)

`_default()` grows from today's `{settings, projects, references, ui}` to:

```
{
  version: 2,
  settings: {                 // PRESERVE all current 3.5 fields — do not reset to the archive's thinner set
    configured, onboarded, claudeApiKey, defaultOutputFolder,
    defaultVideoModel, defaultModel, defaultStillsModel
  },
  clients:      [],           // NEW — governance root
  projects:     [],           // EXTENDED (keeps concepts/shots/todos/stylePrefix)
  deliverables: [],           // NEW — starts empty
  assets:       [],           // NEW — typed; absorbs references[]
  versions:     [],           // NEW — starts empty
  people:       [],           // NEW — starts empty
  ui: { activeProjectId, activeConceptId, activeShotId, activeClientId, activeDeliverableId }
}
```

**Client** — `{ id, name, brand, createdAt, updatedAt }`, where `brand = { styleLook, palette:[], logo, mandatories, legal, personas:[{name,note}], phrasingRules:[], whitelists:[ {name,values} | string ] }` (shape lifted from the archive's `defaultBrand`).

**Project** (extends current) — keeps `{ id, name, assetsFolder, outputFolder, createdAt, updatedAt, todos:[], concepts:[…shots with label], stylePrefix }`; **gains** `{ clientId, status:'active', brief:'', timeline:{start,end}, team:[] }`.

**Deliverable** — `{ id, projectId, name, specs:{ratio,runtime,platform,legal}, status:'not-started', currentVersionId:'', attachedAssetIds:[], createdAt, updatedAt }`.

**Asset** (typed) — `{ id, type:'reference'|'generated'|'cut', clientId, projectId, deliverableId, name, note, createdAt, updatedAt }` plus per-type fields:
- reference: `{ kind, fields:{}, prompt, imagePath }` — **carried forward from this session's References wizard** (not the archive's thinner `refs:[]`).
- generated: `{ recipe:{model,prompt,cost}, builder, status }`.
- cut: `{ url, frameioUrl, round }`.

**Version** — `{ id, deliverableId, round, reviewer, status:'needs-review'|'changes'|'approved', frameioUrl, note, isCurrent, assetId, createdAt }`.

**Person** — `{ id, name, role }`.

## Migration v1 → v2 (`migrate(doc)`, run in `load()`)

Idempotent (guarded on `doc.version >= 2`), non-destructive.

1. Ensure the five new arrays exist (default `[]`); preserve all existing settings fields.
2. Create one **"Unassigned"** client if any client-less projects exist; set their `clientId` (reassignable later). Real client brands (US Bank, etc.) come from the Seed slice, not migration.
3. Add project fields where missing: `status:'active'`, `brief:''`, `timeline:{start:'',end:''}`, `team:[]`. Leave `concepts`/`shots`/`todos`/`stylePrefix` untouched.
4. Fold `references[]` → `assets[]` as `type:'reference'`, **carrying `kind/fields/prompt/imagePath`** and resolving `clientId` from the reference's project. Then `delete doc.references`.
5. Set `doc.version = 2`.

**Deliberate divergence from the archived migration:** the archive projected every `concept → deliverable` and every `shot → generated asset`. Slice 1 does **not**. Reasons: (a) a shot is a prompt recipe, not a generated asset — nothing was generated, so `type:'generated'` would be a lie the dashboard then counts as progress; (b) it dual-writes (concepts/shots preserved *and* projected), which drifts; (c) the "app should demo as populated" need is the Seed slice's job (a real US Bank workspace), not a transform of the user's actual data. Deliverables start empty and are created explicitly in the Project-hub slice.

## Store API added

Thin CRUD on the existing `load → mutate → save` pattern, shapes mirrored from the archived store:

- **Clients:** `listClients`, `getClient`, `createClient`, `updateClient`, `updateBrand(id, brandPatch)`, `deleteClient` (nulls `clientId` on affected projects/assets — no cascade delete of projects).
- **Projects:** extend `createProject(opts)` to accept `clientId`; `updateProject` already exists; add nothing that breaks current callers (all new fields optional).
- **Deliverables:** `listDeliverables(projectId)`, `getDeliverable`, `createDeliverable`, `updateDeliverable`, `deleteDeliverable` (cascade its assets + versions).
- **Assets (typed):** `listAssets(filter)`, `getAsset`, `createAsset`, `updateAsset`, `deleteAsset`.
- **Versions:** `listVersions(deliverableId)`, `createVersion`, `updateVersion`, `deleteVersion`, `registerCut(deliverableId, opts)` (drop link → cut asset + version, sets current).
- **People:** `listPeople`, `getPerson`, `createPerson`, `updatePerson`, `deletePerson` (unlinks from project teams).
- **Reads for later slices:** `getProjectBrand(id)` (live client-brand resolution — never snapshotted, so brand edits propagate), `getWork(opts)` (dashboard aggregation: active projects with deliverable/blocked/in-review counts + in-review/blocked/needs-me lists).

## Back-compat (keeps the app working)

`listReferences / addReference / updateReference / deleteReference / getReference` are **retained as shims over `assets[]`** filtered to `type:'reference'`, preserving today's `{id, projectId, name, kind, note, fields, prompt, imagePath, createdAt}` shape on read/write. `references.html` (this session's wizard + image-attach) therefore needs **zero changes**. `getStylePrefix/setStylePrefix`, `addConcept/addShot/renameShot/updateShotBuilder`, `listTodos/toggleTodo`, `getActive/setActive`, `shotLabel` all stay as-is.

## Explicitly NOT in Slice 1 (scope guard)

No UI. No Work dashboard. No deliverable/version/asset *screens*. No seed data. No export. No generation-as-action. No shot `done` status or `project.handoff` (those belonged to the now-superseded simple-3.5 dashboard; under the spine, progress is measured at deliverable/version level). No multi-user anything.

## Verification (the lesson that was skipped)

1. **Node unit tests** (`scratchpad/`): schema shape; migration is idempotent (double-run doesn't duplicate the Unassigned client or re-fold references); migration is non-destructive (v1 `projects/concepts/shots` intact, reference `fields/prompt/imagePath` carried); each new CRUD fn round-trips; `getProjectBrand` reads live; `getWork` returns the expected counts on a seeded graph.
2. **`node --check src/store.js`** clean.
3. **Drive the real app in the browser** — the step skipped before D-grade. Migrate a *populated* store (create a project + concepts/shots + a couple of References-wizard assets on 3.5, then load the v2 store) and confirm **every existing page still renders with zero console errors** and the References wizard still round-trips (add / edit / attach image / delete). Screenshot Home + References as proof.

## Done means

`src/store.js` is v2: new objects + non-destructive idempotent migration + full CRUD + `getProjectBrand`/`getWork` + reference shims; Node tests pass; `node --check` clean; the live app is browser-verified unchanged on a migrated populated store; committed. No page markup changed.
