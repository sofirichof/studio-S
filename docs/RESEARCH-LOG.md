# Research log — generative model & prompting knowledge

Append-only. Every claim we act on gets a row: where it came from, how it was checked, what
happened to it. The point is that **verified negatives are as valuable as positives** — most of
what we "knew" on 2026-07-17 turned out to be wrong, and the wrongness was only visible because
each claim was checked against a primary source.

**Source tiers** (trust in this order):
1. **T1 — ground truth**: the Higgsfield MCP catalog (`models_explore`), vendor's own help
   center / API docs, our Gen Log clicker data (when the experiment is controlled)
2. **T2 — dated primary**: vendor blog posts *with a publication date* inside Sofia's window
   (this month or last month), creator project pages
3. **T3 — rumour**: undated vendor blogs, SEO/affiliate "best model" roundups, leaderboard
   summaries. Never act on T3 without T1/T2 confirmation.

Rule of the log: **a claim from T3 that failed verification stays in the table.** Deleting dead
claims is how you end up re-believing them.

---

## Session 2026-07-17 — model landscape + prompting doctrine

### Claims checked

| # | Claim | Source (tier) | Verification | Verdict |
|---|---|---|---|---|
| 1 | Sora is discontinued (app 2026-04-26, API dies 2026-09-24) | SEO blogs (T3) | OpenAI Help Center (T1); absent from HF catalog | ✅ **TRUE** — remove from app |
| 2 | "Higgsfield DoP" is their cinematography model | SEO blogs (T3) | `models_explore` full video list (T1) | ❌ **FALSE** — no such model; it's **Cinema Studio** (`cinematic_studio_3_0` / `_2_5`) |
| 3 | "Seedance 2.5" is the hot new long-form model | SEO blog (T3) | `models_explore` (T1) | ❌ **FALSE** — real ids: `seedance_2_0`, `seedance_2_0_mini`, `seedance1_5` |
| 4 | Seedream 4.5 is stale, superseded | Claude's own inference | `models_explore` (T1); Adil's top-up stack uses 4.5 (T2) | ❌ **FALSE** — 4.5 and 5.0 Pro both live |
| 5 | Higgsfield runs 15+ third-party models (Kling, Seedance, Veo, Wan, Grok, Hailuo…) | HF marketing (T3) | `models_explore` (T1) | ✅ **TRUE** — Higgsfield is a *platform*, not a model |
| 6 | Runway & Midjourney are available on Higgsfield | assumption | `models_explore` (T1) | ❌ **FALSE** — both absent; native-only surfaces |
| 7 | Veo 3.1 is current and on-platform | blogs (T3) | `models_explore` (T1): `veo3_1`, `veo3_1_lite` | ✅ **TRUE** — missing from our app |
| 8 | Cinema Studio has camera-move presets (dolly zoom, crane…) | HF marketing (T3) | `models_explore` get (T1): params are only resolution/genre/audio; `presets_show` returns ~50 viral *scenario* templates, not camera moves | ❌ **FALSE** as stated — camera language lives in prose, which raises the dictionary's value |
| 9 | Kling v3 / Runway 4.5 / Seedance 2.0 / Veo 3.1 is "the #1 video model" | four different T3 sources | each names a different #1 | ⚠️ **UNRESOLVABLE** — per-job framing only: Seedance = references+length, Kling = volume/cost, Veo = polish+audio, Runway = multi-shot consistency |
| 10 | Seedance prompts must use FOV degrees, never mm | installed `higgsfield-seedance-prompt` skill (T2) | HF's own *Seedance-4k* blog (T2, 2026-06-25) uses hard "24mm"; *cinematic_headphones* (T3, undated) mixes both | ⚠️ **CONTESTED** — first clicker A/B |
| 11 | Seedance prompts must be positive-only, no "no X" | same skill (T2) | *Santiago-breakdown* agrees; *Seedance-4k* + *cinematic_headphones* use explicit negatives | ⚠️ **CONTESTED** — second clicker A/B |
| 12 | Adil's project pages expose his full prompts | assumption from links | anonymous fetch of both pages | ❌ **FALSE anonymously** — only concept + model stack visible. *Sofia reports access exists (likely logged-in) — unresolved, revisit.* |

### Facts worth keeping (verified T1/T2)

- **Seedance 2.0 inputs**: up to 9 reference images + 3 video clips + 3 audio files per
  generation; `start_image`/`end_image`; native audio; 4–15 s; 4K in std mode. The model most
  able to consume what References compiles.
- **Cinema Studio 3.0 controls**: resolution, genre (auto/action/horror/comedy/noir/drama/epic),
  generate_audio, 4–15 s, 7 aspect ratios. **No camera parameter** — everything cinematographic
  is prompt prose.
- **Adil Alimzhanov (@adilinthewild)** — not "Amir" — model stacks (both 2026-07-10):
  tv-4k = Seedance 2.0 51.1% / Soul Cinematic 35.7% / GPT Image 2 7.7% / NB Pro 1.9%;
  top-up = Seedance 2.0 80.4% / Soul Cinematic 16.8% / GPT Image 2 1.6% / Seedream 4.5 1.2%.
  **No Kling, Veo, or Runway in either.** A top creator's real distribution is two models.
- **Santiago workflow shape** (T3 — undated, direction only): lock characters/locations/props
  early and reuse; reference sheets on neutral grey, shadowless; Claude writes prompts with
  image references attached; 60:30:10 colour ratio; LOCKS blocks for cross-shot consistency.
- **Gen Log status** (measured 2026-07-17): 84 generations, 13 shotIds, 3 models (no Kling/
  Veo/MJ), 57👍/9≈/18👎 = 68% keeper. **Cannot ground word-level claims** — prompts vary in
  dozens of words at once; observational data, causal question.

### Standing open questions

1. **mm vs FOV degrees** (claim 10) — first controlled A/B: two prompts, byte-identical except
   the one clause, same shotId discipline, ≥10 pairs.
2. **Positive-only vs explicit negatives** (claim 11) — second A/B, same design.
3. **Adil's prompt access** (claim 12) — Sofia says the links grant access; check logged-in.
   His working prompts + attached outputs would outrank every blog in this log.
4. **Is the 68% keeper rate real** or are discards under-logged? Affects whether any Gen Log
   inference is trustworthy.
5. **Palmier's native model set** (Kling/Seedance/NB Pro?) — taken from our own app copy,
   never independently verified.

### Method lessons (why this log exists)

- The web on this topic is **majority-wrong**: 3 of 5 checkable blog claims failed against the
  vendor's own API. Affiliate roundups invent model names.
- **The vendor disagrees with itself** across two blog posts on its flagship model's prompting
  rules. "Official guidance" is not a consistency guarantee.
- **Sofia's date filter works**: both undated pages were the least reliable; the dated one at
  least contradicted the skill *checkably*.
- Absence from a T1 catalog is strong signal (Sora dead; Runway/MJ native-only).
- One `models_explore` call beat an afternoon of search. **Check the API before the web.**
