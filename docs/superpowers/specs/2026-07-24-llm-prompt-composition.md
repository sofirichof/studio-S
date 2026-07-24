# REJECTED — Prompt composition: template → LLM writer

Date: 2026-07-24
Status: **rejected / superseded** (do not implement)

## Why this is rejected

This spec proposed handing the builder's structured choices to Claude (via the
`anthropic_messages` proxy) to *write* the generation prompts at runtime. That is
**antithetical to the app's purpose** and must not be built.

Locked principle, decided by Sofia:

> **The app IS the prompt generator — that is its main function. Claude NEVER writes
> prompts.** Claude's only role is project-creation setup (breakdown, shot list, todo
> list, descriptions), enough that the app can then generate the prompts itself,
> deterministically. Needing to go to Claude to make a prompt is the failure this work exists to remove.

## What replaces it

Four phase docs, in dependency order:

1. `2026-07-24-phase1-generator-responsiveness.md`
2. `2026-07-24-phase2-generator-quality-and-layout.md`
3. `2026-07-24-phase3-references-first-workflow.md`
4. `2026-07-24-phase4-project-creation-handoff.md`

The one salvageable idea (already reflected in the phase docs): the good reference-sheet
and location prompts produced in the 2026-07-23 session are the **seed templates** for the
app's deterministic recipe library — but they are encoded as app-owned rules, not produced
by a model at runtime.
