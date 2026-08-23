# BNB Agent Studio V2 Execution Tracker

Last updated: 2026-08-23

This tracker is the implementation source of truth for the BNB Agent Studio V2 marketplace work. The product is intended for real users. Do not mark a unit complete until the code is implemented, tested, and safe to deploy.

## Source Basis

- BNB Agent Studio V2: agents can charge onchain, use TypeScript, use testnet gas sponsorship, and use onchain-checkable Altana permissions.
- BNB Agent Studio: the product stack includes ERC-8004 identity, ERC-8183 task commerce, x402 payment, wallet, LLM, and cloud runtime.
- Smart Money Era hackathon: the marketplace must help users find live BSC agents, understand them without prior Agent Studio knowledge, activate them with minimal friction, and support Rebalancing, Grid Trading, Yield Optimisation, and Health Factor Monitoring with equal depth.

## Current Baseline

| Item | Value |
|:--|:--|
| Branch | `bnb` |
| Baseline commit pushed | `7d20d78` |
| Baseline commit message | `Checkpoint BNB marketplace repairs` |
| Baseline validation | `npm test`, `npm run typecheck`, `npm run lint -- --quiet`, `npm run build`, `git diff --check` passed before push |
| Known non-fatal build output | MetaMask optional React Native storage warning, bigint pure-JS fallback, local sitemap MongoDB DNS refusal |

## Completion Rules

- A phase can be marked `Complete` only after its unit tests, integration tests, browser QA, and production acceptance checks pass or are explicitly documented as blocked.
- Server validation is authoritative. Client validation is a UX helper only.
- No CTA can appear unless the server can complete the action.
- No raw adapter output can be the default delivery view.
- No partner integration can be claimed without a real API, contract, explorer link, or transaction proof.
- No primary marketplace path can depend on mock data.

## Phase Progress

| Phase | Status | Target |
|:--|:--|:--|
| Phase 0: Safety Baseline and Config Contract | Complete | Added tracker, current-runtime env contract, readiness checks, and tests. |
| Phase 1: Marketplace Readiness Gate | Complete | Centralized readiness and removed non-callable hire/request CTAs. |
| Phase 2: Agent-Specific Capability Forms | Complete | Render only the selected agent's supported tasks and arguments. |
| Phase 3: Payment and Run State Repair | In progress | Zero-price policy is now explicit; remaining x402/escrow UI work is pending. |
| Phase 4: Reference Studio V2 Agents | In progress | Reference-agent config loading is wired; real Studio V2 agents are pending. |
| Phase 5: Delivery Formatting and Evidence | In progress | Convert outputs into human summaries and receipt evidence. |
| Phase 6: 8004scan Pro Data Quality | In progress | Pro key precedence and cache controls are wired; richer profile data remains pending. |
| Phase 6A: Endpoint-Backed Discovery | Complete | Agent402, 402Index, x402.direct, and the402 are wired as endpoint/service sources. |
| Phase 7: Altana Permission Path | Not started | Add scoped grant, session-key transaction proof, and revoke flow. |
| Phase 8: PancakeSwap Utility | Not started | Add LP, swap, farming, and pool demand workflows. |
| Phase 9: TermiX Agent Advantage Report | Not started | Capture three real agent-vs-manual comparisons. |
| Phase 10: Production Hardening | In progress | Add deployment safety, rate limits, ownership checks, moderation, analytics, and alerts. |
| Phase 11: Submission Freeze | Not started | Deploy, smoke test, record video, and submit. |

## Phase 0: Safety Baseline and Config Contract

### Units

- Create this tracker.
- Keep `.env.example` limited to values needed by the current local and deployment runtime.
- Keep future Studio V2, x402, Altana, PancakeSwap, TermiX, and observability values out of `.env.example` until their live integrations are wired.
- Add runtime readiness flags that expose whether required values are configured without exposing secrets.
- Add tests that lock the env contract and runtime gates.

### Components

- `.env.example`
- `lib/bnb/studio-v2.ts`
- `lib/bnb/runtime.ts`
- `tests/bnb-product-regressions.test.mjs`

### Tests

- `git diff --check`
- `npm test`
- `npm run typecheck`
- `npm run lint -- --quiet`
- `npm run build`
- Regression: `.env.example` contains current runtime fields and short acquisition notes.
- Regression: `.env.example` does not expose speculative partner placeholders.
- Regression: runtime readiness reports only booleans or non-secret public state.
- Regression: no private key or API key value is exposed by runtime readiness.

### Acceptance

- Operators know which values to provide.
- The app can report missing Studio V2 and partner configuration safely.
- Later phases can use one config source instead of ad hoc env reads.

### Verification

- Date: 2026-08-19
- `npm test`: passed with 68 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Known non-fatal build output remained limited to the MetaMask optional React Native storage warning, bigint pure-JS fallback, and local sitemap MongoDB DNS refusal.
- `.env.example` was trimmed to the values present in the current local BNB runtime plus the production-only `BNB_AUTH_SECRET`.
- Each retained value now has a short acquisition note.

## Phase 1: Marketplace Readiness Gate

### Units

- Centralize agent readiness classification.
- Default marketplace and search results to hireable live BSC agents.
- Keep non-callable ERC-8004 identities visible only in secondary identity contexts.
- Remove run, hire, validate, and payment CTAs from non-callable agents.
- Keep identity links and copyable addresses available.

### Components

- Agent catalog normalization
- Readiness classifier
- Directory filters
- Profile CTA logic
- Activation route guards

### Tests

- Unit: `ready_to_run` agents get hire CTAs.
- Unit: `connectable`, `listed_only`, and `unavailable` agents never get hire CTAs.
- Unit: direct activation URL blocks non-hireable agents.
- Unit: 8004scan links use chain slugs.
- Integration: `/api/bnb/agents?execution=ready_to_run` returns only runnable agents.
- Browser QA: `/bnb`, `/bnb/agents`, and one profile per readiness state.
- Copy scan: no `MCP accepted`, `not runnable through Hive`, `public endpoint`, or unpaid escrow language.

### Acceptance

- A user cannot fill a job form for an agent Hive cannot run.

### Verification

- Date: 2026-08-19
- Added `classifyBnbAgentReadiness` as the shared server/UI readiness source.
- `Ready to run` remains a status label. Hireability still requires a valid BSC agent wallet.
- Non-callable agents show profile or identity actions only.
- Removed the status-page `Request this agent` fallback for non-callable agents.
- Removed `Connectable` and `Listed only` from directory filter labels.
- `/bnb/agents` and `/api/bnb/agents` default to `all`; users can choose `Runnable` to see only agents with executable endpoints.
- `npm test`: passed with 68 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Phase 6A: Endpoint-Backed Discovery

### Units

- Pull endpoint-backed services from Agent402, 402Index, x402.direct, and the402.
- Keep 8004Scan as an identity source; do not treat identities without endpoints as runnable.
- Default `/bnb/agents` and `/api/bnb/agents` to all records instead of a zero-result ready-only view.
- Mark priced x402 endpoints as listed/connectable until x402 payment support is implemented.
- Resolve endpoint-source detail pages and API detail routes from stable encoded token IDs.
- Remove dead static activation links for old local BNB agents.
- Keep empty-state copy short and remove explanatory non-runnable UI text.

### Components

- `lib/bnb/endpoint-sources.ts`
- `lib/bnb/adapters/http.ts`
- `lib/bnb/catalog.ts`
- `app/api/bnb/agents/route.ts`
- `app/bnb/agents/page.tsx`
- `app/bnb/agents/AgentsDirectory.tsx`
- `app/bnb/agents/[chainId]/[tokenId]/page.tsx`
- `app/bnb/status/page.tsx`
- `.env.example`
- `tests/bnb-product-regressions.test.mjs`

### Tests

- Unit/regression: endpoint source env keys and defaults are present.
- Unit/regression: catalog merges endpoint sources with configured and 8004Scan records.
- Unit/regression: no local seeded BNB agents or `BNB_SHOW_LOCAL_AGENTS` fallback remain.
- Unit/regression: paid x402 endpoints are not marked hireable without x402 payment support.
- Unit/regression: bounded HTTP/x402 adapter validates public HTTPS URLs, size, and timeout.
- Unit/regression: default directory status is `all`; `Runnable` is opt-in.
- Unit/regression: stale empty-state and non-runnable explanatory copy is absent.
- Integration: `/api/bnb/agents?limit=5` returns endpoint-backed Agent402 records locally.
- Integration: `/bnb/agents/56/<encoded endpoint token>` returns HTTP 200 locally.
- Integration: `/api/bnb/agents/56/<encoded endpoint token>` returns HTTP 200 locally.
- Integration: `/api/bnb/agents?status=ready_to_run` returns no dead hire records when no runnable endpoint is available.

### Acceptance

- Users can discover real endpoint-backed services from live indexes.
- Users cannot start hire/payment flows for records Hive cannot currently execute.
- Endpoint-source profiles do not create fake 8004Scan URLs.

### Verification

- Date: 2026-08-20
- `npx tsc --noEmit`: passed.
- `npm test -- tests/bnb-product-regressions.test.mjs`: passed with 69 tests.
- `npm run build`: passed.
- `git diff --check`: passed.
- Local route checks passed:
  - `/api/bnb/runtime` reports all endpoint source toggles enabled.
  - `/api/bnb/agents?limit=5` returned endpoint-backed Agent402 services.
  - `/bnb/agents/56/agent402%3Astablecoin%3Ad7f223be1b` returned HTTP 200.
  - `/api/bnb/agents/56/agent402%3Astablecoin%3Ad7f223be1b` returned HTTP 200.
  - `/api/bnb/agents?limit=1&status=ready_to_run` returned zero runnable agents instead of dead hire records.
- Known non-fatal build output remained limited to the MetaMask optional React Native storage warning, bigint pure-JS fallback, and local sitemap MongoDB DNS refusal.

## Phase 2: Agent-Specific Capability Forms

### Units

- Replace generic task selection with agent-supported tasks only.
- Generate fields from the selected task schema.
- Auto-fill connected wallet only when wallet context is required.
- Ask for asset only when the task needs an asset.
- Keep optional details collapsed.
- Map fields to adapter arguments with schema-aware casing and enum handling.

### Components

- Capability schema registry
- Activation form renderer
- Wallet defaults
- Server job validator
- Adapter argument mapper

### Tests

- Unit: each required category exposes only valid tasks.
- Unit: unsupported capabilities fail before adapter calls.
- Unit: wallet-required jobs use the connected wallet when present.
- Unit: asset-required jobs require a valid symbol or address.
- Unit: V3 liquidity maps `lowerPrice` and `upperPrice` to endpoint-required names.
- Regression: Aave, Venus, Lista, PancakeSwap, and V3 payloads match tool schemas.
- Browser QA: all four forms on desktop and mobile.
- Accessibility: labels identify exact values without vague wording.

### Acceptance

- The form asks for the minimum correct inputs for the selected agent and task.

### Verification

- Date: 2026-08-19
- Added `getBnbAgentJobCapability` and `supportedBnbProtocolsForAgent` as the shared capability profile source.
- Protocol fields now use detected agent protocols where available instead of vague `All supported` defaults.
- The activation form uses the selected agent's profile for capability, task, field, default, and preview state.
- Preflight and activation routes pass the selected agent into the authoritative job-spec builder.
- Server validation now fails missing V3, grid, rebalance, health, and yield inputs before adapter calls.
- MCP adapter selection now blocks directory/listing tools and collateral-discovery tools from satisfying job-specific requests.
- `planning/BNB_QUICK_TEST_VALUES.md` now matches the concrete single-protocol field labels.
- `npm test`: passed with 68 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Phase 3: Payment and Run State Repair

### Units

- Resolve payment mode from agent price, x402 capability, ERC-8183 terms, and product config.
- Show `Run` for zero-price jobs.
- Show payment review only for paid jobs.
- Remove budget fields from zero-price flows.
- Split job state from payment state.
- Never show running state before the user clicks Run.
- Never show release or refund controls on no-payment jobs.

### Components

- Payment requirement resolver
- x402 preflight
- Escrow preflight
- Zero-price run path
- Job state reducer
- Settlement action guards

### Tests

- Unit: zero-price agents show `Run`.
- Unit: paid agents show exact price, recipient, and chain.
- Unit: no-payment jobs never render settlement controls.
- Unit: paid jobs cannot run before funding.
- Unit: refund transactions use bounded gas estimates.
- Integration: zero-price create-to-delivery.
- Integration: escrow create-to-fund-to-delivery-to-release.
- Integration: refund after expiry.
- Browser QA: signed out, signed in without wallet, wrong chain, connected wallet.

### Acceptance

- Users see only actions that are valid for the current auth, wallet, payment, and job state.

### Progress

- Date: 2026-08-19
- `BNB_ZERO_PRICE_RUNS_ENABLED` now controls the unpriced run policy.
- Unpriced agents skip escrow by default when zero-price runs are enabled.
- `BNB_FORCE_ESCROW_FOR_UNPRICED_AGENTS` still overrides free runs when explicitly enabled.
- Free-run activation records now start as `saved` instead of `awaiting_funding`.
- Escrow fund, release, and refund transaction requests now include bounded gas limits passed to wallet transactions.
- Run-route copy now reports `Run in progress.` instead of `Agent is running.`.
- Free-run activation uses a `Run` progress step instead of a payment step.
- Settlement APIs now reject release/refund attempts unless the record has confirmed escrow funding.
- Free-run API responses no longer return `This job does not require payment.` as user-facing copy.
- x402 support alone no longer makes an agent paid; the resolver now requires a positive listed price.
- Full x402 payment review and paid Studio V2 settlement work remains pending.
- Date: 2026-08-22
- Zero-price directory and activation flows were retested through the shared regression suite after the endpoint-backed discovery repairs.
- The remaining Phase 3 risk is paid execution: x402 payment collection and Studio V2 paid settlement still need an end-to-end implementation and browser smoke.

### Verification

- `npm test`: passed with 68 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Phase 4: Reference Studio V2 Agents

### Units

- Build four real Studio V2 reference agents.
- Register each with ERC-8004 identity.
- Expose callable endpoints.
- Set zero price where useful for judging.
- Add x402 or ERC-8183 paid pricing to at least one agent.
- Configure references through `BNB_REFERENCE_AGENTS_JSON`.

### Components

- Yield Scout
- Health Sentinel
- Range Guard
- Grid Pilot
- Reference agent config loader

### Progress

- Date: 2026-08-19
- `BNB_REFERENCE_AGENTS_JSON` is now loaded by the catalog alongside `BNB_HIVE_AGENTS_JSON`.
- Reference-agent entries use the same normalization, endpoint derivation, readiness, and dedupe path as other configured agents.
- `BNB_REFERENCE_AGENTS_JSON` takes precedence over `BNB_HIVE_AGENTS_JSON` for the same chain/token identity.
- Building, registering, and smoke-testing the four real Studio V2 reference agents remains pending until live endpoint values are supplied.

### Tests

- Studio CLI doctor/audit for each agent.
- Endpoint health check for each agent.
- ERC-8004 identity link resolves for each agent.
- Marketplace readiness marks each reference agent hireable.
- One successful run per reference agent.
- One missing-input failure per reference agent.
- Production smoke after deploy.

### Acceptance

- The marketplace has at least one reliable callable agent in each required category.

## Phase 5: Delivery Formatting and Evidence

### Units

- Convert adapter output into user-readable summaries.
- Replace raw payload output with readable summaries.
- Add result, key numbers, assumptions, risks, next action, and evidence sections.
- Detect wrong-tool outputs and fail them clearly.
- Persist evidence links and raw payloads.

### Components

- Delivery formatter
- Wrong-tool detector
- Receipt model
- Job details page
- Report ingestion

### Tests

- Unit: health-factor payload formatting.
- Unit: yield route array formatting.
- Unit: agent-directory payload is not successful delivery.
- Unit: protocol mismatch is visible.
- Unit: raw payload is not the default delivery UI.
- Snapshot text tests for all four categories.
- Browser QA: job detail and account activity pages.

### Acceptance

- A non-technical user can understand what the agent did without reading JSON.

### Progress

- Date: 2026-08-19
- Run completion now stores delivery summaries from `formatBnbDeliveryText` instead of raw adapter output.
- Agent-directory payloads now show a plain-language mismatch result instead of raw arrays.
- Activation, job detail, and account activity now use one shared delivery view.
- Raw JSON payloads are no longer rendered as the default delivery UI.
- Delivery data sources are displayed as plain source lines.
- Date: 2026-08-22
- Nested result arrays such as Beefy vault lists now render as human-readable collection summaries instead of raw JSON.
- Directory outputs, documentation outputs, protocol mismatches, empty outputs, and capability mismatches are detected and rendered as explicit delivery states.
- `Technical details` UI was removed from the shared delivery component to avoid hiding the actual useful result behind raw JSON.
- Downloadable records and richer evidence receipt sections remain pending.

### Verification

- `npm test`: passed with 68 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.

## Phase 6: 8004scan Pro Data Quality

### Units

- Use Pro API key when present.
- Add cache and timeout controls.
- Track source freshness.
- Normalize identity, ownership, capabilities, reputation, feedback, activity, and network.
- Add stale and error states that do not break the marketplace.

### Components

- 8004scan client
- Cache wrapper
- Source freshness model
- Profile trust data
- Category counts

### Tests

- Unit: `X-API-Key` header selection.
- Unit: cache TTL behavior.
- Unit: timeout fallback.
- Unit: malformed source records do not crash normalization.
- Integration: `/api/bnb/agents`, detail, and search.
- Browser QA: live, stale, empty, and error states.

### Acceptance

- The marketplace gives better hiring context than a flat ERC-8004 explorer.

### Progress

- Date: 2026-08-19
- `BNB_8004SCAN_PRO_API_KEY` now takes precedence over `BNB_8004SCAN_API_KEY`.
- `BNB_8004SCAN_TIMEOUT_MS` now defaults to 8000 ms and is bounded from 500 ms to 20000 ms.
- `BNB_8004SCAN_CACHE_TTL_SECONDS` now controls fetch revalidation and is bounded from 30 seconds to 3600 seconds.
- 8004scan identity links now normalize numeric chain IDs and common BNB chain names into explorer slugs.
- Date: 2026-08-22
- 8004scan directory pagination now maps one Hive page to one source profile page so deep registry pages do not skip source pages.
- Runnable and Hive-usable endpoint records are ranked first on the first page, then the broader profile-only registry follows.
- BSC registry records that do not match the four primary product categories are preserved under `Other` instead of being dropped.
- Unfiltered all-agent pagination falls back to live network stats at the route/page boundary when a deep page fetch is slow or empty.
- The directory client no longer overwrites page navigation back to page 1 when only the page query changes.
- Date: 2026-08-23
- Durable MongoDB discovery cache is being added for normalized 8004scan and endpoint-index records.
- `/api/cron/bnb-agent-cache` refreshes bounded 8004 pages and hydrates endpoint details without making user page loads scan every profile.
- Cache hits are rejected when an unfiltered first page has too few records, so partial caches cannot replace live registry discovery.
- Richer owner history, profile source confidence, and expanded reputation display remain pending.

### Verification

- `npm test`: passed with 68 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Phase 7: Altana Permission Path

### Units

- Add Altana permission review inside relevant hire flows.
- Require spend cap, expiry, allowed contracts, allowed methods, and asset scope.
- Register sessions onchain.
- Add revoke action.
- Show Altana explorer proof.
- Store grant and revoke receipts.

### Components

- Permission schema
- Altana session API
- Session registry verifier
- Revoke API
- Permission UI
- Explorer link helpers

### Tests

- Unit: invalid spend cap, expiry, contract, and method allowlist fail.
- Unit: permission screen is hidden for report-only tasks.
- Unit: revoke is unavailable until grant confirmation.
- Integration: grant session.
- Integration: revoke session.
- Live testnet proof check.
- Browser QA: grant, active, expired, revoked.

### Acceptance

- The product proves scoped wallet autonomy without hiding risk from the user.

## Phase 8: PancakeSwap Utility

### Units

- Add PancakeSwap task templates.
- Support swap plan, liquidity plan, farming plan, and pool demand research.
- Validate token contracts.
- Fetch price, liquidity, and APY where available.
- Generate PancakeSwap deep links.
- Keep fund movement behind explicit wallet confirmation.

### Components

- PancakeSwap data client
- Token verifier
- Route/deep-link builder
- LP/range validator
- Farming comparison formatter
- Receipt evidence

### Tests

- Unit: token address validation.
- Unit: pair and range validation.
- Unit: deep-link generation.
- Unit: missing PancakeSwap data returns blocked state.
- Integration: swap plan.
- Integration: liquidity plan.
- Integration: farming plan.
- Browser QA: BNB/USDT, CAKE/BNB, and USDC/USDT examples.

### Acceptance

- PancakeSwap judges can see real trader or LP value in one flow.

## Phase 9: TermiX Agent Advantage Report

### Units

- Create guided evidence capture for three real tasks.
- Compare manual workflow with agent workflow.
- Store time, cost, output, quality score, screenshots, transaction links, and conclusion.
- Generate public report at `/bnb/report`.
- Add export-ready submission content.

### Required Cases

- Token or pool risk task
- PancakeSwap LP or yield task
- Health factor or grid strategy task

### Tests

- Unit: comparison record validation.
- Unit: incomplete evidence is hidden from public scoring.
- Unit: each public report item has manual and agent outputs.
- Integration: capture API.
- Browser QA: report readability on mobile and desktop.
- Manual: every evidence link resolves.

### Acceptance

- The report proves agents saved time or improved decision quality with real outputs.

## Phase 10: Production Hardening

### Units

- Prevent accidental BSC mainnet use when BNB env values are missing.
- Rate-limit all write APIs.
- Confirm auth ownership on all BNB writes.
- Keep SSRF-safe endpoint fetching enforced.
- Add analytics events for discovery, profile, validation, run, payment, delivery, and report.
- Add admin controls to hide malformed or unsafe listings.
- Add failure webhook for run and payment incidents.

### Components

- Network safety defaults
- Auth guards
- Rate limiter
- Endpoint security
- Analytics
- Admin moderation
- Failure notifier

### Tests

- Unit: missing server and client BNB chain env defaults to testnet.
- Security: unauthenticated writes return 401.
- Security: body-provided owner is ignored.
- Security: private and local endpoints are blocked.
- Security: write bursts are rejected.
- Integration: user A cannot view or settle user B's private job.
- Production smoke: clean browser and wallet.

### Acceptance

- The BNB marketplace is safe enough for production users.

### Progress

- Date: 2026-08-20
- Server and client BNB chain selection now default to BSC Testnet.
- BSC mainnet is selected only when the server or public client env explicitly sets mainnet or chain ID `56`.
- Date: 2026-08-22
- BNB execution and endpoint-index discovery now share the same bounded outbound fetch path: HTTPS-only, public DNS resolution, internal host suffix blocking, private/reserved IP blocking, credential-in-URL blocking, manual redirect validation, redirect depth cap, configured-header stripping on unsafe redirects, timeout cap, and response-size cap.
- Worker callback bearer checks now use constant-time comparison.
- Owner-scoped BNB record reads/writes were rechecked across job detail, activity, activation, run, payment, settlement, Altana session/revoke, and TermiX capture routes.
- Secret-pattern scan found no committed secret values in tracked project files beyond placeholders and env variable references.
- Dependency audit remains a production blocker: `npm audit --omit=dev --json` reports 60 production advisories: 25 high, 33 moderate, 2 low. Major/direct remediation candidates include `next`, `@bagsfm/bags-sdk`, `@solana/spl-token`, `@solana/web3.js`, `viem`, `wagmi`, and `@privy-io/react-auth`.
- Remaining production risks: process-local rate limiting is not enough for serverless/multiple instances, CSP is still Report-Only with broad script allowances, and the legacy agent dashboard stores raw API keys in `sessionStorage`.

## Phase 11: Submission Freeze

### Units

- Deploy public app.
- Run full QA.
- Record walkthrough video under three minutes.
- Finalize README and setup instructions.
- Finalize submission copy.
- Lock report evidence.
- Submit before 2026-09-09 UTC.

### Tests

- `npm test`
- `npm run typecheck`
- `npm run lint -- --quiet`
- `npm run build`
- `npm run bnb:testnet:smoke`
- Four category browser smoke tests.
- Clean-session auth and wallet test.
- Wrong-chain wallet test.
- Mobile screenshots.
- Desktop screenshots.
- Public route checks for `/`, `/agents`, `/report`, `/api/bnb/runtime`, and `/api/bnb/agents?limit=5`.

### Acceptance

- The public app works.
- Four category flows work.
- At least one paid or x402 path works.
- At least one zero-price Studio V2 path works.
- Altana proof exists.
- TermiX report has three real comparisons.
- PancakeSwap flow shows real LP or trader value.
- User-facing UI avoids internal protocol jargon except in technical details.
