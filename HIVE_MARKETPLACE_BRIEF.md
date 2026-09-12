# Unit 02 — Marketplace

Status: implemented, validated, and ready for review. The user approved moving beyond the landing on September 11, 2026.

## Contract and evidence

`/marketplace` lists tasks. `/agents` remains the separate agent directory. The public `GET /api/tasks` supports category, status, search, page, limit, creation-date sort, and proposal-count sort. Search matches title, description, and tags. Budget sorting is string-based in the API, so this page will not offer a misleading numeric budget sort.

The local production API returned HTTP 200 with two open tasks during research. Fields include title, description, category, requirements, tags, budget, status, proposal count, and creation date. Deadlines are not consistently supplied: show them only when valid. Preserve the listed budget text and currency; missing budgets say “Not listed.” Missing proposal counts do not become zero. No API, authentication, wallet, payment, or task-creation mutation is needed for this unit.

## Design brief

- Direction: a clear work index using the approved Hive identity, Manrope, warm light/dark surfaces, and Robinhood lime accents.
- Density: comfortable task rows with aligned budgets and proposal counts.
- Structure: persistent app sidebar and compact header; task/agent route switch; concise page title; search and native filter controls; task list; desktop brief preview; pagination; app help links.
- Mobile: one column from the outset; visible budget and status in every row; labels stay beside their values; full brief opens in a native modal with a clear close action. No horizontal table scrolling. All controls have at least 40px touch height and text inputs use 16px type.
- Motion: GSAP entrance and short result/preview transitions. Respect reduced motion. Reading and filtering do not require animation.
- Exclude: legacy cards, statistics tiles, activity ticker, repeated promotional blocks, invented demand, provider ratings, or a decorative 3D scene in the work list.

## Interaction and data units

1. Extract the approved typography/theme foundation for reuse without loading the old application shell.
2. Build the marketplace navigation and responsive list/preview composition.
3. Parse and normalize URL state for category, status, search, sort, page, and selected task. All statuses is the default, including Reset filters; explicit Open filters remain shareable in the URL. Search is explicitly submitted; discrete filter changes can be revisited with Back.
4. Fetch the existing public endpoint with cancellation and a request key. Never show results from a previous filter as current. Support refresh and retry.
5. Present task facts faithfully. “View task” links to the existing task route; “Post a task” links to `/create`.
6. Provide loading, successful list, no open tasks, no matching results, request failure, invalid response, out-of-range page, and unavailable preview states. No production fixture fallback.
7. Verify with live public data and isolated browser-intercepted fixtures for pagination, missing fields, long content, empty/error responses, and stale requests. Fixtures remain in QA files.

## Research applied

- [coss UI table](https://coss.com/ui/docs/components/table): aligned fields and clear row boundaries. Use an original responsive list so fields reflow on phones.
- [coss UI select](https://coss.com/ui/docs/components/select): labeled selection controls. Native selects preserve mobile platform behavior without a new dependency.
- [Rare UI components](https://www.rareui.com/components): restrained interaction feedback. Keep the task list readable during changes.
- Supplied design guides, design-taste layout guidance, and frontend interaction/state guidance: real controls, a clear information hierarchy, visible focus, recoverable requests, and URL state.
- Existing approved research remains in `HIVE_REDESIGN_RESEARCH.md`. The original Hive logo remains the brand mark.

## Acceptance

- Both themes: 320, 360, 375, 390, 430, 600, 760, 768, 1024, 1280, and 1440px; include landscape and enlarged text.
- Search, category, status, sort, reset, refresh, pagination, Back, reload, encoded query, task destinations, and dialog focus/escape.
- Loading, empty, no matches, failed request/retry, malformed response, missing budget/count, long text, and canceled stale response.
- Static checks, production build, rendered inspection, and console audit. Separate live-data proof from fixture-based state tests.
- Finish this page and report for review. Do not start Unit 03 in this delivery.

## App shell correction

The user requested that this and the following pages behave as an app, with a deliberate menu. See `HIVE_APP_NAVIGATION.md`. The landing primary CTA now opens `/marketplace`; the marketplace uses a persistent app shell and a compact Tasks heading.

## Review evidence

- Production preview: http://localhost:3100/marketplace
- Landing refinements: http://localhost:3100/
- Build, TypeScript, and scoped redesign lint passed.
- Six task-data/URL boundary tests passed.
- 61 marketplace browser checks passed, including both themes at 13 viewport sizes, mobile previews, focus return, URL/history behavior, and API failure states.
- 54 landing browser checks passed after extracting shared theme styles and adding deeper reveals, Open app actions, and the footer X icon.
- The public endpoint was checked separately from fixture-backed error/pagination tests. The application uses the public endpoint only. No fixture data was written to the server or included in the product UI.
- QA artifacts: `/private/tmp/hive-redesign-qa/marketplace-results.json`, `interaction-results.json`, and `marketplace-live-{light,dark}-1440.png`.
- Tests use an active Chrome page with device emulation. They do not establish physical-device, wallet, payment, or deployed behavior.
- These changes remain local on `main_redesign`. No new push or deployment was performed. The user subsequently approved Unit 03 after the landing audit; see `HIVE_AGENTS_BRIEF.md`.
