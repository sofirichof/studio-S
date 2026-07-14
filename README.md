# Studio S

Native macOS desktop app (Tauri v2) for Supergood — organizes the AI image→video production pipeline: brief → reference assets → stills → image-to-video → music/SFX → edit (Palmier) → finishing. It does **not** generate images or video in-app (firm product decision); the only API key is for Claude (Anthropic), used for planning and prompt refinement.

**Start here → [`docs/HANDOFF-2026-07-09.md`](docs/HANDOFF-2026-07-09.md)** — the full engineering onboarding doc (architecture, product rules, known debt, version history). Read its Status Update banner first: the "us" restructure is shelved; current `src/` is the restored v3.5 lineage.

## Quick start

```bash
npm install
npm run dev          # tauri dev
npm run tauri build  # release build
npm run ship         # build + install to ~/Applications + installer DMG to Desktop — releases only
```

Requires Rust (cargo on PATH) and Node. No bundler: each `.html` in `src/` is a standalone page; shared logic in `store.js` (localStorage persistence), `nav.js`, `support.js`, `updater.js`. `src-tauri/` is a thin shell (~110 lines of Rust: Anthropic proxy, plan-file scanner, Claude-app launcher).

## Layout

- `src/` — the app (pages + shared JS/CSS, uploaded assets in `src/uploads/`)
- `src-tauri/` — Tauri v2 shell and config
- `docs/` — handoff doc, design brief, reviews, specs
- `_archive/` — dated historical snapshots. Two matter: `AI_Film_Studio_2026-06-15_2327.html` (contains the lost deterministic `generatePrompts()` engine — see handoff §7.1) and `us-restructure-3.56-wip-2026-07-09/` (the shelved restructure, reference only)
- `CLAUDE.md` — working rules for Claude Code sessions in this repo

## Hard rules

1. No in-app image/video generation — ever.
2. Prompt compiler stays offline/deterministic; Claude never writes final prompts at runtime.
3. Never ship/publish a release without an explicit go from Sofia (sofia@gosupergood.com).

## Not included in this handoff package

The Tauri updater **private signing key** (`src-tauri/.tauri-updater.key`) stays with Sofia — request it through her if you need to cut an auto-updating release. Also excluded: `node_modules/` (run `npm install`), `src-tauri/target/`, old `release-v*` bundles, and the heavyweight `_archive/` items (old-name folder copy, old Chrome-wrapper .app, uploads snapshot).
