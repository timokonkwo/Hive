# Landing review

Status: the user approved moving to the marketplace on September 11. The landing received the requested app-entry, X-link, and finer reveal updates during Unit 02.

## Open the page

- Production preview: http://localhost:3100
- Branch: `main_redesign`
- Pushed checkpoint before the hero replacement: `4519a58` on `origin/main_redesign`.
- The expanded landing is local and has not been pushed or deployed.

## Review the landing

1. Move the pointer across the hero and select each agent role. The original Hive logo remains in the header and footer.
2. Switch light/dark mode, reload, and check that the choice persists.
3. Scroll through the eight sections and inspect the reveals, background motion, and connected owner process.
4. Select work examples, edit a task brief, and copy its full text.
5. Step through the hiring guide and agent comparison tabs, then open the FAQ answers.
6. Check the mobile menu and pause the animation. Reduced-motion preferences also stop continuous motion.

The eight sections are the hero, work examples, task brief builder, hiring guide, comparison guide, agent owner section, FAQ, and closing action.

## Validation

- `npm run build`: passed, including 122 generated static pages.
- `npm run typecheck`: passed.
- `npx eslint app/page.tsx components/redesign --max-warnings 0`: passed.
- Production Chrome interaction checks: 48/48 passed, with no runtime exceptions.
- Both themes checked at 320, 375, 390, 768, 1280, and 1440 pixels without horizontal page overflow.
- Extra checks: no failures in the computed text-contrast scan; narrow header controls fit; clipboard failure exposes selectable brief text; page content remains available without JavaScript; WebGL context loss shows the static illustration.

Repeatable browser checks and setup: `scripts/redesign/README.md`.

Local evidence in `/private/tmp/hive-redesign-qa/`:

- `interaction-results.json` and `extra-results.json`
- `dark-1440-full.png` and `light-1440-full.png`
- `dark-390-full.png`, `light-375.png`, and tablet screenshots

These are local production-preview checks. They do not establish deployed behavior or exercise task submission, wallets, payments, or other app pages. The task brief builder prepares and copies text locally. Full ASD-STE100 dictionary certification was not performed; the copy follows the plain-language rules documented in the research.

## Approval gate

### Mobile revision  -  September 11

Reduced the Hive wordmark and the mobile navigation button. The button stays on one line. The header is shorter, and its controls cannot shrink into one another. The page now uses a single column through 760px. Hero spacing, work tabs, avatar sizing, and scene touch targets have been adjusted. All mobile brief fields use at least 16px text. The mobile menu scrolls within short landscape viewports.

Anchor links scroll smoothly with a sticky-header offset. Reduced-motion mode uses instant scrolling. The dedicated audit checks both themes at 12 viewport sizes, 14 touch selections at 320px, and simulated larger text. Evidence: `/private/tmp/hive-redesign-qa/mobile-audit.json`; repeat with `scripts/redesign/check-mobile.mjs`. This is browser emulation; physical-device testing remains outside this local validation.

The landing progression gate was approved with “Continue to the next page.” Unit 02 is ready for review; see `HIVE_MARKETPLACE_BRIEF.md` and `HIVE_APP_NAVIGATION.md`.

### App entry and finer reveals

The header, hero, and closing primary actions now say **Launch App** and open `/marketplace`. Agent-specific links still open `/agents`. The footer's Hive X link now uses the X icon with an accessible name.

Heading lines reveal inside individual masks. Eyebrows, paragraphs, document rows, guide items, form fields, and owner-stage elements enter separately. Section backgrounds remain stationary. Each owner stage has its own viewport trigger so later stages still reveal on mobile. Focused controls become visible immediately. The motion pause control completes and stops pending reveals; reduced-motion mode restores static content.

## September 11 landing audit

See `HIVE_LANDING_AUDIT.md` for the copy, visual, and action audit. The owner sequence now uses flat rows, sample requirements no longer imply completion, the hero accurately labels example selection, and the brief tool explains its local draft behavior. The requested artwork and fine-grained reveals remain.

## September 11  -  task creation and rating stars

The user approved progression from the agent profile. The agents directory and profile now display a filled star beside actual ratings; review counts remain separate supporting evidence. Unknown ratings do not receive a star.

Unit 05 is ready at http://localhost:3100/create . Review the brief editor, budget and agent choices, and final review screen in both themes. The page restores session drafts and resolves agents selected from their profiles. Posting preserves the selected agent and reports incomplete assignment without claiming success. Detailed proof and limitations are in `HIVE_CREATE_TASK_BRIEF.md`. The user approved progression to Unit 06 (task detail). Nothing was pushed or deployed.


## September 11  -  task detail

Unit 06 is ready at http://localhost:3100/marketplace/6aa45dd1c06eb119997ffd43 . This is an actual public task; its state may change. Review the brief, proposal rows, work access state, and recorded activity, plus both themes and mobile navigation. Owner-only actions appear only for the authenticated task owner.

The new workspace includes private work history and messages, proposal decisions, revision requests, star reviews, agent submission forms, and an explicit payment preview with recovery of the same signed reference. The browser fixture screenshots show those private states without creating records: `/private/tmp/hive-redesign-qa/task-owner-work-dark-1440.png` and `/private/tmp/hive-redesign-qa/task-payment-dark-320.png`.

Production build, TypeScript, scoped lint, 56 regression tests, and 60 task browser checks passed. Both themes were checked at ten widths from 320 to 1440px. Keyboard/dialog focus, tab history, independent errors, late private responses, and payment recovery after reload passed. See `HIVE_TASK_DETAIL_BRIEF.md` for evidence boundaries. No real messages or payments were sent. All work remains local and unpushed on `main_redesign`. The user approved progression to Unit 07 (My tasks).


## September 11  -  My tasks

Unit 07 is ready at http://localhost:3100/dashboard . Review the Action needed queue and task filters/search/pagination. Account settings are at http://localhost:3100/dashboard?view=account . Signed-out visitors get the existing sign-in flow; private task and account content requires server-authenticated access.

The account view includes profile editing, signature-verified Solana wallet linking, explicit unlink confirmation, USDC funds/history, and points/conversion. Deposits show the configured destination and preserve a reference before broadcasting; uncertain conversion requests stay locked across reload. Task decisions open the approved task workspace.

Validation: build, TypeScript, scoped lint, 73 regression tests, and 60 production-preview Chrome checks passed. Both themes were checked at ten widths from 320 to 1440px. Screenshots: `/private/tmp/hive-redesign-qa/dashboard-tasks-dark-1440.png`, `dashboard-tasks-light-320.png`, and `dashboard-account-{light,dark}-320.png`. Authenticated states and writes are isolated fixtures, not real account or chain transactions. See `HIVE_DASHBOARD_BRIEF.md` for the account-migration and recovery limits.

Work remains local and unpushed on `main_redesign`. The user approved Unit 08 (List agent) with “Continue.”

## September 11  -  List agent

Unit 08 is ready at http://localhost:3100/agent/register . Review the listing editor, avatar choices, name feedback, optional links/wallet and final review in both themes. Listing details survive reload. Registration then shows private access details and requires acknowledgement before activation.

The registration/activation states were checked with isolated browser responses. Unknown registration outcomes survive reload and direct the owner to check the listing. The selected avatar now follows the agent into the directory, profile and task workspace. Shared authentication follows the updated wallet direction while retaining Solana-only accounts.

Build, TypeScript, scoped lint, 94 regression tests and 54 registration browser checks passed. The shared changes also passed 54 task-creation browser checks and 60 task-workspace checks. Registration evidence and limits are in `HIVE_REGISTER_BRIEF.md`; screenshots are in `/private/tmp/hive-redesign-qa/register-*.png`.

All work remains local and unpushed on `main_redesign`. No real agents, tasks, messages or payments were created. The user approved Unit 09 (My agents) with “Continue.”


## September 11  -  My agents

Unit 09 is ready at http://localhost:3100/agent/dashboard . Review the access screen, then Work, Opportunities, Payments and Settings using your saved agent key and owner PIN. First access provides PIN setup. A saved key alone does not open private content after reload.

Work rows lead directly to the existing task workspace. Payments distinguish a recorded paid amount from an unpaid task budget. Service edits survive failures and require save/discard before navigation. Plugin installation, PIN changes and key replacement use explicit actions; key replacement keeps its one-time result open until acknowledgement.

Build, TypeScript, scoped lint, 110 regression tests, 57 owner browser checks and 60 shared task browser checks passed. Both themes were checked at ten work-layout widths, with additional mobile settings, payment and access interactions. Real unauthenticated work access returned 401. Private data and all mutations in QA were intercepted fixtures. Visual evidence and limits are in `HIVE_OWNER_BRIEF.md`.

No changes were pushed or deployed. The user approved Unit 10 (owner tools, including the grouped legacy webhook/token/points controls) with “Continue.”


## September 11  -  Owner tools

Unit 10 is ready at http://localhost:3100/agent/dashboard/tools . Sign in with your agent key and owner PIN, then review Tools, Webhooks, Tokens and Points. Check the tool editor and per-call prices, webhook event controls and delivery history, token target/image fields, and points history. Both themes and mobile layouts are included.

Sensitive actions use explicit confirmations. A new webhook secret requires acknowledgement before dismissal. Token launches and conversions show their exact target, recipient and actual network. Unknown outcomes remain blocked pending verification; service reconciliation limits are recorded in `HIVE_TOOLS_BRIEF.md`.

Final build, TypeScript, scoped lint, 130 regression tests and 70 production-preview browser checks passed. Both themes were checked at ten tool-layout widths; the other three views were checked at 320 and 1440px. Real unauthenticated tool/webhook reads returned 401. Browser data and all 19 writes were intercepted fixtures. No actual image upload, subscription delivery, token creation or conversion took place. Screenshots: `/private/tmp/hive-redesign-qa/tools-*.png`.

Work remains local and unpushed on `main_redesign`. The user approved Unit 11 (wallet management) with “Continue.”


## September 11  -  Agent wallet settings

Unit 11 is ready. Open http://localhost:3100/agent/dashboard , then Settings → Manage wallets. The page uses your exact agent identity and retains the owner PIN gate. Review the primary wallet first, then Solana, in either theme. Current addresses show whether ownership was verified. Wallet selection leads to an address review before signing; removal also requires confirmation.

The audit fixed the ignored route ID, missing Solana signature, unsigned primary-wallet linking and stale-write overwrite. A wrong key cannot start PIN setup for another agent. Unknown saves can resolve through a fresh read without resubmission.

Final build, TypeScript, scoped lint, 146 regression tests and 45 Chrome browser checks passed. Both themes fit ten tested widths from 320 to 1440px. Signing was simulated in the browser and independently checked with real offline cryptographic signatures. All four save requests were intercepted; no actual wallet or account mutation took place. The real signed-out API read returned 401. Screenshots and limits are in `HIVE_WALLET_BRIEF.md`.

Work remains local and unpushed on `main_redesign`. The user requested the next unit, agent verification, with “What’s next?”


## September 12  -  Agent ownership verification

Unit 12 is ready for design review. Open http://localhost:3100/agent/dashboard → Settings → Verify ownership. The page includes claim-link or owner-PIN access, a selectable verification post, copy recovery, an X intent link, post URL validation, review and a saved result. Both themes and mobile layouts are included.

The old API granted verification for an unchecked URL. New verification requires owner authorization and a matching author/code from an official X lookup. No automatic post is sent and no reputation is added by submission. Existing recorded verification flags are not re-audited by this unit.

Final build, TypeScript, lint, 163 regression tests and 49 browser checks passed. All four browser writes were intercepted. The local environment has no X lookup credential set, so live verification stays unavailable. The full ready/review/result design can be inspected in `/private/tmp/hive-redesign-qa/verify-{light,dark}-{320,1440}.png`, `verify-review-dark-320.png` and `verify-success-dark-320.png`. See `HIVE_VERIFY_BRIEF.md` for setup and evidence limits.

Work remains local and unpushed. Unit 13 (agent recovery) is next after review.


## Unit 13  -  Agent recovery (2026-09-12)

Review: http://localhost:3100/agent/recover . Also linked from My agents → Recover access.

The new page has a focused recovery-code form, a confirmation naming the agent and a separate masked-key result with copy/download and saved-key acknowledgement. The unsupported wallet-recovery control is removed. Your owner PIN and existing recovery code stay unchanged. Lost responses and reloads show an uncertain outcome, and another replacement needs a deliberate confirmation.

Validation: production build, TypeScript, scoped lint, 173 regression tests and 51 browser checks passed. Light/dark layouts were audited at ten widths from 320 to 1440px, including narrow long-name confirmation and recovered-key views. All six recovery writes were intercepted with fixtures; no real key, PIN or wallet changed. This is local validation, not production recovery proof. Evidence and repeatable commands are in `HIVE_RECOVERY_BRIEF.md` and `scripts/redesign/README.md`.

X API setup remains deferred. Changes are local and unpushed on `main_redesign`. Next after review: Unit 14, tool directory `/registry`.


## Unit 14  -  Tool directory (2026-09-12)

Review: http://localhost:3100/registry .

New app directory with searchable, expandable rows; provider and per-call price; source/token filters; alphabetical/price sorting; URL-backed pagination; connection copy with manual fallback; profile, source and supported Solana token links. External catalog prices remain unspecified, and illustrative schemas/reputation are removed. Active Tools navigation is visible in More.

Build, TypeScript, scoped lint, 186 regression tests and 56 browser checks passed. Both themes were checked at ten widths from 320 to 1440px, with expanded rows, long content, enlarged text, keyboard controls, clipboard failure, URL history, retry and reduced motion. Scenario reads were intercepted; zero writes or tool executions occurred. A separate real public read returned nine external listings and no registered Hive tools. External connection availability and prices were not verified. Full evidence: `HIVE_REGISTRY_BRIEF.md`.

Changes remain local and unpushed. X API setup remains deferred. Next after review: Unit 15, Analytics `/analytics`.


## Unit 15  -  Analytics (2026-09-12)

Review: http://localhost:3100/analytics .

New UTC activity report with interactive 7/30/90-day chart, keyboard day selection, exact daily table and CSV export. All-time counts and status proportions are separate from dated activity. Recorded payments use explicit payment fields; budgets are excluded. The page discloses undated records and keeps old reports visibly dated after a failed refresh.

Solana token fees load separately with precise SOL units, actual source timestamps, stale/unavailable states and independent refresh. Existing recipient/creator information and source links remain available. Claim amounts with unspecified source units are not converted into invented SOL values.

Validation: production build, TypeScript, scoped lint, 201 regression tests and 68 browser checks passed. Both themes were checked at ten widths from 320 to 1440px, including physical chart-label readability, keyboard interaction, table/export consistency, race handling, error/empty/partial states and motion. Scenario reads used fixtures and no API writes occurred. Real public reads also succeeded. Current records include 406 undated completions, which are excluded from the chart; this is not a chain audit. Evidence is in `HIVE_ANALYTICS_BRIEF.md`.

Changes remain local and unpushed. X API setup stays deferred. Next after review: Unit 16, Disputes `/dao`.


## Unit 16  -  Disputes (2026-09-12)

Review: http://localhost:3100/dao .

New case list/detail, open and past cases, private report history, supporting evidence and explicit report/evidence/vote review. The mobile view opens one case at a time and moves keyboard focus to its heading. Both themes, original Hive identity, compact controls and element entrances follow the approved app direction. The exact Solana voting wallet and recorded provider stake are visible before signing. No new chain behavior is implied.

Validation: production build, TypeScript, scoped lint with zero errors, 229 regression tests and 79 browser checks passed. The audit includes 320–1440px, enlarged text, primary-action contrast, dialogs, copy failures, URL history, pagination, data errors, private history and unknown-result recovery. Four browser submission requests were intercepted with fixtures, including simulated-wallet message signing. No real report, evidence, vote or chain transaction was sent.

The real endpoint currently has no open cases. Populated detail and vote screenshots use fixture data; see `HIVE_DISPUTES_BRIEF.md`. The resolution worker and actual transaction/treasury operations were not validated end-to-end. Changes remain local and unpushed; X API setup stays deferred.

Next after review: Unit 17, HIVE token and staking `/token` and `/stake`.


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
