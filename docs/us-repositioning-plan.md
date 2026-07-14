# Studio S → "Us": Repositioning Plan

*Draft 2026-07-09. Companion to [workflow-case-study.md](workflow-case-study.md). Grounded in the four-source research (Drive, Granola, Gmail, Slack).*

---

## 1. The shift

**From:** a personal **prompt generator** — a "me" tool where Sofia turns creative intent into model-tailored prompts, with the prompt builder as the whole point.

**To:** a **cross-team creative-production manager with a unified asset system** — a "me → us" tool that is the single source of truth for a client's brand and for **every asset in a project's life: the brief, the brand kit, the AI reference assets, the generated stills/clips, *and* the non-AI production cuts** (string-out → rough → review rounds → final). Prompt generation becomes **one capability inside it**, not the front door.

The test of the pivot: *the app has to make sense to someone who never writes a prompt* — a producer chasing a cut, an account lead checking status, a strategist reusing a brand kit. Today it only makes sense to Sofia. That's the gap this closes.

**Why this is on-strategy, not scope-creep:** the game plan already named **standardization** ("new hires/freelancers start here, work within controlled parameters") as the first platform win and the event that trips the engineering trigger. A prompt generator standardizes nothing; a shared production+asset source of truth is *the* standardization play.

---

## 2. The reframed problem (from the research, tool-agnostic)

The pain was never "I need help writing prompts." It was:

1. **No single source of truth per project.** Status, assets, versions, and brand rules live scattered across Frame.io, Drive, Slack, Wrike, ChatGPT threads, and people's heads.
2. **Asset chaos across AI *and* non-AI.** Reference stills, generated clips, string-outs, review cuts, and finals are tracked by hand (Zuzanna foldering the US Bank DAM; "the placeholder AI CMC image still needs to be swapped for a real still").
3. **Version/review coordination is fragile.** Double-digit Frame.io comments/asset/day; review routing so broken Elana had to write the rule down; the same fix repeated across cut-downs.
4. **Brand truth lives in people, not a system** — so a mid-flight NFL-playbook change forced mass manual rework across every asset.
5. **Missing/uncleared assets stall work** reactively at edit time.
6. **Non-prompt-fluent creatives are locked out** of the AI step (the translation problem).
7. **Credit burn with no attribution** blocks experimentation.

A cross-team production manager + unified asset system addresses 1–6 directly; 7 is the interim-cost-tracking layer (the Clicker).

---

## 3. What the product is

> **One place per client and project where the team sees status, pulls brand-governed assets, tracks every version from string-out to final, and — when needed — generates AI assets from the same governed source.**

It **connects and governs**; it does not try to replace Frame.io's commenting or Drive's storage (see §7).

---

## 4. Core objects (the new data model)

Tool-agnostic, portable (exportable JSON), designed to lift into the platform later.

- **Client / Brand** — the governance root. Brand kit (style/look, palette, logo, mandatories/legal), personas, approved-phrasing rules, whitelists (e.g., 49ers player numbers). *Update once → propagates.*
- **Project** — belongs to a client (e.g., "US Bank Rotation 4"). Has team, timeline, status, and deliverables.
- **Deliverable** — a required output (e.g., "BTS :15 — 9:16 — Meta"). Carries specs (ratio, runtime, platform, legal), a status, and a current version.
- **Asset** — *unified and typed:*
  - **Reference:** characters (Soul-ID-style: 20+ refs, angles/lighting/full-body — see case study), products, locations, style presets, personas.
  - **Generated:** stills and clips, each with recipe/provenance (model, prompt, cost) — the Clicker, promoted to first-class.
  - **Production cut:** string-out, rough cut, review versions, final — **non-AI included**, each linked to its Frame.io review + round.
- **Version / Review** — rounds, reviewers, status (needs-review / changes / approved), routed per Elana's rule (craft → creative gate → account → client → NFL).
- **Person / Role** — maker, reviewer, account, creative lead, producer.
- **Status / Activity** — what's in review, what's blocked (missing/uncleared asset), what's approved — the at-a-glance layer.

---

## 5. The lifecycle it manages

Mapped to the real workflow, with the app as source of truth at each step:

`Brief` → `Brand + assets attached` → `AI generation (prompts → stills → i2v)` **and/or** `Live/edit footage` → `String-out` → `Review rounds (Frame.io)` → `Brand/legal gate` → `Final` → `Multi-format delivery`

The app doesn't own every step — it owns the **thread that connects them**: which deliverable, which version, which assets, which brand rules, what status, who's next.

---

## 6. Information architecture (the new front door)

- **Home = hybrid Work dashboard** — blends **brand + projects + status** in one view: active projects, what's in review, what's blocked, what needs *me*, plus quick access to the client brands/assets. (Replaces the onboarding/prompt-first `index`.) *[decided]*
- **Project hub** — deliverables + their versions/reviews + attached assets + status. The producer/account view.
- **Brands & Assets** — the governed library (§4 reference + generated assets), reusable across projects. The standardization layer.
- **Generate** — the current prompt builder + multi-shot, **demoted to an action** you take from a deliverable/asset ("generate from these assets," identity → brand style → shot).
- **Finish** — cuts/versions/review status (evolves today's Finishing/Palmier surfaces).

**Page remapping:** `index` → Work dashboard · `projects` → Project hub · `references` → Brands & Assets · `promptbuilder`/`multishot` → Generate (action) · `finishing`/`palmier` → Finish/versions.

---

## 7. Integrate vs. replace

The fastest way to sink this is to rebuild solved things. Stance:

| Tool | Role today | This app's move |
|---|---|---|
| **Frame.io** | video review/comments | **Integrate/link (or embed)** — app owns version + round + status; Frame.io keeps frame-accurate timeline comments |
| **Google Drive** | storage / DAM | **Link** assets by path/URL; don't re-store binaries (also protects local storage) |
| **Wrike** | client task intake | **Link** the brief/ticket |
| **ChatGPT/Kling/Higgsfield** | generation | **Feed** (prompts) + **log** (generations/cost) |
| **Palmier/Premiere** | edit | **Link** the cut/version |
| **Claude Design / SKG** | brand systems / platform | **Export toward** — the portable brand-asset schema is the bridge |

**Unique value = the connective, brand-governed source of truth across all of these** — the layer none of them provide.

**On "native Frame.io":** tempting, but Frame.io's core value is frame-accurate, timestamped timeline comments — an in-app review that can't match that is a downgrade (the "lost timeline connect" problem). So:
- **Now (solo):** app is the source of truth for which cuts/versions exist + their status (round, reviewer, approved/changes/blocked); each version **links or embeds** its Frame.io review. Cuts are **registered manually** (drop a link/file → logs as a version).
- **Engineering / platform:** auto-ingest ("cut done → Claude adds it to the app"), live Frame.io/Drive sync.
- **Far-future maybe:** a true native review player with timeline comments — only if it can match Frame.io; embedding will likely stay better. Not a near-term goal.

---

## 8. The honest constraint: "cross-team" needs the platform

A genuinely *cross-team* tool is multi-user by definition — shared state, notifications, live sync. The app today is **single-user, offline, local**. So:

- **Solo-buildable now (proves the model, per Ben's "prove the workflow manually first"):** the full data model; the hybrid Work dashboard, Project hub, Brands & Assets, and Finish surfaces as a **single-user source of truth**; generation; **manual cut/version registration + Frame.io links**; manual review/status tracking; the Clicker as first-class cost log; **export/portability**.
- **Needs engineering / the platform (the "us" for real):** multi-user shared state, **auto-ingest of cuts ("cut done → Claude adds it")**, live Frame.io/Drive sync, notifications, cloud storage, automated cost attribution, and (far-future maybe) a native review player.

This is not a blocker — it's the plan. The solo build is the **standardization proof** that trips the engineering trigger and cashes in Ben's platform-key offer. Build the right model now; hand the multi-user layer to engineering when a 2nd user lands.

---

## 9. Restructure plan

Because you chose a full restructure, sequenced to keep the app working:

1. **New store schema** — `clients`, `projects`, `deliverables`, `assets` (typed), `versions/reviews`, `people`; a migration mapping today's `projects → concepts → shots` into it.
2. **New home** — Work dashboard.
3. **Rebuild the four surfaces** — Project hub, Brands & Assets, Generate (demoted), Finish — reusing existing pages where they map (§6).
4. **Wire governance** — projects inherit a brand; assets/versions carry status; generation reads attached assets.
5. **Seed** — a US Bank client (brand kit + personas + a Rotation project with deliverables and a couple of cuts) so it demos as an "us" tool immediately.
6. **Export/portability** — JSON handoff of a client/project, toward Claude Design / the platform.

---

## 10. Risks & open questions

- **Multi-user is the crux.** The true cross-team experience is a platform feature; be disciplined that the solo build is the *proof*, not the final form.
- **Scope explosion.** This is now a much bigger product than a prompt tool. Recommend building a tight **core** (brand + assets + projects + deliverables/versions + generate) that proves the "us" value before chasing full PM parity with Wrike/Monday.
- **Overlap discipline.** Every place we're tempted to rebuild Frame.io/Drive/Wrike, link instead.
- **Naming.** "Studio S" reads as the prompt tool. The us-product may want a new name — open, not urgent.
- **Migration.** Existing project/shot data must map cleanly into the new model without loss.

---

## Decisions
1. **Front door** — ✅ *decided:* hybrid Work dashboard (brand + projects + status).
2. **Core cut for v1** — ⏳ *open:* how much production-management (deliverables, versions, review status, cut registration) to build now vs. after the platform. Proposed v1: source-of-truth model + manual cut/version registration + Frame.io links; auto-ingest & native review deferred to engineering.
3. **Integrate-vs-replace line** — ✅ *decided:* link/embed Frame.io, Drive, Wrike; don't rebuild.
