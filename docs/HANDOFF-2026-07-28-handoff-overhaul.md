# Handoff overhaul — 2026-07-28

Everything in this session is in the **handoff**: what the pasted instructions ask a planning
agent for, and what the app does with the answer. No shot-prompt compiler changes; `compilePrompt`
and `compileVideo` are untouched.

Version 0.3.95, working tree. **Nothing shipped, nothing run against a real agent yet.**

---

## Why

Auditing the app against the original continuity brief (`96da47c0` session, 2026-07-28) showed
roughly half the brief addressed — the handoff-doctrine half — with the app-side half quietly
downgraded. Three specific problems drove the work:

1. **Field definitions overlapped.** `subject` was defined as "who is in frame AND who is just off
   it, with orientation and eyeline"; `offCamera` as "who is just outside this frame … and how the
   subject is oriented toward them". Near-duplicates, with `subject` also carrying posture that
   reads as `action`. Three fields competing for one sentence.
2. **The vocabulary had no reasoning attached.** The agent got 14 purposes and eight camera controls
   as bare enums, with nothing about what any value *does*. It filled fields to fill them.
3. **The no-script path had no craft.** Every doctrine bullet lived under `IF THERE IS A SCRIPT`.
   A project where the agent invents the concept — the common case — got two lines of direction.

## What changed

### Field ownership
`subject` = bodies and objects **in** frame. `action` = the frozen instant, including posture,
weight, hands, gaze. `offCamera` = **sole owner** of everyone outside the crop. New
`FIELD OWNERSHIP — ONE FACT, ONE FIELD` block with a disambiguation test: *if the sentence would be
true of the next shot too, it's subject or environment; if only at this instant, action or
propState; if it concerns someone you can't see, offCamera.*

### Fields added, removed, repurposed
- **Added to the handoff:** `comp`, `density`, `framing`, `negative`. All four already compiled;
  no plan could set them. `negative` also needed an importer fix — it existed in `defaultBuilder`
  but `mapScenes` never read it, so asking for it would have been a silent no-op.
- **`cameraIntent` repurposed** as a justification field, ordered **before** the camera controls:
  what the shot is for, what the camera therefore needs, and what would be lost shooting it the
  default way. Never compiled, and the instructions say so — it is a thinking gate, not a
  deliverable. Ordering is load-bearing and tested: after the controls, it rationalises choices
  already made.
- **`propState`** is now BEFORE / DURING / AFTER, with this shot's *after* as the next shot's
  *before*.

### Doctrine
- `STEP 2A — GET A SCRIPT UNDER IT` / `STEP 2B — DIRECT IT`. No script means **write one first**;
  all seven craft bullets then apply to both paths.
- New geometry-honesty bullet: state only what references show, mark proposals `(inferred)`, never
  assert dimensions or unseen boundaries from one photo. (Brief issue 2.11.)
- New `WHAT EACH CONTROL ACTUALLY DOES` — per-control consequence and when to reach for it
  (*shallow isolates but destroys geography; if the shot's job is spatial, don't choose it*).

### Setup questions
Four dropdowns above the instructions textarea, rewriting the text live: **script depth**
(decide / have one / write full / write beats / skip), **coverage** (tight / standard / full),
**reference sheets** (none / some / all made), **kind of job** (narrative / commercial / doc /
social). Answers also appear near the top of the instructions as *"THE USER ANSWERED THESE AT
SETUP — they override your own read of the folder."*

Not persisted — the panel only exists during project creation.

Dropped: **location provenance** (the geometry bullet now covers both cases unconditionally) and
**delivery format** (undecided).

### Reference sheets
`src/reftemplates.js` — the reverse-engineered character / prop-product / location templates from
`docs/research/copy-paste-templates.md`, as **one source with two renderings**:
- `forHandoff(kind)` → `{{TOKEN}}` becomes `[BRACKET: hint]`, inlined into the pasted instructions.
- `fill(kind, values)` → `{{TOKEN}}` becomes the References wizard's answers.

So a reference built by hand and one built from a plan come out identical. `PromptCompile.fieldsFor`
and `compileReferencePrompt` delegate to it; `references.html` gained `select` support for the
location A/B variant. The old one-liner (`Character reference — Marco: a person, neutral
background…`) survives only as a fallback if `reftemplates.js` fails to load.

**This is the one exception to "Claude never authors prompts"**, and the rule is now scoped rather
than broken: `DO NOT WRITE GENERATION PROMPTS FOR SHOTS`, then `THE ONE EXCEPTION IS REFERENCE
SHEETS`, with the reason stated (the shot-prompt builder was never built to compose them).
`scaffoldFromPlan` accepts `d.prompt` instead of hard-setting `''`.

## Tests

**634 green** (230 store-v2 · 104 promptcompile · 14 continuity · 286 handoff-fields).

New `tests/handoff-fields.test.cjs` guards the bug class that kept recurring — *asked for but
never read*, and *reads fine but nothing can set it*:

- every field the template asks for survives import **and** is read by the compile path
- `cameraIntent` precedes the controls it justifies
- non-compiled fields are in `builderKeys` (else a UI save drops them)
- every `<select>` option has a matching directive (else it silently no-ops)
- every `{{TOKEN}}` has a wizard field, and every field reaches a token
- the shipped templates and the research doc share six anchor strings

`store-v2`'s template/store drift test was extended to `comp`, `density`, `framing`.

Every new guard was mutation-checked. One mutation initially passed when it should have failed
(the field was moved earlier, not later) and was redone.

## Not done

- **No live run.** Nothing here has been rendered in the app or pasted to a real agent. The four
  dropdowns have never been seen on screen. Per the user, testing happens once the phases are done.
- **The real plan run** remains the only test of whether any of this produces better plans. It is
  still the top standing item.
- Setup answers aren't persisted; delivery-format question unresolved.
- B2/B3 (semantic continuity check over the API) remain **deferred, not cancelled** — see
  `docs/CONTINUITY-PHASE3-CHECKLIST.md`.
