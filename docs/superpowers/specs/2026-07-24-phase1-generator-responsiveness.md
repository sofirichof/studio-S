# Phase 1 — Generator responsiveness (unbreak it)

Date: 2026-07-24
Status: ready to implement
Priority: **first** — this is the "app is no longer usable" fix.

## Locked principle (applies to every phase)

The app IS the prompt generator. **Claude never writes prompts.** This phase is pure
deterministic app logic — no `anthropic_messages` proxy, no LLM calls anywhere in the
builder. See the rejected `2026-07-24-llm-prompt-composition.md` for the decision.

## The symptom (Sofia's words)

> "It used to give me a full prompt that responded to my choices and then changed based on
> model, now it doesn't. And if I go back and change something it doesn't [update]."

## What's actually true in the code (verified 2026-07-23/24)

- The uncommitted working edit (`videoRefMode` wired into `weaveReferences`) is **clean and
  correct** — it is *not* the regression. Do not revert it.
- `promptbuilder.html` → `compilePrompt()` is the single source of truth for the compiled
  prompt (stills + video). It builds the stills string from `subject`, shot label,
  `environment`, DP trait, `lens`, and the `term()` film clauses (angle, comp, depth,
  framing, density), then appends the negative as an "Avoid:" tail and weaves references.
- **`action` ("What happens in the shot") never enters the stills prompt.** `compilePrompt`
  reads subject/environment/camera but not `s.action`; action only reaches the video prompt
  via `compileVideo`. So editing that field visibly changes nothing → reads as "inert."
- **Stills don't change by model.** `promptcompile.js` `term(control, value, model)` looks
  for a per-model override but `DICT` ships **zero `perModel` entries**, so every stills
  model yields identical text. Only the `rule` guidance blurb in `stillProfiles()` changes.
- Reactivity is wired but partial: `[data-text]` fields update on `oninput → renderRail()`;
  control buttons update via `render()` (which calls `renderRail()`). Text areas re-render
  their value from state, so going back *should* repopulate — the "doesn't respond when I go
  back" report needs a live repro to pin down (candidate: the Review step / step 6 prompt not
  regenerating on re-entry, or a control that never reaches `compilePrompt`).

## Work

1. **Every authored control must reach `compilePrompt`.** Audit all ~12 builder controls;
   any the user can edit must change the compiled output. Start with `action` — decide where
   it belongs in the stills string (it is currently stills-silent) and wire it in.
2. **Stills must change by model, deterministically.** Use the existing per-model profiles
   (`stillProfiles()` / `videoProfiles()` `rule` text) as the seat of per-model difference —
   e.g. lead the compiled prompt with the selected model's framing, or apply model-specific
   formatting. Do **not** invent per-model wording in `DICT` unless it's real. (Full quality
   treatment is Phase 2; here just make model selection *change the output at all*.)
3. **Going-back edits must re-render the prompt everywhere it shows** — the rail now, the
   end-of-flow location after Phase 2, and the Review step. Confirm step 6 regenerates
   `compilePrompt()` on entry and on model-tab switch.

## Definition of done

- Editing any field (including `action`) visibly changes the prompt.
- Switching stills or video model changes the prompt text, not just a guidance blurb.
- Navigating back to an earlier step, editing, and returning shows the updated prompt.
- `npm test` green. Add a `tests/promptcompile.test.cjs` case per fixed control.

## Out of scope (later phases)

- Prompt *quality* / sentence composition and the rail→end layout move → Phase 2.
- References-first workflow and recipes → Phase 3.
- The project-creation handoff → Phase 4.
