# Design — Prompt dictionary (v1)

Date: 2026-07-17
Status: designed, awaiting review. Blocked on the model/surface restructure (see Ordering).

## The idea

Studio S should let a creative think in the vocabulary they already use — "24mm wide",
"Deakins", "moody", "she looks sad" — and silently emit what the generator actually responds
to. The user's words in; AI-legible words out. No new screen: the same builder controls, with
a translation layer behind them.

This is not new to the app. `dpTraits()` (`src/promptbuilder.html` ~L427) already does it: the
id is `deakins`, the label is "Naturalistic classic", and only the *note* — "motivated
naturalistic light, single soft key, deep restrained shadows" — reaches the prompt. The DP's
name never leaves the app. That is the pattern, and it matters because the Seedance doctrine's
final rule is **"No director names, no signature-work references, no equipment names"** — they
get ignored or break complex moves.

The next line is the open question. `compilePrompt()` does `parts.push(', ' + s.lens + 'mm')`,
emitting "24mm". The installed Seedance skill is explicit: **"In the prompt text use FOV in
degrees from the table below, not millimeters"**, and ships an anchor table (24mm → 84°,
85mm → 29°, 135mm → 18°).

**But this is contested, not settled** — see Contested doctrine below. The dictionary's job is
to make the choice explicit, versioned and testable in one place, rather than hardcoded inline
in a string concat. That is the value even before we know which side is right.

## Why now (and why the clicker can't carry v1)

Sofia's requirement: accuracy grounded in **our own data** (Gen Log, "the clicker"), not
platform marketing. That instinct is well-founded — on 2026-07-17, three widely-repeated blog
claims about the model landscape proved false when checked against the Higgsfield MCP catalog
(`models_explore`); see the Grounding section of `2026-07-17-model-surface-two-axis.md`.

Measured 2026-07-17, `~/Library/Application Support/GenLog/entries.jsonl` holds:

- **84 generations** across **13 distinct shotIds** (= 13 distinct prompts)
- 3 models: ChatGPT (25), Higgsfield (45), Higgsfield/Seedance (14) — **no Kling, Veo, or
  Midjourney**
- ratings: 57 keeper / 9 mixed / 18 discard → **68% keeper rate**

This cannot ground a word-level dictionary, and more volume alone won't fix it. The 13 prompts
differ from each other in dozens of words simultaneously, so an outcome cannot be attributed to
any single choice. It is observational data being asked a causal question. Per-model overrides
are worse: zero logged generations on half the models. The 68% keeper rate is itself a warning
— either ratings are generous or discards are under-logged.

**The fix is cheap and belongs in its own spec:** add a variant tag to Gen Log and log pairs of
prompts differing in exactly one dictionary variable (`24mm` vs `84°`, otherwise byte-identical)
under the same shotId. That turns the clicker from observation into experiment. Ten controlled
pairs beat a thousand uncontrolled logs.

So v1 seeds from doctrine and records provenance honestly; v2 lets clicker evidence promote or
demote entries. v1 does not wait for data it does not have, and does not pretend a hunch is
evidence.

## Contested doctrine (checked 2026-07-17)

Primary sources disagree with each other, and Higgsfield's own blog disagrees with itself. No
entry sourced from any of them may be marked `conf: 'rule'`.

| Source | Focal length | Negative phrasing |
|---|---|---|
| Installed `higgsfield-seedance-prompt` skill | FOV degrees only, never mm | positive only, never "no X" |
| HF blog *Seedance-4k* (pub 2026-06-25, mod 2026-07-16) | hard "24mm" specs | "no franchise IP", "no warping", "no plastic CGI gloss" |
| HF blog *cinematic_headphones* (**undated**) | both mm and degrees, mixed in one prompt | "No 3D render", "No floating props", "No identity drift" |
| HF blog *Santiago-breakdown* (**undated**) | — | "avoid negative prompts with Seedance — write what you WANT" |

Consequence: `conf: 'rule'` is reserved for things that are true by construction (an enum value
the API accepts, an aspect ratio the model supports). **Everything about prompt phrasing is
`doctrine` at best** — a defensible position held by an identifiable source, not a fact.

Where sources conflict, the entry records the conflict rather than silently picking a winner:

```js
{ id: 'lens-24', out: '84° FOV', by: { mj: '24mm --style raw' },
  src: 'seedance-skill', conf: 'doctrine',
  contested: { alt: '24mm', altSrc: 'hf-blog-seedance-4k-2026-06-25' } }
```

`contested` is inert in v1 — it documents the fork and names the first A/B for the clicker. It
is not read by the compiler.

**Undated sources are excluded from the seed** (Sofia's rule: the field moves fast; if a page
won't say when it was written, it doesn't get to set our defaults).

### Sources that carry no vocabulary

`higgsfield.ai/@adilinthewild/projects/{tv-4k,top-up}` (both 2026-07-10) do **not** expose
prompt text publicly — only a concept blurb and a model-stack breakdown. Checked anonymously;
a logged-in view may differ. Useful signal from them anyway: Adil Alimzhanov's stacks are
Seedance 2.0 51.1% / Soul Cinematic 35.7% (tv-4k) and Seedance 2.0 80.4% / Soul Cinematic
16.8% (top-up) — no Kling, Veo or Runway in either, and Seedream **4.5** in use, not 5.0.

## Data

New file `src/dictionary.js`. Follows `promptcompile.js` exactly: IIFE, single `window.Dict`
global, pure functions, no dependencies, node-testable.

```js
{
  id:  'lens-24',
  category: 'optics',              // optics | shotsize | look | motion | atmosphere | performance
  label: '24mm wide',              // what the user clicks — creative language
  out: '84° FOV',                  // universal translation — what the model reads
  by:  { mj: '24mm --style raw' }, // per-model overrides, sparse
  src: 'seedance-skill',           // seedance-skill | vendor-doc | team | clicker
  conf: 'rule',                    // rule | doctrine | team | hunch
  evidence: null                   // v2 only: clicker A/B results
}
```

Decided: **universal core + sparse per-model overrides.** One entry per concept carrying the
craft translation that works nearly everywhere; an override only where a model provably differs.
A missing override degrades to `out` rather than throwing — the property that keeps the table
small and safe.

### API

```
Dict.get(id)                 // entry or null
Dict.translate(id, model)    // by[model] ?? out ?? ''   — never throws
Dict.list(category)          // entries, for populating controls
```

### Seed (~40 entries)

| Category | Count | Source | conf |
|---|---|---|---|
| `optics` — FOV anchor table (180°/107°/84°/63°/47°/29°/18°/12°/8°) | 9 | seedance-skill | doctrine — **contested**, alt `24mm` |
| `shotsize` — ECU/CU/MCU/MS/WS/EWS | 6 | seedance-skill | doctrine |
| `look` — the 10 existing dpTraits notes, migrated verbatim | 10 | team | team |
| `motion` — static/push/pan/tracking/handheld → motivated + km/h | 5 | seedance-skill | doctrine |
| `atmosphere` — fog/haze → density % + depth in metres | ~4 | seedance-skill | doctrine |
| `performance` — sad/angry/tense → muscle movement | ~6 | seedance-skill | doctrine |

No seed entry is `conf: 'rule'`. Every one of them is one source's position, and at least one
(optics) has a credible source arguing the opposite.

Only FOV steps from the anchor table are valid (no "23°" — 18° or 29°).

## Integration

`compilePrompt()` in `src/promptbuilder.html` stops formatting values inline and asks the
dictionary instead:

```js
// before
if (has(s.lens)) parts.push(', ' + s.lens + 'mm');
// after — the stills prompt translates against stillModel
if (has(s.lens)) parts.push(', ' + Dict.translate('lens-' + s.lens, s.stillModel));
```

**Which model id is passed:** the stills prompt translates against `s.stillModel`; the video
prompt against `s.videoModel`. `compilePrompt()` builds both, so it passes the relevant id per
stage rather than one ambient `model`. This matters — Midjourney is a stills-only model, so its
`--style raw` override must never reach a video prompt.

`dpTraits()` keeps working during migration — its notes move into the dictionary as `look`
entries and `dpTraits()` becomes a thin `Dict.list('look')` shim. No behaviour change; the DP
notes are already doctrine-compliant.

`promptcompile.js` needs **no change**. It is already surface- and vocabulary-agnostic.

## Ordering

Per-model overrides key off model ids, and the model/surface restructure renames them
(`kling` → `kling3`, adds `veo31`, retires `sora`). Sequence:

1. step-5 chip wiring (in flight, separate worktree)
2. model/surface two-axis restructure (`2026-07-17-model-surface-two-axis.md`)
3. **dictionary v1** (this spec)
4. video-prompt rewrite — consumes the dictionary; the biggest payoff, since that prompt
   currently ignores subject, lens, look and references entirely

## Out of scope

- Any new UI. Decided explicitly: the builder looks the same; the prompts get correct.
- The Gen Log variant/A-B change — own spec, different repo.
- The clicker evidence pipeline. The `evidence` field reserves room; nothing reads it in v1.
- The video-prompt rewrite.
- Translating free-text (a "paste your brief" box). v1 translates *control values*, not prose.

## Definition of done

- Clicking "24mm wide" compiles whatever the `lens-24` entry says, from one place — so the
  mm-vs-degrees question becomes a one-line data change, not a code change.
- Midjourney still receives `24mm --style raw` via override.
- Every entry carries `src` and `conf`; no entry claims evidence it lacks; no seed entry is
  marked `rule`.
- `Dict.translate` on an unknown id returns `''` and does not throw.
- Existing DP looks compile byte-identically to today (pure migration, no drift).
- `npm test` passes, including the new dictionary tests.
- Verified in the browser at ~1512px via the node preview server (python http.server cannot
  read ~/Documents — macOS TCC).

## Testing

`tests/dictionary.test.cjs`, alongside `tests/store-v2.test.cjs`:

- every entry has `id`, `category`, `label`, `out`, `src`, `conf`
- ids are unique; `category` and `conf` are from the allowed sets
- `translate` returns the override when present, `out` when absent, `''` when unknown
- FOV `out` values are only the nine anchor-table steps
- any entry carrying `contested` names both an `alt` and an `altSrc`
- **no test asserts that millimetres are wrong.** An earlier draft of this spec proposed a
  regression guard forbidding mm in optics entries. That would have frozen a contested opinion
  into a passing test — the worst place to hide an assumption. The mm-vs-degrees question is
  settled by the clicker, not by assertion.
- the 10 migrated `look` notes match the current `dpTraits()` notes exactly
