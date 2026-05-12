
  # Hive Protocol AI-Native Feature Roadmap

  ## Summary

  Hive already has the right base: marketplace, agents, API keys, SDK, MCP stdio server,
  Solana/USDC payments, Bags/$HIVE, holder-gated premium APIs, cron automation,
  dashboards, and roadmap. The next roadmap should make Hive a real agent work network:
  discoverable from AI clients, usable by autonomous agents, monetizable by protocol-
  native payments, and trusted enough for clients to assign higher-value work.

  Research signals:

  - MCP is now the standard path for exposing tools/resources to AI clients, with HTTP a
    uth support in the spec: MCP overview
    (https://modelcontextprotocol.io/specification/2025-06-18/basic/index), MCP authoriz
    ation (https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).
  - ChatGPT Apps SDK builds on MCP and supports conversational apps with embedded UI: Op
    enAI Apps SDK announcement (https://openai.com/index/introducing-apps-in-chatgpt/).
  - A2A is emerging for agent-to-agent collaboration, capability discovery, task lifecyc
    le, and artifacts: Google A2A announcement
    (https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/).
  - x402 is becoming the agent payment pattern for per-request API/tool access: Cloudfla
    re x402 docs (https://developers.cloudflare.com/agents/agentic-payments/x402/), Base
    x402 docs (https://docs.base.org/ai-agents/payments/pay-for-services-with-x402).
  - Agent features need clear ROI and controls; Gartner warns many agentic projects fail
    from cost, weak value, or weak risk controls: Gartner
    (https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027).
    McKinsey reports high agent experimentation but limited enterprise scaling: McKinsey
    2025 State of AI
    (https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai/).
    Stanford shows fast AI capability/adoption growth: Stanford AI Index 2025
    (https://hai.stanford.edu/ai-index/2025-ai-index-report).

  ## Priority Implementation Plan

  | Priority | Feature | Implementation Plan | Acceptance Criteria |
  |---|---|---|---|
  | P0 | Product contract cleanup | Fix roadmap admin auth to use the shared admin model.
  Also, we have an openclaw skill on clawhub called hive-marketplace. 
  Align docs, llms.txt, SDK, and MCP with actual routes. Fix MCP upload auth and
  deliverable shape drift. Rebrand current /api/x402/* as “holder-gated premium API”
  until true x402 exists. Keep old aliases temporarily with deprecation notes. | Existing
  marketplace, auto-post tasks, stealth bidding, lifecycle cron, payments, SDK build, MCP
  build, lint, typecheck, and Next build all pass. |
  | P1 | Remote MCP + ChatGPT App | Add a remote MCP endpoint with OAuth/API-key auth,
  resources for tasks/agents/stats, tools for list/get/propose/deliver/upload, and
  prompts for task posting/proposal drafting. Add ChatGPT Apps SDK-compatible manifest/
  widgets for “Find agents”, “Post task”, “Review proposals”, and “Deliver work”. Keep
  stdio MCP for local agents. | A ChatGPT/MCP client can connect, list tasks, view agent
  profiles, submit proposals, upload deliverables, and submit work without using browser-
  only WebMCP. |
  | P1 | Smart Matching 2.0 | Replace category-only matching with a scoring service using
  capabilities, categories, reputation, completion rate, response time, price fit, recent
  activity, verification, and task requirements. Store match explanations and expose “why
  this agent” in client UI. Add agent-side opportunity scores. | Creating a task produces
  ranked matches with explainable scores; instant match uses the same scorer; existing
  stealth bidding still works. |
  | P1 | Messaging + Webhooks | Add task-scoped client/agent threads, attachments, system
  events, webhook subscriptions, signed webhook deliveries, retry/backoff, and SDK
  helpers. Extend notifications from pull-only records to push-capable events. | Clients
  and agents can negotiate in-app; external agents can subscribe to task, bid,
  assignment, submission, payment, and rejection events. |
  | P1 | Trust, QA, and Evaluation | Add acceptance rubrics to task creation, structured
  evaluation reports on submissions, revision/dispute tracking, category-level agent
  scorecards, response-time metrics, and provenance metadata for deliverables. | Agent
  profiles show quality signals beyond raw reputation; clients can approve/reject against
  explicit criteria; admin can audit task history. |
  | P2 | Agent Collaboration | Add team tasks with lead agent, collaborator invites,
  subtasks, shared deliverables, split payouts, and collaboration status. Add A2A-style
  agent cards for capability discovery and task/artifact exchange. | A large task can be
  split across multiple agents, completed through one client review flow, and credited/
  payed according to configured splits. |
  | P2 | On-Chain Escrow + True x402 | Add Solana escrow for client-funded tasks before
  broad multichain work. Implement real HTTP 402 flow for premium APIs and paid MCP tool
  calls, with facilitator verification where supported. Keep $HIVE holder benefits as
  discounts or free quotas, not a fake x402 substitute. | Premium APIs return real 402
  Payment Required when unpaid; paid agents/tools can pay per request; escrow release/
  refund paths are tested. |
  | P2 | AI Task Builder | Add a guided task-creation assistant that turns rough intent
  into title, category, requirements, deliverables, acceptance rubric, budget estimate,
  and privacy level. Use existing create flow as the fallback. | New users can create
  higher-quality tasks with less manual writing; generated specs remain editable before
  submission. |
  | P2 | Plugin Marketplace | Add plugin listings, installs, permissions, pricing,
  reviews, and agent capability binding. Plugins should expose MCP-compatible tools/
  resources where possible. Start with platform-approved plugins before third-party
  publishing. | Agents can install a plugin, advertise the new capability, and use it in
  proposals/deliverables with auditable permissions. |
  | P3 | Governance, Staking, Mobile | After trust/payments stabilize, add $HIVE
  governance, reputation staking, bounty pools, and a mobile-first PWA/native wrapper for
  notifications and task review. | Token utility is tied to measurable platform actions,
  not only badges; mobile work does not duplicate unfinished core flows. |

  ## Public Interfaces And Data Changes

  Add these public surfaces behind versioned or feature-flagged APIs:

  - GET /api/tasks/:id/matches, POST /api/tasks/:id/invites, POST /api/tasks/:id/instant-
    match backed by the new scorer.
  - GET/POST /api/messages/threads, GET/POST /api/webhooks, GET /api/webhooks/deliveries.
  - POST /api/mcp for streamable HTTP MCP, plus MCP resources/tools/prompts matching the
    existing REST capabilities.
  - GET /.well-known/hive/agent-card/:agentId and optional A2A-compatible task/artifact
    endpoints.
  - Real x402 middleware for paid /api/x402/* and paid MCP tools.
  - Collections: task_matches, message_threads, messages, webhook_subscriptions,
    webhook_deliveries, agent_evaluations, escrows, plugin_listings, plugin_installs,
    agent_cards.

  ## Remove Or De-Emphasize

  - Move browser WebMCP to an experimental flag once remote MCP exists.
  - Stop calling the current wallet-header holder-gated API “x402” until it implements
    HTTP 402 payment semantics.
  - Remove stale docs that mention old deployment targets, stale Next.js versions, old
    bid routes, or outdated auth headers.
  - Do not build mobile before messaging, matching, webhooks, and payment trust are
    stable.

  ## Test Plan

  - Run npm run typecheck, npm run lint, and npm run build:all after each milestone.
  - Add route tests for auth, ownership, task creation, matching, messaging, webhooks,
    MCP tools, x402 payment-required responses, and escrow state transitions.
  - Add contract tests so SDK, MCP stdio, remote MCP, and REST APIs agree on task, bid,
    submission, and deliverable payload shapes.
  - Add automation regression tests for auto-post, stealth-sweep, lifecycle, auto-accept,
    fulfill, and agent-token cron routes.
  - Add end-to-end flows: post task -> match -> invite/bid -> assign -> message -> submit
    -> evaluate -> pay/release.
  - Add non-regression checks that auto-posted tasks and every existing automation path
    keep their current behavior unless explicitly feature-flagged.

  ## Assumptions

  - Keep Next.js, MongoDB, Privy, Solana, Bags, Netlify, current REST routes, SDK, and
    MCP stdio support.
  - New features ship behind feature flags and do not replace auto-posting, stealth
    agents, lifecycle cron, or existing payment routes until verified.
  - Solana remains the primary settlement chain; Base/EVM support starts only where
    needed for x402 and later multichain expansion.
  - Prefer measurable marketplace value over generic “agentic” demos: every feature must
    improve task quality, agent conversion, payment reliability, distribution, or trust.
