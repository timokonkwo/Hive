# Build the Era: Final Hive Plan to Win

> Program: BNB Chain Build the Era / Smart Money Era
> Build period: August 5, 2026 to September 9, 2026
> Judging: September 9, 2026 to September 23, 2026
> Winner announcement: November 5, 2026
> Target product: Hive for BNB Agent Studio at `bnb.uphive.xyz`

## 1. Executive Summary

Build **Hive for BNB Agent Studio** as a BNB-native marketplace at `bnb.uphive.xyz`, powered by Hive's existing marketplace engine but focused entirely on live BSC agents.

The goal is not to make "Hive but with BNB added." The goal is to win the official BNB Agent Studio marketplace spot by shipping the clearest place to **find, compare, activate, and evaluate live BSC agents**.

BNB Chain already has agent supply. 8004scan proves those agents exist. The missing product is the activation marketplace: a place where a user can see which agent to trust, what it does, what it costs, what permissions it needs, and then put it to work.

Hive should win by being that missing layer.

Official sources to keep as source of truth:

- https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace
- https://www.bnbchain.org/en/hackathons/smart-money-era
- https://www.bnbchain.org/en/bnb-agent-studio
- https://8004scan.io/developers

## 2. What BNB Chain Wants

BNB Chain wants the best AI agent marketplace on BNB Smart Chain.

The winning product must do more than list agents. It must help real users:

- browse live BSC agents,
- filter by useful categories,
- compare agents with rich and accurate data,
- understand trust and capability,
- activate agents end to end,
- and see proof that agents outperform manual work.

### Main Track Criteria

| Criterion | What Hive must show |
|:--|:--|
| Functionality | Browse, filter, compare, activate, and track agents end to end. |
| Data quality | Rich BSC-native agent data, freshness timestamps, trust breakdowns, and actionable scores. |
| Agent diversity | Equal depth across the required categories, not just one polished category. |
| Real-world usage | Live/testnet transactions, activation proof, and measured task outputs. |

### Required Categories

The BNB marketplace must make these four categories first-class:

1. Rebalancing
2. Grid Trading
3. Yield Optimisation
4. Health Factor Monitoring

The product should not bury one or two of these as generic DeFi tags. Each category needs comparable UI depth, agent cards, filters, detail pages, activation templates, and proof examples.

### Partner Tracks

| Track | Winning requirement |
|:--|:--|
| TermiX | Publish an Agent Advantage Report comparing at least 3 real tasks with and without agents hired through the marketplace. |
| PancakeSwap | Deliver real benefit to traders or liquidity providers. |
| Altana | Show agents transacting with scoped wallets, spend caps, expiries, revocation visibility, and explorer proof. |

## 3. Winning Position

Most teams will build an ERC-8004 explorer: query 8004scan, render cards, add filters, and call it a marketplace. That is a throwaway project.

Hive should avoid that trap.

The winning positioning:

> **Hive turns BNB Agent Studio's agent supply into a usable marketplace.**

That means:

- 8004scan is the registry and discovery data source.
- BNB Agent Studio is the agent creation and registration ecosystem.
- Hive is the activation, trust, matching, proof, and marketplace layer.

This pitch is sharper than "agent marketplace" because it explains why Hive is needed even though BNB already has 8004scan and Agent Studio.

## 4. Why Hive Can Win

Hive has marketplace parts that most competing teams will only talk about:

- Smart Matching.
- Agent profiles.
- Reputation scoring.
- Task lifecycle.
- Proposals and delivery.
- MCP gateway.
- Webhooks.
- Receipt and proof surfaces.
- Payment verification concepts.
- Existing agent marketplace experience.

These are the real strengths to reuse.

Important constraint: use them as proof of capability, but do not overclaim existing Solana or OKX payment routes as BNB-native support. The BNB submission must show BSC-native identity, data, activation, and proof.

The strongest Hive advantage is not "we have more agents." BNB already has plenty. The real advantage:

> Hive knows how to turn a pile of registered agents into a trusted hiring flow.

### Unfair Advantages To Surface

| Hive strength | How it helps the BNB submission |
|:--|:--|
| Smart Matching | Ranks agents by task fit instead of showing a flat registry. |
| Reputation formula | Turns raw feedback into an understandable score. |
| Task and receipt model | Gives judges a concrete hire-to-proof flow. |
| MCP gateway | Shows agent-facing interoperability beyond a consumer UI. |
| Webhooks and SDK | Proves production maturity for agent developers. |
| Existing marketplace UX | Reduces build time and produces a production-quality product, not a throwaway prototype. |

Before final submission, verify any production metrics used in copy, such as registered agent count, proposal count, completed tasks, or active users. If a number cannot be verified from current production analytics, leave it out.

## 5. Product Decision

Build a BNB vertical in the existing Hive app, served from:

`bnb.uphive.xyz`

Use the current Hive repo. Do not create a new repo. Do not make this the main `uphive.xyz` homepage.

Why:

- Keeps the submission BNB-native for judges.
- Avoids confusing current Solana and OKX Hive positioning.
- Reuses Hive's working product infrastructure.
- Gives BNB Chain a clean URL they could promote if Hive wins.
- Avoids maintaining a separate codebase long-term.

Do not use `agents.uphive.xyz` as the primary submission URL. It is less specific. `bnb.uphive.xyz` is clearer for BNB Chain judges and easier to remember.

## 6. Core Product

Build five surfaces.

### 6.1 BNB Agent Marketplace

The first screen must immediately signal BNB Agent Studio and live BSC agents.

Required behavior:

- Category-first browsing for the four required categories.
- Equal depth across all four categories.
- Live BSC-only primary rankings.
- Filters for category, capability, activation readiness, feedback, service type, price, and recent activity.
- Search across name, description, service metadata, capabilities, and wallet/identity.
- Sort by Hive score, feedback, activation readiness, freshness, price, and recent activity.

Agent cards should show:

- name,
- category,
- ERC-8004 identity,
- BSC status,
- owner or agent wallet,
- capabilities,
- pricing or payment method,
- feedback signal,
- trust score,
- last activity,
- supported services,
- activation readiness,
- 8004scan and BscScan links.

Do not make every indexed agent look activatable. If an agent is only discoverable, label it as discoverable only.

### 6.2 Agent Detail Pages

Each agent page must answer the question: "Can I trust and activate this agent?"

Show:

- ERC-8004 metadata.
- 8004scan link.
- BscScan link.
- owner and wallet addresses.
- service endpoints.
- MCP, A2A, x402, and ERC-8183 support when available.
- feedback history.
- recent activity.
- pricing.
- permissions required.
- freshness timestamp.
- score breakdown.
- activation templates.

Include a "Why this agent?" explanation from Hive Smart Matching. This is the clearest way to show that Hive is more than an explorer.

### 6.3 Smart Match

User types what they need in plain English.

Examples:

- "Find a safe agent to monitor my Venus health factor."
- "I need a PancakeSwap LP range rebalance suggestion."
- "Compare yield opportunities on BSC."
- "Set up a conservative grid trading strategy with capped risk."

Hive returns ranked agents with:

- fit score,
- trust score,
- activation score,
- activity score,
- risk notes,
- matched capabilities,
- explanation.

Smart Match should feel more useful than search. This is one of the main ways Hive can beat teams that only build listings.

### 6.4 Activation Flow

The core journey:

1. Choose category.
2. Choose agent.
3. Choose task template.
4. Set spend cap.
5. Set expiry.
6. Review permissions.
7. Activate.
8. Receive proof or status.

Activation templates:

- Rebalance LP position.
- Create grid strategy.
- Compare yield routes.
- Monitor health factor.
- Audit a token or pool.

Prefer BNB Agent Studio / ERC-8183 callable agents where available. If an agent has no callable interface, allow "request activation" but do not use that path as the primary user flow.

Store activation attempts and proof links for the report.

### 6.5 Proof and Agent Advantage Report

Public page:

`/bnb/report`

The report should be a product page, not just a Markdown file.

For each task, include:

- task objective,
- manual workflow,
- agent workflow,
- time spent,
- cost,
- output quality,
- actual output,
- screenshots,
- explorer/proof links,
- final verdict.

This page directly supports TermiX and strengthens the main track.

## 7. Data Layer

Use 8004scan as the primary data source.

Add BNB API namespace:

- `GET /api/bnb/agents`
- `GET /api/bnb/agents/[chainId]/[tokenId]`
- `POST /api/bnb/match`
- `POST /api/bnb/activate`
- `GET /api/bnb/report`

Normalize into a `BnbAgentProfile` model:

- `chainId`
- `tokenId`
- `name`
- `description`
- `category`
- `ownerAddress`
- `agentWallet`
- `identityRegistry`
- `metadataUri`
- `services`
- `capabilities`
- `x402Support`
- `erc8183Support`
- `mcpSupport`
- `a2aSupport`
- `feedback`
- `lastActivity`
- `activationStatus`
- `scoreBreakdown`
- `sourceFreshness`

Implementation rules:

- Cache API responses to avoid rate-limit failures.
- Show freshness timestamps in the UI.
- Show stale data warnings instead of silently hiding failures.
- Keep BNB agent records separate from existing Hive/Solana agent records.
- Do not mix Solana payout fields into BNB agent profiles.

## 8. Scoring Model

Build a BNB-specific scoring layer using Hive's existing matching and reputation ideas.

### Score Types

| Score | Inputs |
|:--|:--|
| Fit Score | Category match, capability overlap, task-template match. |
| Trust Score | ERC-8004 feedback, metadata completeness, validation or attestation signals, explorer history. |
| Activation Score | Callable service support, ERC-8183/A2A/MCP availability, pricing clarity. |
| Activity Score | Recent transactions, recent feedback, service freshness. |
| Risk Score | Wallet/session controls, spend limits, permission clarity. |

Each score must show a short explanation. This matters for data quality judging.

The final ranking score should prioritize:

1. category fit,
2. live BSC status,
3. activation readiness,
4. feedback/trust,
5. freshness,
6. risk controls,
7. price clarity.

Do not rank a non-callable agent above a callable agent unless the UI clearly explains why.

## 9. Four Required Categories

Treat all four categories as first-class. No single-category bias.

### 9.1 Rebalancing

Use cases:

- LP range reset.
- Portfolio or position rebalance.
- PancakeSwap LP position suggestions.
- Risk-adjusted rebalance frequency.

Example task:

- "Review this PancakeSwap LP position and recommend whether to rebalance."

### 9.2 Grid Trading

Use cases:

- Grid strategy setup.
- Range selection.
- Capital allocation.
- Stop/risk limits.
- Strategy performance summary.

Example task:

- "Create a conservative BNB/USDT grid strategy with capped downside."

### 9.3 Yield Optimisation

Use cases:

- APR comparison.
- PancakeSwap farm scan.
- Risk-adjusted yield ranking.
- Opportunity alerts.

Example task:

- "Compare BSC yield options and return the safest top three opportunities."

### 9.4 Health Factor Monitoring

Use cases:

- Lending position monitoring.
- Liquidation alerts.
- Venus/lista-style health checks.
- User-defined alert thresholds.

Example task:

- "Monitor this lending position and alert before health factor becomes unsafe."

If live public supply is weak in any category, deploy or register one Hive-operated BNB Agent Studio agent for that category. These are real agents that stay live after the submission deadline.

## 10. Showcase Agents

Build 3 to 5 production agents. These are not a replacement for indexing live BSC agents. They are real Hive-operated agents that remain live and maintained after submission.

| Agent | Category | Purpose |
|:--|:--|:--|
| Yield Scout | Yield Optimisation | Scans PancakeSwap farms and BSC yield routes. |
| Range Guard | Rebalancing | Reviews LP ranges and suggests rebalance actions. |
| Grid Pilot | Grid Trading | Builds conservative grid strategies with risk limits. |
| Health Sentinel | Health Factor Monitoring | Tracks lending health and liquidation risk. |
| Audit Lens | Security / TermiX support | Reviews token, pool, and permission risk. |

Register these as ERC-8004 entities on BSC testnet or mainnet if feasible.

Minimum acceptable product state:

- At least one production agent per required category.
- At least one activation path that works end to end.
- At least one PancakeSwap-specific agent with real data.

## 11. Partner Track Plan

### 11.1 Main Track

Win condition:

Be the marketplace judges would actually use and recommend as the official BNB Agent Studio marketplace.

Winning evidence:

- public app at `bnb.uphive.xyz`,
- four category tabs with equal depth,
- live BSC agents,
- Smart Match,
- agent details with trust and activation data,
- working activation flow,
- proof report,
- polished mobile and desktop UX.

### 11.2 TermiX

Win condition:

Publish the strongest Agent Advantage Report.

Required tasks:

#### Task 1: Token or Pool Security Audit

Manual:

- inspect BscScan,
- check owner permissions,
- check liquidity,
- review proxy patterns,
- check GoPlus-style risk signals.

Agent:

- Audit Lens returns structured risk report.

Report:

- time,
- cost,
- actual output,
- screenshot,
- risk conclusion,
- quality comparison.

#### Task 2: PancakeSwap Yield Optimisation

Manual:

- compare farms and pools manually.

Agent:

- Yield Scout ranks opportunities with APR, risk notes, and assumptions.

Report:

- time,
- cost,
- recommendations,
- missed manual data points,
- quality score.

#### Task 3: LP Range or Health Monitoring

Manual:

- check position state manually.

Agent:

- Range Guard or Health Sentinel flags action.

Report:

- alert timing,
- output,
- proof link,
- quality score.

### 11.3 PancakeSwap

Win condition:

Build something PancakeSwap traders or LPs would actually want to use.

Features:

- LP range recommendations.
- Farm/yield comparison.
- Pool demand research.
- Safe swap simulation.
- Risk notes.
- Agent-generated action summary.

Strict rule:

- No agent moves user funds without explicit capped permission.

Proof:

- Show a real PancakeSwap LP/trader task from marketplace discovery to agent output.

### 11.4 Altana

Win condition:

Show session-key control clearly.

Features:

- agent has its own wallet,
- user grants scoped session,
- session has call allowlist,
- spend cap,
- expiry,
- revoke action,
- visible permission summary,
- explorer proof.

Minimum:

- at least one live testnet transaction visible in Altana explorer.

Mainnet is preferred if cost and reliability are acceptable, but testnet is acceptable if the proof is clear.

## 12. Technical Architecture

Use the current Hive Next.js app.

Add:

- BNB subdomain handling for `bnb.uphive.xyz`.
- BNB-specific routes under `/bnb`.
- BNB API namespace under `/api/bnb`.
- BSC wallet connection using the existing `wagmi` and `viem` stack.
- 8004scan ingestion and caching.
- BSC explorer link helpers.
- BNB-specific scoring and matching.
- BNB MCP endpoint if time allows.

Do not:

- migrate the whole app to BSC,
- reuse Solana USDC payment paths as BNB-native support,
- build a separate repo,
- make all 200k agents look equally activatable,
- show mock data in the primary judging path.

### Suggested Route Map

| Route | Purpose |
|:--|:--|
| `/bnb` | BNB marketplace home. |
| `/bnb/agents` | Browse and filter BSC agents. |
| `/bnb/agents/[chainId]/[tokenId]` | Agent detail page. |
| `/bnb/match` | Smart Match interface. |
| `/bnb/activate` | Activation flow. |
| `/bnb/report` | Agent Advantage Report. |
| `/api/bnb/agents` | Agent list API. |
| `/api/bnb/match` | Matching API. |
| `/api/bnb/activate` | Activation API. |
| `/api/bnb/report` | Report data API. |
| `/api/bnb/mcp` | Optional BNB MCP gateway. |

### Optional MCP Tools

If time allows, add BNB-specific MCP tools:

- `bnb_discover_agents`
- `bnb_match_agents`
- `bnb_get_agent`
- `bnb_activate_agent`
- `bnb_get_report`

This is a differentiator, not a blocker. The UI and activation proof matter more.

## 13. Execution Timeline

### Aug 6-9: Setup and Cleanup

- Remove abandoned `flow_design` branch/work before starting implementation.
- Create a `bnb-marketplace` feature branch.
- Register for the Build the Era program.
- Request 8004scan Pro access.
- Confirm BNB Agent Studio, Altana, PancakeSwap, and TermiX resource links.
- Configure `bnb.uphive.xyz` routing decision.

### Aug 10-16: Marketplace and Data

- Build 8004scan ingestion.
- Normalize BNB agent profiles.
- Build category marketplace.
- Build agent detail pages.
- Build freshness and error states.
- Build score explanations.
- Ship first deployed version.

### Aug 17-23: Activation and Matching

- Build plain-English Smart Match.
- Build activation templates per category.
- Add wallet/session UI.
- Integrate ERC-8183/A2A callable path where available.
- Create proof records for activation attempts.
- Deploy production agents for any missing categories.

### Aug 24-30: Partner Tracks

- Build PancakeSwap mode.
- Build Altana permission/session display.
- Run three TermiX Agent Advantage tasks.
- Capture screenshots, outputs, timestamps, and explorer links.
- Publish `/bnb/report`.

### Aug 31-Sep 5: Polish

- Improve mobile and desktop UX.
- Verify all four categories have equal quality.
- Add empty, stale, failed, and loading states.
- Record product walkthrough video.
- Write README and submission copy.
- Test from a clean browser.

### Sep 6-8: Submission Freeze

- Run final QA.
- Verify public deployment.
- Verify explorer links.
- Verify Agent Advantage Report.
- Submit before September 9, 2026 UTC.

## 14. Testing and Acceptance Criteria

Run before submission:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- desktop browser QA
- mobile browser QA
- clean-session deployment test

Acceptance criteria:

- `bnb.uphive.xyz` loads publicly.
- The first screen clearly communicates BNB Agent Studio marketplace.
- Four required categories are equally deep.
- Live BSC agents appear from 8004scan.
- Non-live or non-callable agents are clearly labeled.
- Smart Match works with plain-English intent.
- Agent detail pages show trust and activation data.
- At least one complete activation flow works end to end.
- PancakeSwap mode shows real trader or LP utility.
- Altana session permission flow has explorer proof.
- Agent Advantage Report has three measured comparisons.
- Product walkthrough video shows the complete journey.
- Submission copy avoids unsupported Solana/OKX payment claims.

## 15. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|:--|:--|:--|:--|
| 8004scan API is rate-limited or incomplete | Medium | High | Cache responses and fall back to BSC explorer/RPC where feasible. |
| Not enough callable agents exist in all categories | Medium | High | Deploy Hive-operated production agents for missing categories. |
| ERC-8183 activation integration takes too long | Medium | High | Build one reliable activation path first, then expand. |
| Altana SDK integration is unstable | Medium | Medium | Show clear session UI and at least one explorer-backed testnet proof. |
| PancakeSwap data integration becomes too broad | Medium | Medium | Focus on LP range and yield comparison, not full trading automation. |
| Product becomes an explorer instead of marketplace | High | High | Keep activation, matching, and proof as first-class flows. |
| Claims outrun live product | Medium | High | Only submit what is public, testable, and clearly labeled. |

## 16. Submission Checklist

- [ ] `bnb.uphive.xyz` deployed and public.
- [ ] BNB-specific homepage.
- [ ] Agent browse, search, and filters.
- [ ] Four required categories are equally deep.
- [ ] Live BSC agents shown from 8004scan.
- [ ] Agent detail pages with trust and activation data.
- [ ] Smart Match interface.
- [ ] At least one working activation path.
- [ ] PancakeSwap LP/trader utility path.
- [ ] Altana session permission path with explorer proof.
- [ ] Agent Advantage Report with three measured tasks.
- [ ] At least one showcase agent per required category.
- [ ] Product walkthrough video.
- [ ] README.
- [ ] Submission copy.
- [ ] No unsupported Solana/OKX payment overclaims.
- [ ] Build, lint, typecheck, and browser QA completed.
- [ ] Official intake form submitted before September 9, 2026 UTC.

## 17. Final Pitch

Hive turns BNB Agent Studio's agent supply into a usable marketplace.

BNB Chain already has agents. 8004scan proves they exist. The missing layer is a product where a normal user can decide which agent to trust, see what it does, activate it safely, and check whether it performed better than doing the work by hand.

Hive is built for that layer: matching, reputation, task flow, proof, receipts, and agent-facing interfaces. The BNB build makes that system native to BSC, ERC-8004, ERC-8183, and the BNB Agent Studio ecosystem.

The submission should make one thing obvious:

> If BNB Chain wants an official agent marketplace, Hive is already closest to the product they need.

## 18.5 Implementation Phases and Progress

This section tracks implementation progress on the `bnb` branch. Mark units complete only after the code is implemented and checked.

| Phase | Status | Units |
|:--|:--|:--|
| Phase 0: Planning and source grounding | Complete | Consolidated final BNB plan; confirmed 8004scan public API shape; kept BNB requirements as source of truth. |
| Phase 1: BNB data foundation | Complete | Added BNB agent types, Hive-operated agent data, scoring, report data, and initial `/api/bnb/*` endpoints. Typecheck passed. |
| Phase 2: BNB marketplace UI | Complete | Added `/bnb`, `/bnb/agents`, agent detail, matching, report, and activation pages with BNB-native positioning. Typecheck passed. |
| Phase 3: Activation permission flow | Complete | Added activation templates, spend cap/expiry permission records, `/api/bnb/activate`, and visible activation proof records. Typecheck passed. |
| Phase 4: Partner-track depth | Complete | Added PancakeSwap utility path, TermiX comparison records, Altana session permission records, partner APIs, and redesigned BNB pages with Hive logo usage. Typecheck passed. |
| Phase 5: Live integrations | Complete | Added 8004scan live switch, durable BNB record storage, `/api/bnb/records`, BSC RPC/explorer helper, `/api/bnb/bsc/address/[address]`, `/bnb/status`, and a record-backed report page. Typecheck passed. |
| Phase 6: QA and product polish | Complete | Ran focused BNB lint, typecheck, production build, wording/color scans, and desktop/mobile browser screenshot QA. Fixed mobile overflow and viewport handling. |
| Phase 7: Research refresh and micro-feature audit | Complete | Re-checked current BNB requirements, audited against the product, and implemented semantic search, user-owned receipts, wallet-alert management, comparison records, PancakeSwap job paths, and BSC address checks. |
| Phase 8: Auth and escrow hardening | Complete | Added Privy-gated write APIs, user-scoped receipts, signed-in client forms, BSC wallet support, native BNB escrow transaction construction, and the `HiveBscAgentEscrow` contract. |
| Phase 9: Real execution and settlement | Complete | Removed silent production fallbacks, made live/configured agents the production source, added BSC runtime status, PancakeSwap RPC pair analysis, backend agent execution, escrow release/refund transactions, onchain session grant/revoke transactions, BNB MCP tools, and Forge deploy scripts. |

Latest verification:

- `npm run typecheck` passed after Phases 1, 2, 3, 4, 5, 6, and 7.
- `npm run typecheck` passed after Phase 8.
- BNB UI/API/library scans passed for temporary product wording and old light-theme color remnants after the dark-mode reset.
- `npx eslint app/bnb app/api/bnb lib/bnb app/layout.tsx` passed with one existing root-layout Google Tag Manager warning and no errors.
- `npm run lint` passed with existing warnings and no errors.
- `npm run build` passed after Phase 8; the only build-time issue is the existing sitemap MongoDB DNS refusal in the local environment.
- Browser screenshots were reviewed for `/bnb`, `/bnb/agents`, `/bnb/report`, and `/bnb/status` across desktop and mobile widths.
- Browser screenshots were reviewed for `/bnb`, `/bnb/altana`, `/bnb/termix`, and `/bnb/pancakeswap` after Phase 7.
- Production-server screenshots were reviewed for `/bnb` mobile, `/bnb/termix` desktop, and `/bnb/pancakeswap` mobile after the final mobile-nav and form-spacing fixes.
- Local smoke tests passed for `/bnb`, `/bnb/agents`, `/api/bnb/agents`, `/api/bnb/match`, `/api/bnb/activate`, `/api/bnb/records`, `/api/bnb/bsc/address/[address]`, `/api/bnb/search`, `/api/bnb/termix/capture`, `/api/bnb/altana/session`, and `/api/bnb/altana/revoke`.
- Phase 7 smoke tests exposed a MongoDB `_id` response leak on newly inserted records; `saveBnbRecord` now strips internal IDs before API responses.
- Phase 8 mobile screenshots were reviewed for `/bnb`, `/bnb/altana`, and `/bnb/report`; the receipts page correctly shows a signed-out auth state.
- `npm run typecheck` passed after Phase 9.
- Phase 9 changed the production behavior: local agents are hidden in production unless `BNB_SHOW_LOCAL_AGENTS=true`, and production writes fail loudly when MongoDB is unavailable.

Deployment prerequisites still owned by the operator:

- Deploy `HiveBscAgentEscrow`.
- Deploy `HiveBscSessionRegistry`.
- Set `BNB_AGENT_ESCROW_ADDRESS`.
- Set `BNB_SESSION_REGISTRY_ADDRESS`.
- Set `BNB_BSC_RPC_URL` and `NEXT_PUBLIC_BNB_BSC_RPC_URL`.
- Set `BNB_HIVE_AGENTS_JSON` or enable verified live 8004scan discovery.

## 18.6 Research Refresh and Micro-Feature Audit

Refresh date: August 6, 2026.

Official sources re-checked:

- BNB Chain Build the Era article: confirms the marketplace must help users browse agents, understand performance, and put agents to work on BSC. It also confirms the four reference categories and partner-track needs for TermiX, Altana, and PancakeSwap.
- BNB Agent Studio page: confirms the live Studio stack around ERC-8004 identity, x402 payments, built-in LLM access, AWS AgentCore, and ERC-8183 commerce.
- BNB Agent Studio CLI reference: confirms commands for `erc8004`, `erc8183`, `x402`, `deploy`, `doctor`, `audit`, `budget`, and read-only MCP tooling.
- 8004scan Builder Hub: confirms anonymous public access, agent listing, semantic agent search, account-owned agents, stats, feedback, chains, CORS support, and rate-limit headers.
- BNB Agent SDK docs: confirms ERC-8004 agent identity fields and ERC-8183 job, escrow, evaluator, dispute, and settlement concepts.
- BNB AI Agent solutions page: confirms ERC-8004 as identity and ERC-8183 as the commerce layer for hiring and paying agents.

Audit result:

| Requirement from refresh | Product gap found | Built in Phase 7 |
|:--|:--|:--|
| Semantic discovery from 8004scan | Hive listed 8004scan agents when enabled, but intent search did not call the semantic search endpoint directly. | Added 8004scan semantic search ingestion and `/api/bnb/search`; Smart Match now merges semantic results before scoring. |
| Product clarity | The product had too many technical surfaces competing for attention. | Removed separate studio-readiness framing and kept the user flow focused on agents, hiring, receipts, wallet alerts, comparisons, PancakeSwap jobs, and BSC checks. |
| Altana revocation visibility | Session records showed spend caps and expiry, but revocation was not a product action. | Added revocation status to session records, `/api/bnb/altana/revoke`, a revocation form, and receipt display of revoked sessions. |
| TermiX evidence depth | TermiX records captured target, manual time, verdict, artifact URL, transaction hash, and notes. | Added agent time, manual output, agent output, and quality score fields to records and the TermiX form. |
| PancakeSwap safety | PancakeSwap utilities listed inputs, outputs, scoring, and receipt checklist. | Added structured guardrails for report-only output, scoped approvals, explicit confirmation, spend caps, expiry, and stop conditions. |
| Receipt review detail | Receipts counted records but hid some operational state. | Updated `/bnb/report` to show TermiX time comparison, quality score, Altana revocation status, and revocation note. |

Phase 7 files touched:

- `lib/bnb/catalog.ts`
- `lib/bnb/types.ts`
- `lib/bnb/records.ts`
- `app/api/bnb/search/route.ts`
- `app/api/bnb/termix/capture/route.ts`
- `app/api/bnb/altana/revoke/route.ts`
- `app/bnb/termix/TermixCaptureForm.tsx`
- `app/bnb/altana/AltanaRevokeForm.tsx`
- `app/bnb/altana/page.tsx`
- `app/bnb/pancakeswap/page.tsx`
- `app/bnb/report/page.tsx`
- `app/bnb/_components/BnbUi.tsx`

---

## 18. Developer Guardrails: Tone, Design, and Writing Rules

This section applies to every developer, designer, and writer who touches the BNB submission. Follow these rules without exception.

### 18.1 No AI-Generated Tone

Do not use words, sentences, or design patterns that signal AI generation. Judges and users notice these patterns instantly. They destroy credibility.

**Banned words and phrases:**

- "Revolutionize", "Revolutionizing"
- "Cutting-edge"
- "State-of-the-art"
- "Seamless" / "Seamlessly"
- "Harness the power of"
- "Unlock" (when used as marketing verb)
- "Empower" / "Empowering"
- "Supercharge"
- "Game-changer" / "Game-changing"
- "Paradigm shift"
- "Next-generation"
- "Robust" (when used to describe a product)
- "Leverage" (use "use" instead)
- "Utilize" (use "use" instead)
- "Elevate"
- "Streamline"
- "Delve into" / "Dive into" / "Deep dive"
- "In today's rapidly evolving landscape"
- "At its core"
- "It's worth noting that"
- "Let's explore"
- "Buckle up"
- Em dashes used for dramatic pauses
- Exclamation marks in product copy
- "Welcome to the future of..."

**Writing rules:**

- Use short, direct sentences.
- Say what the product does. Do not say what the product "promises" or "envisions."
- Use concrete numbers and real outputs. Do not use vague adjectives.
- Write as a human builder, not as a press release.
- If a sentence sounds like it came from a LinkedIn post, rewrite it.
- Every claim must be backed by a working feature or a real data point. If you cannot show it, do not write it.

### 18.2 ASD-STE100 Principles

All written content (UI copy, README, report, walkthrough script, submission form) must follow ASD-STE100 writing rules:

1. **One topic per sentence.** Do not combine two ideas with a comma or semicolon.
2. **Active voice.** "Hive ranks agents" not "Agents are ranked by Hive."
3. **Short sentences.** Keep sentences under 25 words. Break long sentences into two.
4. **Approved words.** Use common, direct words. "Use" not "utilize." "Show" not "surface." "Check" not "validate" (unless referring to the ERC-8004 Validation Registry specifically).
5. **No ambiguous pronouns.** "The agent returns a report" not "It returns it."
6. **One instruction per sentence.** "Click Match. Then select a category." Not "Click Match and select a category."
7. **No double negatives.** "The agent is callable" not "The agent is not non-callable."
8. **Specific subjects.** Name the actor. "The user connects a wallet" not "A wallet is connected."

### 18.3 Design Rules

The UI must not look like a prototype or a generic AI template.

**Do:**

- Start from Hive's existing design language, component patterns, and layout structure. The BNB marketplace should feel like part of the same product family, not a separate app built from scratch.
- Adapt the color palette to BNB Chain's dark theme with gold/yellow accents. Keep Hive's typography, spacing, card structure, and navigation patterns.
- Reuse existing Hive components (agent cards, search bars, detail pages, status badges) and adapt them for BSC data fields.
- Use real data in every visible state. No "Lorem ipsum." No "Agent #1234."
- Show trust and risk information clearly. Users must see why they should or should not use an agent.
- Show empty, error, loading, and stale states. These signal production quality.
- Keep the layout clean. Judges scan fast.
- Make the four required categories visible on the first screen.

**Do not:**

- Use gradient backgrounds that scream "AI product."
- Use glowing orbs, neural network illustrations, or circuit-board patterns.
- Use stock photos of robots.
- Add animations that serve no purpose.
- Use rounded-corner cards with drop shadows on everything. Pick a consistent card style.
- Use purple-to-blue gradients. They are the most common AI-product cliche.
- Write taglines like "The Future of Agent Discovery" or "AI Meets DeFi."
- Show a hero section with no useful content. The first screen must have real agents or a real search bar.

### 18.4 Code and Commit Tone

- Commit messages must be short and factual. "Add 8004scan agent ingestion" not "Implement robust agent discovery pipeline."
- Variable and function names must be clear. `fetchBscAgents` not `leverageAgentEcosystem`.
- Comments must explain why, not what. Do not add comments that repeat the code.
- Do not add ASCII art banners or decorative separators in code.
