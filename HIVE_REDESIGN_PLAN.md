# Hive website and app redesign

Date: 2026-09-11. Branch: `main_redesign`. Base: local `main`, `72f793c`.

## Brand identity correction

The user explicitly confirmed that the existing Hive logo must be kept. Use `public/images/hive-icon.svg` and the established favicon assets. Do not introduce a substitute brand identity. The user subsequently authorized replacing the hero logo with an interactive 3D element that represents AI agents. The navigation and footer retain Hive's logo.

## Scope and approval

Build a new visual system, navigation, page structure, components, illustrations, and motion. The old website is not a design source. Read existing code only to identify routes, data contracts, permissions, and supported actions. Do not import old presentation components into a redesigned page.

The current authorized delivery is research, the full implementation plan, and the landing page. **Stop after the landing page passes review checks. Ask the user to review and approve it before starting any other page.** Do not push or deploy during this unit.

- [x] Inspect the repository and preserve the existing branch.
- [x] Create `main_redesign` from `main` with a clean working tree.
- [x] Read the three supplied reference files and inspect the selected external references.
- [x] Inventory all 25 page routes, including four redirects.
- [x] Define the new direction, page contracts, motion, copy, and acceptance gates.
- [ ] Build and validate Unit 01: landing page.
- [ ] Obtain explicit landing-page approval from the user.
- [ ] Start Unit 02 only after approval.

## Research and decisions

Evidence and source links are in `HIVE_REDESIGN_RESEARCH.md`. Research is a design input, not permission to duplicate a reference website.

### Direction

An editorial marketplace with a sculptural identity. Use a near-black opening, warm white reading sections, and Robinhood's observed `#CCFF00` accent. Use a new Manrope font, flat surfaces, oversized left-aligned type, visible separators, and a clear action at each decision. Use a dimensional treatment of the existing Hive logo as the principal artwork. Its separate pieces join together to express agents working toward one result.

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
- ThreeUI inspiration: the material and pointer-response study in Liquid Form. Build geometry derived from the established Hive SVG in Three.js; do not claim that original code is a copied ThreeUI package.
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

### Unit 01 — Landing `/`

Purpose: explain Hive and help a visitor choose between finding an agent and listing an agent. Primary action: Browse agents → `/agents`. Secondary action: How it works → the guide on this page.

New page sequence:

1. Header: existing Hive logo and name; Work examples and How it works anchors; List your agent link; compact Browse agents action. On phones, retain the primary action and put secondary links in a keyboard-safe disclosure.
2. Hero: left-aligned headline “Put AI agents to work.”, one brief description, two actions. The right side contains a large dimensional Hive logo with lime and metallic surfaces. Keep the entire headline readable before motion starts. A small bottom index introduces research, development, design, and content.
3. Work examples: light full-width surface. Left side is a large, selectable category index. Right side is one editorial brief/document illustration. Show a concrete brief and requested output for each category. Use a DiceBear avatar beside the category role, not as fabricated proof of a provider. Explicitly label the content “Example brief.” Switching categories changes all associated text and artwork.
4. Hiring guide: a continuous horizontal/vertical composition with manual stages: Describe the task, Choose an agent, Review the work. Show one stage at a time and an accessible current-step indicator. No three-card feature grid. State only supported actions.
5. Questions: a short list of useful questions about tasks, browsing, reviewing, and listing an agent. Expand inline; do not force a modal.
6. Closing action: a large lime section with “Start with a task.” and actions to browse agents or post a task. New footer with product, agent, and help links.

Responsive: on desktop, unequal two-column hero and examples. On tablets, reduce display scale and artwork. On phones, text precedes the art, example controls wrap, documents fit the viewport, and all guide steps remain reachable. No horizontal page overflow.

States: mobile menu closed/open; selected category; selected guide stage; FAQ collapsed/expanded; motion running/stopped; reduced motion; loading 3D; no WebGL; no JavaScript. No API fetch is necessary to understand the landing page.

Checks: 375/390/768/1280/1440px; keyboard and Escape; anchors and route links; visible focus; image loading; local fonts; contrast; reduced motion; renderer failure; no legacy presentation imports; no banned copy; lint, typecheck, production build; console and browser interaction checks. Gate: deliver local preview and screenshots, then stop for user approval.

### Unit 02 — Marketplace `/marketplace`

Purpose: find work or an agent with a clear distinction between both. Page brief must resolve the relationship with `/agents` before editing. Keep `/marketplace` as available tasks unless a route migration is explicitly chosen.

Layout: full-width work index, search toolbar, category filter, compact task rows, detail preview on large screens. Each row shows task, category, budget, deadline if supplied, proposals, and status. On phones, arrange these facts in a readable two-line row; do not hide budget.

Actions: search, filter, sort, paginate, open task, post a task. Data: `/api/tasks`, task categories and status contract. States: loading rows, no tasks, no matches with clear filters, request error with retry, closed task. Motion: short row replacement; no animated rankings. Checks: URL-persisted filters, Back, stale requests, query encoding, empty budgets, long titles, pagination, and honest status.

### Unit 03 — Agent directory `/agents`

Purpose: choose an agent by service and evidence. Replace ranking-first presentation with a service directory; keep ranking as an explicit sort where the API supports it.

Layout: search and service filters above a comparison list. Each result shows DiceBear identity or supplied avatar, service description, available price basis, completed work, review count, and supported reputation fields. Missing values say “Not listed” or are omitted with context; never invent them.

Actions: search, compare supported fields, sort, open profile. Data: verify `/api/leaderboard` and agent APIs before promising filters. States: loading, empty, no match, failed request, unavailable agent, image failure. Motion: selection and list changes only. Checks: API semantics, no unsupported service filters, names as stable destinations, keyboard search, pagination, mobile field visibility.

### Unit 04 — Agent profile `/agent/[name]`

Purpose: assess one agent and start a task. Layout: identity header; service scope and price; work evidence and reviews; sticky desktop hiring summary; inline mobile action. Avoid a wall of metrics.

Actions: hire via `/create?agent=...`, inspect reviews and delivered examples if supplied. Data: `/api/agents/by-name/[name]`, verified review sources. States: loading, not found, no reviews, no samples, unavailable agent, missing price. Checks: encoded names, direct hire identity preserved, review provenance, unavailable actions disabled with explanation, no invented output samples.

### Unit 05 — Create task `/create`

Purpose: submit a clear task. New sequence: brief → requirements and requested output → budget and agent → review. Use one readable form column and an editable summary, not a large category-card grid.

Actions: enter requirements, choose category, optional direct hire, save draft, review, submit. Data: existing draft/create/instant-match endpoints and authentication. Preserve distinct token-launch behavior only after its active contract is checked. States: signed out, saved draft, validation, uploading, submit pending, insufficient requirements, failure, successful task link. Checks: persistent input on Back/reload, duplicate submit prevention, field-level errors, explicit payment expectations, attachment limits, direct-hire identity, narrow-screen keyboard.

### Unit 06 — Task detail `/marketplace/[taskId]`

Purpose: complete one task. Layout: task header, work brief and output, chronological activity, proposals, and an action rail determined by role and status. Put messages beside the work on desktop and in a named section on mobile.

Actions: propose, accept proposal, assign, submit work, request changes, approve, pay, and message only when allowed by existing state. Data: task, bids, messages, delivery, review, and payment endpoints. States: loading, missing task, each lifecycle stage, signed out, wrong owner, expired proposal, failed payment, revision pending, disputed. Checks: role/state matrix, stale updates, no duplicate payment, exact amounts, attachments, ownership, revision history. No redesign may weaken backend checks.

### Unit 07 — Client dashboard `/dashboard`

Purpose: see work that needs attention. Layout: an “Action needed” work list, task status tabs, and a compact account section. Move secondary balances and rewards below current work.

Actions: open work, resume drafts, review outputs, manage profile and supported account funds. Data: dashboard, profile, session, points, disputes. States: signed out, first task, loading, no active work, failed section, partial data. Checks: work counts match rows, balances have units, no zero-as-loading, authentication return route, task permissions.

### Unit 08 — List agent `/agent/register`

Purpose: publish a useful service listing. Sequence: identity → service and output → price/connection details → review and verify. Show technical fields only where the owner must act on them.

Actions: choose name, avatar, describe service, enter supported integration details, submit and verify. Data: name checks, registration/confirm, uploads. States: name checking/taken, upload failure, field errors, pending verification, registered. Checks: race-safe name validation, retained input, actual registration cost, supported network, secrets never logged or exposed.

### Unit 09 — Agent owner dashboard `/agent/dashboard`

Purpose: manage the agent's work. Layout: assigned work first, opportunities next, then earnings and service settings. Replace the hub-style collection of cards with task-oriented lists and named sections.

Actions: inspect assignments and opportunities, update supported settings, manage plugins, inspect payments. Sensitive key and PIN actions require deliberate confirmation. Data: me, opportunities, plugins, payments. States: no identity, unauthorized, first listing, busy, unavailable API, no payments. Checks: ownership, masked credentials, no unsolicited token creation, complete work links, actionable failures.

### Unit 10 — Owner tools `/agent/dashboard/tools`

Purpose: register and maintain agent tools. Layout: tool table and one edit sheet/form. Developer information belongs here because the owner needs it.

Actions: add/edit tools, inspect status, remove only through the supported API, use any supported launch action after its network and cost are checked. States: unauthorized, no tools, checking tool, invalid endpoint, save error. Checks: endpoint validation, access checks, unsaved changes, status timestamps, no duplicated submissions.

### Unit 11 — Agent wallet settings `/agent/manage/[id]`

Purpose: connect the intended payment wallet. Layout: identity, current wallet, one connection action, and explicit result. States: signed out, wrong owner, connecting, rejected, wrong network, connected, API failure. Checks: exact agent identity, address rendering/copy feedback, supported chain, ownership proof and persistence after reload.

### Unit 12 — Agent verification `/agent/verify/[id]`

Purpose: prove control of a listing. Layout: agent identity, clear instructions, required action, result. States: checking, missing agent, already verified, awaiting proof, rejected proof, verified, expired claim. Checks: ownership evidence, idempotent retry, clear result, no false verified badge.

### Unit 13 — Agent recovery `/agent/recover`

Purpose: recover access. Layout: short identity/proof form; separate secret-reveal result. States: invalid proof, rate limit, pending, recovered, copy failure. Checks: no credential in URL, no console logging, no accidental persistence, accessible errors, actual recovery semantics.

### Unit 14 — Tool directory `/registry`

Purpose: find a tool by capability. Layout: searchable list with category, description, price basis, and supported connection details. Expand a selected row for usage. Actions: search, filter where supported, inspect/copy endpoint. States: loading, empty, API failure, invalid endpoint, no price. Checks: tools versus agents are distinct, copy outcome, useful mobile detail, current status provenance.

### Unit 15 — Analytics `/analytics`

Purpose: understand actual marketplace activity. Layout: dated overview, primary time-series figure, accessible data table, definitions. Avoid a metric-card grid. Data: `/api/analytics`. States: loading, sparse history, no history, stale results, API failure. Checks: date ranges, timezone, currency, denominators, no extrapolated growth, keyboard chart alternatives, reduced motion.

### Unit 16 — Disputes `/dao`

Purpose: report and resolve disputed work. Layout: case list, selected evidence, voting/action summary. Actions: report, attach supported evidence, inspect case, vote when eligible. States: signed out, ineligible, no cases, voting open/closed, pending action, failure, resolved. Checks: report ownership, voting rules, deadlines, evidence access, persisted outcomes. Plain language for consumer instructions.

### Unit 17 — Token and staking `/stake`, `/token`

Purpose: explain verified $HIVE utility and supported staking actions. Layout: token facts and network, wallet position, one staking form, dated activity. `/token` currently redirects to `/stake`; retain or revise after the token product brief is approved.

Required evidence before implementation: official contract address, target network, token availability, migration plan from existing Solana behavior, staking rules, fees, lock terms, wallet support. Do not translate Solana transactions into Robinhood transactions by changing text. States: disconnected, wrong network, unsupported deployment, no balance, amount error, pending, rejected, confirmed. Checks: exact contract/network, decimals, approvals, fees, unlock rules, no fabricated return rates.

### Unit 18 — Documentation `/docs`

Purpose: help a visitor complete a task or maintain an agent. Layout: product guide first; separate agent-builder reference; left navigation, reading column, on-page contents where useful. Entry topics: find an agent, describe a task, review work, payment, account access. Technical topics follow.

Actions: section navigation, search if backed by a real local index, copy code with feedback. States: no search match, invalid anchor, code overflow. Checks: accurate endpoint examples, valid anchors, mobile contents, STE copy review, factual network details. No API credentials in examples.

### Unit 19 — Roadmap `/roadmap`

Purpose: distinguish released changes from planned work. Layout: dated vertical release list and a separate planned section. Data: `/api/roadmap`. States: no entries, loading, failure, partial date. Checks: shipped claims backed by evidence, planned features clearly named, no invented launch dates, no automatic checkmarks.

### Unit 20 — Feedback `/feedback`

Purpose: send a useful report. Layout: focused form with category, message, optional contact if supported, then a receipt state. States: blank/invalid, pending, failure preserving input, received. Checks: labels, rate limits, exact submission response, duplicate prevention, privacy of contact fields.

### Unit 21 — Admin `/admin`

Purpose: review operational exceptions. Layout: access gate, queue navigation, dense tables, explicit case detail. Actions: existing agent/task/submission/feedback/DAO/staker controls. Destructive actions must show the exact target and effect. States: denied, loading, empty queue, stale data, mutation pending/failed/completed. Checks: authorization on every request, auditable actions, no secrets, no accidental bulk action, pagination and filtering.

### Unit 22 — Redirects, navigation, and final consistency

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

### Unit 00 — Research and plan

Completed: repository inspection, branch creation, 25-route inventory, supplied-file review, official component and design research, new direction, evidence boundaries, and per-page specifications.

### Unit 01 — Landing

Status: initial landing implementation complete; user-requested checkpoint before hero replacement and content expansion. Scoped lint and typecheck pass. Production build and final browser checks remain pending. Approval for the next page: pending.
