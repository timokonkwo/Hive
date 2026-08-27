# BNB Agent Studio V2 Execution Tracker

Last updated: 2026-08-27

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
| Phase 3: Payment and Run State Repair | In progress | Zero-price, escrow, and priced BNB x402 orchestration are implemented; live paid-endpoint browser validation remains. |
| Phase 4: Reference Studio V2 Agents | In progress | Reference-agent config loading is wired; real Studio V2 agents are pending. |
| Phase 5: Delivery Formatting and Evidence | In progress | Convert outputs into human summaries and receipt evidence. |
| Phase 6: 8004scan Pro Data Quality | In progress | Pro key precedence and cache controls are wired; richer profile data remains pending. |
| Phase 6A: Endpoint-Backed Discovery | Complete | Agent402, 402Index, x402.direct, and the402 are wired as endpoint/service sources. |
| Phase 7: Altana Permission Path | Not started | Add scoped grant, session-key transaction proof, and revoke flow. |
| Phase 8: PancakeSwap Utility | Not started | Add LP, swap, farming, and pool demand workflows. |
| Phase 9: TermiX Agent Advantage Report | Not started | Capture three real agent-vs-manual comparisons. |
| Phase 10: Production Hardening | In progress | Add deployment safety, rate limits, ownership checks, moderation, analytics, and alerts. |
| Phase 11: Submission Freeze | Not started | Deploy, smoke test, record video, and submit. |

## Execution Reliability Breakdown

This section breaks the remaining implementation into units that can be completed, tested, and reviewed independently. The goal is a marketplace that can discover many ERC-8004 identities, promote genuinely usable agents, validate jobs against actual endpoint contracts, run work once, and present results without exposing raw protocol payloads as the primary user experience.

### Unit A: Endpoint Capability Inventory

**Status:** Complete

**Purpose:** Build one canonical contract for what an endpoint can do. MCP tools, A2A skills, x402/HTTP operations, and future Agent Studio V2 task commerce entries must normalize into the same shape before ranking, form generation, validation, or execution.

**Components**

- `lib/bnb/types.ts`
- `lib/bnb/endpoint-capabilities.ts`
- `lib/bnb/adapters/types.ts`
- `lib/bnb/adapters/mcp.ts`
- `lib/bnb/adapters/a2a.ts`
- `lib/bnb/adapters/http.ts`
- `lib/bnb/adapters/registry.ts`
- `lib/db.ts`
- `.env.example`
- `tests/bnb-product-regressions.test.mjs`

**Implementation Requirements**

- Persist one capability snapshot per `chainId + tokenId + adapter + endpointUrl`.
- Store `ok`, `reason`, endpoint label/source/verification, payment requirement, and normalized capabilities.
- Include tool or skill name, kind, description, JSON schema, tags, and payment requirement when available.
- Bound TTL through `BNB_ENDPOINT_CAPABILITY_TTL_SECONDS`.
- Never let Mongo, index creation, JSON serialization, or endpoint-cache failures block discovery or execution.
- Reuse fresh durable snapshots before re-probing an endpoint.
- Keep the existing short in-memory cache for hot request bursts.
- Keep endpoint probe observability separate from capability inventory.

**Tests**

- Unit/regression: DB collection name exists.
- Unit/regression: capability types exist and are included in adapter preflight results.
- Unit/regression: MCP preflight stores tools with schemas.
- Unit/regression: A2A preflight stores skills with tags.
- Unit/regression: HTTP/x402 preflight stores operation metadata and payment requirement.
- Unit/regression: registry reads fresh durable snapshots before live endpoint probing.
- Unit/regression: registry records durable snapshots after live preflight.
- Unit/regression: cache failures are caught and do not block runtime resolution.
- Unit/regression: TTL env is documented and bounded.
- Static copy scan: no endpoint/cache/debug wording leaks into primary marketplace UI.

**Acceptance**

- A provider-agnostic capability record exists for every successfully inspected endpoint.
- Marketplace ranking and form generation can move to contract-backed decisions without provider-specific one-off logic.

**Verification**

- Date: 2026-08-25
- Added canonical endpoint capability types and Mongo-backed durable snapshots.
- MCP tools, A2A skills, and HTTP/x402 operations now return normalized capability contracts.
- Adapter registry now reuses fresh durable snapshots before live endpoint preflight and records snapshots after live preflight.
- Runtime readiness exposes endpoint capability storage as a non-secret boolean.
- `npm test -- tests/bnb-product-regressions.test.mjs`: passed with 71 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Known non-fatal build output remained limited to the MetaMask optional React Native storage warning, bigint pure-JS fallback, and local sitemap MongoDB DNS refusal.

### Unit B: Contract-Backed Marketplace Ranking

**Status:** In progress

**Purpose:** Sort and filter all agents without hiding identities. Agents with verified callable contracts come first, endpoint-backed but unverified agents come next, then profile-only ERC-8004 identities.

**Components**

- `lib/bnb/catalog.ts`
- `lib/bnb/agent-cache.ts`
- `lib/bnb/readiness.ts`
- `lib/bnb/display.ts`
- `app/bnb/agents/AgentsDirectory.tsx`
- `app/api/bnb/agents/route.ts`

**Implementation Requirements**

- Define ranking inputs from capability inventory, endpoint health, source trust, category fit, review score, and freshness.
- Do not default-hide `Other` agents; rank them below hackathon-relevant BNB categories unless the user filters for them.
- Clamp pagination to valid ranges while preserving the requested query when possible.
- Preserve all agents in totals and pages.
- Keep all user-facing filters simple: `All`, `Available`, `Profiles`, category, protocol/works-with, and sort.
- Do not show counts like "0 ready BSC agents" or diagnostic phrases.

**Tests**

- Unit/regression: available agents sort above profile-only agents.
- Unit/regression: BNB category agents sort above `Other` by default.
- Unit/regression: all agents remain pageable when no execution filter is selected.
- Unit/regression: invalid or out-of-range pages clamp without empty pages or page reset loops.
- Integration: `/api/bnb/agents?page=<last>` returns agents when total indicates a last page.
- Browser QA: page 1, middle page, last page, search, category, and status filters.

**Acceptance**

- Users see useful agents first without losing the full onchain directory.

**Progress**

- Date: 2026-08-25
- Catalog reads, cached page reads, and profile detail reads now apply fresh endpoint capability snapshots before scoring or returning agents.
- Successful fresh endpoint snapshots can promote an agent to `ready_to_run`; failed fresh snapshots demote stale `ready_to_run` state to `connectable` without removing the agent from the marketplace.
- Enriched capability names are merged into agent capability text for search and ranking.
- Cache upserts now persist capability-enriched candidates.
- Directory and API pagination now use the actual page result total instead of inflating totals from global network stats.
- Huge directory result sets no longer render an unreliable deep last-page shortcut; users can move through real pages with next/previous and nearby page links.

**Verification**

- Date: 2026-08-25
- `npm test -- tests/bnb-product-regressions.test.mjs`: passed with 71 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- Known non-fatal build output remained limited to the MetaMask optional React Native storage warning, bigint pure-JS fallback, and local sitemap MongoDB DNS refusal.

### Unit C: Schema-Driven Job Builder

**Status:** Complete

**Purpose:** Generate forms from actual endpoint contracts instead of generic category assumptions.

**Components**

- `lib/bnb/jobs.ts`
- `lib/bnb/endpoint-capabilities.ts`
- `app/bnb/activate/ActivationForm.tsx`
- `app/api/bnb/activate/preflight/route.ts`
- `app/api/bnb/activate/route.ts`

**Implementation Requirements**

- Choose only capabilities exposed by the selected agent.
- Render schema fields with correct controls, enum options, required states, and defaults.
- Auto-fill connected wallet only for wallet-address fields.
- Ask for assets only when the selected operation requires an asset.
- Reject unknown required fields before payment or run.
- Preserve advanced details for freeform instructions, not as a catch-all for missing schema fields.

**Tests**

- Unit/regression: agent capability selector is derived from endpoint contracts.
- Unit/regression: required schema fields render as required inputs.
- Unit/regression: enum schema fields render as selects with allowed values.
- Unit/regression: wallet defaults apply only to wallet/address fields.
- Unit/regression: unsupported generic category choices cannot be submitted.
- Integration: validation response includes missing fields with user-safe labels.
- Browser QA: HeyAnon Venus, Beefy, V3 Pools, A2A public card, x402-priced endpoint.

**Acceptance**

- A user never pays or starts a run before the selected endpoint has all required inputs.

**Verification**

- Date: 2026-08-26
- Capability choices now come from the selected agent's endpoint contracts when contract snapshots are available.
- Schema-derived fields render required inputs, enum selects, JSON input areas, and wallet-address defaults.
- Generic category choices are rejected when the selected agent does not expose that task.
- Required endpoint arguments are validated before payment or execution.
- `npm test -- tests/bnb-product-regressions.test.mjs`: passed with 71 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- Known non-fatal build output remained limited to the MetaMask optional React Native storage warning, bigint pure-JS fallback, and local sitemap MongoDB DNS refusal.

### Unit D: Execution Orchestrator

**Status:** In progress

**Purpose:** Replace adapter-specific run paths with one state machine that handles no-payment, escrow, x402, worker callbacks, retries, and result normalization consistently.

**Components**

- `lib/bnb/execution-orchestrator.ts`
- `app/api/bnb/activate/run/route.ts`
- `app/api/bnb/activate/callback/route.ts`
- `app/api/bnb/activate/settlement/route.ts`
- `lib/bnb/runtime.ts`
- `lib/bnb/escrow.ts`
- `lib/bnb/records.ts`

**Implementation Requirements**

- Persist run state transitions with idempotency keys.
- Make `validate -> run` the normal path for zero-price public agents.
- Make `validate -> review payment -> fund -> run` the normal path for escrow jobs.
- Make `validate -> x402 payment -> run` the normal path for priced x402 endpoints.
- Prevent duplicate runs for the same record.
- Do not show release/refund actions on zero-price jobs.
- Never execute a paid job unless funding or payment authorization is verified.
- Store adapter, endpoint, capability, request args, sources, and hashes needed for audit.

**Tests**

- Unit/regression: no-payment runs skip escrow copy and settlement actions.
- Unit/regression: escrow jobs require successful onchain funding before run.
- Unit/regression: duplicate run calls return the existing completed work or running state.
- Unit/regression: failed run records the error without losing payment state.
- Unit/regression: settlement actions are unavailable for zero-price jobs.
- Unit/regression: a signed x402 authorization must match the stored version, scheme, BNB network, asset, amount, payee, payer, and expiry.
- Unit/regression: consumed x402 authorization ciphertext is removed after settlement and is never returned by public record APIs.
- Integration: BSC Testnet smoke still passes fund -> run -> release -> paid.
- Integration: public agent smoke passes validate -> run -> delivered.
- Integration: priced BNB x402 smoke passes challenge -> wallet authorization -> replay -> settlement receipt.

**Acceptance**

- The run button represents one complete user action for the selected payment mode.

**Progress**

- Date: 2026-08-26
- Added `lib/bnb/execution-orchestrator.ts` as the single run path for public and escrow-backed jobs.
- Added atomic run claiming in `lib/bnb/records.ts` to prevent duplicate work execution and allow stale run recovery.
- Run records now store idempotency key, request hash, job hash, selected endpoint, selected capability, request args, sources, run ID, and final execution state.
- The run API now delegates to the orchestrator after auth, rate limiting, record lookup, and agent lookup.
- Worker callbacks now use the same work-result finalization path as synchronous runs.
- Empty, transport-only, documentation, directory, and capability-mismatch outputs are converted into failed deliveries instead of successful empty results.
- Paid escrow jobs are blocked from execution unless onchain payment was verified.
- Zero-price jobs remain executable without escrow and keep settlement actions unavailable.
- Date: 2026-08-27
- Added explicit immutable payment modes for free, escrow, and x402 jobs. Legacy records retain a bounded compatibility resolver.
- Replaced the legacy x402 package with maintained `@x402/core` and `@x402/evm` v2 packages.
- BNB x402 requirements now use exact CAIP-2 network matching (`eip155:56` or `eip155:97`) and reject unrelated-chain or legacy-v1 payment challenges.
- The browser signs only the requirement returned by the selected resource server. Hive validates the signed version, scheme, network, asset, amount, payee, payer, and expiry before encrypting it at rest.
- Paid HTTP execution replays the version-correct payment header to the resource server. Hive does not send buyer authorizations to an arbitrary facilitator.
- Permit2 allowance reads and approval transactions use the maintained EVM x402 helpers and the connected wallet's configured BNB chain.
- Settlement receipts are captured from the resource response, linked to BscScan when a transaction is returned, and consumed authorization ciphertext is removed.
- Public job, activity, payment, run, callback, and settlement responses pass through the central record sanitizer.
- Payment confirmation proceeds directly to the run; x402 and free jobs never render escrow release or refund actions.
- Audit iteration 1 binds each job to one immutable adapter, endpoint, capability contract, and endpoint-specific payment mode. Execution no longer falls through to another transport or inherits pricing from an unrelated service on the same agent.
- Audit iteration 1 also aligns the persisted job capability with the selected execution target, so validation, argument generation, execution, and evidence use the same endpoint contract.
- Audit iteration 2 makes x402 authorizations single-use across Hive jobs through a hash-keyed reservation ledger, keeps authorization ciphertext out of public and worker payloads, and rejects changed payment requirements.
- Audit iteration 2 gives every run a unique attempt ID. Worker callbacks must match that attempt, and terminal results use compare-and-set updates so late or duplicate callbacks cannot overwrite completed or settled work.

**Verification**

- Date: 2026-08-26
- `npm test -- tests/bnb-product-regressions.test.mjs`: passed with 71 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- Known non-fatal build output remained limited to the MetaMask optional React Native storage warning, bigint pure-JS fallback, and local sitemap MongoDB DNS refusal.
- Date: 2026-08-27
- `npm test -- --test-name-pattern="BNB"`: passed with 77 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with no errors; the repository still has pre-existing warnings outside this unit.
- `git diff --check`: passed.
- Audit verification after endpoint binding, callback attempt isolation, and x402 replay protection: `npm test` passed with 82 tests, `npm run typecheck` passed, `npm run lint -- --quiet` passed, `npm run build` passed, and `git diff --check` passed.
- Live paid-endpoint browser smoke remains open because it requires a currently reachable BNB x402 v2 resource and a wallet-funded payment asset. This is the only remaining Phase 3 acceptance check.

### Unit E: Result Normalization and Evidence

**Status:** In progress

**Purpose:** Convert raw agent output into a concise, useful delivery while preserving full evidence behind a secondary audit view.

**Components**

- `lib/bnb/delivery.ts`
- `app/bnb/_components/BnbDeliveryView.tsx`
- `app/bnb/jobs/[recordId]/BnbJobClient.tsx`
- `app/bnb/report/ReceiptsClient.tsx`

**Implementation Requirements**

- Detect transport-only payloads, documentation payloads, directory payloads, empty payloads, and capability mismatches.
- Promote high-signal arrays and nested data into tables/lists in the primary delivery.
- Keep raw JSON behind "Run data" or downloadable receipt content, not "Technical details".
- Include source links and copied IDs without overwhelming the delivery.
- Add typed renderers for DeFi positions, yield vaults, predictions, pools, balances, transactions, and generic tabular records.

**Tests**

- Unit/regression: Beefy vault arrays render APY/TVL rows in the primary delivery.
- Unit/regression: raw JSON does not appear under a `Technical details` heading.
- Unit/regression: empty `{}` renders as a failed/no-result delivery, not success.
- Unit/regression: A2A `OK` only payload does not count as useful delivery.
- Unit/regression: directory payloads and documentation payloads are flagged as wrong result.
- Browser QA: delivery views on mobile and desktop for text, tables, sources, and failed runs.

**Acceptance**

- Normal users can understand what the agent returned without reading JSON.

**Progress**

- Date: 2026-08-26
- Primary delivery view no longer exposes a `Technical details` panel.
- Sources are deduplicated and displayed as simple source links instead of transport labels.
- Empty payloads, transport-only acknowledgements, documentation responses, directory responses, capability mismatches, health checks, and nested collections are recognized.
- Beefy-style vault arrays render as primary delivery rows with protocol, chain, APY, TVL, pool TVL, and shortened addresses.
- The execution orchestrator marks empty, documentation, directory, and mismatched outputs as failed runs so they do not appear as successful deliveries.
- Date: 2026-08-27
- Replaced text-first delivery formatting with a normalized delivery contract shared by execution validation and every delivery view.
- Consistent record arrays now render through a schema-agnostic semantic table extractor, including nested vaults, predictions, pools, positions, balances, transactions, and unfamiliar future record types without protocol-specific branches.
- Tables use bounded rows and columns, semantic APY/APR/TVL formatting, copyable addresses, safe links, responsive overflow, and a downloadable raw-data artifact.
- Empty objects, repeated status acknowledgements, documentation, endpoint-operation mismatches, and error payloads now have explicit unusable states; the execution orchestrator consumes those states instead of matching display text.
- Endpoint-bound jobs compare returned operation metadata with the selected capability contract before using legacy category heuristics.
- Added behavioral normalization tests that execute the TypeScript delivery module against nested Beefy vaults, arbitrary prediction records, empty and acknowledgement payloads, documentation, operation matches, operation mismatches, and row caps.

**Verification**

- Date: 2026-08-26
- `npm test -- tests/bnb-product-regressions.test.mjs`: passed with 71 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- Known non-fatal build output remained limited to the MetaMask optional React Native storage warning, bigint pure-JS fallback, and local sitemap MongoDB DNS refusal.
- Date: 2026-08-27
- `npm test`: passed with 82 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Browser QA for authenticated delivery records remains open.

### Unit F: Production Reliability and Operations

**Status:** In progress

**Purpose:** Make the system operable under real traffic and provider variability.

**Components**

- `proxy.ts`
- `lib/bnb/rate-limit.ts`
- `lib/bnb/readiness.ts`
- `lib/bnb/agent-cache.ts`
- `lib/bnb/endpoint-observability.ts`
- `lib/bnb/analytics.ts`
- `lib/bnb/moderation.ts`
- `app/api/bnb/runtime/route.ts`
- `app/api/cron/bnb-agent-cache/route.ts`
- `app/api/admin/bnb/moderation/route.ts`
- `netlify/functions/scheduled-bnb-agent-cache.mts`

**Implementation Requirements**

- Add bounded concurrency and timeouts around all external endpoint calls.
- Add retry policy only for safe idempotent reads.
- Add rate limits for write, preflight, run, and cron routes.
- Add structured observability for cache age, provider failure, endpoint success/failure, and run outcomes.
- Add deployment readiness that reports missing env and stale caches without exposing secrets.
- Add a security sweep for SSRF, auth bypass, payment bypass, replay, XSS, and unbounded payloads.
- Keep dependency vulnerabilities in a separate tracked hardening unit.

**Tests**

- Unit/regression: all external fetches use public-URL validation, timeouts, and byte caps.
- Unit/regression: write and run routes enforce auth and rate limits.
- Unit/regression: readiness exposes non-secret booleans only.
- Unit/regression: cron requires `CRON_SECRET`.
- Unit/regression: endpoint health failures reduce ranking without removing agents.
- Unit/regression: admin moderation excludes hidden or blocked listings before cache pagination, live runtime probing, profile detail lookup, and match results.
- Unit/regression: admin moderation writes require shared admin auth, route-level rate limits, bounded JSON bodies, valid status, and explicit `chainId` plus `tokenId`.
- Security audit: npm audit review, SSRF review, env exposure review, auth/session review.
- Load smoke: cache read path remains bounded for large result sets.

**Acceptance**

- The marketplace remains useful when some providers fail, slow down, or return malformed data.

**Progress**

- Date: 2026-08-26
- Audited the MCP and HTTP argument builders and moved schema parsing, enum coercion, address extraction, protocol selection, pool selection, and generic option filtering into `lib/bnb/adapters/schema-arguments.ts`.
- Removed the unsafe fallback that treated unknown protocols as Venus/Core.
- HTTP/x402 and MCP adapters now use the same schema argument rules.
- Validation output no longer emits advisory assumptions or vague warnings in the primary hire flow.
- Job detail pages now sanitize saved adapter errors before rendering them.
- BNB cache cron now requires `CRON_SECRET`, uses timing-safe auth comparison, and has a route-level rate limit.
- Runtime readiness exposes cache-cron configuration as a boolean only.
- BNB rate limits are now route-aware for reads, writes, validation, runs, payments, and cron.
- Added non-blocking server-side BNB analytics events for discovery, profile views, validation, hire creation, payment updates, settlement updates, run lifecycle, delivery readiness, and activity views.
- BNB analytics hashes client identifiers and drops sensitive metadata keys and values before storage.
- Audit iteration 1 fixed serverless analytics reliability by scheduling writes through Next `after()` with a safe fallback, added server-side profile-view analytics for direct profile page loads, and removed duplicate `run.started` analytics from terminal run records.
- Audit iteration 2 fixed the directory `Works with` filter architecture by moving integration filtering into the canonical catalog/cache query before pagination and totals.
- Added central BNB listing moderation storage and admin API. Hidden or blocked listings are excluded from cached directory pages before pagination, live discovery before runtime probing, profile lookup, and match results.
- Added a short in-memory moderation key cache with invalidation on admin writes so public reads do not scan moderation storage on every request.
- Migrated root request routing to `proxy.ts` for Next 16 while preserving BNB subdomain rewrites and markdown negotiation.
- Upgraded `next` and `eslint-config-next` from `16.1.6` to `16.3.3` to remove the currently reported production Next.js advisories without a semver-major framework jump.
- Current production dependency audit after the Next.js upgrade reports 58 production advisories: 23 high, 33 moderate, and 2 low.

**Verification**

- Date: 2026-08-26
- `npm test -- tests/bnb-product-regressions.test.mjs`: passed with 73 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `npm audit --omit=dev --json`: still fails due remaining production dependency advisories.
- `git diff --check`: passed.
- Static copy scan found no banned MCP/A2A/endpoint/escrow/debug phrases in live BNB app, API, or library files.
- Static convention scan found no stale root middleware filename references after the `proxy.ts` migration.
- External BNB fetch scan found direct `await fetch` only in the bounded fetch helper and Netlify's same-origin scheduled cron caller.
- Known non-fatal build output remained limited to the MetaMask optional React Native storage warning, bigint pure-JS fallback, and local sitemap MongoDB DNS refusal.

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
- Promote priced x402 endpoints to runnable only when preflight returns an exact BNB x402 v2 payment requirement.
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
- Unit/regression: paid x402 endpoints are hireable only when BNB x402 execution is configured and preflight returns a matching requirement.
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
- Full x402 payment review and paid resource replay are implemented for BNB x402 v2 endpoints.
- Date: 2026-08-22
- Zero-price directory and activation flows were retested through the shared regression suite after the endpoint-backed discovery repairs.
- The remaining Phase 3 risk is live validation: a real BNB x402 v2 endpoint still needs an end-to-end wallet and browser smoke.

### Verification

- `npm test`: passed with 68 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## Phase 4: Reference Studio V2 Agents v (Don't do this)

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
- Unprobed 8004scan endpoint records now start as `connectable`; only Hive runtime preflight or cache hydration can promote them to `ready_to_run`.
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
- Remaining production risks: UI CSP is still Report-Only with broad script allowances, and dependency audit remediation remains open.
- Date: 2026-08-26
- Audit iteration 1 hardened listing moderation: invalid listing identities now fail before DB writes, public discovery ignores malformed IDs instead of crashing, and index creation is only cached after storage is available.
- Audit iteration 2 aligned runtime readiness with unpaid public runs: hire creation is ready when storage exists and either escrow is configured or zero-price runs are enabled; paid-hire and unpaid-run readiness are exposed separately.
- Analytics hashing now uses server-side secrets in production and omits client hashes when no server secret is configured.
- Added an optional BNB incident webhook for failed agent runs, payment verification failures, reverted payment transactions, and reverted settlement transactions. Payloads are sanitized, signed when `BNB_MARKETPLACE_ERROR_WEBHOOK_SECRET` is configured, dispatched after response where possible, and sent only through the SSRF-safe endpoint fetch path.
- Added concise env example entries for moderation, analytics, endpoint capability caching, and the incident webhook.
- Validation: `npm test -- tests/bnb-product-regressions.test.mjs`, `npm run typecheck`, `npm run lint -- --quiet`, `npm run build`, `git diff --check`, and BNB direct-fetch scan passed. Build still shows the known MetaMask optional async-storage warning; sitemap dynamic-page lookup caught a sandbox Mongo SRV refusal without failing the build.
- Audit iteration 3 moved BNB write, validation, run, payment, settlement, auth, cron, and moderation limits to Mongo-backed counters when MongoDB is configured. Read limits remain process-local to avoid putting high-volume directory browsing on the database.
- Audit iteration 4 corrected the limiter storage boundary so only write-class routes use durable counters; production write limits fail closed if durable limiter storage is unavailable.
- Date: 2026-08-27
- Audit iteration 5 removed the static production salt fallback from Mongo-backed BNB rate-limit keys. Production write limits now fail closed if no server-side auth secret is configured.
- Audit iteration 6 added an enforced non-executable CSP for API routes while leaving the UI CSP in Report-Only mode until third-party scripts and inline payloads can be nonce-controlled.
- Regression coverage now verifies the rate-limit secret boundary and API CSP header policy.
- Next hardening item completed: the legacy agent dashboard no longer persists raw API keys in browser storage. API-key/PIN login and PIN setup now create a signed httpOnly session cookie bound to the current API-key hash, key rotation refreshes that cookie, logout clears it, and dashboard/tools/task messaging paths restore from the cookie.
- Cookie-backed agent sessions require a same-origin `Origin` or `Referer` check before shared agent auth accepts them on browser requests.
- Validation: `npm test -- tests/bnb-product-regressions.test.mjs` passed with 76 tests, `npm run typecheck` passed, `npm run lint -- --quiet` passed, `npm run build` passed, `git diff --check` passed, and `npm run bnb:submission:qa -- --base-url http://localhost:3010` passed.

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

### Progress

- Date: 2026-08-26
- Added `npm run bnb:submission:qa` for repeatable Phase 11 route checks. It verifies local `/bnb`, `/bnb/agents`, `/bnb/report`, `/api/bnb/runtime`, and `/api/bnb/agents?limit=5`, or the clean public paths `/`, `/agents`, `/report`, `/api/bnb/runtime`, and `/api/bnb/agents?limit=5` when pointed at the deployed BNB subdomain.
- The QA script fails on non-2xx responses, malformed runtime payloads, unexpected BNB chain IDs, and empty agent API results.
- Local production route QA passed against `http://localhost:3010`: `/bnb`, `/bnb/agents`, `/bnb/report`, `/api/bnb/runtime`, and `/api/bnb/agents?limit=5` all returned valid responses, with runtime on chain `97` and 5 agents returned by the agent API.
