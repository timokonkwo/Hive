# Hive website and app redesign

Date: 2026-09-11. Branch: `main_redesign`. Base: local `main`, `72f793c`.

## Brand identity correction

The user explicitly confirmed that the existing Hive logo must be kept. Use `public/images/hive-icon.svg` and the established favicon assets. Do not introduce a substitute brand identity. The user subsequently authorized replacing the hero logo with an interactive 3D element that represents AI agents. The navigation and footer retain Hive's logo.

## Landing expansion requested during review

- Replace the hero logo with a pointer-responsive 3D agent scene informed by ThreeUI's Logic Core/material studies. Add visible, keyboard-accessible role controls that select an agent and change the scene.
- Add a fine interactive background field and clear page reveals. Use GSAP to sequence headings, document illustrations, rows, and connective drawings on scroll. Support reduced motion and a global pause control.
- Extend the page with three useful sections: an interactive task-brief builder, guidance for comparing agents, and a section for agent owners. Do not add invented metrics or repetitive feature cards.
- The brief builder is a real local writing tool: editable task/requirements, scope choice, generated brief preview, and working copy. Posting opens the existing task form; there is no claim of automatic submission.
- Keep both themes and verify new controls, field labels, errors, clipboard failure, keyboard access, motion cleanup, and mobile behavior.
- These revisions belonged to Unit 01. The user approved progression afterward; the current review gate is recorded below.

## Scope and approval

Build a new visual system, navigation, page structure, components, illustrations, and motion. The old website is not a design source. Read existing code only to identify routes, data contracts, permissions, and supported actions. Do not import old presentation components into a redesigned page.

The user approved progression beyond the landing on September 11 and continued through Units 02–09. The user approved Unit 13 (agent recovery) with “Continue” after deferring paid X API setup. The user requested the next unit with “What’s next?” after the recovery handoff. The user approved Unit 15 with “Continue.” The user approved progression to Unit 16 with “Continue.” **Report Disputes for review before starting Unit 17 (token and staking).** The original-Hive-hero checkpoint `4519a58` was pushed to `origin/main_redesign` at the user’s request. Subsequent redesign changes remain local.

- [x] Inspect the repository and preserve the existing branch.
- [x] Create `main_redesign` from `main` with a clean working tree.
- [x] Read the three supplied reference files and inspect the selected external references.
- [x] Inventory all 25 page routes, including four redirects.
- [x] Define the new direction, page contracts, motion, copy, and acceptance gates.
- [x] Build and validate Unit 01: landing page.
- [x] Obtain explicit landing-page approval from the user (September 11: “Continue to the next page”).
- [x] Start Unit 02 after approval; see `HIVE_MARKETPLACE_BRIEF.md`.
- [x] Implement and validate Unit 02 and shared app navigation.
- [x] User authorized progression to Unit 03 after the landing audit.
- [x] Audit landing copy, visual cues, and primary Launch App actions; see `HIVE_LANDING_AUDIT.md`.
- [x] Research and implement Unit 03; see `HIVE_AGENTS_BRIEF.md`.
- [x] Complete Unit 03 final validation and report for review.
- [x] User approved progression to Unit 04.
- [x] Research and implement Unit 04; see `HIVE_PROFILE_BRIEF.md`.
- [x] Complete Unit 04 browser and visual validation.
- [x] User approved progression to Unit 05; add profile and directory rating stars.
- [x] Research and implement Unit 05; see `HIVE_CREATE_TASK_BRIEF.md`.
- [x] Validate Unit 05 browser, data, and assignment contracts.
- [x] User approved Unit 06 after create task; implement and validate task detail.
- [x] User approved Unit 07; implement and validate My tasks.
- [x] User approved Unit 08; implement and validate List agent and the updated wallet direction.
- [x] User approved Unit 09; implement and validate My agents.
- [x] User approved Unit 10; research, implement and validate Owner tools.
- [x] User approved Unit 11 with “Continue” after Owner tools.
- [x] Research, implement and validate Unit 11; see `HIVE_WALLET_BRIEF.md`.
- [x] User requested the next unit after wallet settings.
- [x] Research, implement and validate Unit 12; see `HIVE_VERIFY_BRIEF.md`.
- [x] User approved Unit 13 after deferring X API setup.
- [x] Research and implement Unit 13; see `HIVE_RECOVERY_BRIEF.md`.
- [x] Complete Unit 13 final validation and report for review.
- [x] User requested Unit 14 after the recovery handoff.
- [x] Research and implement Unit 14; see `HIVE_REGISTRY_BRIEF.md`.
- [x] Complete Unit 14 final validation and report for review.
- [x] User approved Unit 15 after the tool-directory handoff.
- [x] Research and implement Analytics; see `HIVE_ANALYTICS_BRIEF.md`.
- [x] Complete Unit 15 final validation and report for review.
- [x] User approved progression from Analytics to Disputes with “Continue.”
- [x] Research, implement and validate Unit 16; see `HIVE_DISPUTES_BRIEF.md`.
- [ ] User review of Disputes before token and staking.

## Research and decisions

Evidence and source links are in `HIVE_REDESIGN_RESEARCH.md`. Research is a design input, not permission to duplicate a reference website.

### Direction

An editorial marketplace with a sculptural identity. Use a near-black opening, warm white reading sections, and Robinhood's observed `#CCFF00` accent. Use a new Manrope font, light and dark modes, flat surfaces, oversized left-aligned type, visible separators, and a clear action at each decision. Use an interactive 3D agent group as the principal artwork. Four selectable agent roles surround a central agent. Retain the existing Hive logo in the navigation and footer.

Density: spacious public pages; comfortable forms; compact work lists. Surface: full-width sections, open rows, and functional document views. Type: clear, large, restrained. Motion: deliberate assembly and short responses to input.

Do: make tasks and outputs specific; use the established Hive geometry; use DiceBear agent avatars; preserve readable text over plain backgrounds; give primary actions strong contrast. Do not: use decorative feature cards, rainbow gradients, hexagon wallpaper, network orbs, floating statistics, scrolling tickers, fake reviews, token charts without real data, copied screenshots, or an imitation Robinhood logo.

### Verified product boundaries

- `main` has task creation, proposals, assignment, delivery, review, messages, and payment routes. Its payment UI references Solana/USDC. This is code evidence, not a new end-to-end runtime certification.
- `/marketplace` is currently a task list. `/agents` currently uses `/api/leaderboard`. The future design must present discovery clearly while preserving both audiences.
- Registration, owner tools, reputation, disputes, staking, analytics, and admin pages exist. These are separate page units with separate access rules.
- The user's intended $HIVE launch on Robinhood Chain is a product requirement. This checkout does not establish a deployed Hive contract or functioning Robinhood payment path. Do not publish an address, price, availability claim, Robinhood endorsement, or buy action based on that intent.
- Landing examples are editorial sample briefs. They are not named marketplace providers, completed work, performance records, or purchasable offers.
- A landing CTA may open an existing route. It must not imply that the destination has already been redesigned.

## New foundation

### Light and dark modes

User requirement confirmed during planning: deliver both light and dark mode on the landing and every later approved page. Start from the system preference. Provide a visible theme switch and persist explicit choices locally. Respond to system changes until the visitor chooses a mode. Check both palettes, illustrations, focus rings, contrast, and reduced motion. The landing approval gate remains mandatory; the user reconfirmed that no other page may start before their go-ahead.

### Tokens

| Role | Decision |
| --- | --- |
| Dark canvas | `#11140F` |
| Dark raised surface | `#1C2118` |
| Primary accent | `#CCFF00`; dark ink for text on this fill |
| Reading canvas | `#F5F5EF` |
| Paper | `#FFFFFF` |
| Main ink | `#182015` |
| Secondary text | `#5A6254` on light; `#B5BCAD` on dark |
| Rules | `#D6DACE` on light; `#3B4333` on dark |
| Font | New local Manrope files; regular, medium, semibold |
| Type | Fluid display and section titles; 16–18px body; 12–14px labels |
| Spacing | 4px base; fluid 24–64px page gutters; 80–128px section gaps |
| Shape | Flat sections; 12px document corners; pill actions; round avatars |
| Icons | One consistent Lucide set, as used by coss UI reference examples |

Namespace the landing CSS. Keep old global typography and effects out of the new page. Isolate the home route from the old provider/background shell. Only introduce the common app shell when the user approves the landing direction.

### Component plan

New modules: site header, wrapper for the existing Hive logo, action link, 3D mark, work-example selector, document illustration, step navigator, FAQ rows, and footer. Content definitions stay separate from rendering. Each component has a narrow responsibility. Extract app primitives only when a second approved page needs them.

### Motion contract

- GSAP: initial artwork assembly, bounded entrance choreography, user-selected example transitions, step-progress movement, and a slow scroll response on the artwork. Do not intercept wheel input or pin reading text.
- ThreeUI inspiration: the material study in Liquid Form and connected scene structure in Logic Core. Build original 3D agent geometry in Three.js; do not claim that original code is a copied ThreeUI package.
- Rare UI inspiration: seekable Step Player and its clear current-step indicator. Adapt it into a manual guide with visible numbered labels. No automatic advancement while the user reads.
- Use `gsap.matchMedia` for reduced motion and breakpoint cleanup. Reduced motion means immediate changes and a static illustration.
- Load WebGL after page content. Render a static SVG mark before loading, on context loss, and when WebGL is unavailable. Text and actions must work without the renderer.
- Cap pixel ratio at 1.5. Pause rendering outside the hero and in background tabs. Dispose geometries, materials, observers, timers, renderer, and GSAP context on unmount.
- Motion controls must stop the artwork. Pointer motion is optional decoration, never the only way to use a feature.

### Copy contract: ASD-STE100

Use one idea per sentence, active voice, consistent nouns, concrete verbs, and short instructions. Use the imperative for actions. Keep instructions within 20 words and descriptions within 25 words per sentence. Define product technical nouns in `HIVE_REDESIGN_RESEARCH.md` and use them consistently.

Avoid: pulse, live on Robinhood, settlement, trustless, seamless, unlock, next-generation, revolutionize, ecosystem, powered by, route ready, and developer implementation details in consumer pages. Avoid unverifiable adjectives, unsupported speed claims, invented usage counts, and made-up testimonials.

The official STE site provides an overview, but the full Issue 9 dictionary is not supplied in the repository. Record this limit: a plain-language review is not a formal full-dictionary certification. Full lexical verification remains a publication check when the official dictionary is available.

## Page-by-page units

Each unit follows: inspect its current data and action contracts → write a route brief → design responsive composition → implement new modules → verify states, access, and behavior → review the rendered page → update this tracker. The layout below is an implementation specification, subject to the landing approval and each route's verified capabilities.

### Unit 01  -  Landing `/`

Purpose: explain Hive and help a visitor choose between finding an agent and listing an agent. Primary action: Launch App → `/marketplace`. Secondary action: How it works → the guide on this page.

New page sequence:

1. Header: existing Hive logo and name; Work examples and How it works anchors; List your agent link; compact Launch App action. On phones, retain the primary action and put secondary links in a keyboard-safe disclosure.
2. Hero: left-aligned headline “Put AI agents to work.”, one brief description, two actions. The right side contains a 3D agent group with lime and metallic surfaces, selectable roles, and an interactive contour background. Keep the entire headline readable before motion starts. A small bottom index introduces research, development, design, and content.
3. Work examples: light full-width surface. Left side is a large, selectable category index. Right side is one editorial brief/document illustration. Show a concrete brief and requested output for each category. Use a DiceBear avatar beside the category role, not as fabricated proof of a provider. Explicitly label the content “Example brief.” Switching categories changes all associated text and artwork.
4. Hiring guide: a continuous horizontal/vertical composition with manual stages: Describe the task, Choose an agent, Review the work. Show one stage at a time and an accessible current-step indicator. No three-card feature grid. State only supported actions.
5. Questions: a short list of useful questions about tasks, browsing, reviewing, and listing an agent. Expand inline; do not force a modal.
6. Closing action: a large lime section with “Start with a task.” and actions to browse agents or post a task. New footer with product, agent, and help links.

Responsive: on desktop, unequal two-column hero and examples. On tablets, reduce display scale and artwork. On phones, text precedes the art, example controls wrap, documents fit the viewport, and all guide steps remain reachable. No horizontal page overflow.

States: mobile menu closed/open; selected category; selected guide stage; FAQ collapsed/expanded; motion running/stopped; reduced motion; loading 3D; no WebGL; no JavaScript. No API fetch is necessary to understand the landing page.

Checks: 375/390/768/1280/1440px; keyboard and Escape; anchors and route links; visible focus; image loading; local fonts; contrast; reduced motion; renderer failure; no legacy presentation imports; no banned copy; lint, typecheck, production build; console and browser interaction checks. Gate: deliver local preview and screenshots, then stop for user approval.

### Unit 02  -  Marketplace `/marketplace`

Purpose: find work or an agent with a clear distinction between both. Page brief must resolve the relationship with `/agents` before editing. Keep `/marketplace` as available tasks unless a route migration is explicitly chosen.

Layout: full-width work index, search toolbar, category filter, compact task rows, detail preview on large screens. Each row shows task, category, budget, deadline if supplied, proposals, and status. On phones, arrange these facts in a readable two-line row; do not hide budget.

Actions: search, filter, sort, paginate, open task, post a task. Data: `/api/tasks`, task categories and status contract. States: loading rows, no tasks, no matches with clear filters, request error with retry, closed task. Motion: short row replacement; no animated rankings. Checks: URL-persisted filters, Back, stale requests, query encoding, empty budgets, long titles, pagination, and honest status.

### Unit 03  -  Agent directory `/agents`

Purpose: choose an agent by service and evidence. Replace ranking-first presentation with a service directory; keep ranking as an explicit sort where the API supports it.

Layout: search by name or skill, plus reputation/completed-task sorting above a comparison list. Each result shows DiceBear identity or supplied avatar, service description, available price basis, completed work, review count, and supported reputation fields. Missing values say “Not listed” or are omitted with context; never invent them.

Actions: search, compare supported fields, sort, open profile. Data: verify `/api/leaderboard` and agent APIs before promising filters. States: loading, empty, no match, failed request, unavailable agent, image failure. Motion: selection and list changes only. Checks: API semantics, no unsupported service filters, names as stable destinations, keyboard search, pagination, mobile field visibility.

### Unit 04  -  Agent profile `/agent/[name]`

Purpose: assess one agent and start a task. Layout: identity header; service scope and price; work evidence and reviews; sticky desktop hiring summary; inline mobile action. Avoid a wall of metrics.

Actions: hire via `/create?agent=...`, inspect reviews and delivered examples if supplied. Data: `/api/agents/by-name/[name]`, verified review sources. States: loading, not found, no reviews, no samples, unavailable agent, missing price. Checks: encoded names, direct hire identity preserved, review provenance, unavailable actions disabled with explanation, no invented output samples.

### Unit 05  -  Create task `/create`

Purpose: submit a clear task. New sequence: brief → requirements and requested output → budget and agent → review. Use one readable form column and an editable summary, not a large category-card grid.

Actions: enter requirements, choose category, optional direct hire, save draft, review, submit. Data: existing draft/create/instant-match endpoints and authentication. Preserve distinct token-launch behavior only after its active contract is checked. States: signed out, saved draft, validation, uploading, submit pending, insufficient requirements, failure, successful task link. Checks: persistent input on Back/reload, duplicate submit prevention, field-level errors, explicit payment expectations, attachment limits, direct-hire identity, narrow-screen keyboard.

### Unit 06  -  Task detail `/marketplace/[taskId]`

Purpose: complete one task. Layout: task header, work brief and output, chronological activity, proposals, and an action rail determined by role and status. Put messages beside the work on desktop and in a named section on mobile.

Actions: propose, accept proposal, assign, submit work, request changes, approve, pay, and message only when allowed by existing state. Data: task, bids, messages, delivery, review, and payment endpoints. States: loading, missing task, each lifecycle stage, signed out, wrong owner, expired proposal, failed payment, revision pending, disputed. Checks: role/state matrix, stale updates, no duplicate payment, exact amounts, attachments, ownership, revision history. No redesign may weaken backend checks.

### Unit 07  -  Client dashboard `/dashboard`

Purpose: see work that needs attention. Layout: an “Action needed” work list, task status tabs, and a compact account section. Move secondary balances and rewards below current work.

Actions: open work, resume drafts, review outputs, manage profile and supported account funds. Data: dashboard, profile, session, points, disputes. States: signed out, first task, loading, no active work, failed section, partial data. Checks: work counts match rows, balances have units, no zero-as-loading, authentication return route, task permissions.

### Unit 08  -  List agent `/agent/register`

Purpose: publish a useful service listing. Audited sequence: listing details → review → save access details → activate. Show technical fields only where the owner must act on them. The registration contract has no price, endpoint or fee field; token launch stays in owner tools.

Actions: choose name/avatar/services, add optional links and wallet, review, create, save credentials, activate. Data: name checks and registration/confirm. States: name checking/taken, field errors, unknown creation outcome, created, activation error, active. Checks: race-safe name validation, retained non-secret input, signed EVM ownership, Solana compatibility, private credentials, and explicit activation.

### Unit 09  -  Agent owner dashboard `/agent/dashboard`

Purpose: manage the agent's work. Layout: assigned work first, opportunities next, then earnings and service settings. Replace the hub-style collection of cards with task-oriented lists and named sections.

Actions: inspect assignments and opportunities, update supported settings, manage plugins, inspect payments. Sensitive key and PIN actions require deliberate confirmation. Data: me, opportunities, plugins, payments. States: no identity, unauthorized, first listing, busy, unavailable API, no payments. Checks: ownership, masked credentials, no unsolicited token creation, complete work links, actionable failures.

### Unit 10  -  Owner tools `/agent/dashboard/tools`

Purpose: register and maintain agent tools. Layout: tool table and one edit sheet/form. Developer information belongs here because the owner needs it. Unit 10 subunits also group the existing webhook controls, agent-token launch and points conversion removed from the old all-in-one dashboard; retain Solana functionality and clearly show the actual network on transactional actions.

Actions: add/edit tools, inspect status, remove only through the supported API, use any supported launch action after its network and cost are checked. States: unauthorized, no tools, checking tool, invalid endpoint, save error. Checks: endpoint validation, access checks, unsaved changes, status timestamps, no duplicated submissions.

### Unit 11  -  Agent wallet settings `/agent/manage/[id]`

Purpose: connect the intended payment wallet. Layout: identity, current wallet, one connection action, and explicit result. States: signed out, wrong owner, connecting, rejected, wrong network, connected, API failure. Checks: exact agent identity, address rendering/copy feedback, supported chain, ownership proof and persistence after reload.

### Unit 12  -  Agent verification `/agent/verify/[id]`

Purpose: prove control of a listing. Layout: agent identity, clear instructions, required action, result. States: checking, missing agent, already verified, awaiting proof, rejected proof, verified, expired claim. Checks: ownership evidence, idempotent retry, clear result, no false verified badge.

### Unit 13  -  Agent recovery `/agent/recover`

Purpose: recover access. Layout: short identity/proof form; separate secret-reveal result. States: invalid proof, rate limit, pending, recovered, copy failure. Checks: no credential in URL, no console logging, no accidental persistence, accessible errors, actual recovery semantics.

### Unit 14  -  Tool directory `/registry`

Purpose: find a tool by capability. Layout: searchable list with category, description, price basis, and supported connection details. Expand a selected row for usage. Actions: search, filter where supported, inspect/copy endpoint. States: loading, empty, API failure, invalid endpoint, no price. Checks: tools versus agents are distinct, copy outcome, useful mobile detail, current status provenance.

### Unit 15  -  Analytics `/analytics`

Purpose: understand actual marketplace activity. Layout: dated overview, primary time-series figure, accessible data table, definitions. Avoid a metric-card grid. Data: `/api/analytics`. States: loading, sparse history, no history, stale results, API failure. Checks: date ranges, timezone, currency, denominators, no extrapolated growth, keyboard chart alternatives, reduced motion.

### Unit 16  -  Disputes `/dao`

Purpose: report and resolve disputed work. Layout: case list, selected evidence, voting/action summary. Actions: report, attach supported evidence, inspect case, vote when eligible. States: signed out, ineligible, no cases, voting open/closed, pending action, failure, resolved. Checks: report ownership, voting rules, deadlines, evidence access, persisted outcomes. Plain language for consumer instructions.

### Unit 17  -  Token and staking `/stake`, `/token`

Purpose: explain verified $HIVE utility and supported staking actions. Layout: token facts and network, wallet position, one staking form, dated activity. `/token` currently redirects to `/stake`; retain or revise after the token product brief is approved.

Required evidence before implementation: official contract address, target network, token availability, migration plan from existing Solana behavior, staking rules, fees, lock terms, wallet support. Do not translate Solana transactions into Robinhood transactions by changing text. States: disconnected, wrong network, unsupported deployment, no balance, amount error, pending, rejected, confirmed. Checks: exact contract/network, decimals, approvals, fees, unlock rules, no fabricated return rates.

### Unit 18  -  Documentation `/docs`

Purpose: help a visitor complete a task or maintain an agent. Layout: product guide first; separate agent-builder reference; left navigation, reading column, on-page contents where useful. Entry topics: find an agent, describe a task, review work, payment, account access. Technical topics follow.

Actions: section navigation, search if backed by a real local index, copy code with feedback. States: no search match, invalid anchor, code overflow. Checks: accurate endpoint examples, valid anchors, mobile contents, STE copy review, factual network details. No API credentials in examples.

### Unit 19  -  Roadmap `/roadmap`

Purpose: distinguish released changes from planned work. Layout: dated vertical release list and a separate planned section. Data: `/api/roadmap`. States: no entries, loading, failure, partial date. Checks: shipped claims backed by evidence, planned features clearly named, no invented launch dates, no automatic checkmarks.

### Unit 20  -  Feedback `/feedback`

Purpose: send a useful report. Layout: focused form with category, message, optional contact if supported, then a receipt state. States: blank/invalid, pending, failure preserving input, received. Checks: labels, rate limits, exact submission response, duplicate prevention, privacy of contact fields.

### Unit 21  -  Admin `/admin`

Purpose: review operational exceptions. Layout: access gate, queue navigation, dense tables, explicit case detail. Actions: existing agent/task/submission/feedback/DAO/staker controls. Destructive actions must show the exact target and effect. States: denied, loading, empty queue, stale data, mutation pending/failed/completed. Checks: authorization on every request, auditable actions, no secrets, no accidental bulk action, pagination and filtering.

### Unit 22  -  Redirects, navigation, and final consistency

`/overview` → `/`, `/feed` → `/`, `/leaderboard` → `/agents`, `/token` → `/stake`. These are verified current redirects, not missing content pages. Preserve inbound links unless an approved information architecture requires a new destination.

Audit every header/footer/mobile route; update canonical metadata, social previews, sitemap and accessibility surfaces where needed. Check generic errors, missing routes, loading boundaries, long names, browser Back/Forward, expired sessions, offline failures, and image fallbacks across all approved pages.

## Validation and delivery gates

1. Every route has a purpose, primary action, input/data contract, access rule, complete state list, responsive composition, and copy review before implementation.
2. Run scoped lint and repository typecheck. Run the production build. Identify pre-existing failures separately from introduced failures.
3. Exercise interactive behavior in a real browser. Static compilation is not interaction proof.
4. Review screenshots at narrow, medium, and wide widths. Verify keyboard order, visible focus, touch targets, text contrast, zoom, reduced motion, and overflow.
5. Verify actual links. Do not add dead buttons, fake search, invented offers, or unsupported wallet actions.
6. Record changed files, checks, screenshots, and unresolved limits in the unit log.
7. Finish Unit 01 with a local preview and a direct request for landing-page approval. Do not start Unit 02 without it.

## Unit log

### Unit 00  -  Research and plan

Completed: repository inspection, branch creation, 25-route inventory, supplied-file review, official component and design research, new direction, evidence boundaries, and per-page specifications.

### Unit 01  -  Landing

Status: implemented and validated; ready for user review. Original-Hive-hero checkpoint pushed as `4519a58`. The expanded landing remains local. The user approved moving to Unit 02 on September 11. See the marketplace brief for the next delivery.

Delivered: eight landing sections, original Hive header/footer logo, interactive 3D agent scene and pointer-responsive background, GSAP entrances and scroll reveals, editable task brief with clipboard recovery, work examples, hiring guide, comparison guide, owner section, FAQ, persistent light/dark themes, mobile navigation, motion pause, reduced-motion behavior, and static renderer fallback.

Validation: production build, TypeScript, scoped landing lint, 48 production browser checks, both themes at 320/375/390/768/1280/1440px, computed text contrast, narrow-header bounds, clipboard error recovery, no-JavaScript content, and WebGL context-loss fallback. Browser checks are repeatable through `scripts/redesign/check-browser.mjs`. See `HIVE_REDESIGN_REVIEW.md` for review links and evidence limits.

Mobile review revision: compact header branding/action, single-column layout through 760px, short-screen menu scrolling, fitted tabs and avatars, larger scene touch targets, readable brief fields, and smooth anchors with reduced-motion support. Added `scripts/redesign/check-mobile.mjs` for the expanded mobile audit. Landing progression approved on September 11; Unit 02 is ready for review.

### Unit 02  -  Marketplace

Status: implemented and validated; ready for user review. Delivered the task marketplace, shared app shell, URL-backed filters and previews, mobile dialog, request recovery, and the requested landing refinements. Production build, lint, TypeScript, six task-data tests, 61 marketplace browser checks, and 54 landing browser checks pass. See `HIVE_MARKETPLACE_BRIEF.md` and `HIVE_APP_NAVIGATION.md`. The user has since approved progression to Unit 03.

### Unit 03  -  Agent directory

Status: implemented and validated; ready for review. Replaced the old ranking/card page with the shared app shell, search, server-side completed-task/reputation sorting, flat service/evidence rows, local DiceBear avatars, and URL pagination. Removed invented badges and mislabeled execution counts. Build, TypeScript, scoped lint, 12 data-boundary tests, and 53 directory browser checks passed. The accompanying landing audit passed 54 browser checks and the 24-layout/14-touch mobile audit. See `HIVE_AGENTS_BRIEF.md` and `HIVE_LANDING_AUDIT.md`. Changes remain local; the user subsequently approved Unit 04.

### Unit 04  -  Agent profile

Status: implemented and validated; ready for review. Delivered service/skills, consistent avatar, actual work and review history, review URL pagination, task-entry rail and mobile action, and independent recovery states. Fixed zero-score fallback, legacy name assignment counts, and encoded-name boundaries. Production build, TypeScript, 23 data/route tests, and 58 browser checks passed. See `HIVE_PROFILE_BRIEF.md`. The user approved Unit 05; it resolves the direct-assignment issue recorded in the brief. Rating stars were added to the profile and agents directory at the user’s request.

### Unit 05  -  Create task

Status: implemented and locally validated; ready for review. Replaced the old category-card wizard with a brief editor, budget/agent summary, and explicit review step inside the app shell. Session drafts retain fields and selected agent. Existing sign-in, draft suggestion, human verification, and matching paths are preserved. Suggestions need explicit acceptance and cannot replace budget or agent choice.

Explicit creation modes prevent automatic assignment from overriding direct selection or proposal review. Direct assignment uses an atomic task claim and retryable record creation; the form retains the created task ID after an assignment failure. Unknown creation outcomes stop automatic retries and link to My tasks. See `HIVE_CREATE_TASK_BRIEF.md` for limitations and evidence. The user approved progression to Unit 06 with “Continue.” Changes remain local on `main_redesign`, without push or deployment.


### Unit 06  -  Task detail

Status: implemented and locally validated; ready for review. Production build, TypeScript, scoped lint, 56 regression tests, and 60 task browser checks passed. Replaced the legacy task page with Brief, Proposals, Work, and Activity views, a budget/assignment rail, private messages, and role-specific owner/agent actions. The page uses the approved app shell, both themes, element entrances, and narrow-screen layouts. Reviews use labeled stars.

Proposal acceptance now claims only Open tasks and supports repair of the same partial acceptance. Payment confirmation shows the actual amount, chain, and wallet addresses; signed references survive reload and permit verification without a second transfer. Same-task completion retry preserves cross-task signature protection. See `HIVE_TASK_DETAIL_BRIEF.md`. The user approved Unit 07 (My tasks) with “Continue.” Work remains local on `main_redesign`; no push or deployment.


### Unit 07  -  My tasks

Status: implemented and locally validated; ready for review. All 60 dashboard browser checks passed. Added the task action queue, URL filters/search/pagination, session-draft resume and separate Account view. Profile and verified wallet management use authenticated requests. Funds show actual USDC/points/history, configured deposit details, saved-signature recovery and an explicit conversion confirmation.

Corrected the dashboard query to select canonical account work and verified historical Solana records, with private/no-store caching. No supplied-address ownership claim is accepted. Seventeen new data/route/wallet tests bring the regression suite to 73 passing tests. Build, TypeScript and scoped lint passed. See `HIVE_DASHBOARD_BRIEF.md` for browser evidence and account/financial limits. The user approved Unit 08 with “Continue,” and directed Robinhood-first wallet support while retaining Solana. No push or deployment.

### Unit 08  -  List agent

Status: implemented and locally validated; ready for review. The listing editor includes DiceBear avatar selection, retained non-secret drafts, race-safe name checking, optional links/wallet, review, private access details and explicit activation. A non-secret receipt preserves unknown creation outcomes across reload. Pending names are retained; normalized-name constraints protect new writes, and activation retries stay bound to the created identity.

Shared wallet configuration follows the user's Robinhood priority while preserving Solana support. Mixed-wallet account selection and sign-out behavior have regression coverage. Avatar seeds propagate to agent and task surfaces. Build, TypeScript, scoped lint, 94 regression tests and 54 registration browser checks passed. Shared task-creation and task-workspace checks passed 54 and 60 checks respectively. All registration/activation writes were intercepted; no real wallet, agent or payment mutation was made. See `HIVE_REGISTER_BRIEF.md` for evidence and limits. Review at http://localhost:3100/agent/register . The user approved Unit 09 (My agents) with “Continue.” Work remains local and unpushed on `main_redesign`.


### Unit 09  -  My agents

Status: implemented and locally validated; ready for review. Work, Opportunities, Payments and Settings now use the approved app shell. Work has private agent-scoped pagination/search/filtering; payments separate task budgets from recorded paid amounts. Settings retain edits on error, protect unsaved input and provide plugin installation, PIN change and deliberate key replacement. Existing identity, wallet, recovery and owner-tool routes remain linked.

Stored API keys no longer bypass the PIN gate. PIN and key writes compare the previous database state; unconfirmed key replacement offers recovery without an automatic retry. Build, TypeScript, scoped lint, 110 regression tests, 57 owner browser checks and 60 shared task browser checks passed. A real unauthenticated work read returned 401. All authenticated QA used fixtures; no real agent, key, PIN or chain mutation was performed. See `HIVE_OWNER_BRIEF.md` for ownership limits and the Unit 10 feature grouping. Review at http://localhost:3100/agent/dashboard . The user approved Unit 10 with “Continue”; work remains local and unpushed.


### Unit 10  -  Owner tools

Status: implemented and locally validated; ready for review. Tools, Webhooks, Tokens and Points now have focused app views, both themes, short element entrances and mobile layouts. Tool editors retain input on error and reject conflicting writes. Webhooks include delivery history and a protected one-time signing-secret result. Token and points actions show exact review details, and uncertain requests survive reload without automatic retries.

Tool-token creation now verifies the exact agent and registered tool, claims that target atomically and preserves unrelated token entries. Build, TypeScript, scoped lint, 130 regression tests and 70 browser checks passed. Real unauthenticated tool and webhook reads returned 401. All authenticated browser data and 19 writes were intercepted; no real upload, webhook delivery, token launch or conversion was performed. See `HIVE_TOOLS_BRIEF.md` for contract and recovery limits. Review at http://localhost:3100/agent/dashboard/tools . The user approved Unit 11 with “Continue.” Work remains local and unpushed on `main_redesign`.


### Unit 11  -  Agent wallet settings

Status: implemented and locally validated; ready for review. The manage route now binds to the exact agent, including the initial PIN gate. Primary and Solana wallets have separate address/verification sections, connection choices, exact-address review, message signing, conflict handling and reload recovery. Primary-wallet immutability is preserved; Solana supports reviewed replacement/removal. Shared wallet direction remains Robinhood-first.

New proofs bind the agent, network, address and previous revision. Replay and stale-write checks protect the new API; unsigned legacy primary-wallet linking is closed. Build, TypeScript, scoped lint, 146 regression tests and 45 browser checks passed. A real unauthenticated wallet read returned 401. Browser wallets and four saves were simulated/intercepted; no real account or chain mutation was performed. See `HIVE_WALLET_BRIEF.md`. Review through My agents → Settings → Manage wallets. The user requested progression to Unit 12. Changes remain local and unpushed.


### Unit 12  -  Agent ownership verification

Status: implemented and locally validated; ready for review. The page now separates recorded status, owner access, public post instructions, exact post review and confirmed result. Claim links have scoped authorization and expiry; tokens are removed from the URL and never persisted by the page. Failed and uncertain checks retain the post link and recheck saved state before retry.

The old unchecked URL auto-approval was replaced with an authenticated X post/author/code check and an atomic verification update. Reputation is preserved. Profile edits invalidate proof created by this flow when the owner handle changes, and conflicting updates are rejected. Existing verification flags are not retroactively changed.

Final build, TypeScript, scoped lint, 163 regression tests and 49 browser checks passed. Four verification writes were intercepted; no real X post or listing was changed. The local environment has no X lookup credentials, so actual post checks remain unavailable until configured and validated. Review through My agents → Settings → Verify ownership; full-flow screenshots and evidence are in `HIVE_VERIFY_BRIEF.md`. The user subsequently approved Unit 13 and deferred paid X API setup. Changes remain local and unpushed on `main_redesign`.


## Unit 13 delivery  -  2026-09-12

Status: implemented and locally validated; ready for review. The recovery page now uses the app shell with light/dark themes, labelled and masked inputs, explicit key-replacement confirmation and a separate save-key result. It supports the recovery-code method accepted by the API, removes the nonfunctional wallet option, preserves owner PIN/recovery-code semantics, guards duplicate requests and handles lost responses without automatic retry. Clipboard failures, file preparation and unsaved-key navigation are explicit.

The route rate-limits before lookup, requires exact name plus hashed proof, rejects ambiguous matching records, compares previous key/proof before updating and returns private responses. Activity-log failure cannot hide an already-created key. Build, TypeScript, scoped lint, 173 regression tests and 51 browser checks passed. Six browser writes used intercepted fixtures; no real credential or account changes were performed. X verification remains as implemented, with paid API setup deferred at the user's request.

Review: http://localhost:3100/agent/recover . See `HIVE_RECOVERY_BRIEF.md`. The user subsequently requested Unit 14 with “What’s next?” Changes remain local and unpushed.


## Unit 14 delivery  -  2026-09-12

The tool directory now uses the app shell and a divided list with provider and per-call price always visible. Rows expand for connection details, copy actions, supplied schema and source/profile/token links. Search, source, token filter, sorting and pagination use URL state. Unknown prices stay unknown, tiny prices retain precision, and external catalog examples do not appear as confirmed input schemas or reputation. The active Tools item is visible inside More on desktop and mobile.

Public reads exclude pending/suspended providers, keep private endpoints private, distinguish duplicate names by provider/source and report capped snapshots. Production build, TypeScript, scoped lint, 186 regression tests and 56 browser checks passed. A real endpoint read returned nine external listings and no registered Hive tools; no tool execution or account mutation was performed.

Review: http://localhost:3100/registry . See `HIVE_REGISTRY_BRIEF.md`. The user subsequently approved Unit 15. Changes remain local and unpushed; X API setup stays deferred.


## Unit 15 delivery  -  2026-09-12

Analytics now uses the app shell with a UTC 7/30/90-day activity chart, keyboard day inspection, semantic daily table and matching CSV export. All-time counts, current status percentages and recorded payments are distinct. Budgets no longer appear as payouts, missing dates are disclosed, and refresh failures keep the prior report visibly dated. The SVG viewBox follows its container so chart labels remain readable on phones.

Existing Solana fee data loads independently, preserves integer lamport precision and original fetch timestamps, and exposes stale/unavailable/partial states. Recipient and creator identities remain available with source links and recorded creator shares. Marketplace analytics do not wait for external providers. No X setup, fee claim or new chain integration was performed.

Production build, TypeScript, scoped lint, 201 regression tests and 68 browser checks passed. Real public reads succeeded; the current data contains 406 undated completion records and one explicit 1 USDC payment record. These are local stored/provider reads, not independent chain proof. See `HIVE_ANALYTICS_BRIEF.md`.

Review: http://localhost:3100/analytics . The user subsequently approved Unit 16, Disputes. Changes remain local and unpushed on `main_redesign`.


## Unit 16 delivery  -  2026-09-12

Disputes now uses the app shell, a bounded desktop case list and mobile case detail. Open/past cases, private report history and pagination use URL state. Detail shows the recorded report, public evidence, actual voting dates, provider stake, weighted totals, quorum, threshold and saved outcome. Missing dates cannot enable voting; execution failure is distinct from completed stake removal. Case selection moves focus and has short element entrances.

Reports and supporting evidence have validated editors, exact review, retained input on rejection and non-secret pending references. Private result checks recover lost responses. A successful empty lookup offers deliberate reference clearing with an explicit warning that the original request can still complete. Public responses omit account IDs. Usage-reference ownership and registered-tool checks are enforced. Votes use the exact connected Solana wallet, current eligibility and reviewed message signing; vote/tally writes share a database transaction. No Robinhood voting behavior was invented.

Production build, TypeScript, scoped lint (zero errors; 24 typing warnings), 229 regression tests and 79 browser checks passed. Browser submissions were intercepted: four report/evidence/vote requests stayed in fixtures. Both themes, 320–1440px, enlarged text, mobile review actions, primary-button contrast, empty/error/rate-limit states, pagination/history, signing cancellation and unknown-result recovery were checked. A real public GET returned zero open cases; unauthenticated report access returned 401. No real report, evidence, vote, stake action or chain resolution was submitted. The existing resolution worker was not audited or executed end-to-end.

Review: http://localhost:3100/dao . See `HIVE_DISPUTES_BRIEF.md` for evidence and limits. Stop before Unit 17, token and staking. All changes remain local and unpushed on `main_redesign`; paid X API setup remains deferred.


## September 12  -  Unit 17, task defaults, dropdowns and supplied logo

The user approved token/staking after Disputes, then requested All statuses as the task default, themed dropdowns throughout the website, and the newly uploaded lime/olive Hive identity everywhere the old green logo appeared.

Implemented: `/stake` HIVE app workspace with a persistent “$Hive Launching soon On RobinHood” cover over unavailable trade/stake actions; separate Solana market link, position, exact action review and saved-result recovery. `/token` retains supported network/view deep links. No Robinhood token deployment or transaction integration was invented.

Marketplace starts and resets to All statuses while preserving explicitly selected Open URLs. One themed Select component replaces the native white popups throughout all current select callers, including admin. The supplied full wordmark appears in navigation/footer; icon-only versions appear in compact identity/login contexts. Share images, manifest and browser icon references were updated. Source uploads remain intact.

Build, TypeScript, scoped lint (zero errors, warnings remain), 241 regression tests, 57 token browser checks, 33 dropdown checks and 35 branding checks passed. Financial/account browser writes used fixtures; no real transaction or mutation was sent. See `HIVE_TOKEN_BRIEF.md` for launch setup and existing Solana ledger/reconciliation limits; see `HIVE_CONTROLS_AUDIT.md` and `HIVE_BRAND_UPDATE.md` for the later corrections.

Review: http://localhost:3100/ , http://localhost:3100/marketplace , http://localhost:3100/stake . Everything remains local and unpushed on `main_redesign`. Stop before Unit 18 until user approval. Paid X API setup remains deferred.


## September 12  -  My tasks layout correction

The user's screenshot showed an oversized marketing-style sign-in heading, loose spacing and weak action hierarchy. Replaced it with a centered authentication panel, a concise heading and description, one clear sign-in button and a separate marketplace link. The page heading is smaller; the irrelevant signed-out refresh control is hidden. CSS specificity now preserves text spacing and control type against the shared foundation reset. The signed-in toolbar reserves consistent space for the themed sort field and stacks correctly on mobile.

Validation: production build, TypeScript, scoped lint (zero warnings/errors), eight dashboard model tests and 29 targeted browser checks passed. Both themes at 320/390/768/1024/1440px, exact content spacing, button text contrast, existing login modal, task search, clear filters, empty account, enlarged text and motion completion were checked. All task data used isolated fixtures; no account or financial writes occurred. Evidence: `scripts/redesign/check-dashboard-layout.mjs`, `/private/tmp/hive-redesign-qa/dashboard-layout-results.json` and dashboard-layout screenshots.

Review: http://localhost:3100/dashboard . Changes remain local and unpushed. Documentation (Unit 18) still has its old layout with the updated logo; it has not yet been redesigned and remains the next planned unit, pending approval.


## September 12  -  Landing identity, navigation, copy and Analytics follow-up

The shared header/footer identity now pairs the supplied 24/28px icon with separately sized Hive text. Landing navigation is How it works, For agent owners and Docs, with Launch App as the primary action; desktop and mobile use the same list. Owners list/configure agents; agents propose and deliver. Removed repeated landing instructions, example descriptions, duplicate category links and closing/footer filler while retaining all eight sections and interactions.

Analytics no longer displays the recorded-task-payment total or coverage ratio. Its subtitle now describes task activity and token fees. The HIVE fee section has Robinhood and Solana tabs. Solana remains the initial data view; Robinhood has a Coming soon state with no amounts, provider links or refresh action. Selecting Robinhood makes no fee request. The existing Solana data source, fee units, timestamps and error behavior remain intact. The stored report data and API contract were not altered.

Validation: production build, TypeScript and scoped lint passed; 15 analytics model/provider/route tests passed. Browser checks: 45 navigation, 59 landing and 79 analytics, all passed. The Analytics checks covered both networks, keyboard selection, mobile/light/dark layouts, chart/CSV agreement and loading/error/stale/partial data states with zero API writes. Visual captures of the landing and fee panels were reviewed. Evidence: `/private/tmp/hive-redesign-qa/landing-navigation-results.json`, `interaction-results.json`, `analytics-results.json`.

Review locally at http://localhost:3100/ and http://localhost:3100/analytics . Changes remain unpushed on main_redesign. Documentation redesign is still pending; this update does not start another page unit.


## September 12  -  Unit 18, Documentation

The user approved redesigning /docs. Replaced the old long dark-only page with a public documentation workspace: shared compact Hive identity, topic index, readable articles, on-page outline, previous/next navigation and mobile Topics access that stays visible while reading. Both themes use the existing app tokens. Added local full-content/endpoint search with Ctrl/Cmd K, accessible dialogs, code copy with manual selection fallback, section permalinks, history/deep-link support and unknown-topic recovery. Removed legacy wallet/provider/background loading from this public route.

All 23 old topic hashes remain supported. Guidance starts with client tasks and agent-owner setup, followed by SDK/MCP/REST reference and HIVE/help. Agent proposals and delivery are explicitly agent actions. Corrected old registration/dashboard/token claims, SDK response handling and remote/local MCP distinctions. Robinhood token actions and data remain coming soon; Solana instructions stay separate. X API setup remains deferred.

Production build, TypeScript, scoped lint, 257 content/index checks and 89 browser checks passed. Reviewed desktop/light and mobile/dark screenshots. Checks cover topics and anchors, actual search, copy success/failure, mobile keyboard navigation, 320–1440px, enlarged text, themes, motion and history. No account/API writes or live integration tests were performed. See HIVE_DOCS_BRIEF.md for scope, sources and evidence.

Review: http://localhost:3100/docs . Changes remain local and unpushed on main_redesign. Stop for review before Unit 19, Roadmap.


## September 12  -  Existing login and shared account access

Fixed the existing Privy integration: removed automatic logout on wallet disconnect/mismatch, retained one auth provider across app/public navigation, added a bounded retry for rejected authenticated reads, and separated authenticated session errors from the My tasks signed-out gate. Shared app headers now provide Sign in / Account, including Connect wallet, with compact mobile access. Server JWT verification and ownership boundaries remain unchanged.

Production build, TypeScript, scoped lint, 28 focused tests, 98 auth-access browser checks and 29 dashboard browser checks passed. The actual login modal and mobile header were reviewed. Full npm test still has older redesign source-guard failures; see HIVE_AUTH_ACCESS_FIX.md for details and evidence. A real account login has not been completed during validation. Review at http://localhost:3100/dashboard . Local changes remain unpushed on main_redesign; no subsequent page unit was started.


## September 12  -  Admin and connected-wallet follow-up

Pushed the existing redesign/login snapshot as 3a88066 to main_redesign and fast-forwarded/pushed main before starting this user-requested unit. Verified both remote refs. Admin (original Unit 21) was brought forward: server-verified sidebar/mobile entry, shared app shell, ten management sections, light/dark themes, modular task/agent records, responsive rows and explicit delete/launch confirmations. Preserved API operations and corrected missing authenticated transport on deletion/roadmap edits. Admin wallet authority requires a signed identity for the authenticated account; request-supplied wallet claims cannot grant access.

Connected EVM/Solana wallets now show their address and Change wallet in Account. Token grant/identity updates refresh dependent requests; stale sessions have an explicit reauthentication action. The user confirmed live login succeeds; local development was restarted after observed Privy HMR failures. Real localhost login remains unconfirmed.

Build and types passed; 33 focused tests and 104 admin + 9 record + 98 auth browser checks passed. No real admin/account/payment writes. Existing full-suite source-guard failures and inherited admin typing warnings remain documented in HIVE_ADMIN_BRIEF.md. This follow-up is local for review at http://localhost:3100/admin . Roadmap/Feedback remain pending.

## September 13  -  Unit 20, public Feedback
Replaced /feedback's legacy page with the shared app shell, light/dark tokens, native report-type radios, labeled fields and inline errors. Existing POST /api/feedback remains in use. Inputs survive failures and rate limits; an in-flight guard prevents concurrent submission. A returned submission ID is required before showing the focused receipt state. New-report action clears previous message/contact fields. No authentication requirement or backend changes. Next unit: final navigation and cross-page consistency audit. Review and validation details: HIVE_FEEDBACK_BRIEF.md.

## September 14  -  Final consistency and admin Analytics
Completed the navigation/metadata/recovery unit, with validation recorded in HIVE_FINAL_CONSISTENCY.md. Per user direction Analytics is an admin section; public entry points are hidden with source retained, and both legacy and admin API URLs require server-side admin authorization. Public Feedback, recovery/metadata, and this admin relocation remain local for review. Robinhood token data remains coming soon.

## September 19  -  Token route rename
Per user instruction, /token now renders the existing token workspace directly. Removed /stake entirely; no redirect was added. Updated navigation, docs links, sitemap, canonical metadata and tab navigation to /token. Build and five browser checks passed: direct load, active navigation/canonical, explicit Solana trade view, old-route 404 and no runtime errors. Legacy security-suite execution remains blocked by its pre-existing reference to removed docs ContentSections; its token-route assertions were updated. Changes are local pending publication.

## September 21  -  Robinhood HIVE launch update
Updated the /token Robinhood view from prelaunch to live using the supplied contract address `0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8`. Removed the "$Hive Launching soon On RobinHood" cover from the token page. Trade and stake controls remain disabled until reviewed destination URLs are configured, so the page does not invent a trading or staking integration.

Follow-up correction: staking is the coming-soon action, not the token launch. Added `/api/token/robinhood-market` to read live Robinhood Chain token data from Pons Portal, with ponsapi enrichment only when useful non-zero values are returned. The token page now shows Robinhood market state and the contract address, while the stake tab says "Staking coming soon." Docs copy was updated to match the launched token state.
