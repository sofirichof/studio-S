# Studio S — QA Review (v0.2.0)

**Reviewer:** AI filmmaking intern (fresh eyes, first week)
**Date:** 2026-07-01
**Build under test:** shipped `Studio S.app` v0.2.0
**Source of truth:** `~/Claude/Projects/Rotation 4 social - USB/studio-s/src`
**Method:** served `src/` over a local static server, drove it in a real browser at 1512×950, and read the shipped JS/HTML + Rust backend.

> ⚠️ **Version note:** `~/Downloads/Studio S app` is a **stale Jun 28 copy** (still contains OmniEdit, uses the old dark theme). Do not review against it. All findings below are against `src/`, which matches the installed v0.2.0 binary.

**Evidence tags:** `[live]` = I saw it happen in the running app · `[code]` = confirmed by reading source.

---

## Intended flow (as designed) — and does it work?

**Design intent** (confirmed in code + comments): first open → onboarding once; **every** open after shows the splash animation ("normal launch always shows the welcome video first," `index.html:344`), and clicking **Get started** drops a configured user straight into Projects, skipping setup (`goStep1`, `index.html:469`). Splash-on-every-launch is **intended, not a bug.**

**Verified live:** with a saved Claude key, splash → Get started → **Projects** — onboarding correctly bypassed. ✅ Works as designed.

**The catch:** the entire bypass hinges on `isConfigured() = configured && claudeApiKey` (`store.js:84`) — i.e. **a saved Claude key is the "you're onboarded" flag.** If there's no key, the bypass silently fails and you re-onboard forever. See #2 — this is the one thing standing between the intended flow and a frustrated user.

---

## Severity summary

| # | Finding | Severity | Evidence |
|---|---------|----------|----------|
| 2 | No-key user never gets "configured" → re-onboards every launch | 🔴 High | **live + code** |
| 3 | First click after any page load/nav is silently dropped | 🔴 High | live (2×) |
| 1 | Claude API key is the onboarding sentinel but is never used for anything else | 🟡 Med | code |
| 4 | Onboarding "Continue" gates with no feedback | 🟡 Med | live |
| 5 | No real per-model prompt compiler (MVP feature) | 🟡 Med | code |
| 6 | Dead Tauri boilerplate (`main.js`) in the bundle | 🟢 Low | code |

---

## 🔴 High severity

### 2. No-key user never gets "configured" → re-onboards on every launch `[live + code]`
This is the one directly breaking the intended "onboard once, splash-and-go forever after" flow.

- `finishSetup()` calls `Store.markConfigured()` → sets `configured: true` (`index.html:649`, `store.js:86`).
- `saveBasics()` only persists the key `if (key)` (`index.html:643`).
- `isConfigured()` returns `configured && claudeApiKey` (`store.js:84`) — **both** required.
- Nothing in `goNext` forces a key (#4), so a keyless finish is a normal, reachable path.

**Verified live:** seeded storage with `configured:true` and an empty key → `Store.isConfigured()` returns **`false`** while raw `configured` is **`true`**. In that state `goStep1` (`index.html:469`) never short-circuits to Projects, so **every launch dumps the user back into setup.** `markConfigured()` is effectively dead/misleading — setting `configured:true` alone can never satisfy the gate.

**Red flag:** the product's "you only set this up once" promise silently fails for anyone who doesn't paste a key — and pasting a key isn't enforced.

**Suggestions (pick one):**
- Make `isConfigured()` depend on `configured` alone (if the key is genuinely optional), **or**
- Require the key in `goNext` before allowing finish (with visible feedback — see #4), **or**
- Add a dedicated `onboardingComplete` flag that survives independent of the key, and gate the bypass on that instead of overloading the key.

### 3. First interaction after a page load/nav is silently dropped `[live, reproduced 2×]`
On the splash, my first "Get started" click did nothing; on Step 1, my first "Continue" clicks did nothing. Second attempts always worked. `support.js` binds the `{{ handler }}` templates *after* first paint, so the earliest click hits an unbound element and is lost with no error.

**Red flag:** on a cold start this reads as "the app is frozen" — the worst possible first impression, and it's on the very first button a new user touches.

**Suggestions:**
- Bind handlers before paint, or render buttons `disabled` until hydration completes, then enable.
- Add a lightweight "ready" flag so no click is silently swallowed.

---

## 🟡 Medium severity

### 1. The Claude key is the onboarding sentinel — but is never used for anything else `[code]`
Onboarding frames the key as one of "the three things the studio needs to run," and it *is* load-bearing — but only as the `isConfigured()` flag (#2), not as a working credential. The Rust backend ships a working proxy (`anthropic_messages`, `src-tauri/src/lib.rs:6`, POSTs `api.anthropic.com/v1/messages`), yet **the frontend never invokes it.** The only `invoke()` calls in `src/` are `scan_plan_folder` (×2) and the orphaned `greet` (#6). The real AI step is the honest copy-paste workflow ("Plan with Claude" → paste into Claude.ai → `scan_plan_folder` reads `studio-s-plan.json`), which needs no in-app key.

**Red flag:** using "has a key" as a proxy for "is onboarded" is fragile — clearing storage or the key silently re-triggers onboarding, and users paste a secret the app never spends.

**Suggestions:**
- Decouple onboarding-complete from the key (see #2's third option).
- Then either wire the key to the existing proxy (obvious first uses: "improve my wording" / the per-model compile in #5 — backend's already done, it's one `invoke()`), or label the field "optional — for upcoming AI features."

### 4. Onboarding "Continue" gates with no feedback `[live]`
`goNext` (`index.html:473`) has **no validation at all** — it just increments the step. So the only reason Continue ever "fails" is the hydration race (#3), and the user gets zero feedback in either case: no inline error, no disabled state, no "pick a folder first."

Also: the "Choose folder" picker is a Tauri dialog (`pickDir`), so onboarding **cannot be completed in a browser** — expected for a native app, but there's no hint, so anyone testing outside the bundle hits a dead end.

**Suggestions:**
- Decide what's actually required and enforce it in `goNext`, with a visible inline message.
- Disable Continue until requirements are met (doubles as mitigation for #3).

### 5. No real per-model prompt compiler `[code]`
The handoff's #1 MVP feature isn't built. Review's "one brief, compiled into each model's native phrasing" is **curated static strings** (`promptbuilder.html:566`), and the UI honestly admits *"Direct generation isn't connected yet"* (`promptbuilder.html:955`).

This is a fine, honest stopgap — just don't let the marketing copy outrun it. When #1 is wired, this is the highest-leverage place to actually spend the Claude key.

**Suggestion:** build the compiler as the first consumer of the `anthropic_messages` proxy — capture the brief (subject/env/look/camera/composition/realism/crowd) and emit per-model phrasing from a model-profile table.

---

## 🟢 Low severity / cleanup

### 6. Dead Tauri boilerplate shipping in the bundle `[code]`
`src/main.js` is untouched starter code: calls `invoke("greet")` and binds `#greet-form`/`#greet-input`/`#greet-msg`, none of which exist. It's currently **orphaned** (no page loads it), so harmless today — but if anyone adds `<script src="main.js">`, it throws `TypeError` on `DOMContentLoaded`.

**Suggestion:** delete `src/main.js`.

---

## ✅ What's working well
- **Honest onboarding copy.** I braced for fake "AI mode · connected" status strings (they exist in the stale Downloads build) — they're **gone** here. Only truthful "Plan with Claude" language remains. Good.
- **On-brand, light-themed setup.** Correct tokens (`#F6F6F4` page, `#0217D3` blue), matching the design system — a real improvement over the old dark builder.
- **Solid navigation architecture.** `nav.js` uses a single delegated click handler (never goes stale) and centrally hides the removed OmniEdit row instead of editing every page. Clean.
- **Backend is ahead of the frontend.** The Rust Anthropic proxy and `scan_plan_folder` are done and correct — the gap in #1 is purely a missing frontend call, which is the good kind of gap.

---

## Coverage / what I did NOT test
- Verified **live:** splash → onboarding Steps 1–2, the hydration race, silent gating.
- Verified **by code:** key/config logic, compiler, nav, backend commands, orphaned `main.js`.
- **Not exercised end-to-end:** Projects, References, Multi-Shot, Palmier, Finishing. The Tauri-only folder picker blocks onboarding completion in a browser, so I couldn't reach the configured-app state without stubbing `Store`.

**Recommended next pass:** stub `Store.isConfigured()` (or seed `localStorage`) to bypass onboarding, then drive the full post-setup app — Projects CRUD, shot builder → generate, Palmier hand-off, Finishing — and log a second round.

---

## Suggested priority order
1. **#2** onboarding loop — directly breaks the "onboard once" promise; decouple the flag from the key. Trivial, high impact.
2. **#3** hydration race — first thing every user hits; makes even a working bypass feel broken.
3. **#4** validation feedback — cheap, and removes the ambiguity behind #2/#3.
4. **#1** wire the key to the proxy — turns a dead input into real value.
5. **#5** build the compiler on top of #1.
6. **#6** delete dead code.

## Verification note
Onboarding bypass and the keyless-loop bug were verified live by seeding `localStorage['aifs.v1']`. The splash-every-launch behavior is intended; the bypass works when a key is saved; it fails when a key is not.
