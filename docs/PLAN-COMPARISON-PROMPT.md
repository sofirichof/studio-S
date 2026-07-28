# Plan-comparison prompt

A different experiment from the beta test. The beta test asks *"is the app usable?"*. This asks
*"do the handoff instructions carry the work, or are they leaning on the model being clever?"*

## The rule that makes it valid

**Only the model changes.** Same brief, same setup answers, same instruction text, byte for byte.
If you regenerate the instructions with different dropdown answers between runs, the comparison
measures nothing.

## Setup — do this once

After the beta-test run (or any time you generate instructions in the app), save two files:

- `/tmp/plan-compare/brief.md` — the client brief, verbatim
- `/tmp/plan-compare/instructions.txt` — the **exact** text out of the app's textarea, unedited

Then run the prompt below in a fresh session per model. Keep the outputs apart:

- `/tmp/plan-compare/plan-sonnet.json`
- `/tmp/plan-compare/plan-opus.json`

Nothing else in the session. No repo, no context, no explanation of what Studio S is — the
instructions are supposed to be self-sufficient, and whether they are is half of what's being
measured.

---

You are being given a set of production-planning instructions and a client brief. Follow the
instructions exactly as written and produce what they ask for.

- The brief is at `/tmp/plan-compare/brief.md`.
- The instructions are at `/tmp/plan-compare/instructions.txt`.
- Treat `/tmp/plan-compare/` as the assets folder the instructions refer to, wherever they mention
  a folder path.
- Write your output to `/tmp/plan-compare/plan-<model>.json`, replacing `<model>` with the model
  you are (`sonnet` or `opus`).

Do not ask clarifying questions — a real user pastes this and walks away, so answer them the way
the instructions tell you to, or make the call yourself and move on. Do not look for other context;
what you have been given is all a real planning agent would get.

When you are finished, add one short note at the end of your reply — not in the JSON — listing:

1. Any field where you were unsure what was wanted, and what you did about it.
2. Anything the instructions asked for that you could not do.
3. Anything you found contradictory.

That note is as valuable as the plan.

---

## What gets compared

Run both plans through the same checks — ask a session with repo access to do it:

| Check | What a gap means |
|---|---|
| Import cleanly via `scaffoldFromPlan`? | Structural compliance |
| `Continuity.checkScene` trips per scene | How much the doctrine actually landed |
| Field ownership — off-camera content in `subject`? sequences in `action`? | Whether the ownership block works |
| `comp`/`density`/`framing`/`negative` populated or ignored | Whether new fields get used or skipped |
| `cameraIntent` — real reasoning, or restating the choice? | Whether the justification gate does anything |
| Purpose spread, and `establishing` used once | Brief issues 2.3 / 2.4 |
| Reference sheets — template filled verbatim, or paraphrased? | Whether "use it verbatim" holds |
| Shot count vs the coverage answer | Whether setup answers are obeyed |

**Reading the result:**

- **Plans similar** → the instructions carry the work. That's the outcome you want.
- **Opus much better** → the instructions rely on model judgment. Each gap names something to make
  explicit.
- **Both bad in the same way** → an instruction problem, not a model problem. Fastest thing to fix.
- **Both good** → stop tuning the handoff and go test something else.
