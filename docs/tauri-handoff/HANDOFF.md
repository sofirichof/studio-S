# Studio S → Native macOS app (Tauri) — Claude Code handoff

This folder hands off an existing single-file web app to **Claude Code** to be turned
into a real native macOS app using **Tauri**. Everything Claude Code needs is described
below. Open Claude Code **in this folder** and paste the "KICKOFF PROMPT" section.

---

## What exists today

- **The app** is a single, self-contained HTML file (all CSS/JS inline, no backend, no
  build step). Only external dependency is Google Fonts (cosmetic; degrades offline).
- **Source-of-truth file ("boss file"):**
  `/Users/sofiagonzalezirigoyen/Claude/Projects/Rotation 4 social - USB/Studio_S.html`
- The app saves state in the browser's **`localStorage`**.
- There is currently a lightweight Chrome-wrapper `.app` on the Desktop
  (`Studio S.app`). We are **replacing** that wrapper with a proper Tauri app.
  (You don't need the old wrapper; it can be retired once the Tauri app works.)
- **App icon:** `app-icon-1024.png` (in this folder) — a 1024×1024 transparent PNG of the
  Supergood "S-rosette" mark. Use it as the source for `tauri icon`.

## App identity (use these)

- Display name: **Studio S**
- Bundle identifier: **com.supergood.studios**
- Category: Productivity
- Window: ~1280×840 default, resizable, standard traffic-light controls, native title bar.

## Requirements / preferences

1. **Feel fully native** — own Dock icon while running, native menu bar, no browser
   chrome or browser right-click context menu, lives in `/Applications`.
2. **Preserve the owner's workflow.** Today she edits the boss file and relaunches to see
   changes. Please keep this easy. Two acceptable approaches — pick the cleaner one and
   explain the tradeoff to her:
   - (a) Bundle the HTML as the Tauri frontend (`frontendDist`) for a self-contained app,
     and add an npm/script command like `npm run sync` that copies the latest boss file
     into the frontend before `tauri build`. One command to ship a new version.
   - (b) Have the app load the boss file live at runtime so edits show on relaunch with no
     rebuild. Note the localStorage-origin implication and whichever is more robust.
3. **localStorage must persist** across launches (stable origin).
4. Keep it **offline-capable** (don't hard-depend on the Google Fonts CDN; fall back to
   system fonts is fine — it already does).
5. Generate the full icon set from `app-icon-1024.png` via `tauri icon`.

## Heads-up to mention to her

- Data saved in the old Chrome-wrapper app will **not** carry over to the Tauri app
  (different storage origin). If that matters, offer a small import, otherwise it starts fresh.
- First launch of an unsigned local app may need a right-click → Open once.

---

## KICKOFF PROMPT (paste this into Claude Code)

> I want to turn my existing single-file web app into a native macOS app using **Tauri**.
> Read `HANDOFF.md` in this folder first — it has all the context, the app identity, the
> path to my source HTML ("boss file"), my workflow preferences, and the app icon
> (`app-icon-1024.png`).
>
> Please:
> 1. Check my toolchain and install what's missing (Rust, Node, and the Tauri CLI).
>    Tell me each command before running anything that changes my system.
> 2. Scaffold a Tauri v2 app named "Studio S" (identifier `com.supergood.studios`)
>    that displays my HTML. Use the approach in HANDOFF.md that best preserves my
>    "edit-the-file-and-relaunch" workflow — explain the tradeoff and let me choose.
> 3. Generate the app icons from `app-icon-1024.png` using `tauri icon`.
> 4. Set the window to ~1280×840, resizable, with a native menu bar, and make sure
>    `localStorage` persists between launches.
> 5. Build the `.app`, help me move it to /Applications, and confirm it launches with my
>    S-rosette icon in the Dock.
>
> Go step by step and keep me in the loop before any install or build command.

---

## Open questions / future conversations

### OmniEdit (removed 2026-06-29)
The **OmniEdit** screen was a non-functional mockup — a design comp of a still-editing /
inpaint idea, with no research, no defined behaviour, and no integration behind it. It was
**removed** from the app (page deleted, nav item hidden centrally in `src/nav.js` via the
`REMOVED` map) because shipping a feature that pretends to work is misleading.

**This is a parked conversation, not a closed one.** If OmniEdit comes back it needs an
actual definition first: what does it do (mask-and-regenerate a region of a still? swap a
product? fix a hand?), which tool/model performs the edit (it must follow the same
"downstream, by hand" model — the app is NOT an in-app generator), and how the edited still
re-enters the shot. Have that scoping conversation before rebuilding any UI for it.
