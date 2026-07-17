# Spec — Prompt builder: split model from surface

Date: 2026-07-17
Status: ready to implement (blocked on the step-5 chip-wiring session landing first)

## Problem

`promptbuilder.html` presents one model axis: Kling 3.0 / Seedance / Runway Gen-4 / Sora, with
Higgsfield bolted on as a fifth peer. That is a category error. Higgsfield is not a model — it
is a platform that *runs* Kling, Seedance, Veo, Wan, Grok and Hailuo, alongside its own
Cinema Studio / Soul / Marketing Studio models. "Kling vs Higgsfield" is malformed; you run
Kling *through* Higgsfield.

Three concrete symptoms:

1. **@ asset tags are keyed to the wrong axis.** `usesAtTags()` tests
   `videoModel === 'higgsfield'`. @handles are a Higgsfield *platform* feature (Soul IDs, saved
   elements) — not a Kling-vs-Veo prompt dialect. "Kling run on Higgsfield with @tags" is a real
   combination that the current model cannot express.
2. **Sora is offered but dead.** Web/app discontinued 2026-04-26; API dies 2026-09-24. It is
   absent from the Higgsfield catalog entirely.
3. **Veo 3.1 is missing**, despite being on-platform and one of the strongest current options.

## Grounding

Model facts below come from the Higgsfield MCP catalog (`models_explore action:list`), queried
2026-07-17 — not from secondary reporting. Several widely-repeated blog claims were **wrong** and
must not be reintroduced:

- There is **no "Higgsfield DoP" model.** The cinematography product is **Cinema Studio**
  (`cinematic_studio_3_0` video, `cinematic_studio_2_5` image).
- There is **no Seedance 2.5.** Real: `seedance_2_0`, `seedance_2_0_mini`, `seedance1_5`.
- **Seedream 4.5 is still live** (`seedream_v4_5`) alongside `seedream_v5_pro`. Not stale.
- **Runway and Midjourney are absent from Higgsfield** → native-only surfaces.

Re-verify against `models_explore` before changing any model list; do not trust this file's
version numbers after ~Q4 2026.

## Design

### Two axes

- **surface** (new): where the prompt gets run — `higgsfield` | `native` | `palmier`
- **stillModel` / `videoModel`** (existing): which model generates

Surface is the primary selector. Choosing a surface **filters** the model list to what that
surface actually runs; impossible states are unreachable by construction.

### Profile shape

Each entry in `stillProfiles()` / `videoProfiles()` gains:

```js
{ id, label, tag, prompt, rule,
  surfaces: ['higgsfield','native','palmier'],   // where it runs
  retired: true }                                // optional; see migration
```

### Video models

| id | label | surfaces |
|---|---|---|
| `kling3` | Kling 3.0 | higgsfield, native, palmier |
| `seedance2` | Seedance 2.0 | higgsfield, native, palmier |
| `veo31` | Veo 3.1 | higgsfield, native |
| `wan27` | Wan 2.7 | higgsfield, native |
| `runway45` | Runway Gen-4.5 | native |
| `hf_cinema` | Cinema Studio 3.0 | higgsfield |
| `sora` | Sora | *(retired — see migration)* |

### Still models

| id | label | surfaces |
|---|---|---|
| `gpt2` | GPT Image 2 | higgsfield, native |
| `nano_pro` | Nano Banana Pro | higgsfield, native, palmier |
| `seedream5` | Seedream 5.0 Pro | higgsfield, native |
| `flux2` | FLUX.2 | higgsfield, native |
| `mj` | Midjourney | native |
| `soul2` | Higgsfield Soul 2.0 | higgsfield |
| `hf_cinema_img` | Cinema Studio Image 2.5 | higgsfield |

Palmier's native set (Kling, Seedance, Nano Banana Pro) is taken from existing in-app copy —
**confirm with Sofia before shipping**, it is the least-verified row here.

### @ asset tags

`usesAtTags()` re-keys from model to surface:

```js
usesAtTags() { return this.state.surface === 'higgsfield' && this.state.atTags !== false; }
```

The toggle moves from the Higgsfield *model tab* to the surface area of Review & generate, and
shows whenever surface is `higgsfield` regardless of model. `weaveReferences(compiled, refs,
{atTags})` in `promptcompile.js` is already surface-agnostic and needs **no change**.

### Sora migration (decided: leave stored value, badge as retired)

Do **not** silently remap. On load, a shot storing `videoModel: 'sora'`:

- keeps `'sora'` in the store — no write-behind, no changed creative decision
- renders in Review as a greyed tab badged **Retired** with: "Sora was discontinued
  2026-04-26; the API ends 2026-09-24. Pick a replacement — Veo 3.1 is the closest match."
- is excluded from the normal model list for any *new* selection
- compiles no prompt until the user picks a live model

Implement via `retired: true` on the profile plus a filter: show a retired profile only if
`state.videoModel === profile.id`.

### Default surface (decided: per-user preference, not hardcoded)

Only part of the team uses Higgsfield, so it must not be baked in. Add `defaultSurface` to
settings, picker in `aisetup.html` beside the existing default-video-model select. New shots
seed `surface` from `settings.defaultSurface`, mirroring the existing `defaultVideoModel`
fast-path in `seedFromActive()` (`promptbuilder.html` ~L458).

Ship the setting defaulting to `higgsfield` — it is the house pipeline — overridable once per
user in AI Setup.

## Files

- `src/promptbuilder.html` — `stillProfiles()`, `videoProfiles()`, `usesAtTags()`,
  `builderKeys()` (+`surface`), `seedFromActive()`, review-step render + `bindReviewTabs()`,
  step-5 chips
- `src/aisetup.html` — default-surface picker; persist via existing patch pattern (~L207)
- `src/store.js` — `defaultBuilder()` gains `surface`
- `src/promptcompile.js` — **no change**

## Out of scope

- Rewriting the video prompt template (`'Animate the still: ' + moveTxt + ...`). Tracked
  separately; it is the larger win and deserves its own pass.
- Wiring step-5 chips to builder state — owned by the concurrent session; this spec builds on
  top of whatever it lands.
- Soul ID training flow, Marketing Studio, per-model parameters (resolution/duration/genre).
- Direct generation. Studio S compiles prompts; generation stays downstream by hand.

## Definition of done

- No dead models offered: Sora unreachable for new selections; existing Sora shots badged, not
  rewritten.
- Every surface × model combination shown is one that actually exists per `models_explore`.
- @ tags follow surface, not model. Kling + Higgsfield + @tags reachable and correct.
- Surface persists per shot; new shots inherit `settings.defaultSurface`.
- Switching surface never leaves an invalid model selected (falling back to that surface's
  first model is acceptable, silently dropping the user's choice is not — badge it).
- Empty/edge: shot with no surface stored, unknown model id, surface with zero eligible models.
- Verified in the browser at ~1512px via the node preview server (python http.server cannot
  read ~/Documents — macOS TCC), not just by reading the diff.
- `npm test` passes.

## Verification target

Load `promptbuilder.html`, seed a shot with references, then confirm:

1. Surface `higgsfield` → model tabs show Kling/Seedance/Veo/Wan/Cinema Studio; no Runway, no
   Midjourney, no Sora.
2. Surface `native` → Runway and Midjourney appear; Cinema Studio and Soul disappear.
3. @ toggle visible on any Higgsfield model; absent on `native`; @handles appear in the compiled
   stills prompt for Kling + Higgsfield.
4. A shot with `videoModel:'sora'` shows the retired badge and does not silently become Veo.
