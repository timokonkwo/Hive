# Landing copy and design audit  -  September 11, 2026

Scope: the current redesigned landing, its linked actions, content modules, and rendered desktop/mobile composition. The user's new instruction approves Unit 03 after these fixes.

## Findings and changes

| Finding | Change |
| --- | --- |
| Three primary buttons said Open app | Use exact Launch App; each opens `/marketplace`. |
| Headings repeated short aspirational slogans without adding product information | Name the task brief, requested output, proposals, service comparison, and work review. |
| Hero role selection sounded like choosing a real provider | Say that selection changes an example; keep the requested interactive 3D artwork. |
| Sample brief checkmarks and “Prepared for your review” looked like delivered work | Remove completion marks and use “Example requirements.” |
| Repeated decorative avatar clusters and an icon/title/body owner grid | Remove the comparison avatar cluster; replace the owner diagram with numbered process rows. |
| Decorative status dot and second background dot pattern | Remove them; retain the interactive hero background and element-level reveals. |
| Brief builder could imply a saved or transferred draft | Explicitly state that it does not save or post. Copy remains a real clipboard action. |
| Owner text could imply registration guarantees work | State the actual sequence: list, propose, then submit after selection. |
| Secondary language used “fit,” “work ahead,” and other filler | Replace with concrete services, tasks, requirements, and review language. |

## Product boundaries

The landing examples describe requested work, not verified providers or completed orders. The public marketplace is tasks, with Agents as a separate directory. The task flow supports proposals, assignment, submission, review, and change requests. No invented traffic, earnings, rating, availability, endorsement, or Robinhood launch claim appears on the landing.

The Hero remains the one main illustration; it has a useful category-selection interaction. The brief tool, manual guide, comparison checks, and FAQ each serve a distinct user action. The page retains eight sections rather than filling its length with feature cards. Existing Hive branding, light/dark mode, responsive navigation, pause/reduced-motion support, smooth anchors, and deeper text/element reveals remain required.

The copy follows the project's plain-language/STE sentence-length rules. Full ASD-STE100 dictionary certification is not claimed.

## Validation

Production build, TypeScript, and scoped redesign lint passed. All 54 landing browser checks passed. The mobile audit passed 24 layout/theme combinations, 14 touch selections, short-screen navigation, enlarged text, smooth anchors, and reduced motion. Reviewed full-page desktop and phone captures. CTA destinations, clipboard behavior, guide controls, theme persistence, fine-grained reveals, and WebGL fallback passed.

Preview: http://localhost:3100/ . Evidence: `/private/tmp/hive-redesign-qa/interaction-results.json`, `mobile-audit.json`, `light-1440-full.png`, and `dark-390.png`. These are local production/Chrome-emulation results, not physical-device or deployment proof. Changes remain local on `main_redesign`.


## September 12  -  Agent roles and copy reduction

The previous owner sequence addressed the reader as both owner and worker. It now names the actor in every step: **You list the agent**, **Your agent proposes**, **Your agent delivers**. Setup/access belongs to the owner; proposals and submitted work belong to the AI agent. The FAQ answers who applies, and the hiring guide identifies proposals as agent proposals. This supersedes the earlier ambiguous “list, propose, then submit” description.

Audited all landing copy modules and searched registration, owner, task and documentation surfaces for application/submission/delivery language. Agent-session action forms and agent-specific API/SDK instructions still describe actions available to the agent; they are not owner onboarding instructions. No backend behavior was changed.

Removed the repeated hero category-link row, section instructions that restated their controls, duplicate example descriptions, repeated closing CTA explanation, footer tagline and decorative closing logo. Shortened brief labels and FAQ answers. Comparison headings now name service/output, completed tasks/reviews, and scope/price/timing. Examples remain labeled; the brief still states that it is not saved or posted. All eight sections and their useful interactions remain.

Production build, TypeScript and scoped lint passed. All 59 landing browser checks passed, including owner-role wording, example labels, draft behavior, category/guide/comparison controls, clipboard, FAQ keyboard operation, theme persistence, 320–1440px overflow, element reveals, reduced motion and WebGL fallback. Full-page light desktop and dark mobile captures were reviewed. Evidence: `/private/tmp/hive-redesign-qa/interaction-results.json`, `landing-copy-light-1440.png` and `landing-copy-dark-390.png`. These are local Chrome checks; no deployment was performed.
