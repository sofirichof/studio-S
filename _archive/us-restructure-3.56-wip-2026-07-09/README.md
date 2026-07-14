# Studio S — "us" restructure · 3.56 WORK IN PROGRESS

**Snapshot date:** 2026-07-09. **Status:** work in progress, NOT shipped.

This folder preserves the full `src/` of the 2026-07-09 "us repositioning" restructure —
the pivot from a personal prompt generator to a cross-team production manager
(spec: `docs/us-repositioning-plan.md`).

## Why it's here
On 2026-07-09 this restructure was accidentally published over the working app.
Per Sofia's decision, the **original 3.5** was restored as the working app
(installed to `~/Applications`, sourced from `release-v0.3.5/`), and this restructure
is kept as a labeled **3.56 work-in-progress** to continue or cherry-pick from later.

## State of this WIP (from the pipeline audit, artifact "Studio S — Pipeline Audit")
Was ~40% working UI over stubbed internals. Status of the "unsparing edition" audit's 18 defects
(all fixes made in THIS WIP src on 2026-07-09; NONE are in the installed original 3.5):

✅ FIXED (17):
- BUG-01 (fatal) — Review card shows the REAL compiled prompt via shared `compilePrompt()`, not the "commuters" demo. `promptbuilder.html`
- BUG-02 (fatal) — "Generate" actually copies to clipboard; button reads "Prompt copied ✓". `promptbuilder.html`
- BUG-03 (fatal) — onboarding pipeline relabels Palmier as a **handoff** and says editing happens there, not in-app. `index.html`
- BUG-04 (fatal) — reviewed: export copy already honest ("Export JSON" / portable-JSON tooltip); "delivered" is a legit lifecycle state. No overpromising copy left to change.
- BUG-05 — builder now honors onboarding "Default video model" (`seedFromActive` reads `getSettings().defaultVideoModel`). `promptbuilder.html`
- BUG-06 — client-less projects' logged assets no longer orphaned: library includes assets on the client's projects; log resolves clientId from project. `references.html` + `promptbuilder.html`
- BUG-07 — "Log as generated asset" shows for any shot with a prompt, not only via a deliverable. `promptbuilder.html`
- BUG-08 — References sidebar shows the REAL project selector (was hardcoded "US Bank — Rotation 4"). `references.html`
- BUG-10 — onboarding has a **Project name** field (was silently scraped from folder basename). `index.html`
- BUG-11 — folder-pick no longer silently no-ops off-desktop; shows a clear "desktop app only" message. `index.html`
- BUG-12 — leading-article fix ("of a glass bottle", not "of A glass bottle"). `promptbuilder.html`
- BUG-13 — stray " ," fixed (global replace). `promptbuilder.html`
- BUG-14 — fake "~4s" video duration removed. `promptbuilder.html`
- BUG-15 — prompt-strength meter counts more real authoring (6 checks incl. detail + style). `promptbuilder.html`
- BUG-16 — shot status unified to `prompted` (was split `ready`/`prompted`). `multishot.html`
- BUG-17 — recipe stores the model **label**, not the internal id. `promptbuilder.html`
- BUG-18 — video prompt line now HTML-escaped like the stills line. `promptbuilder.html`

⚠️ PARTIAL / needs live verification (1):
- BUG-09 — nav consistency. `nav.js` already re-normalizes on every DC re-render (MutationObserver) and BUG-08 removed the hardcoded project. The residual retired-row FLASH/REVERT under the template runtime is a timing issue against the React-like runtime — deliberately NOT blind-patched (nav is the surface whose breakage started this whole episode). Watch it in a live `npm run dev` window before touching `nav.js`/sidebar markup.

Every fix syntax-checked (`node --check` on each page's script block) + BUG-01/13/14 behavior-tested under Node. GUI not yet walked.

## Data
The v2 store migration (schema v2: clients → projects → deliverables + typed assets +
versions) is **non-destructive** — it keeps the v1 `projects`/`concepts`/`shots` intact,
which is why restoring 3.5 reads the data fine. A full data backup from this date is at
`~/Desktop/StudioS-DATA-BACKUP-2026-07-09/`.
