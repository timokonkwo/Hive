# Hive BNB Complete UI Redesign Specification

Status: Design direction approved for specification, not implementation  
Branch: `bnb-ui-redesign`  
Base: `bnb` at `b9014f0`  
Date: 2026-08-28

## 1. Purpose

This document defines a complete replacement for the Hive BNB user experience. It does not preserve the existing visual language, layouts, page composition, or component styling. It does preserve the working product capabilities, safety rules, data contracts, and job lifecycle already implemented in the BNB application.

The new product should feel like a dependable marketplace for delegated work, not a crypto dashboard and not a generic AI chat application. A user should be able to:

1. Describe work in ordinary language.
2. Find agents that can actually perform it now.
3. Understand an agent's scope, price, track record, and permissions.
4. Review the exact task and payment before confirming.
5. Watch work progress and understand failures.
6. Inspect the result and release or recover payment when applicable.

## 2. Product Position

### One-line description

Hive is a marketplace where people find, hire, and pay autonomous services on BNB Chain.

### Product promise

Find a service that can do the work, set its boundaries, pay safely, and follow the result from request to receipt.

### What the interface must communicate

- The marketplace contains both callable agents and onchain profiles.
- "Available" means the agent has passed the shared runtime eligibility contract and can accept work now.
- A profile without a callable runtime can be inspected, saved, compared, or contacted, but cannot be hired.
- The user remains in control of task scope, wallet permissions, payment, and settlement.
- Every run has a durable record with status, timestamps, result, data sources, and transaction evidence when relevant.

### Non-goals

- Do not present Hive as an AI chatbot.
- Do not lead with protocol names, standards, or infrastructure acronyms.
- Do not make every indexed identity appear hireable.
- Do not imply guaranteed returns, guaranteed execution, or platform custody.
- Do not turn the landing page into a long feature-card catalogue.
- Do not use animated decoration as a substitute for product evidence.

## 3. Source Hierarchy

The design is based on four kinds of evidence, in this order:

1. **Hive product contracts:** repository routes, types, runtime eligibility, job schemas, payment modes, and activity records.
2. **Agent-product workflows:** official documentation from products that expose task setup, tool use, execution, monitoring, and results.
3. **Real product design references:** individual systems found through `styles.refero.design`. Refero is an index, not the design source.
4. **Component and systems guidance:** the websites listed in the local Design styles guide, used to validate component anatomy, accessibility, motion, responsive scales, and implementation feasibility.

OKX.AI is a secondary market comparison only. It does not define Hive's visual system or primary information architecture.

## 4. Research Synthesis

### 4.1 Local design direction

The local `AI Agent.md` guide supports a light editorial register: paper-white and warm neutral surfaces, near-black type, sparse cool and natural accents, hairline separation, restrained shadows, and real product UI as the primary visual evidence.

This redesign adopts that restraint but does not copy the guide literally. In particular:

- Landing pages may have editorial breathing room; operational pages remain compact and scan-friendly.
- Serif display type is limited to selected public-page headings. It never appears in forms, tables, prices, statuses, or wallet information.
- Cards use a maximum 8px radius. Controls use 6px. Pills are reserved for tags, status, and segmented modes.
- Letter spacing is `0` throughout.
- No ornamental gradients, glow, glass, floating blobs, or decorative 3D assets.

### 4.2 Indexed style references

The following individual systems were selected from the styles indexed at `styles.refero.design`:

| Reference | Use in Hive | Explicitly do not copy |
| --- | --- | --- |
| [Voiceflow](https://styles.refero.design/style/03b3d707-2a30-4f53-a524-347d1b70eb2c) | Calm light canvas, product UI as proof, clear division between conversation and structured workflow | Pill-heavy navigation, centered SaaS hero, decorative orange marks |
| [Hex](https://styles.refero.design/style/3e32db74-a61d-4e72-93b8-1fb949af2c00) | Dense technical workbench inside a warm editorial frame; data carries the color | Branded type tension, violet identity, notebook metaphor |
| [Legora](https://styles.refero.design/style/f89bad29-019a-48d7-9724-c40a0d7d8171) | Warm paper, hairline rules, low-shadow authority, narrow reading measure | Monumental headlines and legal-publication mannerisms |
| [Linear](https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1) | Compact controls, command/search behavior, precise state changes, product artifacts as imagery | Dark theme, acid accent, developer-tool tone |
| [Stripe](https://styles.refero.design/style/48e5de76-05d5-4c4e-a269-c7c245b291ec) | Payment review hierarchy, left-aligned financial facts, quiet confidence | Indigo brand language and marketing composition |
| [Mercury](https://styles.refero.design/style/3172cd4d-118a-4a16-a259-6b634d32322e) | Transaction confidence, measured typography, one primary action per payment state | Dark alpine atmosphere and fully pill-shaped controls |
| [OpenSea](https://styles.refero.design/style/61f1902f-6da3-4af7-b046-3b08bc1377f6) | Marketplace filter mechanics, numeric alignment, compact comparable records | NFT imagery, dark terminal styling, three-pane desktop shell |
| [Common](https://styles.refero.design/style/54bfd692-3299-48ab-8cf5-784e632227b1) | Light data-table density, 6px shapes, hairline structure | Spectrum gradients and token-launch presentation |

The result is not a mashup of these styles. Hive uses a single visual thesis: **clear records for every job**.

### 4.3 Agentic workflow references

- [Voiceflow](https://docs.voiceflow.com/docs/agents) separates open-ended agent reasoning from deterministic workflows. Hive should disclose whether a service chooses its own steps or follows a fixed procedure.
- [Gumloop](https://docs.gumloop.com/core-concepts/agents) shows the importance of tools, triggers, outputs, and user-owned credentials. Hive should disclose the connections and permissions required before a run.
- [Relevance AI](https://relevanceai.com/agents) separates marketplace discovery, agent details, task execution, and teams of agents. Hive should not force discovery and monitoring into one screen.
- [Lindy task monitoring](https://docs.lindy.ai/fundamentals/lindy-101/tasks) exposes chronological steps, inputs, outputs, timestamps, and the exact failure location. Hive job pages should use the same observability principle without exposing raw internal noise by default.
- [OKX.AI](https://www.okx.com/en-us/learn/okx-ai) confirms that agent discovery, tasks, escrow, direct payment, identity, and reputation can coexist in one marketplace. Hive will use this only as category validation, not as a primary visual or structural template.

### 4.4 Component-system references

- [The Component Gallery](https://component.gallery/) is used to compare proven component anatomy across established systems, not to copy visual treatments.
- [Coss UI](https://coss.com/ui) is a useful inventory of accessible primitives needed by Hive: field, combobox, dialog, drawer, progress, segmented control, sheet, table, toast, and toolbar.
- [ReUI](https://reui.io/components) provides implementation references for composed filters, data grids, timelines, steppers, receipts, comparisons, and mobile sheets.
- [Utopia](https://utopia.fyi/) informs fluid spacing between bounded mobile and desktop values. Font size itself will use explicit semantic sizes rather than viewport-width scaling.
- [Open Props](https://open-props.style/) informs token naming and reusable scales, not the final values or visual identity.
- Motion references from Transitions, Motion Primitives, Kinetics, and Rauno Freiberg are limited to state continuity and feedback. Decorative motion is excluded.

### 4.5 Rejected source patterns

The following sites in the local guide are useful implementation galleries but are not visual direction: Aceternity, 21st.dev, Orbs, background generators, animated-button galleries, and prompt galleries. Their decoration-first examples create the exact generic generated-UI look this redesign must avoid.

## 5. Design Thesis

### Working name

**Clear work records**

### Character

- Light, precise, calm, and materially flat.
- Editorial on public pages; operational in the marketplace and account.
- Trust comes from facts, state, and evidence rather than badges and visual effects.
- The interface should look designed for repeated work, not for a product launch screenshot.

### Experience split

Hive has two related presentation modes built from the same tokens:

1. **Public mode:** landing, browse, match, and agent profiles. More whitespace, stronger editorial headings, real marketplace records as visual content.
2. **Work mode:** hire, job, account, activity, wallet controls, and partner tools. Denser, sans-only, left-aligned, with stable rows, timelines, and review panels.

The modes share navigation, color, controls, status language, and data formats. They differ only in density and typography.

## 6. Audience and Core Jobs

### Primary user: DeFi participant

Needs to delegate monitoring, analysis, liquidity, yield, or trading tasks without learning how the agent is implemented.

Primary questions:

- Can this service do my exact task?
- Can it run now?
- What will it access?
- What will it cost?
- What happens if it fails?
- What exactly did it deliver?

### Secondary user: Agent provider

Needs their onchain identity and callable services represented accurately. Provider publishing and management are not yet first-class public workflows in the current BNB UI, so the redesign reserves architecture for them without inventing unsupported controls.

### Secondary user: Evaluator or technical reviewer

Needs to verify identity, runtime evidence, data sources, payments, and settlement. Technical detail is available progressively, not placed in the primary decision path.

## 7. Product Vocabulary

User-facing language must describe outcomes and decisions.

| Internal term | Primary UI language | Technical detail only |
| --- | --- | --- |
| `ready_to_run` | Available | Runtime eligibility passed |
| `connectable` | Profile | Connection found; no supported hire path |
| `listed_only` | Profile | Indexed identity only |
| ERC-8004 | Onchain identity | ERC-8004 record and explorer link |
| MCP / A2A / HTTP | Connection | Protocol and endpoint capability |
| x402 | Direct payment | x402 asset, network, and payee |
| escrow | Protected payment | Contract, transaction, and settlement action |
| preflight | Final check | Adapter checks and selected execution |
| execution endpoint | How it runs | Endpoint URL and protocol |
| spend cap | Maximum payment | Session or job limit |
| settlement | Close payment | Release or refund transaction |

Never use "AI-powered," "seamless," "revolutionary," "autonomous economy," "unlock," or similar filler in core product copy.

## 8. Information Architecture

### Primary navigation

Mobile bottom navigation after entry:

- Home
- Agents
- Activity
- Account

Desktop top navigation:

- Hive wordmark
- Find an agent
- Agents
- Activity
- Account / wallet control

The primary navigation remains small. Partner tools do not occupy top-level navigation.

### Canonical route model

Current `/bnb` route prefixes may remain during implementation, but the design treats these as product destinations:

| Destination | Purpose |
| --- | --- |
| Home | Explain the literal product, start with a task, show live marketplace evidence |
| Agents | Browse, filter, sort, save, and compare |
| Match | Convert a task into a shortlist |
| Agent profile | Evaluate identity, fit, cost, evidence, and availability |
| Hire | Define, check, pay for, and start work |
| Job | Monitor, inspect result, and close payment |
| Activity | Review all hires, access requests, comparisons, and alerts |
| Account | Manage identity, wallets, selected network, and account state |
| Verify | Check a wallet, identity, token ID, or address |
| Tools | PancakeSwap analysis, Altana permissions, and Termix comparison records |

### Route hierarchy

```text
/
/agents
/agents/:chainId/:tokenId
/match
/hire/:chainId/:tokenId
/jobs/:recordId
/activity
/account
/verify
/tools/pancakeswap
/tools/wallet-alerts
/tools/termix
```

Migration may preserve existing URLs with redirects. The URL plan is subordinate to working contracts and SEO requirements.

## 9. Global Shell

### Mobile

- 48px top bar with wordmark, network status, and account icon.
- Bottom navigation appears on marketplace and account routes, not during focused hire/payment steps.
- Content edge padding: 16px at 320-479px, 20px at 480px and above.
- Primary action may become a fixed bottom action bar only when a screen has one obvious next step. It must not obscure content or system browser controls.
- Filters, compare selection, technical details, and wallet selection use bottom sheets.

### Desktop

- 64px top bar, maximum content width 1280px.
- Public pages use a 12-column grid.
- Operational pages use a stable 240px context rail only where it provides persistent value, such as hire steps or job summary. Do not add a global sidebar.
- Content columns remain readable: 680px for forms and prose, 860px for work timelines, full available width for agent results.

### Global search

One search entry supports agent name, category, capability, token ID, and plain-language task intent. Search suggestions are grouped into:

- Agents
- Capabilities
- Recent searches

Selecting a capability filters the directory. Submitting a task sentence opens Match.

## 10. Landing Page

The landing page is the actual start of the product, not a marketing detour.

### First viewport

#### Mobile composition

1. Compact navigation.
2. Literal headline: **Hire agents that can do the work.**
3. Supporting line: **Describe a task, review the cost and permissions, then follow the result from payment to receipt.**
4. Task composer with 3-4 line input and a single arrow submit icon.
5. Four compact suggestion buttons using real categories: Check a position, Rebalance liquidity, Compare yield, Set a wallet alert.
6. A visible hint of the live marketplace: the heading and first agent row must begin before the bottom of common mobile viewports.

#### Desktop composition

- Asymmetric 5/7 grid.
- Left: headline, supporting copy, and task composer.
- Right: a live, real-data job preview showing agent selection, final check, payment, running, delivery, and receipt. This is product evidence, not a decorative mockup.
- The preview uses a scrubbed example record or a clearly labeled example state. It must never imply a live user transaction.
- The next section begins within the viewport.

### Landing sections

1. **Available now:** six real ready-to-run agents in compact rows.
2. **What you can delegate:** a plain list grouped by Monitor, Analyse, Manage liquidity, and Trade. No equal feature cards.
3. **How a hire works:** one horizontal timeline on desktop and vertical timeline on mobile: Define, Check, Pay, Run, Review, Close.
4. **Recent work:** anonymized real activity aggregates when available. Do not fabricate metrics.
5. **Safety and control:** concise facts about wallet confirmation, limits, runtime checks, and receipts, presented as a full-width band with links to details.
6. Footer with product, technical documentation, contract addresses, status, and legal links.

### Landing imagery

Use only:

- Real Hive agent rows.
- Real task forms.
- Real execution timelines.
- Real result artifacts with sensitive data removed.
- Small protocol or integration marks where they identify an actual connection.

Do not use generated illustrations, robots, honeycombs, abstract network diagrams, 3D coins, or atmospheric crypto imagery.

## 11. Agent Marketplace

### Core model

The directory is a searchable result set, not a gallery. The default view uses compact rows because agents contain comparable text and facts.

### Result header

- Title: Agents
- Result count from the actual query contract.
- Search field.
- Sort menu: Recommended, Recently active, Best reviewed, Name.
- View control: List is default; compact grid is optional only if agent imagery becomes meaningful and consistently available.

### Filters

Desktop filter rail; mobile filter sheet:

- Availability: Can hire now, Profile only.
- Category.
- Connection.
- Payment type.
- Verified identity.
- Recently active.

Applied filters appear as removable chips below the search field. Clear all is a text action.

### Agent result row

Each row has stable columns:

1. Identity mark or deterministic fallback.
2. Name and verified identity indicator.
3. One-sentence service description, clamped to two lines.
4. Category and supported task count.
5. Activity and review summary.
6. Availability state.
7. Primary action.

Primary action rules:

- `ready_to_run`: **Hire**.
- `connectable`, `listed_only`, or `unavailable`: **View profile** only.
- Eligibility is derived from the shared server contract, never inferred separately in each card.

Save is an icon button with tooltip and accessible name. Compare is a checkbox. Neither competes with the primary action.

### Loading model

Use server pagination with progressive append:

- Initial URL-addressable page for fast loading, sharing, and recovery.
- **Load more** progressively appends results.
- Automatic loading may start when the sentinel becomes visible after the first explicit page, but a visible Load more control remains for keyboard and failure recovery.
- Preserve search, filters, sort, page cursor, and scroll position in URL/session state.
- Never present the loaded count as the marketplace total.
- Show `Showing 1-40 of 12,480` only when the API provides a trustworthy total. Otherwise show `40 loaded` without implying completeness.

This hybrid avoids a long numbered pagination wall while retaining deterministic URLs and accessibility.

### Compare

- Maximum four agents.
- Mobile: selection tray above bottom navigation; comparison opens full screen.
- Desktop: sticky bottom tray; comparison uses a table.
- Rows: availability, supported jobs, payment type, price, activity, reviews, required connection, expected output, owner, and onchain identity.
- Highlight meaningful differences, not every cell.

### Marketplace states

- Loading skeleton preserves exact row height.
- Empty query explains which filters removed results and offers Clear filters.
- Partial source failure keeps returned results visible and shows a restrained warning.
- Load-more failure is inline at the list end with Retry.
- Stale eligibility is rechecked on profile and again before hire.

## 12. Match Experience

Match is task-first discovery for users who do not know which category to choose.

### Step 1: Describe

- Single task textarea.
- Optional target such as wallet, position, pool, or pair.
- Optional risk choice using a segmented control: Conservative, Balanced, Flexible.
- Example text is contextual, not rotating promotional copy.

### Step 2: Clarify

Ask only fields required by the selected job schema. Do not display every possible capability field.

### Step 3: Shortlist

Return 3-5 eligible agents with a plain reason for each match:

- Supports this task.
- Can run now.
- Requires these permissions.
- Costs this amount or is free.

Profile-only records may appear under a separate **Other profiles** heading but cannot be selected for hire.

## 13. Agent Profile

### Above the fold

- Name, verification, and availability.
- Literal one-sentence description.
- Category, recent activity, review summary, and price.
- Primary action: Hire or Request access, never both at equal weight.
- Save and Compare icon controls.
- On mobile, primary action remains reachable in a bottom action bar after the header scrolls away.

### Profile sections

1. **What it does:** supported tasks and expected outputs.
2. **What it needs:** wallet, position, token, protocol, credentials, or permissions.
3. **How work is handled:** autonomous or fixed workflow, payment mode, likely steps, and user confirmation points.
4. **Track record:** completed work, recency, reviews, and failure rate only when trustworthy data exists.
5. **Connections:** user-friendly integration names.
6. **Identity:** owner, agent wallet, token ID, chain, and explorer links.
7. **Technical details:** protocols, endpoints, service descriptors, capability evidence, and raw source metadata.

### Availability module

The availability block is a shared component driven by the canonical runtime result:

- Available: "Can accept this type of work now."
- Profile: "This identity is listed, but Hive cannot start a job with it."
- Temporarily unavailable: explain a retriable reason without exposing raw infrastructure errors.

No visual component may add a Hire action without consuming this shared state.

## 14. Hire Flow

Hire is a focused four-stage flow. It uses a full page, not a modal.

### Persistent context

Desktop left rail and mobile collapsible summary show:

- Agent.
- Selected task.
- Availability.
- Maximum payment.
- Time limit.

### Stage 1: Define work

- Capability is visible only when the agent supports more than one.
- Job type uses a select or segmented control depending on option count.
- Schema-derived required fields appear first.
- Optional constraints remain collapsed.
- Risk uses a segmented control.
- Numeric values use number fields with unit suffixes.
- Wallet or position fields support validation and recent values.
- The primary action is **Check job**.

### Stage 2: Final check

This is the preflight result, translated into decisions:

- What the agent will do.
- Expected result.
- Inputs and targets.
- Required permissions.
- Maximum payment and payment type.
- Time limit.
- Assumptions.
- Warnings.
- Blocking changes.

Statuses:

- Ready: proceed.
- Needs changes: return directly to affected fields.
- Cannot run: no payment or run action is shown; offer another agent or return to results.

The runtime eligibility check must happen again here. A stale profile cannot progress.

### Stage 3: Confirm payment

- Show amount as the strongest fact after the task name.
- Show asset, network, recipient/contract, payment type, and what happens after delivery.
- Show wallet and network readiness inline.
- Escrow copy: "Held until you release it or a refund becomes available."
- Direct payment copy: "Sent directly when you confirm."
- Free job copy: skip this stage and state "No payment required" in the final check.
- The button names the action and amount: **Pay 0.001 BNB**.

### Stage 4: Start work

- Payment confirmation and job creation are distinct states.
- If user action is required, show **Start job**.
- If work starts automatically, route directly to the job page.
- Never leave a completed payment on a generic success screen.

### Failure handling

- Field error: inline at field and summary at stage top.
- Eligibility failure: no Hire/Pay control; explain next action.
- Wallet rejection: remain on payment review, preserve inputs.
- Transaction pending: durable state with explorer link and safe refresh.
- Payment confirmed but run failed: preserve the funded job and show retry/refund eligibility.
- Upstream 5xx: human message, record ID, retry when safe, and no raw stack or protocol jargon.

## 15. Job Page

The job page is the core workbench.

### Header

- Task title, agent, and status.
- Created time and record ID.
- Payment summary.
- Contextual primary action only: Start, Retry, Release, or View result.

### Timeline

Canonical sequence:

1. Job created.
2. Payment requested or not required.
3. Payment confirmed.
4. Work started.
5. Steps and tool calls, summarized for users.
6. Result delivered.
7. Payment released or refunded.

Each event contains status, timestamp, plain-language description, and an expandable evidence block. The currently running step has a subtle progress indicator; completed steps do not animate.

### Result area

Results are artifacts, not chat bubbles.

Supported presentations:

- Summary and recommendations.
- Structured key-value data.
- Tables.
- Transaction or position details.
- Source list.
- Raw output in a collapsed technical section.

Result hierarchy:

1. Outcome.
2. Important risks or warnings.
3. Recommended next action.
4. Evidence and sources.
5. Raw details.

### Settlement

- Escrow jobs show Release payment after delivery.
- Refund appears only when the shared contract permits it; otherwise explain why it is unavailable.
- Release and refund use confirmation dialogs with amount, destination, and consequences.
- Closed jobs retain a clear paid/refunded receipt and explorer links.

### Job statuses

The UI supports every existing lifecycle state without collapsing distinct financial events:

```text
saved
awaiting_funding
payment_submitted
payment_confirmed / funded
payment_reverted
running
work_completed / delivered
release_submitted
released / paid
refund_submitted
refunded
failed
```

## 16. Activity and Account

### Activity

Activity is a unified list with tabs:

- All
- Jobs
- Access requests
- Wallet alerts
- Comparisons

Each row includes title, type, current state, relevant amount, last update, and one contextual action. Results may expand inline on desktop but open the job page on mobile.

Filters use URL state. Activity loading must not blank previously loaded rows.

### Account

Account sections:

1. Sign-in identity.
2. Active BNB wallet and network readiness.
3. Notification and alert preferences when supported.
4. Links to verification and full activity.

Wallet status uses explicit labels:

- Connected to BNB Smart Chain.
- Wrong network.
- Not connected.
- Opening wallet.
- Waiting for confirmation.

Do not make authentication state look equivalent to wallet readiness.

## 17. Verify

Verify accepts an agent name, token ID, wallet, or contract address.

Results are grouped into:

- Identity.
- BNB balance and transaction activity.
- Ownership and agent wallet.
- Runtime availability.
- Explorer evidence.

The primary action follows eligibility: Hire if available, View profile otherwise.

## 18. Partner Tools

Partner integrations are useful workflows, not top-level marketing destinations.

### PancakeSwap

- Pair or position analyzer.
- Clear input/output split.
- Converts a supported analysis into a prepared Hive job.
- Never promises yield or labels estimates as guaranteed.

### Altana wallet alerts

- Wallet target.
- Alert conditions.
- Permission summary.
- Spend cap and expiry.
- Grant, active, revoke submitted, and stopped states.
- A permission receipt remains available after revocation.

### Termix

- Side-by-side comparison of manual and agent-assisted work.
- Record the result as evidence.
- Keep promotional partner branding subordinate to the comparison task.

All tools reuse the same field, review, wallet, timeline, receipt, and status components as the core marketplace.

## 19. Visual System

### Color

Light mode is the default and initial release target.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#FCFCF8` | Main page background |
| `surface` | `#FFFFFF` | Forms, rows, dialogs, primary work surfaces |
| `surface-muted` | `#F3F4EF` | Section bands, selected rows, quiet summaries |
| `ink` | `#171815` | Primary text and dark actions |
| `ink-muted` | `#60645D` | Secondary text |
| `ink-faint` | `#858A82` | Placeholders and tertiary metadata |
| `border` | `#DDE0D8` | Hairline structure |
| `border-strong` | `#B9BDB4` | Inputs, active separators |
| `brand` | `#F3BA2F` | BNB identity and rare branded emphasis |
| `action` | `#171815` | Primary action fill |
| `focus` | `#2F6FED` | Focus rings and links |
| `success` | `#247A4A` | Confirmed and completed states |
| `warning` | `#9A6500` | Needs attention |
| `danger` | `#B33A32` | Failed, destructive, or blocked states |
| `info-surface` | `#EEF4FF` | Informational callouts |
| `success-surface` | `#EDF7F0` | Success callouts |
| `warning-surface` | `#FFF6DD` | Warning callouts |
| `danger-surface` | `#FFF0EE` | Failure callouts |

Rules:

- Brand yellow is not the default button color; dark actions provide stronger text contrast and reduce crypto-dashboard styling.
- Color never carries state alone. Every state includes text and, where useful, an icon.
- Large page sections remain neutral. Semantic surfaces are local and restrained.
- No gradients.

### Typography

Recommended families:

- UI and body: Geist Sans or an equivalent neutral variable sans.
- Public display: Source Serif 4 at regular weight, used only for landing and selected public section headings.
- Numeric/technical: Geist Mono for addresses, transaction hashes, token IDs, record IDs, and aligned amounts.

Scale:

| Role | Mobile | Desktop | Weight | Line height |
| --- | --- | --- | --- | --- |
| Display | 40px | 60px | 400 | 1.05 |
| Page title | 30px | 40px | 500 | 1.12 |
| Section title | 24px | 28px | 500 | 1.2 |
| Panel title | 18px | 20px | 600 | 1.3 |
| Body | 16px | 16px | 400 | 1.5 |
| Body small | 14px | 14px | 400 | 1.45 |
| Label | 13px | 13px | 500 | 1.35 |
| Micro | 12px | 12px | 500 | 1.3 |

All letter spacing is `0`. Do not use viewport-based font scaling.

### Spacing

Base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.

- Operational component padding: 12-20px.
- Public section spacing: 64px mobile, 80px desktop.
- Form field gap: 20px.
- Dense row height: minimum 72px desktop and 88px mobile.
- Touch targets: minimum 44x44px.

Fluid interpolation may be used for container gutters and section spacing only, bounded by explicit minimum and maximum values.

### Shape and elevation

- Input and button radius: 6px.
- Surface and card radius: 8px maximum.
- Status/tag radius: full pill only when the content is genuinely a label.
- Dialog radius: 8px.
- Border: 1px.
- Default shadow: none.
- Dialog/menu shadow: one restrained elevation token.
- No cards nested inside cards. Use dividers, definition lists, or tinted bands inside framed tools.

### Iconography

- Lucide icons, 1.5-2px stroke.
- 16px inline, 18-20px controls, 24px empty states.
- Icon-only controls require tooltips and accessible names.
- Familiar symbols replace text where the action is unambiguous: save, copy, close, filter, sort, external link.

### Data presentation

- Amounts use tabular numerals.
- Addresses, hashes, IDs, and protocol details use mono.
- Values align right in comparison tables; labels align left.
- Long values truncate visually but remain copyable and available in full.
- Dates show human relative time with exact time in tooltip/detail.

## 20. Component Architecture

The redesign must be modular at three levels.

### Foundation

```text
tokens/
  color
  typography
  spacing
  shape
  motion
  breakpoints
```

### Primitives

```text
Button
IconButton
Link
Input
Textarea
Select
Combobox
NumberField
Checkbox
RadioGroup
SegmentedControl
Badge
Tooltip
Popover
Dialog
Sheet
Tabs
Table
Progress
Skeleton
Toast
Divider
```

### Product components

```text
AgentIdentity
AgentAvailability
AgentResultRow
AgentFilters
AgentCompareTray
AgentComparisonTable
TaskComposer
JobFieldRenderer
JobSummary
PreflightReview
PaymentReview
WalletReadiness
ExecutionTimeline
TimelineEvent
DeliveryArtifact
SettlementActions
TransactionEvidence
ActivityRow
EmptyState
ErrorRecovery
```

### Feature modules

```text
home/
marketplace/
match/
agent-profile/
hire/
job/
activity/
account/
verify/
tools/
```

Feature modules consume product components and domain selectors. They do not reimplement availability, status labels, payment labels, wallet readiness, or settlement rules.

### Component source policy

The local `design-guides.md` file is the component research map. Use it as follows during design and implementation:

| Source | Approved use | Not approved for |
| --- | --- | --- |
| Coss UI | Accessible primitive anatomy and keyboard behavior | Importing its visual theme unchanged |
| Component Gallery | Comparing how mature systems solve a named component | Treating popularity as proof that a pattern fits Hive |
| ReUI | Complex composed patterns such as filters, stepper, timeline, receipt, data grid, and mobile sheet | Copying dashboard blocks wholesale |
| DesignSystems.one | Semantic tokens, naming rules, component status, duration and easing discipline | Using its illustrative token values without review |
| UI Skills | Pre-ship audits for hierarchy, responsiveness, accessibility, performance, and generic generated-UI patterns | Replacing manual visual review |
| Utopia | Bounded fluid gutters, grid, and spacing | Viewport-scaled text or unbounded `clamp()` values |
| Open Props | Token categories and naming inspiration | Adding a second uncontrolled token system |
| Transitions.dev | Studying state swaps, menus, panels, skeleton reveal, and forward/back continuity | Confetti, shakes, gooey controls, blur-heavy text, or decorative effects |
| Kinetics | Spring behavior only where direct manipulation benefits from it | Bouncy page furniture or perpetual animation |
| Rauno's Interface Guidelines | Labels, form submission, input affordances, focus, disabled state, and small interaction details | Treating subjective details as higher priority than accessibility |
| Motion Primitives | Implementation reference for accessible enter/exit behavior | Adding a motion dependency before CSS is insufficient |
| OriginKit / Beautiful UI / 21st.dev | Scouting a specific interaction after the component contract is defined | Setting the Hive design direction |
| Aceternity / Orbs / background and animated-button galleries | None in core product UI | Decoration, thinking orbs, generated backgrounds, novelty buttons |
| Agentation | Annotating visual QA feedback during implementation | A production dependency |
| Icon Creator | Creating a missing brand-specific mark only | Replacing familiar Lucide interface icons |

### Component blueprints

#### Buttons

Anatomy: optional leading icon, action label, optional trailing disclosure icon, and an internal loading indicator that does not change button dimensions.

Variants:

- Primary: ink fill, white text. One per decision region.
- Secondary: transparent or white fill, strong border, ink text.
- Quiet: no container until hover/focus; used for low-risk secondary actions.
- Destructive: danger text and border by default; filled danger only in the final destructive confirmation.
- Icon: square 44px target, 32-36px visible container, tooltip and accessible name.

States: default, hover, pressed, focus-visible, loading, disabled. Loading preserves the label or replaces it with a same-width action phrase. Disabled controls remain legible and expose the reason in nearby text when the user may not understand why.

Do not use scale, bounce, glow, gradient, or particle effects. Press feedback may use a 1px translation or neutral surface change.

#### Fields

Anatomy: persistent label, required marker when needed, control, optional hint, validation message. The entire label targets the control.

- Minimum control height: 44px.
- Textarea minimum: 112px and user-resizable vertically.
- Prefix/suffix icons or units sit inside the control with corresponding text padding and focus the input when clicked.
- Use native semantic input types and input modes.
- Submit with Enter where expected; multiline task composers use `Cmd/Ctrl+Enter` only as an optional accelerator, never the only submission method.
- Error state highlights the relevant field, explains the correction, and is included in the stage error summary.
- Success styling is not shown during ordinary typing.

#### Select, combobox, and autocomplete

- Select is for short fixed sets.
- Combobox is for searchable agent, asset, protocol, pool, or wallet sets.
- Autocomplete suggestions are grouped and keyboard navigable.
- Trigger content never changes width based on the selected option.
- Menus align to the trigger, fit the viewport, and use a maximum height with internal scrolling.
- On narrow mobile screens, complex multi-select filters open in a sheet rather than a tiny anchored menu.

#### Segmented controls

Use only for 2-4 mutually exclusive modes visible at once, such as risk or list/grid view. The group has one accessible label, a stable height, and an active indicator with both fill and weight change. Long labels wrap once or the component changes to a select; text never shrinks to fit.

#### Checkboxes, toggles, and radios

- Checkbox: independent selection such as Compare or category filters.
- Radio: one choice from a longer visible group.
- Toggle: immediate on/off setting only. Do not use a toggle to submit a financial transaction or grant a permission.
- The text label is always clickable.
- Checked state uses icon plus color.

#### Badges and status

Badges are compact labels, not buttons. They use semantic text such as Available, Profile, Running, Delivered, Paid, Failed, or Wrong network. Maximum one availability badge and one category label in a dense agent row. Technical protocols do not become a cloud of badges; list them in details.

#### Agent result row

The row is a semantic article or table row depending on view. Its entire surface is not a link because it contains Save, Compare, and a primary action. Name and profile action are the navigation links. Columns have explicit responsive constraints so long names and status changes do not move the action column.

Hover uses a muted surface wash, not elevation. Selected-for-compare uses a 2px inset focus-colored edge plus checked checkbox. Availability is never encoded through row opacity.

#### Filters

Desktop anatomy: heading, grouped controls, per-group reset when useful, and Clear all. Result updates may be immediate for checkboxes and selects; text search submits after a short debounce or explicit Enter. The result header announces the updated count.

Mobile anatomy: Filter button with applied count, full-height sheet, grouped controls, Clear all, and a fixed **Show results** action. Closing without applying preserves the previous committed filters.

Filter state is serialized to the URL. Loading does not clear or replace the controls.

#### Tabs

Tabs switch peer views inside the same destination, such as Activity types. They do not replace primary navigation or a multi-step hire flow. The active tab uses text, weight, and underline/surface, exposes `aria-selected`, and remains visible when the row scrolls horizontally on mobile.

#### Stepper

The hire stepper is informational and non-clickable until a prior completed stage is safe to revisit. Mobile shows current step text plus `2 of 4`; desktop may show all labels. Completed, current, upcoming, blocked, and error states are distinct. The stepper never implies that a submitted payment can be undone by navigating backward.

#### Timeline

Anatomy: vertical rule, state marker, event title, plain description, timestamp, optional action, and expandable evidence. The title and status remain visible without expansion. Running events use one subtle progress treatment; failed events expose a recovery action. Events are chronological and never reorder after initial insertion.

#### Tables and comparison

- Use a table only when rows share comparable columns.
- Header stays visible for long desktop result sets.
- Numeric cells use tabular figures and right alignment.
- Row actions occupy a stable final column.
- Sorting controls include direction in their accessible name.
- Mobile ordinary tables become labeled record rows. Agent comparison remains horizontally scrollable with the attribute column pinned.
- Empty and error states span the table width without being wrapped in another card.

#### Panels and cards

Use a framed panel for one bounded tool, repeated card only for genuinely repeated independent objects, and an unframed section for page structure. A panel may contain rows and bands but never another decorative card. Surface hierarchy is canvas, surface, muted band, then dialog; do not invent extra elevations.

#### Dialogs, sheets, and popovers

- Dialog: consequential confirmation or focused short task.
- Sheet: mobile filters, wallet selection, compare tray detail, or secondary context.
- Popover: compact anchored choices or explanations.
- Tooltip: short noninteractive label for an icon; it never contains required information.

Dialogs and sheets have title, optional description, body, and footer actions. Destructive confirmations name the object and consequence. Initial focus goes to the least destructive sensible target; focus returns to the trigger on close. Backdrop click cannot dismiss a payment or settlement confirmation after a transaction has begun.

#### Toasts, alerts, and banners

- Toast confirms a completed low-risk action such as Saved or Copied. It disappears but remains announced accessibly.
- Inline alert explains a state that affects the current task.
- Page banner is reserved for broad source, network, or service degradation.
- A toast never carries the only copy of a payment failure or required next action.

#### Loading and progress

- Skeletons match final geometry and cross-fade into content.
- Spinner is used inside compact controls or indeterminate local waits.
- Progress bar is used only when progress is meaningful.
- "Thinking" animation is not used. Job work is described through actual running steps and timestamps.
- Previously loaded data stays visible during refresh with a small refreshing indicator.
- Any wait longer than ten seconds gains updated explanatory text and a safe leave/return path.

#### Empty states

Anatomy: literal heading, one sentence explaining why the area is empty, and at most one primary action plus one text link. Use no stock or generated illustration. In filtered results, Clear filters is primary; creating unrelated work is not.

#### Receipts and transaction evidence

Use a definition list with stable label/value rows. Amount, state, and time appear first; network, payment mode, address, contract, and hashes follow. Copy and explorer actions use icons. Full values remain available to assistive technology and in expanded details.

#### Navigation

Top and bottom navigation use familiar icon plus text patterns. Current destination is identified by more than color. The account/wallet control reflects readiness but does not display a long address in the global bar. Hide navigation only during transaction confirmation when reducing accidental departure materially helps; always provide a safe explicit exit.

#### Motion tokens

Use semantic tokens rather than component-specific durations:

```text
motion-instant: 0ms       focus, hover, active color
motion-quick: 100ms       press, checkbox, toggle
motion-standard: 200ms    tooltip, popover, menu, tab indicator
motion-panel: 320ms       sheet and dialog entrance
```

Enter with ease-out, dismiss faster with ease-in, and use ease-in-out only for continuous movement such as a tab indicator. Operational page transitions are instant. Reduced motion removes translation and scale while preserving opacity or immediate state change.

## 21. Domain Architecture Rules

### Canonical selectors

The UI needs shared selectors for:

- `selectAgentAvailability(profile, runtimeEvidence)`
- `selectAgentPrimaryAction(availability)`
- `selectJobPhase(record)`
- `selectJobPrimaryAction(record, walletState)`
- `selectPaymentSummary(recordOrRequest)`
- `selectSettlementOptions(record)`
- `selectWalletReadiness(authState, walletState, chainState)`

Exact implementation names may differ, but there must be one shared decision source for each rule.

### Availability invariant

`Hire` can render only when the shared server-derived state is `ready_to_run` and the selected capability is actionable. Profile cards, search results, Match, Verify, profile pages, and direct hire routes consume the same contract.

### Direct-route invariant

A user navigating directly to Hire must pass the same eligibility and preflight gates as a user entering from a marketplace button.

### Record invariant

Once a payment or run begins, the UI is record-driven. Refreshing, changing devices, or reopening Activity must reconstruct the current state from the durable record rather than transient component state.

### Count invariant

Marketplace totals come from the discovery contract. Client-loaded length is never used as total inventory.

## 22. Motion

Motion explains state change only.

- Hover/focus: 120ms.
- Menu, popover, and sheet: 160-200ms.
- Row insertion or filter result transition: 180ms with position/opacity only.
- Timeline running indicator: restrained indeterminate progress; no pulsing entire cards.
- Skeleton shimmer is optional and disabled under reduced motion.
- No scroll-jacking, parallax, bouncing icons, autoplay carousels, animated gradients, or staggered reveal of operational data.
- `prefers-reduced-motion` removes nonessential movement.

## 23. Responsive Behavior

### 320-479px

- One column.
- Bottom navigation.
- Filter and compare in sheets.
- Tables become labeled rows except comparison, which scrolls horizontally with the first column pinned.
- Fixed action bars account for safe-area insets.
- Technical facts collapse under details.

### 480-767px

- One column with wider gutters.
- Two-up option groups allowed where labels fit.
- Agent rows retain row form; do not become decorative cards.

### 768-1023px

- Desktop top navigation begins.
- Two-column public compositions.
- Filter rail may remain a sheet to preserve result width.
- Hire context becomes a top summary rather than a narrow side rail.

### 1024px and above

- Marketplace filter rail plus result column.
- Hire/job context rail where useful.
- Comparison and activity use tables or stable multi-column rows.
- Maximum content width prevents uncontrolled line length.

## 24. Accessibility

- WCAG 2.2 AA contrast minimum.
- Every flow is keyboard complete.
- Visible focus ring uses `focus` blue with sufficient offset.
- Heading order reflects page structure.
- Fields have persistent labels, linked hints, and linked errors.
- Error summaries link to invalid fields.
- Dynamic job, payment, and run status uses appropriate polite live regions; transaction failures may use assertive alerts.
- Sheets and dialogs trap focus, restore focus, close with Escape where safe, and require explicit confirmation for destructive actions.
- Status never depends on hue alone.
- Touch targets are at least 44x44px.
- Long agent names and unbroken addresses never overflow their containers.
- Reduced motion and system text zoom are supported.

## 25. Content Rules

### Voice

- Direct, plain, calm.
- Use verbs: Find, Check, Pay, Run, Review, Release.
- State what happened before explaining why.
- Give the next safe action.

### Errors

Pattern:

```text
What happened.
What remains safe or unchanged.
What the user can do next.
```

Example:

```text
The agent did not return a result.
Your funded job is still recorded and no payment was released.
Retry the run or review refund availability.
```

Do not show "502 Bad Gateway," endpoint names, adapters, or raw upstream messages in the primary error. Put diagnostic IDs and technical detail behind Details.

### Empty states

Describe the missing object and provide one relevant action. No illustrations are required.

### Trust copy

Prefer evidence over reassurance. Show the contract, amount, network, status, timestamp, and explorer link instead of saying a transaction is "secure."

## 26. Performance and Data Loading

- Landing page server-renders its first useful content and first marketplace records.
- Agent results server-render the first page.
- Filters update URL state and stream/replace only the result region.
- Progressive append deduplicates by canonical chain ID and token ID.
- Result row heights are stable to prevent layout shift.
- Profile technical data below the fold may load progressively.
- Job status uses a documented polling or event strategy with backoff and visible stale-state recovery.
- Wallet libraries and partner-tool code do not block public discovery pages.
- Images use responsive dimensions and are never required to understand agent availability.

Targets for implementation validation:

- LCP under 2.5s on a mid-tier mobile device and realistic network.
- CLS under 0.1.
- INP under 200ms for search, filters, and primary controls.
- Initial agent directory remains usable with JavaScript delayed.

## 27. Analytics and Product Measurement

Track decisions, not vanity interactions:

- Task composer submitted.
- Search completed with result count.
- Filter applied.
- Agent profile viewed.
- Match shortlist produced.
- Hire eligibility blocked and reason category.
- Preflight ready / needs changes / blocked.
- Payment submitted / confirmed / reverted.
- Job started / delivered / failed.
- Result viewed.
- Release / refund submitted and confirmed.
- Recovery action used.

Never include wallet addresses, free-form task text, private result content, or transaction secrets in analytics payloads.

## 28. Implementation Sequence

### Phase 0: Contracts

- Freeze current route and domain behavior.
- Add or confirm shared selectors for availability, status, payment, settlement, and wallet readiness.
- Confirm marketplace total and cursor/page contracts.
- Create representative fixtures for every state.

### Phase 1: Foundations

- Tokens, typography, global shell, primitives, responsive containers, accessibility utilities.
- Storybook or equivalent isolated component previews if compatible with the repository.

### Phase 2: Discovery

- Landing, marketplace, filters, result rows, progressive append, save, compare, Match, profile.

### Phase 3: Work lifecycle

- Hire form renderer, final check, payment review, wallet readiness, job page, timeline, result artifacts, settlement.

### Phase 4: Account and tools

- Activity, account, Verify, PancakeSwap, Altana, Termix.

### Phase 5: Hardening

- Full state matrix, accessibility audit, performance profiling, responsive visual QA, live testnet smoke flow, error recovery, and copy review.

Do not run a visual old/new hybrid in production. Build behind a route or feature flag, complete the lifecycle, then switch coherently.

## 29. Required State Fixtures

Every view must be testable without depending on a random live agent.

### Agent

- Ready to run.
- Profile only: connectable.
- Profile only: listed.
- Temporarily unavailable.
- Long name and description.
- Missing image.
- No reviews.
- Multiple capabilities.
- Free, escrow, and direct-payment jobs.

### Hire

- Required and optional fields.
- Schema-derived fields.
- Invalid wallet/position/pair.
- Ready preflight.
- Warning.
- Missing input.
- Blocked.
- Wrong network.
- Wallet rejection.
- Pending, confirmed, and reverted transaction.

### Job

- Awaiting payment.
- Funded.
- Running.
- Delivered with structured result.
- Delivered with long raw result.
- Failed before payment.
- Failed after funding.
- Cannot run.
- Release pending and paid.
- Refund unavailable, pending, and complete.

### Marketplace

- Large total.
- Unknown total.
- Zero results.
- Partial-source failure.
- Next-page failure.
- Duplicate records across sources.

## 30. Acceptance Criteria

The redesign is complete only when:

1. A first-time mobile user can describe a task and reach a valid shortlist without understanding agent protocols.
2. No non-hireable agent displays a Hire action anywhere, including direct routes and Verify.
3. The directory exposes the trustworthy total or explicitly states only the loaded count.
4. Filters, sorting, loading more, back navigation, and refresh preserve context.
5. The full free, escrow, and direct-payment lifecycles are represented.
6. A funded job survives refresh and can be recovered from Activity.
7. Failures explain payment safety and a next action.
8. The same availability and lifecycle state produces the same label and action across all pages.
9. All required state fixtures pass automated interaction tests.
10. Keyboard, screen reader, reduced-motion, text-zoom, and contrast checks pass.
11. Screenshots at 320x568, 390x844, 768x1024, 1280x800, and 1440x900 show no overlap, truncation, blank regions, or hidden actions.
12. The UI contains no decorative gradients, orbs, nested cards, generic AI imagery, fake metrics, or unexplained protocol jargon.

## 31. Final Design Review Checklist

Before implementation approval:

- Each screen has one clear primary action.
- Public warmth does not reduce marketplace density.
- Operational screens use stable rows and timelines, not marketing cards.
- The first landing viewport shows Hive, a literal offer, a usable task composer, and a hint of real inventory.
- Mobile is designed first, not collapsed from desktop.
- Agent availability is visible and truthful.
- Permissions and payment are visible before confirmation.
- Results are readable artifacts, not a wall of chat bubbles.
- Technical details remain accessible without dominating the task.
- Copy describes user decisions and outcomes.
- Product data, not decoration, carries the visual story.
