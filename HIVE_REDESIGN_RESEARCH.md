# Hive redesign research

Research date: 2026-09-11. This document describes a new direction. Prior Hive design plans are not design authority for this branch.

## Supplied local references

| Source | Inspected information | Design decision |
| --- | --- | --- |
| `/Users/tim/Coding/vibecoding/Design styles/design-guides.md` | Component sources, coss UI, Utopia, iconcreator, interaction references | Use consistent iconography, semantic controls, fluid type, and an explicit token scale. Do not collect unrelated effects. |
| `/Users/tim/Coding/vibecoding/Design styles/AI Agent.md` | Alden: controlled color, type hierarchy, functional mockups, quiet surfaces | Use restraint and concrete output illustrations. Reject the healthcare palette, centered sequence, repeated cards, and inherited brand. |
| `/Users/tim/Coding/vibecoding/Design styles/inspiration.md` | Dala, Steep, and other style references; large typography, editorial sections, particle art, diagrams | Use type scale and section rhythm. Reject multicolor clouds, copied compositions, promotional metrics, and generic feature grids. |

## External sources and applied decisions

### Robinhood

Source: https://robinhood.com/us/en/

Read the public page and inspected its delivered CSS color values. `#CCFF00`, `#110E08`, and white are present. Use the lime as an accent with dark text. Retain the existing Hive mark and different page composition. Color affinity does not imply affiliation.

Source: https://docs.robinhood.com/chain/deploy-smart-contracts/

The current official documentation provides chain deployment information. This is infrastructure documentation, not evidence of Hive's deployment. The landing will not state “live on Robinhood” or present an invented token address. The token page unit has an explicit evidence gate.

### Rare UI

Sources:
- https://www.rareui.com/components
- https://www.rareui.com/components/stepplayer
- https://www.rareui.com/components/scrollprogressindicator

The Step Player supports manual seeking and a clear current step. Apply that interaction principle to the hiring guide, with named stages and no automatic playback. Scroll Progress informed restrained progress feedback. The guide implementation is original GSAP/React code, not an imported Rare UI component. Reject animated counters because the landing has no verified number to present. Reject fluid orbs, gooey navigation, and gravity text for this product.

### ThreeUI

Sources:
- https://threeui.com/
- https://threeui.com/backgrounds/liquid-form
- https://threeui.com/three-js/structure-flow
- https://threeui.com/terms

The homepage is client-rendered, so the public catalog metadata and Liquid Form thumbnail were inspected directly. Liquid Form demonstrates studio metal reflections and smoothed pointer response. Structure Flow demonstrates geometry-based scenes and bounded renderer controls. Use these material and interaction ideas for geometry derived from the established Hive SVG. Do not copy paid code or republish a reference asset. Record the implementation as ThreeUI-inspired, built with Three.js. The Hive artwork is an identity sculpture, not an activity indicator.

### Component and icon references

Sources:
- https://coss.com/ui/docs/components/button
- https://coss.com/ui/docs/components/accordion
- https://iconcreator.dev/
- https://utopia.fyi/

Use the coss UI approach to accessible buttons and inline disclosures. Use one Lucide icon family as in the reference examples. Use Utopia's fluid-scaling principle, with explicit `clamp()` limits. The existing Hive mark is brand artwork rather than an icon-library asset. No generic component theme is imported wholesale.

### Avatars

Sources:
- https://www.dicebear.com/
- https://www.dicebear.com/styles/bottts/
- https://www.dicebear.com/licenses/

Use deterministic Bottts avatars with local SVG files so the landing does not depend on a remote avatar request. Record generation seeds, upstream version and URLs in the asset attribution file. Avatars identify the illustrative role in each example; they do not stand for fabricated marketplace sellers. Bottts is by Pablo Stanley; retain its license information with the assets.

### Typography

Sources:
- https://fonts.google.com/specimen/Manrope
- https://github.com/google/fonts/tree/main/ofl/manrope

Use new local Manrope assets, with their OFL license. Its open counters and wide lowercase forms support large, plain headings and legible smaller labels. Do not reuse the existing Montserrat font on the landing.

### Motion and accessibility

Sources:
- https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- https://threejs.org/docs/#api/en/renderers/WebGLRenderer
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

Use scoped motion contexts, cleanup, native buttons, and reduced-motion alternatives. 3D motion must not prevent reading or selecting an action. Test no-WebGL and reduced-motion paths in the browser.

### ASD-STE100

Sources:
- https://www.asd-ste100.org/
- https://www.asd-ste100.org/about.html

The official site identifies Issue 9 and describes controlled technical English. The full dictionary requires an official copy and is not present in the supplied material. Apply short sentences, active voice, consistent nouns and direct instructions; do not claim a formal dictionary-compliance audit without that text.

Working product nouns: Hive (proper name); AI agent (software that performs a task); task (requested work); brief (task description); proposal (agent's offer to do the task); output (submitted work); review (inspection of submitted work); budget (amount available for a task); marketplace (place to find agents or tasks); USDC (proper token name, only in verified payment context).

## Repository evidence

Base commit: `72f793c`. `git status --short` was empty before branching. Source remote: `https://github.com/timokonkwo/Hive.git`.

- `app/marketplace/page.tsx`: tasks API, category/status filters, pagination.
- `app/agents/page.tsx`: leaderboard API, search and sort.
- `app/create/page.tsx`: task brief, budget, draft, optional direct hire, submission.
- `app/marketplace/[taskId]/page.tsx`: proposals, task lifecycle, work review and messages.
- `components/providers/Providers.tsx`: existing auth and wallet provider boundaries.
- `app/overview/page.tsx`, `app/feed/page.tsx`, `app/leaderboard/page.tsx`, `app/token/page.tsx`: redirect routes.

These files establish route and action contracts only. Their layout, cards, artwork, flow, and copy are not inputs to the new landing composition.

## Open questions for later units

1. Token deployment, contract, supply and migration details: needed for Unit 17; not needed to design the landing.
2. Agent service pricing and availability fields: verify endpoint schema before Unit 03.
3. Public proof and samples: require a attributable data source before displaying real provider claims.
4. The full STE Issue 9 dictionary: needed for formal lexical verification before publication.
5. Native app distribution: this repository is a Next.js web app. The plan covers the responsive web app. Native applications need a separate platform scope if requested.
