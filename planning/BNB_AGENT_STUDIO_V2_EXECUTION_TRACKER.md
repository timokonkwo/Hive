# BNB Agent Studio V2 Execution Tracker

Last updated: 2026-08-19

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
| Phase 0: Safety Baseline and Config Contract | Complete | Added tracker, env placeholders, runtime readiness, and tests. |
| Phase 1: Marketplace Readiness Gate | Complete | Centralized readiness and removed non-callable hire/request CTAs. |
| Phase 2: Agent-Specific Capability Forms | Not started | Render only the selected agent's supported tasks and arguments. |
| Phase 3: Payment and Run State Repair | Not started | Split zero-price, x402, and escrow flows cleanly. |
| Phase 4: Reference Studio V2 Agents | Not started | Add one reliable callable agent per required category. |
| Phase 5: Delivery Formatting and Evidence | Not started | Convert outputs into human summaries and receipt evidence. |
| Phase 6: 8004scan Pro Data Quality | Not started | Improve live identity, reputation, activity, and freshness data. |
| Phase 7: Altana Permission Path | Not started | Add scoped grant, session-key transaction proof, and revoke flow. |
| Phase 8: PancakeSwap Utility | Not started | Add LP, swap, farming, and pool demand workflows. |
| Phase 9: TermiX Agent Advantage Report | Not started | Capture three real agent-vs-manual comparisons. |
| Phase 10: Production Hardening | Not started | Add rate limits, ownership checks, moderation, analytics, and alerts. |
| Phase 11: Submission Freeze | Not started | Deploy, smoke test, record video, and submit. |

## Phase 0: Safety Baseline and Config Contract

### Units

- Create this tracker.
- Add environment placeholders for Studio V2, 8004scan Pro, ERC-8183, x402, reference agents, Altana, PancakeSwap, and production observability.
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
- Regression: `.env.example` contains all required Studio V2 fields.
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
- `npm test`: passed with 68 tests.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

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
- Hide raw payload under technical details.
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
- Unit: raw payload remains available in technical details.
- Snapshot text tests for all four categories.
- Browser QA: job detail and account activity pages.

### Acceptance

- A non-technical user can understand what the agent did without reading JSON.

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

- Rate-limit all write APIs.
- Confirm auth ownership on all BNB writes.
- Keep SSRF-safe endpoint fetching enforced.
- Add analytics events for discovery, profile, validation, run, payment, delivery, and report.
- Add admin controls to hide malformed or unsafe listings.
- Add failure webhook for run and payment incidents.

### Components

- Auth guards
- Rate limiter
- Endpoint security
- Analytics
- Admin moderation
- Failure notifier

### Tests

- Security: unauthenticated writes return 401.
- Security: body-provided owner is ignored.
- Security: private and local endpoints are blocked.
- Security: write bursts are rejected.
- Integration: user A cannot view or settle user B's private job.
- Production smoke: clean browser and wallet.

### Acceptance

- The BNB marketplace is safe enough for production users.

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
