# Studio S v0.3.1 — Filmmaker's Critical Review

**Date:** 2026-07-01
**Reviewed:** live source at `~/Documents/Studio S/src/` (v0.3.1) — `promptbuilder.html`, `multishot.html`, `references.html`, `projects.html`, `finishing.html`, `store.js`. All source claims are checkable at `file:line`.
**Market claims:** verified against ten research briefings (current models, practitioner grievances, craft consensus, competitive landscape, cost economics, legal/provenance, directability, character-reference systems). Research digest at the bottom.

---

## The one thing to hear first

**The headline feature is a façade.** The Review step promises *"One brief, compiled into each model's native phrasing"* (`promptbuilder.html:919`), but `stillProfiles()` / `videoProfiles()` (`promptbuilder.html:562, 582`) return **hardcoded strings about "commuters crossing a downtown intersection at golden hour"** — the US Bank demo — and never reference `this.state.subject/environment/look`. No Claude call, no fetch, no interpolation. A user can describe a vampire in a snowstorm through six wizard steps and Review still shows commuters.

`generate()` (`promptbuilder.html:1008`) persists the brief, flips status to `'prompted'`, shows "Prompts saved ✓" — and despite the UI claiming it "copies the active model's prompt," **there is no clipboard write.**

Everything downstream inherits the hole: Multi-Shot's "Edit once → updates every shot's *compiled prompt*" (`multishot.html:156`) is hollow because there are no compiled prompts for the prefix to flow into. A filmmaker who demos the Review tab with their own shot and sees someone else's prompt will close the app and never reopen it. **The real compiler is the fix that unblocks the entire product** — it was MVP #1 in the original handoff doc and is still the curated-example mock that doc flagged.

> **Correction (2026-07-02):** the deterministic compiler EXISTS — `generatePrompts()` at `_archive/AI_Film_Studio_2026-06-15_2327.html:2551`, with real per-model rules (e.g. which models accept negative prompts). **It was lost in the multi-page `src/` rewrite** and never ported into `promptbuilder.html`. Phase 1 of the implementation plan is therefore a *port + upgrade to profiles-driven data*, not a from-scratch build. The v0.3.1 finding above stands: what ships today shows hardcoded demo strings.

---

## 1. Problems the app genuinely solves (design-level — real, and ahead of the field)

- **Model-dialect fragmentation.** One brief → per-model native phrasing with a "why it's tailored" note is the single best idea in the app. The `rule` strings (`promptbuilder.html:566–606`) are legitimately expert (GPT Image = full sentences + upscale; Nano Banana = Image/Content/Style brief; Midjourney = Portra + `--style raw --stylize`; Kling = camera-first, still-as-anchor; Sora = narrative phrasing). Research confirmed this is the identified market whitespace: *"aggregators route generation but don't author portable prompts."* It just isn't wired to user input yet.
- **Translating film language for people who don't have it.** `dpPresets()` mapping Deakins → ARRI Alexa 35 + shallow, Villeneuve → Venice + symmetrical + deep, plus the "by cinematographer / by feel" toggle. No competitor does this; LTX Studio's most-cited gap is precisely "no camera-department notation."
- **Workflow discipline as product.** The pipeline (Claude plan → `scaffoldFromPlan` at `store.js:246` → Studio S → Palmier → Finishing) matches the community-consensus workflow almost step for step (Rivera's 8 steps, Curious Refuge doctrine, PJ Ace's ingredients-to-video): assets first, image-to-video, test in motion, best-of-many, finish in a real NLE.
- **Intellectual honesty and engineering care.** "Direct generation isn't connected yet" (`promptbuilder.html:955`); crash-safe store that backs up corrupt blobs instead of wiping (`store.js:60`). Rare, and it builds trust — keep it.

## 2. Problems still unsolved (verified absent in src/)

- **Character/identity consistency — the field's #1 grievance.** References are a *decorative catalog*: `addReference` stores `{name, kind, note, shotCount:0}` (`store.js:205`), `shotCount` is never incremented, and **nothing links a reference to a shot**. No auto-attach, no reference-image storage, no per-model export shape. Meanwhile the industry's answer is reference systems: Kling 3.0 (10-image multi-reference, Bind Subject, multi-fusion), Veo 3.1 Ingredients (≤3 images), Runway References (≤3), Nano Banana Pro (≤14 refs, 5 people), Higgsfield Soul ID (true trained identity). All are anchors, not locks — vendors themselves say "re-anchor every generation" — which is exactly why the app's test-and-lock doctrine should be wired to real attachment plumbing.
- **Audio and dialogue.** No dialogue/sound field anywhere in the brief. This is now a roster mismatch, not just a gap: **Kling 2.6+ (the app's default model) generates synced speech/song/SFX natively; Seedance 2.0 ships lip-synced speech at no extra cost; Sora 2 and Veo 3.1 are audio-native; Runway Gen-4.5 added native audio Dec 11, 2025.** Only Luma and Midjourney remain silent. The wizard has nothing to route to any of it.
- **The slot machine — acknowledged in doctrine, absent in product.** Shots store a `builder` and `status` only (`store.js:154`) — no takes, no outputs, no ratings, no seeds, no costs. Research numbers: keep-ratios run 5:1–10:1 (Shy Kids' Sora short: 300:1), ~80% of credits die on rerolls, per-clip pricing is per-*attempt* not per-*keeper*. The separate Gen Log app collects exactly the data that belongs here.
- **Continuity between shots.** No eyeline, screen-direction, 180°, or match-cut concept (grep: only stray SVG coordinates). First/last-frame keyframing is now near-universal (Veo, Kling, Luma, Runway, Pika), so a match-cut feature has a real compile target in every model.
- **Provenance / authorship manifest.** Zero capture of model, version, seed, refs per shot. Two research findings make this urgent: (1) the **US Copyright Office (Jan 2025)** holds fully AI-generated work uncopyrightable and prompts alone insufficient — protection attaches only to *documented human contributions*; (2) vendor provenance (C2PA/SynthID) is **strippable by re-encode** and won't survive the Palmier → Premiere → Resolve pipeline. A Studio S manifest logging the human creative chain (DP choice, choreography, keeper selection) is the only record that survives to the client deliverable — it's what lets the client *own* the ad.
- **Choreography.** Still a single `Movement` chip defaulting to `'push'` (`store.js:34`) — the exact "'he dances' generates mush" problem the app's own Workflow guide warns about. Handoff MVP #3, unbuilt.

## 3. What would elevate it (ranked by leverage)

1. **Build the real compiler; make model profiles versioned data, not code.** Assemble per-model prompts from `this.state` × a profile table — deterministic templates or the existing Claude/Rust proxy. Profiles must live in data (see `model-profiles-2026-07-01.json`) because they rot in weeks: Seedance rewrote its own prompting doctrine between 1.0 and 2.0; Kling gained native audio Dec 3; Runway gained audio Dec 11 after launching silent Dec 1. Version-stamp each profile and show it in Review ("tuned for Seedance 2.0, Feb 2026").
2. **Wire references to shots, with per-model export shapes.** `refIds: []` on each shot; auto-inject into compiled prompts; store reference images; export in each model's native form (Kling Elements/Bind Subject first — it's the default model and has the deepest reference API — then Veo Ingredients, Runway References, Nano Banana ref sets). Encode PJ Ace's **2×2 grid hack** into the "add character" flow (one generation → four matched panels → crop to keyframes).
3. **Dialogue & sound fields in the brief.** Route to Kling 2.6+/Seedance 2.0/Veo/Sora 2 when present; warn on Luma/Midjourney. Mood already maps naturally to delivery/energy direction.
4. **Take/keeper board per shot.** Store generations (path, model, seed, rating, cost), compare, star, promote. Surface **cost-per-keeper per model per shot** (absorbing Gen Log). Build in the discipline nudge: *3 takes with no keeper → change one variable* (single-variable testing, now backed by the 80%-of-credits-die-on-rerolls data). Add a "fix, don't reroll" path: route small changes to targeted-edit tools (Runway Aleph, Luma Modify) instead of full regeneration.
5. **Continuity as first/last-frame anchoring.** "Open on the closing pose of shot X" compiles directly to Veo First & Last Frame / Kling end-frame / Luma keyframes. Add screen-direction arrows and a 180° warning on the Multi-Shot list.
6. **Human-authorship manifest export.** Once takes capture seed/model/refs, one-click a per-project sheet: prompts, models, versions, refs, and the human decisions. Copyright protection + client legal in one artifact. No competitor keeps this.

### Pre-gen lint rules worth adding to the compiler (cheap, high-value)

- "Extreme close-up + hands" → warn (60–75% success on complex hand shots, all models).
- On-screen text/signage in video → route the text to a Nano Banana Pro *still* (the field's only reliable in-image text) and composite in Finishing.
- Stacked camera moves in one short clip → warn; **one primary move** (Google's own Veo guidance; Seedance 2.0 tolerates sequenced moves — per-model exception).
- Spatial placement ("subject on right third") → compile via reference-frame/first-frame anchoring, not text; OpenAI's own system card admits models confuse left/right and fail specific camera trajectories.
- Choreography helper text: name every mover — precisely-controlled subjects move correctly while everything unmentioned freezes (the precision-vs-dynamism tradeoff, MotionAgent 2025).
- Kling: motion-brush/end-frame **disables** camera movement — mutually exclusive controls, enforce in UI.
- FLUX.2: one-off hero frames only, never recurring characters (documented generation-to-generation identity drift).

---

## Market position (from the competitive-landscape research)

The market has three layers — generation platforms (Runway, Kling, Flow, Krea, Freepik), pre-pro/orchestration (LTX Studio, Shai, Filmustage), and doctrine (Curious Refuge). The research's strategic takeaway for this category, nearly verbatim Studio S's thesis:

> "Own the connective layer the generators neglect — versioned prompts, a style bible held as persistent context, properly-notated shot lists, reusable character/asset blocks, and one-click multi-model export."

- **Closest competitor: LTX Studio** ($125/mo Pro) — ships script→shot breakdown, Elements, Character Profiles, hosts Kling/Seedance/Veo natively. Its reported failures are Studio S's differentiators: characters drift despite profiles, no camera-department notation, credits burn fast.
- **The two clearest whitespaces named by the research** are already this review's #1 and #4: *"version tracking — no generation UI treats prompts as versioned source"* and *"multi-model prompt export."*
- **Never compete on generation** — Sora's inference burn is ~$15M/day and OpenAI calls its own economics "completely unsustainable." The authoring layer is the defensible ground.
- **North-star test** (from the grievance research): *does the app reduce the slot-machine cost and cross-tool fragmentation, or just add another text box?* v0.3.1 currently: fragmentation — designed correctly, not functioning; slot machine — not addressed. Both are fixable with items #1 and #4.

---

## Research digest (10 briefings, 2026-07-01)

Key sourced facts the recommendations rest on. Fuller citations in the session transcript; model-specific rules encoded in `model-profiles-2026-07-01.json`.

**Models (video):** Kling 2.6 (Dec 3, 2025) first Kling with native single-pass audio (speech/song/SFX, CN+EN), 1080p/48fps, 10s; Kling 3.0 announced Jan 31, 2026 (4K/15s claims unverified, in testing at announcement); Kling's weakness = temporal consistency/stability. Veo 3.1 (Oct 14–15, 2025): native audio (48kHz, ~120ms lip-sync), 4/6/8s clips, scene extension conditions on the final second only, Ingredients (≤3 refs), First & Last Frame. Sora 2 (Sep 30, 2025): native audio, Cameos (verified-capture likeness, app-only), 10–25s, physics still fails on limbs/weight, throttled access. Seedance 2.0 (Feb 2026): native audio + lip-sync free, 4–15s, multi-shot cuts in one generation, camera-control leader; weaknesses: coarse control (regenerate, don't nudge), hands in close-up, on-screen text. Runway Gen-4.5 (Dec 1, 2025): tops Elo for prompt adherence, 720p cap; native audio + one-minute multi-shot added Dec 11, 2025 (TechCrunch). Luma Ray3.14: native 1080p, no audio, drops character reference (use Ray 3 for identity). Midjourney Video V1: 480p, image-animation only, silent. Higgsfield: aggregator + camera presets + Soul ID (the only true trained-identity system; vendor's own caveat: "high, not absolute").

**Models (stills):** Nano Banana Pro = Gemini 3 Pro Image (Nov 20, 2025): native 4K, best character consistency (≤14 refs, 5 people), best in-image text — the ad-agency routing answer for taglines/signage. Nano Banana 2 = Gemini 3.1 Flash Image (Feb 26, 2026) — a speed tier, not an upgrade. GPT Image 2 tops several preference leaderboards. FLUX.2 (Nov 25, 2025): photorealism leader, open weights, but generation-to-generation consistency drift. Imagen 4 Fast: $0.02/image volume tier.

**Grievances (practitioner):** #1 character/identity drift; slot machine (5:1–10:1 keep ratio, 300:1 for Shy Kids' *Air Head*, ~80% of credits on failed rerolls); prompt-dialect fragmentation; unreliable camera control ("camera pan works six out of 10 times" — Shy Kids); small edit = full regenerate (Aleph/Luma Modify exist specifically to fix this); the AI look; provenance/legal.

**Craft consensus:** story → characters → locations/style bible → shot list with explicit camera language → composite stills → upscale → image-to-video → NLE edit → separate sound. "Style bible takes 30 min to write and saves hours of regeneration" (601 Media). PJ Ace's 2×2 grid hack. Max ~3 regenerations then change a variable. One primary camera move per short clip.

**Legal/provenance:** US Copyright Office Part 2 (Jan 29, 2025): human authorship required, prompts alone insufficient, document human contributions. NO FAKES Act cleared Senate Judiciary (2026), not yet law. C2PA/SynthID converging (May 2026 OpenAI+Google dual-layer) but strippable — Microsoft's Feb 2026 report concedes stripping can't be prevented. Training-data fair use still unresolved in US courts (NYT v. OpenAI in discovery; Disney/Universal v. Midjourney early-stage; Getty UK judgment dodged the core question).

**Economics:** Veo 3.1 ~$0.75/s standard, $0.15/s fast; Sora ~$1/clip ($3–5 Pro); Kling ~$0.10/s; Runway ~10 credits/s. Sticker price is per-attempt; true cost ≈ 5–10× per keeper.

---

*Review conducted as "fresh eyes: a filmmaker using AI" per Sofia's brief. Prior session context: this review supersedes any findings referencing `~/Downloads/AI Film Studio app` (stale Jun 28 mockups) or the old `Rotation 4 social - USB/ai-film-studio/` path.*

---

## Addendum 2026-07-02 — Stakeholder demo feedback (Granola: "Studio S Demo and Talk")

Demo to Bob, Andrew Robertson, Bianca Chaer (Supergood) + Ben Wilhelm (Supernatural). Outcome: enthusiastic — "this is awesome," "tip of the iceberg," engineering support offered. What it changes:

### Validation from the room
- **Positioning confirmed:** "this sits in the middle of the complete workflow" — pre-pro in, prompts/stills/video out, rest of pipeline after. Matches the review's "connective layer" market position.
- **The offline deterministic compiler is a *feature*, not a shortcut.** Sofia's argument, validated in the room: Claude gives a different prompt every time; the app uses "a list of words that are proven to work." Consistency > generative variety for this job. Keep the compiler deterministic; use Claude only to *refresh the profiles data*, not to write prompts at runtime.
- **Cost tracking has org-level pull beyond the review's framing:** the agency "can't distribute AI cost to different clients — it's just a big blob," and scoping/pricing AI projects requires cost-per-keeper averages. Sofia's clicker log (model, prompt, still/video, keeper/mix/discard + what-went-wrong) is the seed. Elevate item #4 (take board + cost) from filmmaker convenience to **agency billing/scoping infrastructure**.

### New asks from stakeholders (not previously in the review)
1. **Platform integration** — move onto the company platform with a platform API key ("you don't ever have to worry about it"), runaway-cost guardrails, and in-app generation via API calls with async notification ("send it off in an API call and message you when it's ready"). Engineering offered to build this.
2. **Distribution / "multiplayer"** — get it into other people's hands to find which parts are Sofia's personal workflow vs. generalizable. Known trap named in the room: "we build for one person's workflow and then it's not useful to anyone else."
3. **Studio look / style templates** — a standardized dictionary of proven words; "build me a style template for this project" importable so every generation inherits it (extends the global style prefix toward brand/studio level). Also solves "the US Bank look is in 10 different folders."
4. **Creative→production handoff** — let a creative (e.g. Aaron) ideate in production-oriented terms and hand Sofia exactly what he wants; possibly as a Claude skill.
5. **Traditional-production port** — same script→shot-list flow, minus prompts, for practical shoots.
6. **Small fix noted during demo:** shots within a scene need auto-labels (1A, 1B) — currently manual.

### Follow-ups
- Meeting with Ben (Supernatural) scheduled for **Tuesday next week** (~Jul 7) to go deeper.
- Ben is embedded until **Aug 21** — engineering window for platform/API work.
- Priority reshuffle implied: distribution-readiness (onboarding without Sofia, generalized workflows) and the cost/scoping story rise; they're what the org will fund.
