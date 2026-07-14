# Studio S — Hypothetical-user audit · 2026-07-14

Method: fresh state (cleared localStorage), full first-time-user journey in a browser against the current `src/` (post handoff-prep fixes): onboarding → project creation → prompt builder → Multi-Shot → References → Palmier → Finishing → Workflow guide → AI setup. Native-only paths (real folder pick, Claude API proxy, updater) are not exercisable in a browser and were not judged.

## 🔴 High — both FIXED 2026-07-14

1. **Configured users re-enter onboarding on every launch.** ✅ FIXED. Root cause: `componentDidMount` rendered the welcome splash unconditionally; the `isConfigured()` fast-path only fired *after* clicking "Get started" (and only when a Claude key was present). Now `componentDidMount` redirects configured users straight to `projects.html` before any splash renders. First-run (unconfigured) users still see the welcome video. Verified: seeded configured user → index.html lands on projects.html, no splash; cleared state → welcome video still shows.
2. **"New project" re-runs Basics for configured users.** ✅ FIXED. `?new=1` now starts at the Plan step (step 2) for already-configured users instead of Basics (step 1), so the API key / video model aren't re-asked. The saved video model is seeded into wizard state so `finishSetup()`'s `saveBasics()` can't clobber it back to the `kling` default, and `goBack` is floored at the Plan step so the skipped Basics step isn't reachable backward. Verified: `?new=1` opens on "Setup · Plan", creates the named project, sets it active, and preserves a non-default (`seedance`) model. (The "typed twice" note was an artifact of a dead, never-shown modal in projects.html — the real flow only asks for the name once, in the wizard.)

## 🟡 Medium

3. **First-run wizard silently discards the project name.** ✅ FIXED. `finishSetup()` now creates + activates a project whenever a name was typed (or a folder scanned) in first-run too, not just the `?new=1` quiz. Verified: onboarding with a name but no key and no folder now lands with the named project active (was "No project yet").
4. **No-key Continue gives no feedback but is accepted.** ✅ FIXED (copy). The Basics key field now states it's optional and that Claude planning/refinement stay unavailable until a key is added in AI setup. (Empty-key Continue is intentionally allowed; the AI-setup page already shows "Not connected" honestly.)
5. **Finishing page shows fake progress.** ✅ FIXED (de-faked). Removed "9 of 14 done", the "9 done / 5 remaining" badges, and the line-through "Completed" list; the handoff checklist is now a neutral reference template labeled "Reference — not tracked". Pipeline-progress badges changed from "Done" to "Upstream", and the fabricated "Due Fri 4 Jul" countdown was removed (delivery specs relabeled a template).
6. **BUG-09 reproduced (stale sidebar).** ✅ MITIGATED (A+B), browser-verified; one live-desktop check still advised. Two changes, neither touching nav.js's fragile repopulate/observer core: **(A)** every page's sidebar `<select>` no longer hardcodes "US Bank — Rotation 4" / "Nike — Air Max 2026" / "Super Bowl LXI" — it's a single neutral `<option>No project yet</option>`, so a DC-runtime revert can never show a fake client name. **(B)** the select is authored `visibility:hidden` and nav.js reveals it only after populating (`initProjectSelect` + inserted-select CSS), so the placeholder never flashes before the real project loads. Verified: at a simulated revert the placeholder is present but hidden (never seen); after the observer fires the select shows the real project and is revealed. Still worth a glance in the built Tauri app since the flash is a runtime-timing artifact, but the misleading content and the visible flash are both gone.

## 🟢 Low

7. **Palmier page hardcoded environment details.** ✅ FIXED. "Claude 4 Sonnet" → "Claude Opus 4.8", "Pro · macOS 26" → "Detected on connect", and its status dot de-emphasised to match the honest not-connected state. (Also fixed the same-class staleness in `aisetup.html`'s model dropdown: now Opus 4.8 / Sonnet 5 / Haiku 4.5, Opus recommended.)
8. **Marketing claim on the Done step.** ✅ FIXED. Unsubstantiated "2× faster vs manual workflow" replaced with a factual "One place · brief → handoff".

## ✅ Verified working as a user

- Full prompt-builder walk: subject → environment → look (generic preset labels + trait banner) → camera → output → review; compiled prompt is real and matches inputs; "Generate stills" → "Prompt copied ✓"; Save draft persists (shot status `prompted`).
- Multi-Shot lists the saved shot with correct look label and status; global style prefix present.
- Project switching via sidebar (nav.js) works once populated; created project propagates to every page.
- Palmier page: project snapshot correct, "Copy handoff JSON" → "Copied ✓", connection honestly shown as not connected.
- References: renders (post-revert), honest empty state. Workflow guide and AI setup render clean; key never displayed.
- Zero console errors on every page except the (now fixed) references crash.

## Regression fixed during this audit

`references.html` white-screened (React `removeChild` crash) due to the same-day BUG-08 port that imperatively rewrote the sidebar select inside DC/React-managed DOM. Reverted — nav.js (`initProjectSelect`) already owns that select on every page. Guidance added to the handoff doc: never mutate the sidebar select at page level.
