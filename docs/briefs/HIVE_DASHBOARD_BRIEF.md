# Unit 07  -  My tasks

Status: implemented and locally validated; ready for review. User approved progression from Unit 06 with “Continue.”

## Contract audit

- `/api/dashboard` currently requires a supplied wallet address, returns all matching records without authentication, and misses canonical Privy-owned tasks. Replace that lookup with authenticated canonical identity plus the profile's signature-verified Solana address for historical records. Never trust a query address or an unverified profile externalAddress to select private work. Wallet-only historical records without a verified link require account linking; do not silently claim those records.
- Task list data includes posted tasks, incoming proposals and existing review status. Count from the same normalized rows, keep proposed price separate from task budget, and route decisions to the approved task workspace. Avoid duplicate accept/pay forms on this page.
- `/api/clients/profile` PATCH already verifies Privy authentication and consumes a Solana ownership signature for wallet linking. Use authenticated requests and canonical profile lookup, validate profile fields, retain input on errors, require explicit unlink confirmation, and never claim success on a failed PATCH.
- `/api/session` and `/api/points` require authenticated requests; the old page uses plain fetch. Keep independent loading/error states and explicit USDC/points units. Do not show zero while loading. Session history is limited to 30 actual records.
- Existing session deposits verify Solana USDC to the configured treasury. The old client hardcodes the treasury, which can differ from the server. Expose the actual public deposit configuration through the authenticated session response, build only from those values, and retain a signed reference before broadcasting. Recovery verifies that reference and never automatically sends a second transfer.
- Points conversion requires at least 1,000 points and a verified linked Solana recipient. Read exact conversion rules from the server and verify the response's token amount/signature. An uncertain response locks automatic retries and directs the user to refreshed history.
- Disputes are global staker-governance records, not this client's task disputes. Keep their existing app navigation destination `/dao`; do not label global cases as “your disputes.” Agent-submitted proposals belong in My agents. Task-specific proposal decisions remain in Unit 06.
- Existing local creation draft can be resumed through `/create`; only a real nonempty session draft gets a resume action.

## Design brief

Direction: task workspace using the approved Hive identity, Manrope, lime accent, light/dark tokens.
Density: comfortable task rows, compact supporting account details.
Surface: flat task queue and divided lists; no marketing hero or metric-card grid.
Type: clear, restrained, readable.
Motion: short GSAP row/element entrances, reduced-motion support; no continuous decoration beside balances.

Primary Tasks view: title and refresh, local draft resume if present, Action needed list, status filters/search/sort, task rows with budget, agent, date and exact next action. Account view: profile form, verified payment wallet, balances/history and explicit deposit/conversion dialogs. Navigation state lives in the URL; mobile rows stack their actual fields without horizontal scrolling.

References: supplied `Design styles/design-guides.md`, `inspiration.md`, prior app briefs, https://www.rareui.com/ and https://threeui.com/ revisited for interaction ideas. No existing legacy dashboard layout, cards or copy will be reused.

## Implementation sequence

1. Correct dashboard account selection and private response caching; add public deposit/conversion configuration to existing authenticated reads.
2. Add dashboard normalizers and pure filtering/action rules. Replace the route with a modular app workspace.
3. Build task queue, real draft resume, URL filters/history and complete request states.
4. Build profile editing and wallet proof/link/unlink with explicit success/error handling.
5. Build separate funds/history and conversion controls with conservative unknown-outcome recovery.
6. Test account selection, data boundaries and payment transport. Browser-check signed-out flow and isolated authenticated fixtures, both themes at 320–1440px, keyboard, errors, stale data, and motion. No actual messages, reviews, tasks, conversions or payments during QA.
7. Run build, TypeScript, scoped lint, inspect screenshots, document evidence and report before Unit 08.


## Delivered

- Original My tasks workspace, with prioritized review/assignment rows, status counts from the same task data, URL search/sort/filter/page state, twenty rows per page, and actual session-draft resume. Task decisions open the approved task detail page.
- Separate Account view with profile editor, inline errors, ownership-message wallet linking, confirmed unlink, copy recovery, USDC funds/history, points/history and explicit conversion preview. Global disputes and agent work retain their dedicated destinations.
- Authenticated dashboard lookup uses canonical account ownership. Historical Solana task lookup requires the saved wallet's ownership proof and cannot override another stored owner. Query addresses and unverified external profile addresses cannot select work.
- Server deposit configuration replaces the old hardcoded browser destination. The transfer uses USDC's six decimals, checks the connected sender, persists its signature before broadcast and verifies that same transfer on recovery. Confirmed ledger history can resolve a completed deposit without another credit request.
- Points conversion uses server-supplied rate/minimum, the verified recipient and actual returned HIVE amount. An uncertain outcome stays locked across reload instead of automatically converting again.
- Brief and account sections use the existing app identity, light/dark tokens, GSAP element entrances and reduced-motion support. No legacy dashboard cards, badges, reward grid, or page flow remain.

## Validation

- Production build passed, including 122 static pages. The sitemap's optional MongoDB lookup logged a sandbox DNS error; this is not live data or deployment proof.
- TypeScript and scoped lint passed for the new dashboard components/routes.
- Regression suite: 73/73 passed. Seventeen new tests cover dashboard normalization, filters/actions, authenticated task selection, address spoof rejection, private caching, exact deposit amount/recipient, signature storage before broadcast, storage failure and wallet ownership messages.
- Final Chrome suite: 60/60 passed, including failed unlink recovery. No runtime exceptions. Desktop task and account layouts, narrow payment dialog, and mobile layouts in both themes were visually inspected. Both themes were checked at 320, 375, 390, 600, 760, 768, 1024, 1100, 1280 and 1440px.
- Browser coverage includes real signed-out access and sign-in entry, URL pagination/Back/reload, search/filter reset, first task, actual draft resume, profile errors and save, unlink cancellation, ownership proof, deposit validation/recovery, conversion preview/uncertain outcome, independent funds retry, expired access, long content, and motion.

Repeat with `scripts/redesign/check-dashboard.mjs`. Evidence is in `/private/tmp/hive-redesign-qa/dashboard-results.json` and `dashboard-*.png`.

## Limits and review gate

Authenticated UI states and every write were exercised through isolated browser interceptions; route and wallet tests use in-memory transports. The real signed-out endpoint returned 401 and the existing sign-in opened on `/dashboard`. No actual profile, wallet link, deposit, point conversion, task or message was created. Wallet transactions were tested with stubbed transports, not on-chain funds.

Historical wallet-only tasks without canonical ownership or a verified Solana link are not claimed by this dashboard. Legacy EVM-only task recovery needs a separate verified account migration path. This is explicit instead of trusting an address query.

Existing session-ledger updates and points conversion retain their backend limits: they are not a full multi-document transaction redesign. Pending deposit records or uncertain conversions may require support reconciliation. Recovery never automatically repeats a transfer/conversion. Session and points history display at most 30 recent records.

Physical-device checks and formal ASD-STE100 dictionary certification were not performed. No chain migration is implied by the Robinhood accent.

Review at http://localhost:3100/dashboard and http://localhost:3100/dashboard?view=account . Unit 08 (List agent) waits for approval. All changes remain local and unpushed on `main_redesign`.


## September 12  -  My tasks layout correction

The user's screenshot showed an oversized marketing-style sign-in heading, loose spacing and weak action hierarchy. Replaced it with a centered authentication panel, a concise heading and description, one clear sign-in button and a separate marketplace link. The page heading is smaller; the irrelevant signed-out refresh control is hidden. CSS specificity now preserves text spacing and control type against the shared foundation reset. The signed-in toolbar reserves consistent space for the themed sort field and stacks correctly on mobile.

Validation: production build, TypeScript, scoped lint (zero warnings/errors), eight dashboard model tests and 29 targeted browser checks passed. Both themes at 320/390/768/1024/1440px, exact content spacing, button text contrast, existing login modal, task search, clear filters, empty account, enlarged text and motion completion were checked. All task data used isolated fixtures; no account or financial writes occurred. Evidence: `scripts/redesign/check-dashboard-layout.mjs`, `/private/tmp/hive-redesign-qa/dashboard-layout-results.json` and dashboard-layout screenshots.

Review: http://localhost:3100/dashboard . Changes remain local and unpushed. Documentation (Unit 18) still has its old layout with the updated logo; it has not yet been redesigned and remains the next planned unit, pending approval.
