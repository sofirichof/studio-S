# Studio S — handoff for web hosting (for Lucas)

*2026-07-16 · app version 0.3.7 · from Sofia (sofia@gosupergood.com)*

Context: Mike wants Studio S hosted on the web so he can show it outside the agency. This doc answers the questions you raised in Slack and gives you what you need to open the source in your own Claude Code and restructure it for a web server. It's the "Claude handoff with all the context" I mentioned.

---

## Your three questions, answered

**1. Mike's feedback (no director names) — addressed.** The cinematography ("DP look") presets show generic labels in the UI — *Naturalistic classic, Available-light immersive, Noir chiaroscuro, Crisp anamorphic,* etc. — not director names. One caveat for you as the engineer: the internal preset *keys* in the code (and thus in saved localStorage) are still director surnames (`deakins`, `lubezki`, `villeneuve`…). They're opaque ids the user never sees, but if you're scrubbing everything, rename them in `promptbuilder.html` (`dpPresets()` / `dpTraits()`).

**2. Baked, or still adding?** The core is baked and usable as-is: prompt builder (6-step wizard), References (an AI asset-prompt maker + manager — the creative-facing feature I mentioned to Ben), Multi-Shot, a Home/Work dashboard, Projects, and the Palmier handoff. What you'd host today works. Separately, a larger "agency utility" repositioning is underway (a client → project → deliverable → asset/version data model): the data layer and dashboard are in, the rest (project hub, brand/asset library, review/finish) is planned but not built. **You can host the current build without waiting for that.** The plan/wishlist is in `docs/us-repositioning-plan.md`.

**3. Self-contained / external dependencies — mostly, with specifics you'll care about:**

- **No build step.** Every page is authored directly as standalone HTML/CSS/JS in `src/` (`npm run sync` is a no-op). You can serve `src/` as a static site.
- **No app backend for the core.** All state is client-side `localStorage` (one document, schema v2, with a v1→v2 migration on load). Nothing to stand up server-side to make it run.
- **Claude is copy-paste, not an in-app API call.** The "plan with Claude" flow generates an instruction block you paste into Claude.ai, then imports the resulting plan file — so there's **no server-side API key to host**. (A Rust `anthropic_messages` proxy exists in `src-tauri/` but is not wired into the current frontend.)
- **One external runtime dependency:** `support.js` loads **Babel standalone from `unpkg.com`** at runtime (the little component layer transpiles in-browser). It works fine on the web, but if you want zero external calls / offline resilience, vendor that file locally. React is already vendored in `src/vendor/`.
- **Desktop-only features that are INERT on the web** (they all degrade gracefully — the app loads and the core works; these bits just no-op or show a "desktop app only" message):
  - Local folder pick + `scan_plan_folder` (Rust) — importing a plan from a folder on disk. No web filesystem.
  - Local image attach + `convertFileSrc` thumbnails on References — no asset protocol on the web.
  - The auto-updater (`updater.js`) — no-ops outside the Tauri app by design.
  - "Launch Claude / open Palmier" link-outs and the `127.0.0.1:19789/mcp` Palmier reference — local desktop integrations.

So: the frontend is essentially a static site backed by localStorage. For the web you'll mainly decide what to do with the desktop-only file features (stub them, hide them, or replace with web equivalents like file inputs / uploads).

---

## Architecture map

- **Pages** (`src/*.html`, each self-contained): `index` (onboarding), `home` (Work dashboard — the landing page), `projects`, `promptbuilder`, `references`, `multishot`, `newproject`, `palmier`, `finishing`, `workflow`, `aisetup`.
- **Shared JS:** `store.js` (the whole data model + localStorage + v1→v2 migration + CRUD), `nav.js` (sidebar wiring, injected consistently across pages), `support.js` (the component runtime — this is what pulls Babel from unpkg), `promptcompile.js` (shared prompt/asset compiler), `updater.js` (auto-update, desktop-only).
- **Assets:** `src/vendor/` (fonts + React), `src/uploads/` (branding: logo, demo media).
- **Desktop shell:** `src-tauri/` — a thin Tauri v2 wrapper. `src/lib.rs` is ~110 lines with three commands: `anthropic_messages` (Claude proxy, unused by current frontend), `scan_plan_folder` (plan-file reader), `open_claude_app` (launch helper). You won't need most of this for the web.
- **Data:** localStorage key `aifs.v1`; schema v2 = clients → projects (→ concepts → shots) → deliverables → typed assets → versions → people. Non-destructive migration runs on load.

## To run it

- **Desktop (as-is):** `npm run dev` (Tauri) — needs Rust/cargo.
- **Web (what you want):** serve `src/` with any static file server (e.g. `npx serve src`), open `index.html`. It's a static site; localStorage persists per browser. The desktop-only features above will be inert until you stub/replace them. No env vars, no secrets, no database.

## Getting the source

Sofia will send you a clean zip of the project (or repo access to `sofirichof/studio-s`). **It excludes `node_modules/`, `src-tauri/target/`, and the Tauri updater signing key `src-tauri/.tauri-updater.key`** — that private key must never leave her machine; you don't need it for web hosting. Git history is the changelog; version notes are in `docs/`.

## Drift

Agreed with your Slack note: once you fork this for the web, Sofia's desktop copy and your web copy will diverge if both sides make changes. Suggestion: you own the web fork outright, and coordinate before either side makes structural (data-model / page-structure) changes so a later re-sync is possible.

## Pointers

- `docs/us-repositioning-plan.md` — the agency-utility plan / wishlist.
- `docs/HANDOFF-2026-07-09.md` — prior general engineering handoff (build/ship/brand notes).
- `docs/superpowers/specs/2026-07-15-agency-spine-slice1-store-design.md` — the v2 data-model spec.
- `docs/version-timeline.html` — version history.
