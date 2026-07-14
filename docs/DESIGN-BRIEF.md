# Studio S — Design Brief (for Claude's design program)

Paste this whole file into Claude's design program as the brief, then ask it to generate hi-fi screens (start with **Onboarding**, then Projects, Prompt Builder, Palmier, Finishing). Goal: redesign the app so it stops looking "wireframe-y / unfinished" and matches **Supergood's real, clean brand**.

## The product
Studio S is a native macOS (Tauri) desktop app — Supergood's standardized **image-to-video workflow**: Claude (ideate) → Studio S (prompts → stills → image-to-video → music/SFX) → Palmier (AI edit/assembly) → Finishing (Premiere edit / DaVinci color / After Effects motion). Users are ad-agency creatives.

## Brand truth (source: gosupergood.com)
The real Supergood brand is **clean, light, minimal** — NOT the saturated electric-blue field the app currently uses.
- Predominantly **white / light backgrounds**, dark text.
- **Sentence case** headlines (e.g. "Built to be different"). Never ALL CAPS.
- Modern sans-serif; clear hierarchy; generous **whitespace**.
- **Card-based, modular** layout.
- **Color photography**, natural light (not B&W collage as wallpaper).
- Minimal ornamentation. Tone: premium but accessible — "real human talent and super smart AI."

The expressive Supergood assets (electric blue, red specks, rotating "SUPERGOOD · SUPERGOOD" badge, squiggle-S, B&W team collage) are REAL but used as **accents and 1–2 hero moments**, on a light canvas — not as the whole field. Neither full-saturated-blue nor dark mode.

## Design principles
1. Light canvas, white cards, depth from hairline borders + subtle gray — not heavy color.
2. Sentence case everywhere. Kill the tiny ALL-CAPS monospace labels.
3. Whitespace and modular cards; let content breathe.
4. Color is earned: one clear primary action per view; accents reserved.
5. Real imagery (the user's stills/refs) lives in the cards.
6. Save bold brand expression (electric-blue hero band + specks + rotating badge) for 1–2 moments — primarily the **onboarding welcome**.

## Tokens (starting point — refine in the design program)
- **Surfaces**: page `#F6F6F3` (warm off-white), card `#FFFFFF`, subtle fill `#F0F1F4`. Hairline border `rgba(20,20,40,0.10)`.
- **Text**: primary `#16161D`, secondary `#5A5A6B`, tertiary `#9A9AA8`.
- **Accent — electric blue** `#2626CF` (primary buttons, active nav/state). Hover a touch darker.
- **Accent — red** `#FF3D1E` (ONE reserved accent: progress, alerts, the speck motif). Don't pair blue+red as equals in the same component.
- **Semantic**: done/green `#1D9E75`.
- **Type**: confirm the exact Supergood brand sans; fallback a modern grotesque (Inter / similar). Sizes: page title ~22px/500, section/card title 14px/500, body 13–14px/400, eyebrow 11–12px/regular. Two weights (400/500).
- **Radius**: cards 12px, controls 8–10px. **Spacing**: 16–20px gutters, rem-based vertical rhythm.

## Components
- **Buttons**: primary = solid electric blue, white text. Secondary = ghost (hairline border, neutral text). One primary per view.
- **Cards**: white, hairline border, 12px radius, ~16px padding. Optional color-photo header for concepts.
- **Nav**: light left rail; active item = blue text + soft blue tint; grouped (Create / Manage / Edit & Handoff / Help) with small sentence-case group labels.
- **Inputs/checklists/progress**: neutral, thin; green check for done; thin red progress fill.

## Screens / IA
Nav: Prompt Builder, References, Multi-Shot, OmniEdit · Projects · Palmier · Finishing · Workflow Guide · AI Setup.
- **Onboarding (ANCHOR, gated full-screen)**: 5 steps — welcome → basics → plan with Claude (point at assets folder; Claude writes a plan file; app scaffolds concepts/shots/to-do) → pipeline orientation → done. This is where ONE bold electric-blue hero moment belongs (welcome). Other steps: clean/light forms.
- **Projects**: hub — project header, "Project to-do" card, video concept cards (with color stills), production progress.
- **Prompt Builder**: 6-step wizard + right rail (prompt strength + a compact project-to-do mirror).
- **Palmier**: kickoff prompt + JSON sync + version guidance.
- **Finishing**: Premiere/DaVinci/AE roles + handoff checklist.

## Deliverables wanted from the design program
1. A visual system sheet (surfaces, color, type scale, buttons, card, nav, states).
2. Hi-fi mockups: Onboarding (welcome + plan step), Projects, Prompt Builder. Light/clean, sentence case, accents-only.
3. Export as images and, if possible, the color/spacing/type specs so it can be implemented in HTML/CSS.

## Implementation note
The app is one self-contained HTML file (inline CSS/JS). Designs will be hand-translated to HTML/CSS, so concrete tokens (hex, px, spacing) are more useful than abstract style.
