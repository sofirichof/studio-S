# Studio S — Working Instructions

Read automatically at the start of every Claude Code session in this repo. Kept short on
purpose: Anthropic's own guidance is that a bloated CLAUDE.md causes Claude to ignore half of
it, and only things that apply to *every* session belong here. Workflow-specific stuff lives in
the `production-quality-review` skill instead — see the bottom of this file.

## Repo map

No bundler — pages are authored directly as standalone HTML/CSS/JS in `src/` (`npm run sync` is
a no-op placeholder). Each `.html` file in `src/` is a page: `index.html` (first-run
onboarding only; configured users redirect to Home), `home.html` (landing dashboard),
`newproject.html` (project creation / Claude plan import), `palmier.html`, `promptbuilder.html`,
`finishing.html`, `multishot.html`, `projects.html`, `references.html` (asset prompt
maker/manager), `workflow.html`, `aisetup.html`. Shared logic: `store.js`,
`nav.js`, `support.js`, `updater.js`, `promptcompile.js`, `styles.css`. `assets/` and `vendor/` hold static files.

**Several of these files are large** — `promptbuilder.html` (~80KB), `index.html` (~46KB),
`support.js` (~58KB), `finishing.html`/`projects.html`/`palmier.html` (~26-32KB each). Reading
one of these whole is a meaningful chunk of a session's budget on its own — this is a likely
contributor to past token spikes. Grep for the relevant section before reading; don't Read the
whole file for a change that touches one function or one block of markup.

`src-tauri/` is a genuinely thin shell: `src/lib.rs` is ~110 lines with three `#[tauri::command]`
functions (an Anthropic API proxy that keeps the key server-side, a plan-file scanner, and a
"launch Claude desktop app" helper). `src/main.rs` just calls into it. Almost all app logic
lives in `src/`, not here — don't reach for Rust changes unless the task is actually about one
of these three commands or Tauri config.

Build/run commands (from `package.json`): `npm run dev` (tauri dev), `npm run tauri build`
(release build), `npm run ship` (full build + copy to `~/Applications` + installer to Desktop —
only run this when actually cutting a release, not to verify a change compiles).

`src-tauri/target/` is 1.8GB. It's already gitignored, but nothing stops a search tool from
walking into it if a Glob/Grep isn't scoped — see below.

## Model

Default to Sonnet. Only switch to Opus for genuine architectural decisions or multi-step
reasoning — not for routine edits, lookups, or small fixes. Opus costs more per token and most
of what eats a 5-hour window is volume of tokens, not task difficulty.

## Scope before you touch anything

If you could describe the diff in one sentence — fix a typo, add a log line, rename a
variable, change a prop — just do it. Don't enter plan mode or spawn a subagent for this.

If the change touches multiple files, is in an unfamiliar part of the codebase, or you're not
sure of the approach: explore first (read only what's relevant), write a short plan, then
implement. Planning up front is cheaper than redoing an implementation that solved the wrong
problem.

## Search and read scope

Never search or read inside `node_modules/`, `target/` (Rust build output — can be gigabytes),
`dist/`, `build/`, or `.next/`. Scope Glob/Grep to `src/` or `src-tauri/src/` explicitly rather
than searching the repo root — an unscoped search in a Tauri repo will walk into `target/` and
burn tens of thousands of tokens on compiled artifacts.

For files over a couple hundred lines, Grep for the relevant section first, then Read with a
narrow offset/limit — don't read the whole file unless you need the whole file.

## Subagents

Use a subagent to investigate something open-ended in an unfamiliar area ("how does auth
handle token refresh across this codebase"). Don't use one for a lookup you could do yourself
with a single Grep or Read — spawning a subagent re-derives context from scratch and costs more
than doing the lookup directly.

## Verify before calling it done

Give yourself something that produces a pass/fail signal, then use it: run the build, run the
relevant tests (not the whole suite unless needed), or check a screenshot against the design.
For Rust changes, `cargo check` gives the same compile signal as `cargo build` with far less
output — reach for it first, save `cargo build` for when you actually need the binary.

Pipe verbose commands through something that caps output instead of dumping it all, e.g.
`cargo check 2>&1 | tail -60`.

## Session hygiene

If you've corrected the same issue twice in one session, the context is polluted with failed
approaches — say so, and suggest starting a fresh session with a better initial prompt rather
than continuing to iterate in place.

## Bigger work

For features or refactors that are more than a one-sentence diff, use the
`production-quality-review` skill — it covers spec-first planning, a proper definition of done,
and a review pass before calling something finished.
