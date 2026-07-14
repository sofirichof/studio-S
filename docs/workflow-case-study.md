# Supergood AI-Film Workflow — Case Study & Company Needs

*Prepared 2026-07-09. Evidence base: Google Drive (10 docs/decks read), Granola meeting notes (Jul 2 "Studio S Demo and Talk", Jul 7 "AI Projects"), Gmail (Jun–Jul 2026 production threads), and Slack ("Supernatural AI" workspace — the Andrew↔Sofia AI-film DM, `#usb-nfl`, `#usbank`, `#product-discussion-general`). Claims below are triangulated across sources; source system noted inline.*

---

## 1. Executive summary

Supergood positions itself as an **AI-native agency** ("Most agencies added AI. Supergood was built for it" — *2026 AI Capabilities* deck) and is shipping real AI-generated film for marquee clients — the US Bank × NFL Super Bowl program, "Real MVP," Chappell Roan, Grid, and Branch Screens work. That output is produced through a **fragmented, credit-anxious, consistency-fragile pipeline** stitched from ~6–8 external tools with no unified surface, no cost attribution, and manual, per-project asset handling.

**Studio S** (Sofia's offline desktop app) already sits at the front of that pipeline as a **prompt-generation + tracking hub** — it "speaks cinematography, not prompts." It is prompt-only today. The proposed next steps — **asset management** (a persistent, brand-governed style/asset + character library) and **asset creation** (native in-app generation with cost attribution) — map directly onto the three most-cited, cross-source pain points: **prompt-drift/consistency, the prompt-fluency skill gap, and credit-burn with no client attribution.** The company's own strategy documents already call for exactly this ("empower more people… strategists and account managers, not just creatives"; "everyone in the org using the same assets, templates, branding"), and the org's stated exit thesis rewards it: **IP/platform assets sell at 15–20× EBITDA vs. services at 5–8×.**

The gating logic is already agreed: build the **asset-management "unlock" solo now**; onboarding a 2nd creative onto a shared template **trips the engineering trigger**; **native generation** is the engineering handoff Ben Wilhelm has offered a platform key for, held to a "prove the manual workflow first" principle.

---

## 2. The nested workflow

### 2a. Supergood's creative-delivery workflow (the outer loop)

Evidenced across email + Drive + Slack, most clearly on the US Bank × NFL program:

1. **Brief in.** Client brief (often via the client's own tool, e.g. Wrike for C4) → SG lifts the brief fields. For film: a marked-up deck assigned to makers (Andrew + Sofia). *(Drive: C4 Process Workflow; Email: Social Rotations 3/4)*
2. **Concept / pitch.** Ideas developed in Google Slides, run through sequential internal reviews ("R2", "R3"); a Group Account Director (John Little) consolidates cross-review notes into one structured brief before the client room. *(Email, 2026-06-10)*
3. **Production.** Assets built (see 2b for the AI track). First assembly is a **"string out"** — intentionally long/rough, built straight off the brief. *(Email: Izzy Gerace string out, 2026-07-07)*
4. **Review & revision.** Runs on **Frame.io** (comment-by-comment, @mentions — double-digit comments per asset per day) and Google Docs/Slides for decks. Review routing had to be formally codified after it broke: string-out → Aaron/Ted/Nicole (craft) → Sofia/Andrew → Bob Winter (senior-creative gate) → account → client. *(Email: Elana, 2026-07-08)*
5. **Brand/legal approval.** Heavy, dual-brand governance (US Bank + NFL + 49ers): NFL shield rules, logo-lockup consistency, **Member FDIC on all videos**, approved-phrasing swaps, player-number whitelists, open question on AI-disclosure language. Checked by hand per asset. *(Email: Hannah recaps, 2026-06-23 / 07-01)*
6. **Delivery.** Multi-platform, multi-ratio: 6 rotations aligned to the NFL calendar, ~15–18 platform-native assets per rotation (Meta/Pinterest/Snap/LinkedIn) at a 60/30/10 brand mix, plus TV cut-downs. *(Drive: US Bank Creative Rotation Strategy)*

### 2b. The AI-film pipeline (the inner loop, where Studio S lives)

A **reference-first, gated sequence** (Slack DM `D0B9M0989H8`; Granola Jul 2; Drive Rotation 4 Gameplan):

1. **Pre-pro / plan — Claude.** Script/folder → Claude returns a structured `studio-s-plan.json` shot list (scene, subject, environment, time of day) that auto-populates the project.
2. **Prompt building — Studio S.** Cinematographer's-model wizard (subject, environment, ToD, lighting, DoF, lens/motion, grade, shot size, angle, aspect, mood, duration) + a **global style prefix** locking a consistent look; a Prompt-Strength meter; Projects (Client→Rotation→Concept→Shot), References (auto-inject brand/character assets), Multi-Shot (Nano-Banana 12-angle character sheets). Emits **still + video prompts simultaneously, each tailored per model. Prompts only — no media generated in-app.**
3. **Reference stills — ChatGPT/GPT-image + Midjourney.** The on-brand anchor. **Explicit human sign-off gate before any video credits are spent:** *"once we sign off on the right ones, you can make them into videos"* (Andrew).
4. **Image-to-video — Kling (primary), Seedance omni, Higgsfield** (increasingly the favored hub), + Veo 3 / Luma / Runway.
5. **Adjacent generation — ElevenLabs** (VO/music), **Heygen** (lip-sync), **Topaz/Replicate** (4K upscale), Suno (music).
6. **Track — "The Clicker."** Manual log of every generation (model, prompt, still/video, keep/mix/discard + a "what went wrong" capture). ~70 logged.
7. **Edit / finish — Palmier** (AI-native timeline) → **Premiere/Adobe** (human finish); external freelancers sometimes on **Final Cut**. Color grade for a "film look" (halation/haze).

**Origin story (cited repeatedly):** the pre-Studio-S pipeline was ~10 fragmented steps (scattered Claude chats, 40+ ChatGPT threads/project, no consistency, no cost tracking). The US Bank / Chappell Roan video — frames that looked "shot by different people" — was the breaking point that prompted building the tool. *(Granola Jul 2)*

---

## 3. Pain points & gaps

*Ordered by how strongly and how often they surfaced across sources.*

1. **Credit burn with no cost attribution — the #1 adoption barrier.** The whole reference-first ordering exists "otherwise we'd just be wasting credits" (Sofia). "At $1+ per clip, people treat every generation like it's precious — nobody's experimenting at scale." Gosupergood runs a monthly AI "blob" budget with **no client attribution**; token costs swing with each model release. *(Slack DM; Granola)* Ben's investigation into per-generation credit-API attribution was **deemed not feasible short-term** — client APIs don't expose routing. *(Granola Jul 7)*
2. **Aesthetic / brand consistency & prompt drift — the hard technical problem.** "The heavy lift… getting that exact aesthetic — the 60fps, hyper-realism"; the search for "a good workable prompt that gives consistency" across a series is unsolved. Character sheets are rebuilt per person; the whole Step-0 setup exists to fight per-clip drift. *(Slack; Drive Gameplan)*
3. **The prompt-fluency skill gap ("the translation problem").** "Image generation… requires a specialized skillset that not everyone possesses" *(Drive: Point Solution Visuals, 2024)*. Bianca: creatives "have a hard time understanding what the tools can do… it's almost like a translation problem — a different language" *(Granola Jul 2)*. Studio S's answer: **the prompt is the output, not the input.**
4. **Manual asset management / no persistent library.** References auto-inject *within* a project, but character sheets, "copydecks," and DAM folders are **rebuilt/organized by hand each rotation** (Zuzanna manually foldering the USBank_NFL asset library). Anthony's open question: "Have we uploaded client style/templates into Claude design?" — desired, not settled. *(Email; Slack; Drive)*
5. **Revision churn & review-routing dysfunction.** Double-digit comments/asset/day; repeated fixes across cut-downs (player numbers on :10 AND :15); account giving craft notes editors couldn't action — severe enough to require a written process rule. *(Email)*
6. **Mid-flight brand changes → mass manual rework.** The NFL Global Design Playbook (new logo lockup) landed mid-project (2026-07-07/08), forcing hand re-versioning across *all* assets — TV end cards, social, banners, every Real MVP video. *(Slack `#usb-nfl`)*
7. **Missing / uncleared assets at edit time.** "No b-roll on my end yet"; footage chased reactively; "placeholder AI CMC image still needs to be swapped for a real still." *(Email)*
8. **Tool fragmentation & handoff mismatches.** "You won't get something fully baked straight out of any one service" (Lucas); FCP-vs-Premiere project handoff friction with external editors. *(Slack; Email)*
9. **Model bias → rework.** ChatGPT reads "affluent" as white/male; repeated iteration to get diverse crowds. Strategists hand-feed persona docs as a workaround. *(Slack)*
10. **Turnaround pressure & capacity contention.** Weekend crunch; "Anjanette and Elizabeth are jamming on other briefs too." *(Email)*
11. **Studio S maturity gaps.** Local-only (no collaboration), manual tracking with no per-model token cost, legal risk from cinematographer-named presets (now addressed), the outcome→prompt-logic feedback loop still aspirational. *(Granola)*

---

## 4. Company needs & strategy

- **AI-native operating model, three layers** *(Drive: 2026 AI Capabilities)*: a **Knowledge Graph** (Industry / Agency / Client graphs, client-isolated), a **Data Stack** (YouGov/BrandIndex, Media Radar, SEMRush…), and **AI Workflows** (proprietary prompts/tools that plug into clients' existing tools) — delivered via a **Supergood Knowledge Graph over an MCP server** so LLMs get grounded context. Agency-wide rollout underway: **SG Tools, SG Wizard (`/supergood-wizard`), Claude Design** (Ben Wilhelm / Bianca Chaer). *(Slack)*
- **Creative/production tooling is the acknowledged next frontier.** "Today our tools lean strategy-heavy. Next, we need tooling to support the rest of the agency." That is exactly the space Studio S occupies. *(Drive)*
- **Standardization is the first platform win** (ahead of collaboration): new hires/freelancers start in Studio S, work within controlled parameters. The **engineering trigger**: engage when (1) 2+ people must collaborate, or (2) the org wants to standardize. *(Granola)*
- **Cost attribution** is a live need (the Clicker is step one); the automated-routing approach stalled short-term.
- **Brand governance** recurs everywhere: client-graph isolation, brand-guidelines/legal/mandatories loaded as references, private brand-tone-trained models, pre-delivery "alignment checks," Anthony's US Bank design system in Claude Design.
- **Consolidation appetite:** funnel spend into "one space" (Higgsfield/Kling); centralized intake of AI requests (Aaron); shared single-source decks/edit briefs.
- **Exit / valuation thesis (the strategic "why"):** services businesses trade at 5–8× EBITDA; **IP/data/platform assets at 15–20×** — "when we exit, we are going to be selling assets." Tooling that becomes reusable IP directly drives enterprise value.

---

## 5. Where Studio S fits — the case for asset management + creation

**Studio S today** is the prompt/tracking hub at the front of the AI pipeline (§2b). Its References tab, character sheets, and global style prefix are an **embryonic asset system that is rebuilt per project** — that gap is precisely what the two proposed directions close.

### Asset management (build-now, solo) — "the unlock"
A persistent, brand-governed **style/asset template + character/asset library** so non-prompt-fluent creatives produce on-brand work from the first generation.
- **Directly validated by the org's own words:** "empower more people… strategists and account managers" *(Drive 2024)*; "everyone in the org using the same assets, templates, branding" (Lucas); Anthony's Claude Design US Bank system + his open "have we uploaded client style/templates?" question; Elana hand-feeding persona docs to Sofia as a manual stand-in.
- **Closes** pain points #2 (consistency), #3 (fluency gap), #4 (manual asset mgmt), and #6 (mass rework — a governed library re-propagates a brand change once instead of per-asset).

### Asset creation (engineering handoff) — native in-app generation + cost attribution
- **The pull is explicit:** the "one space" wish, Studio S installer requests, and the 2024 "Better Visual Across Tools" spec (embed generation, 2–3 auto-alternates, regenerate/select/save/export, multi-model) whose rationale is **cost + democratization**: "AI image generation can greatly decrease the cost of production."
- **The offer exists:** Ben Wilhelm can raise token limits and has offered the **platform API key**; asked for the installer.
- **The guardrails:** "figure out the full workflow manually first, then automate" (Ben); gated on the 2-user / standardization trigger; automated per-client cost routing is not feasible short-term, so **manual/estimated attribution (the Clicker → per-shot/per-project estimates) is the pragmatic interim.**
- **Closes** pain point #1 (credit burn / no attribution) and #8 (fragmentation).

---

## 6. Business case (evidence-backed)

- **Efficiency proof points already measured** *(Drive: AI Capabilities case studies)*: C4 copy revisions 4h→1.5h ("62% faster") and "90% reduction in copywriter time," 25+ weekly deliverables at 24h turnaround via a private brand-tone model; US Bank competitive reviews 50→20h ("60% less time").
- **The reuse thesis** *(Drive Gameplan)*: "build references and character sheets once, and every one of the 5 videos — plus the cutdowns — pulls from the same consistent assets instead of you rebuilding per clip."
- **Quality/consistency is a revenue lever:** "QA issues hurt client trust more than other mistakes… and directly hurt revenue"; "expertise doesn't scale — senior knowledge lives in people." A governed asset library operationalizes senior taste.
- **Enterprise-value lever:** reusable, brand-governed asset IP moves work from the 5–8× services multiple toward the 15–20× asset multiple.

---

## 7. Stakeholder map (who wants what)

| Person | Org / role | Position on this |
|---|---|---|
| **Sofia Gonzalez Irigoyen** | Gosupergood (intern; AI-video editor) | Builder/owner of Studio S; wants it validated, de-risked, path to team/platform. |
| **Ben Wilhelm** | Gosupernatural (platform/eng) | Sees Studio S filling the creative-workflow blind spot; offers token raises + platform key; owns the engineering trigger + "manual-first" principle + cost-attribution investigation. |
| **Andrew Robertson** | Gosupergood (senior editor/AI-film lead) | Owns direction + tool logins; requested the installer; bullish — "tip of the iceberg"; drives consolidation/budgeting. |
| **Mike Barrett** | Gosupergood (owner / aesthetic arbiter) | Strong positive — "solving a real problem, built from genuine friction, well beyond peers." |
| **Bianca Chaer** | Gosupergood | Frames the "unlock" as a translation problem; runs SG Tools/Claude Design rollout; parallel tool. |
| **Anthony Pelkey** | Gosupergood (client engagement, accounts) | Built the US Bank design system in Claude Design; asking whether client style/templates are managed — a natural first customer for asset management. |
| **Elana King** | Gosupergood (creative leadership) | Owns the review process; hand-feeds persona references (the manual version of the asset library). |
| **Lucas Shuman** | Gosupernatural | Design-system-as-shared-assets vision; multi-tool chaining. |
| **Zuzanna Ziolkowski** | Gosupergood | Manual DAM foldering + a parallel AI creative/legal-review tool (candidate to merge as a review layer). |
| **Hannah Lacey / John Little / Aaron Marshall / Ted Pedro / Bob Winter / Nicole James** | Gosupergood | Account/creative reviewers & gates in the outer delivery loop. |

---

## 8. Recommendation & next steps

Aligned with the existing "Studio S build and game plan":

1. **Build the asset-management "unlock" now (solo):** persistent, brand-governed style/asset template + character/asset library in Studio S; carry it across a project's videos and cut-downs. Seed it from a real customer: **Anthony's US Bank brand system** and **Elana's audience personas**.
2. **Onboard a 2nd creative onto a shared template** — this is the explicit event that **trips the engineering trigger**; pick a low-risk internal user (a strategist/AM, per the "empower more people" goal).
3. **Interim cost attribution** via the Clicker → per-shot/per-project estimates (since automated routing isn't feasible short-term). This is the credible answer to the #1 pain point without waiting on engineering.
4. **Draft the engineering handoff for native generation** on Ben's platform key — framed as "the manual workflow is proven, here's the usage/cost data, here's the standardization ask."
5. **De-risk for the labs sandbox** (bug pass + preset relabel — largely done in v0.3.5) so it can demo in client pitches.

---

## 9. Evidence & confidence

- **Strong, cross-corroborated** (3–4 sources agree): the AI pipeline shape, reference-first gating, credit-burn as #1 barrier, the consistency/fluency gaps, manual asset management, brand-governance intensity, Studio S's role + internal rollout, the platform strategy, and the asset-mgmt/creation direction.
- **Well-sourced but single-domain:** efficiency percentages (Drive case studies), the exit multiples (Drive), the engineering-trigger/Ben-offer specifics (Granola Jul 2/7).
- **Thin / open:** no hard per-asset $ cost figures (SOW/billing trackers unread); **no dedicated "asset library" design spec exists yet** — the direction is inferred from convergent practice + the 2024 Visuals spec; Higgsfield/Seedance/ElevenLabs lightly evidenced in email specifically; the HoldCo AI Strategies (2025) and three Platform Overview decks not fully mined.

### Primary sources
- **Granola:** "Studio S Demo and Talk" (Jul 2 2026), "AI Projects" (Jul 7 2026).
- **Drive:** Rotation 4 Production Gameplan; Meeting Prep — Social Rotation 4; 2026 AI Capabilities; C4 Process Workflow; Point Solution Business Requirements — Visuals (2024); 2026 US Bank Creative Rotation Strategy; RealMVP Edit Brief v2; AI Implementation Playbook; 5.11 Reactive Brief; HoldCo AI Strategies (partial).
- **Email (Gmail, Jun–Jul 2026):** Super Bowl Notes R2; Izzy Gerace string-out/review; Social Rotations 3+4 recaps; AI Videos for Super Bowl; Rotation 4 + Real MVP DAM.
- **Slack ("Supernatural AI"):** Andrew↔Sofia AI-film DM (`D0B9M0989H8`); `#usb-nfl`; `#usbank`; `#product-discussion-general`; `#c4-ai-copywriting-pilot`.
