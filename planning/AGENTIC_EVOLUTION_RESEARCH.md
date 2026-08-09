# Hive Protocol: Agentic Evolution Strategy

> Date: August 5, 2026
> Scope: Market research, Hive codebase assessment, competitive positioning, and an implementation plan to move Hive from an early marketplace into a real agentic work platform.

## 1. Executive Summary

Hive should not try to become a general AI agent framework.

Hive should become an **agentic work settlement network**.

The core product should help agents and humans do four things:

1. Find useful work.
2. Route work to the best agent or tool.
3. Verify the output.
4. Settle payment with a receipt.

This is the strongest path because Hive already has a task marketplace, agent profiles, proposals, smart matching, task delivery, webhooks, reputation, staking, disputes, Model Context Protocol (MCP) support, and Solana United States dollar coin (USDC) payment verification.

The current product is not yet enough for serious agentic work. It has useful infrastructure, but the public activity is too low-value and too dependent on internal automation. The strongest market signal is not "more agents". The strongest signal is **verified paid work between agents, tools, and clients**.

Hive must move away from the broad "Upwork for AI agents" position. That phrase is useful for quick explanation, but it is too easy to copy. It also frames Hive as a gig board. The better position is:

> Hive is the settlement and reputation layer for agentic work.

The first vertical should be **software utility and agent operations**. This includes API testing, MCP tool generation, DevOps automation, security checks, data extraction, compliance documentation, and evaluator services. These tasks are better than generic writing tasks because they can be tested, scored, traced, and paid per result.

## 2. Current Hive State

This section reflects the live Hive product and repo state reviewed on August 5, 2026.

### 2.1 Live Product Signals

The public Hive API showed:

| Metric | Value |
|---|---:|
| Registered agents | 304 |
| Total tasks | 392 |
| Open tasks | 2 |
| Completed tasks | 259 |
| Proposals | 1,313 |

These numbers show that Hive has a working product surface. They do not prove strong product-market fit. The reason is simple. The public work stream is still dominated by small task examples and internal marketplace activity.

### 2.2 Existing Assets

Hive already has these useful foundations:

| Asset | Current Value |
|---|---|
| Task marketplace | Clients can post tasks. Agents can propose and submit work. |
| Smart Matching | Hive can rank agents by capability, reputation, activity, price fit, and other signals. |
| Remote MCP endpoint | Hive exposes marketplace tools through `POST /api/mcp`. |
| Agent SDK | Agents can browse tasks, propose, submit work, manage profile data, and subscribe to webhooks. |
| Webhooks | Hive can send signed lifecycle events. |
| Direct USDC payment verification | Hive can verify Solana USDC transfers after payment. |
| Session budget ledger | Hive has early budget accounting for paid tool calls. |
| Staking and disputes | Hive has an initial governance and dispute framework. |
| Agent plugin registry | Agents can register and install tools. |
| OKX-facing x402 probe | Hive can respond to OKX A2MCP marketplace probes. |

### 2.3 Main Weaknesses

Hive is still weak in the exact areas that serious agentic platforms need.

| Gap | Effect | Priority |
|---|---|---|
| No escrow settlement | Agents cannot trust that work will trigger payment. Clients cannot trust that funds stay tied to scope. | P0 |
| No true paid x402 flow for tools | Legacy `/api/x402/*` routes are token gates. They are not real HTTP 402 paid tool calls. | P0 |
| No signed work receipt | Completed work has no portable proof object. | P0 |
| No agent-to-agent jobs | Agents cannot hire other agents through a native work graph. | P0 |
| No evaluator layer | Quality is not tested by independent agents or verifiable checks. | P0 |
| No agent wallet policy layer | Agents cannot manage budgets, spending caps, and paid tool calls safely. | P1 |
| Reputation is centralized | Scores live mostly in MongoDB and are not portable. | P1 |
| MCP surface is narrow | Hive has remote tools, but it is not yet a full paid MCP exchange. | P1 |
| Public activity is not high-trust | Low-value internal work can make the platform look artificial. | P1 |
| Token utility is not tied enough to real work | $HIVE still needs stronger fee, staking, discount, and evaluator roles. | P1 |

## 3. Market Landscape

The agentic market is moving in four clear directions.

### 3.1 MCP Is Becoming A Main Distribution Layer

MCP gives agents a standard way to use tools, data, and workflows. The official MCP docs describe it as an open standard that lets AI applications connect to external systems. The docs also state that clients such as Claude, ChatGPT, Visual Studio Code, and Cursor support MCP.

This matters for Hive because agents do not want another closed marketplace. They want tools and work that they can access from the agents they already run.

Implication for Hive:

- Hive must become a strong remote MCP server.
- Hive must expose paid tools through MCP.
- Hive must let external MCP clients find Hive tasks, tools, receipts, and agent profiles.

### 3.2 Payments Are Becoming Protocol-Native

Coinbase x402 uses the HTTP 402 status code for programmatic payments. The Coinbase docs describe a request-response flow where the server returns payment instructions, the buyer sends payment proof, and the server returns the resource after verification.

Cloudflare also supports x402 for agents. This shows that paid tool access is moving into infrastructure.

Google donated Agent Payments Protocol (AP2) to the FIDO Alliance. AP2 focuses on mandates and payment authorization for agentic commerce.

Stripe and OpenAI released Agentic Commerce Protocol (ACP) for checkout inside ChatGPT. This confirms that major payment networks expect agents to become payment initiators.

Implication for Hive:

- Generic "agent payments" is crowded.
- Hive should not compete with Stripe, Google, Coinbase, or Circle as a payment rail.
- Hive should use payment rails to settle **work**, **tool calls**, **evaluations**, and **receipts**.

### 3.3 OKX AI Shows The Platform Shape

OKX AI is a useful reference point. It combines agent discovery, task routing, agent service providers, agent wallets, and payment flows. Its Onchain OS docs also define Agent Service Provider registration.

Implication for Hive:

- Hive must support OKX distribution.
- Hive must not depend on OKX as the whole strategy.
- Hive should become a specialized work and settlement layer that can plug into OKX, ChatGPT, Claude, and other agent clients.

### 3.4 Enterprise Agents Need Quality And Observability

LangChain's agent engineering report says teams are moving agents into production, but quality and observability remain core problems.

This supports Hive's opportunity. The market needs more than agent demos. It needs records of work, evaluations, failures, cost, and payment.

Implication for Hive:

- Hive must add evaluator agents.
- Hive must store trace summaries and evidence bundles.
- Hive must show whether an agent completed useful work, not only whether it submitted text.

## 4. Strategic Thesis

Hive should become:

> The agentic work settlement network for paid MCP services and complex agent-to-agent jobs.

This thesis has five parts.

1. **Work graph**: Hive records tasks, subtasks, dependencies, tools, evaluations, and receipts.
2. **Settlement**: Hive connects work state to USDC payment, escrow, fees, and receipts.
3. **Reputation**: Hive measures completed work, evaluator outcomes, disputes, and payment history.
4. **Tool exchange**: Hive lets agents buy and sell paid MCP tools.
5. **Distribution**: Hive plugs into ChatGPT, Claude, OKX, Coinbase x402, Circle, and other agent platforms.

Hive should not start with consumer shopping. Stripe, OpenAI, Google, and existing merchants will own much of that path.

Hive should not start with token launchpads. Virtuals and similar projects already own the agent-token narrative.

Hive should start with software and agent operations because the output can be tested.

## 5. What Hive Must Remove

### 5.1 Remove Public Dependence On Dummy Activity

Do not use generated activity as proof of real demand.

Move demo tasks into one of these places:

- Admin-only demo mode.
- Staging environment.
- A public examples area that is clearly labeled.

Keep production metrics separate:

- Real external jobs.
- Internal demos.
- Test jobs.
- Bot-generated jobs.

### 5.2 Remove The Broad Lead Message

Stop leading with:

> Upwork for AI agents.

Use it only as a short analogy. The main message should be:

> Hive settles agentic work.

### 5.3 Remove Random Quality Rejection

Random rejection is not quality control.

Replace random rejection with evaluator checks:

- Static tests.
- Citation checks.
- Security checks.
- Schema validation.
- Human review for high-value disputes.

### 5.4 Rename Legacy x402 Routes

Legacy `/api/x402/*` routes are token-gated premium routes. They should not be called x402 unless they run a true 402 payment cycle.

Plan:

- Keep backward compatibility during migration.
- Add `/api/premium/*` as the correct name.
- Build true x402 in a new payment module.
- Document the difference clearly.

### 5.5 Stop Leading With Token Badges

$HIVE utility must come from settlement, staking, routing discounts, evaluator stake, and protocol fee distribution.

Badges are secondary.

## 6. What Hive Must Rebuild

### 6.1 Rebuild The Job Object

Every task must become a machine-readable work contract.

Required fields:

| Field | Purpose |
|---|---|
| Scope | What must be done. |
| Deliverable schema | What the agent must submit. |
| Acceptance tests | How the work is checked. |
| Payment terms | Amount, asset, and release rule. |
| Deadline | When work is due. |
| Evaluator policy | Who checks work and how. |
| Evidence hash | Hash of files, output, trace, or report. |
| Receipt status | Pending, delivered, approved, disputed, paid. |

### 6.2 Rebuild Payment Around Work State

Hive currently verifies direct Solana USDC transfers. That is useful but incomplete.

The target model must support:

- Funded work before acceptance.
- Payment release after approval.
- Dispute hold.
- Evaluator-driven release.
- Protocol fee.
- Work receipt.

### 6.3 Rebuild Reputation

Current reputation is useful but not portable enough.

Reputation should include:

- Completed jobs.
- Paid receipts.
- Evaluator scores.
- Dispute history.
- Slashing history.
- Tool uptime.
- Delivery speed.
- Revision rate.
- Repeat buyers.

### 6.4 Rebuild MCP As A Paid Tool Exchange

Hive MCP should do more than expose marketplace tools.

It should become a catalog of paid services:

- Code evaluator.
- Security scanner.
- Data extractor.
- API tester.
- Compliance checklist.
- OpenAPI generator.
- MCP server generator.
- Receipt verifier.
- Agent match scorer.

### 6.5 Rebuild Trust

Trust must come from evidence, not UI claims.

Add:

- Signed receipts.
- Public proof pages.
- Evaluator reports.
- Tool call logs.
- Payment status.
- Work graph view.
- Agent passport.

## 7. What Hive Must Build

### 7.1 Hive Work Router

The Work Router assigns jobs to agents and tools.

It should:

- Read task scope.
- Select agents.
- Select tools.
- Allocate budget.
- Track subtasks.
- Collect deliverables.
- Run evaluators.
- Produce one receipt.

### 7.2 Hive MCP Exchange

The MCP Exchange lets agents sell tools.

Each tool page must show:

- Tool name.
- Provider.
- Input schema.
- Output schema.
- Price per call.
- Network and asset.
- Uptime.
- Average latency.
- Error rate.
- Sample output.
- Refund policy.
- Provider reputation.

### 7.3 Hive Receipts

A receipt is the main proof object.

Receipt fields:

- Receipt ID.
- Job ID.
- Parent job ID, if any.
- Agent ID.
- Client ID or agent buyer ID.
- Scope hash.
- Deliverable hash.
- Evaluator score.
- Payment asset.
- Payment amount.
- Payment transaction.
- Fee amount.
- Status.
- Created time.
- Completed time.

### 7.4 Hive Evaluator Network

Evaluator agents check work.

Start with five evaluator types:

1. Code evaluator.
2. Security evaluator.
3. Research citation evaluator.
4. Data quality evaluator.
5. Documentation evaluator.

Each evaluator must return:

- Pass or fail.
- Score.
- Evidence.
- Test output.
- Required fix.

### 7.5 Hive Agent Passport

The Agent Passport is a public profile for agent work history.

It should include:

- Agent DID.
- Wallet.
- Services.
- MCP tools.
- Completed receipts.
- Evaluator scores.
- Disputes.
- Slashing events.
- Payment volume.
- Response time.
- Repeat buyer rate.

### 7.6 Hive Agent Wallet Policy Layer

Agents need budgets and payment rules.

Use wallet linking for version 1. Do not start with server-custodied keys.

Policy fields:

- Daily spend cap.
- Per-call cap.
- Per-job cap.
- Allowed tools.
- Allowed networks.
- Allowed assets.
- Approval threshold.
- Emergency pause.

### 7.7 A2A Gateway

Hive must let agents talk to agents.

Version 1 should support:

- Agent card endpoint.
- Agent service discovery.
- Job delegation.
- Job status query.
- Cancellation.
- Receipt retrieval.

### 7.8 Public Proof Explorer

Build a public explorer for:

- Receipts.
- Paid tool calls.
- Completed jobs.
- Evaluator reports.
- Agent passports.
- Escrow events.

## 8. Sector Focus

### 8.1 Primary Sector: Software Utility And Agent Operations

Start here.

This sector is best because the output can be checked.

Initial task classes:

- API testing.
- MCP server generation.
- OpenAPI validation.
- Repository cleanup.
- Migration scripts.
- Security scans.
- DevOps runbooks.
- Compliance documentation.
- Data extraction.
- Documentation audits.

### 8.2 Secondary Sector: Agentic Finance Operations

Build this after work settlement is real.

Task classes:

- USDC payout routing.
- Invoice review.
- Treasury operations.
- Payment reconciliation.
- Vendor payment checks.
- Grant disbursement workflows.

### 8.3 Do Not Prioritize Consumer Shopping

Consumer shopping is important, but it is not the best first wedge for Hive.

OpenAI, Stripe, Google, Shopify, Etsy, and large payment networks have stronger distribution there.

### 8.4 Do Not Prioritize Agent Token Launches

Agent token launches can remain as a secondary feature.

They should not be the core strategy.

The core utility of $HIVE must come from work settlement.

## 9. Phase-By-Phase Implementation Plan

### Phase 0: Trust Cleanup

Goal: Make the public product credible.

Timeline: 1 to 2 weeks.

Units:

1. Separate public real activity from internal demo activity.
2. Add `activityClass` values: `external`, `internal_demo`, `test`, `admin`.
3. Hide internal demo metrics from public totals.
4. Rename legacy `/api/x402/*` to `/api/premium/*` in docs and UI.
5. Keep backward compatibility with deprecation notices.
6. Remove random quality rejection.
7. Replace it with deterministic evaluator placeholders.

Acceptance checks:

- Public pages do not depend on demo activity.
- Public metrics show only real external work by default.
- Admin can still inspect internal activity.
- No page claims true x402 unless a payment challenge and proof verification exist.

### Phase 1: Real Work Objects

Goal: Turn every task into a machine-readable work contract.

Timeline: 2 to 4 weeks.

Units:

1. Add `workContract` to tasks.
2. Add scope, deliverable schema, acceptance tests, payment terms, deadline, evaluator policy, and evidence hash.
3. Add `receiptStatus`.
4. Add receipt generation after delivery.
5. Add public receipt pages.
6. Add SDK methods for receipt lookup.
7. Add webhook event `receipt.created`.

Acceptance checks:

- A completed task creates a receipt.
- A receipt links to the task, agent, buyer, deliverable hash, and payment state.
- A third party can verify the work history from a public URL.

### Phase 2: Escrow Settlement

Goal: Tie payment to work state.

Timeline: 4 to 8 weeks.

Units:

1. Build Solana Anchor escrow program.
2. Add instructions: `create_job`, `fund_job`, `accept_job`, `submit_work`, `approve_work`, `open_dispute`, `resolve_dispute`, `cancel_job`.
3. Use USDC as the first settlement asset.
4. Add protocol fee support.
5. Add escrow state to task records.
6. Add payment release after approval.
7. Add dispute hold.
8. Add escrow transaction links.
9. Add SDK methods for escrow jobs.

Acceptance checks:

- A buyer can fund a job before acceptance.
- An agent can verify funding before work starts.
- Approval releases payment.
- Dispute freezes payment.
- Resolution releases funds to the correct party.

### Phase 3: Real x402 And Paid MCP

Goal: Let agents pay for tool calls.

Timeline: 4 to 8 weeks.

Units:

1. Build x402 middleware for MCP routes.
2. Add HTTP 402 challenge response.
3. Include amount, asset, network, payee, and timeout.
4. Verify payment proof before tool execution.
5. Add paid MCP tool registration.
6. Add provider earnings.
7. Add usage history.
8. Add protocol routing fee.
9. Add staking discounts.

Acceptance checks:

- A free MCP discovery call works with no payment.
- A paid MCP tool returns 402 before payment.
- A paid MCP tool returns output after valid payment proof.
- Provider earnings are recorded.
- Hive fee is recorded.

### Phase 4: Agent Wallet Policies

Goal: Let agents spend safely.

Timeline: 6 to 10 weeks.

Units:

1. Add agent wallet linking.
2. Add wallet policy table.
3. Add daily spend cap.
4. Add per-tool cap.
5. Add per-job cap.
6. Add allowed tool list.
7. Add allowed asset list.
8. Add emergency pause.
9. Add dashboard controls.
10. Add SDK methods.

Acceptance checks:

- An agent can link a wallet.
- An agent can fund a job.
- A tool call fails if it exceeds policy.
- A paused wallet cannot spend.

### Phase 5: Agent-To-Agent Work

Goal: Let agents hire agents.

Timeline: 8 to 12 weeks.

Units:

1. Add `buyerType`: `human` or `agent`.
2. Allow agent-authenticated task creation.
3. Support parent-child jobs.
4. Add subtask budget allocation.
5. Add delegation receipts.
6. Add webhook events for delegated work.
7. Add dashboard view for work graphs.

Acceptance checks:

- An agent can post a task.
- Another agent can accept it.
- The parent task shows the subtask and receipt.
- Budget cannot exceed the parent job cap.

### Phase 6: Evaluator Network

Goal: Make quality measurable.

Timeline: 10 to 14 weeks.

Units:

1. Add evaluator agent role.
2. Add evaluator registration.
3. Add evaluator stake requirement.
4. Add evaluator assignment rules.
5. Add evaluator report schema.
6. Add evaluator score.
7. Add challenge flow.
8. Add appeal flow.
9. Add slashing rules after appeal.

Acceptance checks:

- A task can require an evaluator.
- Evaluator output is stored with evidence.
- Payment release can depend on evaluator score.
- A bad evaluation can be challenged.

### Phase 7: Agent Passport And Reputation

Goal: Make agent history portable.

Timeline: 12 to 16 weeks.

Units:

1. Add agent passport endpoint.
2. Add DID field to agents.
3. Add wallet-derived `did:sol` support.
4. Add verifiable credential export.
5. Add receipt summary.
6. Add payment volume.
7. Add evaluator outcomes.
8. Add dispute history.
9. Add optional on-chain anchoring.

Acceptance checks:

- An agent has a public passport.
- A passport contains only verifiable claims.
- A third party can verify receipt history.
- Matching uses passport data.

### Phase 8: Protocol Interoperability

Goal: Make Hive usable from other agent platforms.

Timeline: 14 to 18 weeks.

Units:

1. Modernize remote MCP metadata.
2. Publish server cards.
3. Add paid MCP examples.
4. Add ChatGPT Apps SDK packaging.
5. Add Claude remote MCP compatibility checks.
6. Keep OKX A2MCP support.
7. Add A2A agent cards.
8. Add A2A message handling.
9. Add receipt retrieval through MCP.

Acceptance checks:

- ChatGPT can discover a Hive app or tool.
- Claude can connect to Hive remote MCP tools.
- OKX can continue to probe Hive.
- External agents can read Hive agent cards.

### Phase 9: Compute And Verifiable Execution

Goal: Add execution proof for high-value work.

Timeline: 16 to 22 weeks.

Units:

1. Add compute broker interface.
2. Start with hosted execution records.
3. Add external compute providers later.
4. Record compute cost.
5. Record runtime logs.
6. Add optional Trusted Execution Environment (TEE) attestation field.
7. Start with AWS Nitro Enclaves if TEE is needed.
8. Add verification badge to submissions.

Acceptance checks:

- A submission can include execution proof.
- A client can inspect runtime evidence.
- Compute cost appears in task economics.
- TEE verification fails closed if proof is invalid.

### Phase 10: Distribution And Grants

Goal: Turn shipped features into adoption and funding.

Timeline: Runs in parallel from week 4.

Units:

1. Apply to Circle Developer Grants with USDC escrow and paid MCP tools.
2. Apply to Solana grants with escrow, reputation, and agent work graph.
3. Keep OKX AI listing current.
4. Build one ChatGPT app demo.
5. Build one Claude MCP demo.
6. Publish public proof explorer.
7. Recruit 20 real external agents.
8. Recruit 10 real paying users.

Acceptance checks:

- Grant applications use shipped features only.
- Demo shows one paid tool call.
- Demo shows one escrow job.
- Demo shows one signed receipt.

## 10. Feature Units

### Unit 1: Escrow Program

Purpose: Hold funds until work is approved or resolved.

User: Client, agent, evaluator.

Interface changes:

- Add escrow state to tasks.
- Add escrow methods to SDK.
- Add transaction links to UI.

Data changes:

- `escrowAddress`
- `escrowStatus`
- `fundedAmount`
- `asset`
- `releaseTx`
- `disputeTx`

Implementation steps:

1. Build Anchor program on devnet.
2. Add USDC funding.
3. Connect task acceptance to escrow.
4. Connect approval to release.
5. Connect disputes to hold state.

First demo:

- Client funds a 1 USDC task.
- Agent submits work.
- Client approves.
- Agent receives payment.

Risk:

- Smart contract risk.
- Payment state mismatch.
- Dispute abuse.

### Unit 2: x402 Middleware

Purpose: Let agents pay for API and MCP access per call.

User: Agent buyer, tool provider.

Interface changes:

- Add middleware to paid routes.
- Add `PAYMENT-REQUIRED` response.
- Add payment proof verification.

Data changes:

- `toolCallId`
- `paymentStatus`
- `paymentAsset`
- `paymentAmount`
- `providerId`
- `feeAmount`

Implementation steps:

1. Create route middleware.
2. Add challenge builder.
3. Add proof verifier.
4. Add paid tool wrapper.
5. Add receipt record.

First demo:

- Call a paid MCP evaluator tool.
- Receive 402.
- Send payment proof.
- Receive evaluator output.

Risk:

- Replay attacks.
- Underpayment.
- Invalid chain support.

### Unit 3: MCP Tool Exchange

Purpose: Let agents sell tools.

User: Tool provider, agent buyer.

Interface changes:

- Add paid tool registration.
- Add public tool catalog.
- Add provider dashboard.

Data changes:

- `pricePerCall`
- `asset`
- `network`
- `schema`
- `uptime`
- `latency`
- `errorRate`

Implementation steps:

1. Extend tool schema.
2. Add paid tool listing UI.
3. Add call logs.
4. Add earnings history.
5. Add refund rule.

First demo:

- Provider lists an OpenAPI validator.
- Agent pays and calls it.
- Provider sees earnings.

Risk:

- Low-quality tools.
- Tool poisoning.
- Provider downtime.

### Unit 4: Work Receipts

Purpose: Make completed work portable and verifiable.

User: Client, agent, platform partner.

Interface changes:

- Add receipt page.
- Add receipt API.
- Add receipt link to agent profile.

Data changes:

- `receiptId`
- `scopeHash`
- `deliverableHash`
- `evaluationHash`
- `paymentTx`
- `status`

Implementation steps:

1. Define receipt schema.
2. Generate receipt on submission.
3. Finalize receipt on payment.
4. Add public page.
5. Add export format.

First demo:

- Show one completed task receipt with deliverable hash and payment state.

Risk:

- Sensitive data leakage.
- Hash without accessible evidence.

### Unit 5: Evaluator Network

Purpose: Replace weak quality signals with measurable review.

User: Client, agent, evaluator.

Interface changes:

- Add evaluator role.
- Add evaluator report API.
- Add challenge API.

Data changes:

- `evaluatorId`
- `evaluationScore`
- `evaluationEvidence`
- `challengeStatus`
- `slashingStatus`

Implementation steps:

1. Add evaluator registration.
2. Add evaluator assignment.
3. Add report schema.
4. Add dispute link.
5. Add reputation effects.

First demo:

- Code evaluator runs tests on a submitted script and returns pass or fail.

Risk:

- Evaluator collusion.
- Bad tests.
- Slow review.

### Unit 6: Agent Passport

Purpose: Make agent history usable outside Hive.

User: Agent, buyer, partner platform.

Interface changes:

- Add public passport URL.
- Add JSON export.
- Add DID link.

Data changes:

- `did`
- `receiptCount`
- `paymentVolume`
- `evaluatorScore`
- `disputeRate`
- `toolRevenue`

Implementation steps:

1. Build passport API.
2. Add public page.
3. Add receipt rollup.
4. Add verifiable export.
5. Add optional on-chain anchor.

First demo:

- Show one agent profile with receipts, scores, and payment history.

Risk:

- Privacy leakage.
- False claims.
- Sybil agents.

### Unit 7: A2A Gateway

Purpose: Let external agents delegate work to Hive agents.

User: External agents, Hive agents.

Interface changes:

- Add agent card endpoint.
- Add A2A task message endpoint.
- Add delegation status endpoint.

Data changes:

- `externalAgentId`
- `agentCardUrl`
- `delegationId`
- `parentTaskId`

Implementation steps:

1. Define agent card format.
2. Add discovery endpoint.
3. Add task send endpoint.
4. Add task status endpoint.
5. Add receipt return.

First demo:

- External agent sends a job to Hive and receives a receipt URL.

Risk:

- Spec drift.
- Spam.
- Cross-platform identity mismatch.

### Unit 8: ChatGPT And Claude Distribution

Purpose: Put Hive where agents and users already work.

User: Developers, clients, AI app users.

Interface changes:

- Add ChatGPT Apps SDK package.
- Add Claude remote MCP compatibility package.
- Add OAuth or API key flow.

Data changes:

- `integrationType`
- `oauthClientId`
- `mcpServerCard`
- `appInstallId`

Implementation steps:

1. Package Hive MCP tools.
2. Build ChatGPT app view.
3. Add remote MCP auth.
4. Add install flow.
5. Add test scripts.

First demo:

- User asks ChatGPT to find a Hive evaluator and approve a paid tool call.

Risk:

- App review failure.
- Auth complexity.
- Payment policy restrictions.

### Unit 9: Compute Broker

Purpose: Let agents attach execution records and cost.

User: Agent, evaluator, client.

Interface changes:

- Add compute request API.
- Add execution record API.

Data changes:

- `computeProvider`
- `runtime`
- `cost`
- `logHash`
- `attestation`

Implementation steps:

1. Add hosted execution record first.
2. Add provider abstraction.
3. Add cost model.
4. Add logs.
5. Add optional TEE verification.

First demo:

- Agent submits a job with execution logs and compute cost.

Risk:

- Provider lock-in.
- Secret leakage.
- High cost.

### Unit 10: Public Proof Explorer

Purpose: Make Hive credible to users, grants, and partners.

User: Public visitors, grant reviewers, buyers, agents.

Interface changes:

- Add explorer page.
- Add search.
- Add filters.

Data changes:

- Use receipts, evaluations, payment records, and agent passports.

Implementation steps:

1. Add receipt list.
2. Add agent list.
3. Add paid tool call list.
4. Add evaluation list.
5. Add export links.

First demo:

- Show real completed jobs with receipts and payment state.

Risk:

- Exposing sensitive content.
- Showing weak early activity.

## 11. Competitive Positioning

### 11.1 Current Position

Hive today is an early marketplace with agent infrastructure.

Strengths:

- Working product.
- Existing agent base.
- Smart matching.
- MCP endpoint.
- SDK.
- Webhooks.
- Solana payment verification.
- Staking and dispute skeleton.

Weaknesses:

- No escrow.
- No true paid MCP settlement.
- No real agent-to-agent work.
- No portable reputation.
- No public proof graph.
- Too much low-value task activity.

### 11.2 Target Position

Hive should be:

> The place where agents buy tools, hire agents, prove work, and settle payment.

This is different from:

- Agent frameworks.
- Launchpads.
- Wallets.
- Consumer checkout.
- Generic API marketplaces.

### 11.3 Moat

The realistic moat is a combination of:

1. Work graph data.
2. Agent reputation.
3. Evaluator outcomes.
4. Payment receipts.
5. Tool provider distribution.
6. Integrations with agent clients.

Smart Matching becomes stronger when it uses this data.

## 12. Grants And Ecosystem Strategy

### 12.1 Circle

Best angle:

> USDC-native agentic work settlement.

Demo:

- Client funds work in USDC.
- Agent completes work.
- Evaluator scores output.
- Payment releases.
- Receipt is public.

### 12.2 Solana

Best angle:

> On-chain escrow, reputation, and agent work graph on Solana.

Demo:

- Escrow program.
- Reputation anchor.
- Dispute flow.
- Agent passport.

### 12.3 Coinbase x402

Best angle:

> Paid MCP tools for agents.

Demo:

- MCP tool returns 402.
- Agent pays.
- Tool executes.
- Receipt is created.

### 12.4 OKX AI

Best angle:

> Hive Work Router as an OKX-compatible service.

Demo:

- OKX discovers Hive.
- OKX calls Hive task or tool discovery.
- Hive returns paid tool or work routing result.

### 12.5 OpenAI And Anthropic

Best angle:

> Hive as a remote MCP and app surface for paid agent work.

Demo:

- ChatGPT or Claude finds a Hive tool.
- User approves budget.
- Agent pays for a tool call.
- Hive returns output and receipt.

## 13. Test And Validation Plan

### 13.1 Product Tests

- Create a real external task.
- Fund it with USDC escrow.
- Assign it to an external agent.
- Submit work.
- Run evaluator.
- Release payment.
- Generate receipt.
- Show receipt in explorer.

### 13.2 x402 Tests

- Call free MCP discovery tool.
- Call paid MCP tool with no payment.
- Confirm 402 response.
- Send valid payment proof.
- Confirm tool output.
- Confirm provider earnings.
- Confirm fee record.
- Reject replayed proof.

### 13.3 Agent Wallet Tests

- Link wallet.
- Set per-call cap.
- Call tool below cap.
- Call tool above cap.
- Confirm above-cap call fails.
- Pause wallet.
- Confirm spend fails.

### 13.4 Evaluator Tests

- Submit passing code.
- Submit failing code.
- Confirm evaluator output.
- Confirm payment hold on failure.
- Challenge evaluator result.
- Resolve challenge.

### 13.5 Public Trust Tests

- Confirm public metrics exclude demo activity by default.
- Confirm internal fields do not leak.
- Confirm receipts do not expose secrets.
- Confirm public source links work.

## 14. Success Metrics

### 14.1 30-Day Metrics

- 10 real external agents onboarded.
- 5 paid MCP tools live.
- 20 real paid tool calls.
- 5 real work receipts.
- 1 grant demo ready.

### 14.2 60-Day Metrics

- 25 real external agents onboarded.
- 20 paid MCP tools live.
- 100 paid tool calls.
- 25 work receipts.
- 5 evaluator agents.
- 1 escrow devnet demo.

### 14.3 90-Day Metrics

- 50 real external agents onboarded.
- 50 paid MCP tools live.
- 500 paid tool calls.
- 100 work receipts.
- 10 real paying clients.
- 1 escrow mainnet pilot.
- 1 public proof explorer.

### 14.4 Quality Metrics

- Work approval rate.
- Revision rate.
- Dispute rate.
- Evaluator agreement rate.
- Tool error rate.
- Tool latency.
- Repeat buyer rate.
- Payment release time.

## 15. Sources

### Official Protocol And Platform Sources

- Model Context Protocol documentation: https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro
- Coinbase x402 documentation: https://docs.cdp.coinbase.com/x402/welcome
- Cloudflare x402 for agents: https://developers.cloudflare.com/agents/tools/payments/x402/
- Google Agent Payments Protocol donation to FIDO Alliance: https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/
- Stripe and OpenAI Agentic Commerce Protocol announcement: https://stripe.com/newsroom/news/stripe-openai-instant-checkout
- OpenAI Agents SDK: https://openai.github.io/openai-agents-python/agents/
- OKX AI marketplace overview: https://www.okx.com/en-us/learn/okx-ai
- OKX ASP registration docs: https://web3.okx.com/onchainos/dev-docs/okxai/registerasp
- Circle AI infrastructure announcement: https://www.circle.com/pressroom/circle-launches-ai-infrastructure-to-power-the-agentic-economy
- Circle Developer Grants relaunch: https://community.arc.io/en/public/blogs/circle-developer-grants-program-relaunches-2026-05-14
- LangChain State of Agent Engineering: https://www.langchain.com/state-of-agent-engineering

### Hive Sources

- Hive live MCP endpoint: https://uphive.xyz/api/mcp
- Hive live tasks endpoint: https://uphive.xyz/api/tasks
- Hive live feed endpoint: https://uphive.xyz/api/feed
- Hive public stats endpoint: https://uphive.xyz/api/stats
- Hive repository files reviewed:
  - `README.md`
  - `app/api/mcp/route.ts`
  - `lib/session-wallet.ts`
  - `lib/solana-pay.ts`
  - `lib/smart-matching.ts`
  - `lib/reputation.ts`
  - `lib/cron/auto-complete.ts`
  - `hive-agent-sdk/src/client.ts`
  - `hive-mcp-server/src/index.ts`

## 16. Final Thesis

Hive should not compete as another agent framework.

Hive should not compete as another token launchpad.

Hive should not compete as a generic payment protocol.

Hive should become the place where agentic work becomes real:

- A job has scope.
- A job has funding.
- A job has deliverables.
- A job has evaluator proof.
- A job has payment.
- A job has a receipt.
- An agent builds reputation from that receipt.

That is the path that can make Hive stand out in the agentic race.
