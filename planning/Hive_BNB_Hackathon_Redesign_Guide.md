# Hive BNB Agent Marketplace — Production Redesign Guide

> **Visual system update:** This version blends the supplied dark phosphor/terminal reference with the existing Hive identity. Hive remains the brand. The reference supplies the surface hierarchy, typography discipline, spacing, geometry, border treatment, and accent restraint.

> **Product permanence:** Do not use copy, navigation, empty states, labels, or visual treatments that make the product feel temporary, event-only, or limited-time. `bnb.uphive.xyz` must read as a maintained Hive product.

This is a **production product specification** for `bnb.uphive.xyz`. The product should be designed for real users, real agent discovery, real hiring, real verification, and continued operation after the BNB Chain program ends.

The BNB Agent Studio marketplace requirements remain important because the product will also be submitted to BNB Chain's Build the Era program. Treat those requirements as external product constraints and ecosystem opportunities, not as a temporary event scope.

The marketplace must let users **find an agent, understand what it does, compare it, and activate or hire it with minimal friction**. It must also support strong data quality and equal depth across Rebalancing, Grid Trading, Yield Optimisation, and Health Factor Monitoring.

The partner integrations must remain meaningful product capabilities. PancakeSwap and Altana should appear where they create real user value. TermiX is different: the relevant requirement is to prove that hiring agents through Hive gives a measurable advantage; do not present TermiX as an integration unless Hive actually integrates it.

---

## 1. Product objective

The interface should communicate one idea immediately:

> **Find, compare, and hire agents that work on BNB Chain.**

It should not primarily communicate:

> blockchain infrastructure dashboard.

It also should not primarily communicate:

> Hive's general marketplace.

This subdomain has a much narrower purpose.

BNB Chain describes the winning product as the potential canonical front door for agents on BSC. The marketplace must surface agent data, support category discovery, and let a user activate an agent without requiring prior Agent Studio knowledge.

Therefore the design priorities should be:

1. **Discovery**
2. **Comparison**
3. **Trust**
4. **Hiring**
5. **Evidence of what happened**

Everything else should support one of those goals.

---

## 2. The four categories are primary navigation concepts

This is one of the largest changes I would make to the current interface.

The BNB Agent Studio marketplace requirements treat these four categories as first-class. The product should not treat one category as primary while the others are shallow:

- Rebalancing
- Grid Trading
- Yield Optimisation
- Health Factor Monitoring

Right now they appear as small suggestion chips underneath a task field.

That understates their importance.

### Redesign

On the main marketplace page, put the four categories immediately below the task search/composer.

For example:

### What do you need help with?

`[ Describe your task or goal… ]` **Find agents**

Then:

**Explore by task**

| Rebalancing | Grid Trading | Yield Optimisation | Health Factor |
|---|---|---|---|
| Manage LP ranges and positions | Run automated grid strategies | Find stronger yield opportunities | Monitor lending risk |
| 12 agents → | 9 agents → | 14 agents → | 13 agents → |

These can be compact horizontal cards rather than huge marketing cards.

Each category should receive the same:

- visual size;
- information depth;
- interaction treatment;
- result-page capability.

Do not visually privilege Yield just because many current agents happen to have that tag.

---

## 3. Do not call the product the "official marketplace" yet

This distinction matters.

BNB Chain may officially adopt a winning marketplace, but Hive should not claim official status until BNB Chain grants it.

Therefore avoid production copy such as:

> Official BNB Agent Studio Marketplace

until that status is actually granted.

Safer current product identity:

**Hive**  
`BNB Agent Marketplace`

or:

**Hive for BNB Agents**

A small contextual line can say:

> Built for BNB Agent Studio agents.

If the product needs to state its program participation, use a small factual note in an About, ecosystem, or footer context:

> Built for BNB Chain's Build the Era program.

Do not make an unearned official-adoption claim.

---

## 4. Global visual direction

The BNB subdomain should **not** abandon Hive's current visual identity.

Use the current Hive product as the brand base:

- dark interface;
- Hive logo and agent mark;
- emerald/green brand accent;
- compact marketplace information;
- technical, onchain metadata;
- simple geometric UI;
- restrained Web3 character.

Then use the supplied Modal style reference as the **design-system discipline**. The reference uses a black canvas, layered dark surfaces, green-tinted hairline borders, pale phosphor text, tight geometric typography, low elevation, and a single bright green emphasis color. It also relies on surface contrast instead of card shadows and uses 8–12 px radii for most UI.

The target is not a copy of Modal.

The target is:

> **Hive's marketplace identity, refined with Modal's dark technical precision.**

The BNB marketplace should feel related to `uphive.xyz`, but more focused, more premium, and more suitable for a BNB Agent Studio marketplace.

### 4.1 What to retain from current Hive

Retain these recognizable Hive properties:

- the existing Hive logo and mark;
- the current dark product mood;
- the current emerald/green identity;
- marketplace-first terminology;
- direct, technical copy;
- compact data presentation;
- agent, task, receipt, wallet, and chain metadata;
- simple line icons;
- dark cards and controls.

Do not redesign the BNB subdomain as a separate brand that looks unrelated to Hive.

### 4.2 What to take from the supplied Modal reference

Use these principles:

- one deep black base canvas;
- two or three clearly separated dark surface levels;
- green-tinted hairline borders instead of gray boxes everywhere;
- pale green-white headings instead of hard white;
- muted sage body text instead of low-contrast gray;
- tight geometric headings;
- smaller corner radii;
- minimal shadows;
- one high-emphasis accent treatment at a time;
- strong spacing rhythm;
- technical metadata in compact rows;
- terminal-like precision without decorative "hacker" effects.

### 4.3 What not to copy from Modal

Do not copy these elements literally:

- the Modal logo or brand mark;
- Modal's custom 3D cube;
- Modal-specific product illustrations;
- the exact Goga typeface as a requirement;
- lime as a second independent brand color;
- code windows where no code is relevant;
- terminal decoration that does not support a task.

Hive must remain the recognizable product.

### 4.4 Visual character

The design should feel like:

> **A live agent registry inside a high-end infrastructure console.**

It should not feel like:

- a generic crypto dashboard;
- a neon DeFi terminal;
- a temporary campaign landing page;
- a clone of Modal;
- a light editorial marketplace.

---

## 5. Hybrid design system

### 5.1 Color roles

Use the supplied Modal palette as the base logic, but keep Hive's existing emerald as the primary brand accent.

The current BNB UI screenshots use an emerald close to `#12B981`. Treat that as an approximate starting point, not a mandatory production hex if Hive already has an official token.

| Role | Suggested value | Use |
|---|---|---|
| Void canvas | `#000000` | Page background |
| Ground surface | `#181818` | Cards, forms, list containers |
| Carbon surface | `#212525` | Header, selected areas, elevated controls |
| Deep separator | `#1F2A33` | Section dividers and secondary hairlines |
| Circuit border | `#485346` | Primary hairline border; use at reduced opacity |
| Primary text | `#DDFFDC` | Headings, strong labels, important values |
| Body text | `#8CAB87` | Default body copy |
| Secondary text | `#677D64` | Helper text and low-priority metadata |
| Hive emerald | `#12B981` approximate | Primary brand action, active state, verified mark |
| Hive emerald bright | `#34D399` approximate | Hover/focus emphasis only |
| BNB yellow | `#F0B90B` | BNB network identity only |

Do not introduce another lime brand token on top of Hive emerald.

The supplied Modal reference uses `#7FEE64` as its vivid accent. For Hive, use the **same restraint rule**, but map that role to Hive emerald.

### 5.2 Accent rule

Do not fill every `Hire`, `Find`, `Verify`, status, score, and link with emerald.

Use a bright emerald fill only for the highest-priority action in a local view.

Examples:

- On the marketplace home, `Find agents` can be the accent action. The header `Hire an agent` should then be a dark or outline action.
- On an agent profile, `Hire agent` can be the accent action.
- On Verify, `Verify` can be the accent action.
- In a list of 20 agents, do not create 20 large glowing emerald buttons. Use a compact dark button with an emerald border or emerald hover state.

This keeps the current Hive identity but gives the accent more value.

### 5.3 BNB yellow rule

Use BNB yellow only for chain context:

- `BNB Smart Chain` badge;
- BNB icon;
- chain/source metadata;
- small BNB program context labels only where they add factual context.

Do not use BNB yellow for primary CTAs.

Do not combine large emerald and yellow fills in the same component.

### 5.4 Typography

Use Hive's current product font if it is already standardized.

Apply the supplied Modal reference's typography behavior:

- geometric sans;
- 400–500 weights for most UI;
- tight tracking on headings;
- compact UI labels;
- no heavy 700–800 display typography;
- uppercase eyebrow labels only for small technical categories.

If the team wants a new display face, use a practical substitute such as **Inter Tight** or **Space Grotesk**. Do not make the custom Modal font a dependency.

Suggested scale:

| Role | Size | Weight | Notes |
|---|---:|---:|---|
| Marketplace display | 52–64 px | 400–500 | Use only on the main landing view |
| App page title | 38–44 px | 400–500 | Agents, Receipts, Verify |
| Section title | 28–30 px | 400–500 | Major page sections |
| Card/row title | 18–21 px | 500 | Agent name, receipt title |
| Body | 16 px | 400 | Main copy |
| UI text | 14 px | 400–500 | Buttons, filters, metadata |
| Caption | 12 px | 500 | Eyebrow, chain source, micro status |

Keep line height comfortable. Do not compress body copy to imitate a terminal.

### 5.5 Shape system

Use a small, consistent radius set:

- cards and list containers: **8 px**;
- inputs and selects: **8 px**;
- buttons: **10–12 px**;
- tags and small status chips: pill radius;
- icon plates: 6–8 px or square where the icon supports it.

Do not use 16–24 px rounded cards across the app.

Do not use pill radius for full cards.

### 5.6 Borders and elevation

Use depth in this order:

1. canvas-to-surface color change;
2. 1 px green-tinted hairline;
3. selected-state surface change;
4. shadow only when an overlay needs separation.

Standard cards should have no visible drop shadow.

Avoid the current pattern where every block is a black rectangle with the same gray border.

### 5.7 Spacing

Use a 4 px base grid.

Recommended app values:

- page max width: **1240–1280 px**;
- desktop page gutter: **32–48 px**;
- page section gap: **48–64 px**;
- marketing section gap: **72–80 px**;
- card padding: **20–24 px** for dense marketplace cards;
- large feature block padding: **28–32 px**;
- element gap: **8–16 px**.

The supplied reference uses generous 32 px card padding. Use that on feature blocks, not on every agent row.

### 5.8 Iconography and imagery

Keep the current Hive icon family if it exists.

Use simple one-color line icons in pale phosphor or muted sage.

For BNB-specific identity:

- use the BNB mark only as chain context;
- do not decorate every agent with a yellow icon;
- do not use generic crypto coin imagery.

Optional brand visuals can use a subtle geometric agent/network form in Hive emerald. They should be used on the marketplace landing page or empty states, not inside every row.

Do not add glow filters to text.

Do not add scanlines.

Do not add fake terminal prompts.

### 5.9 Motion

UI transitions should be restrained:

- hover/focus: **150–200 ms ease-out**;
- dropdown/modal transitions: **180–240 ms**;
- large marketing visual: up to **300 ms**.

Use spring motion only for a rare branded illustration.

Respect `prefers-reduced-motion`.

### 5.10 Dark-only versus theme support

Dark should remain the default product theme because it aligns with the current Hive identity and the supplied visual reference.

A light theme is optional. Build it only if it serves Hive's broader product roadmap and can be maintained as a complete theme.

The priority is to make the dark theme intentional, accessible, and durable.

---

## 6. Header redesign

Keep the current Hive header structure recognizable, but remove the segmented-nav look and duplicate actions.

Current navigation:

`Agents / Hire / Receipts / BSC`

plus another:

`Hire agent`

button.

This duplicates the main action.

### New header

Use a **64 px** dark carbon header.

Suggested treatment:

- background: `#212525` or the closest existing Hive header token;
- bottom border: 1 px deep green/blue-black;
- no large shadow;
- optional subtle backdrop blur only if the header is sticky.

#### Left

Keep the current Hive mark and wordmark.

Add a compact chain context item:

`BNB`

or:

`BNB Agents`

The BNB item can use a small yellow icon or dot. Do not turn the whole logo lockup yellow.

Do not use the current permanent two-line:

> Hive  
> Agent marketplace

The product context is already clear from the page.

#### Primary navigation

**Agents**

**Receipts**

**Verify**

Remove the `Hire` navigation item.

Hiring is an action, not a content section.

The active item should use:

- brighter text;
- a subtle carbon/ground selected surface or short underline;
- optional small Hive emerald indicator.

Do not place all nav links inside one large rounded capsule.

#### Right

Account, wallet, or sign-in control.

Then:

**Hire an agent**

The header action should be the accent button only on pages where no more important page-level action is visible above the fold.

On the marketplace home, where `Find agents` is the main action, render `Hire an agent` as a dark/outline button.


## 7. Homepage / Hire page

This is the most important acquisition and conversion screen in the product.

The core marketplace requirement defines this page: a person should land, find an agent, understand it, and activate or hire it without hitting a dead end.

The redesign must make that flow visually obvious.

### 7.1 Hero

Current:

> Hire agents

Better:

> **Find the right agent for the job**

or more BNB-specific:

> **Find an agent for BNB Chain**

Supporting copy:

> Compare live BNB agents by capability, performance, price, and activity.

This is better aligned with the actual challenge than:

> set the task and budget, then keep the receipt.

---

## 8. Make task description the dominant interaction

Current task search is visually less important than the huge heading.

Reverse this.

### Component

Small label:

**What do you need done?**

Large input:

> Describe the task, position, strategy, or outcome…

Primary action:

**Find agents**

This should be the dominant artifact of the hero.

---

## 9. Add category discovery immediately after task search

Use the four primary BNB Agent Studio categories here.

Do not treat them as tiny generic chips.

A compact module can contain:

### Rebalancing

Manage LP ranges and rebalance positions.

### Grid Trading

Find agents that operate grid strategies.

### Yield Optimisation

Compare agents that search and route yield.

### Health Factor Monitoring

Find agents that watch positions and liquidation risk.

Clicking one should apply the category filter to the marketplace.

---

## 10. Recommended agents

After category discovery:

> **Recommended agents**

Description:

> Compare live status, capability, activity, track record, and price.

Right side:

**View all agents →**

Then show approximately 4–6 agents.

---

## 11. The current partner sidebar should not simply be removed

This is the largest correction to the earlier recommendation.

The current right sidebar contains:

- PancakeSwap
- TermiX
- Altana

Those names are not arbitrary. They represent BNB ecosystem partners and product opportunities relevant to this marketplace.

However, the current presentation is still wrong.

The problem is **not their presence**.

The problem is that they are represented as generic "Tools", which misrepresents what each partner means.

---

## 12. Replace "Tools" with partner capabilities

Do not label the block:

> Tools

Instead:

> **Ecosystem capabilities**

or:

> **Built for BNB agent workflows**

But the individual partners should not all receive the same interaction because their roles are different.

---

## 13. PancakeSwap treatment

PancakeSwap is a real partner challenge.

The challenge rewards agents that create actual benefit for PancakeSwap traders or liquidity providers, such as better liquidity management, yield discovery, market research, or safe automated swaps.

Therefore PancakeSwap is relevant to discovery.

But the current card:

> PancakeSwap  
> Rank farms, review LP ranges, and save the result.

looks like a generic external tool.

### Better approach

Create:

**Works with PancakeSwap**

as a capability/filter.

Agent cards that genuinely support it can show:

`PancakeSwap`

as an integration badge.

Users can filter:

**Integration**  
`PancakeSwap`

An agent profile can have:

### PancakeSwap capabilities

- Liquidity management
- Yield analysis
- Swap execution
- Pool research

Only show capabilities that are actually supported.

This places PancakeSwap where it matters: **on agents and tasks**, not in an unrelated sidebar.

---

## 14. TermiX treatment

This is particularly important.

The BNB program documentation states that a TermiX integration is not required.

The TermiX track evaluates whether an agent hired through the marketplace provides a measurable advantage over alternative workflows. The Agent Advantage Report compares time, cost, and output quality across real tasks.

Therefore a card titled:

**TermiX**

under:

**Tools**

can give the wrong impression.

### Remove TermiX as a generic "tool"

Instead, if Hive implements the partner-track evidence feature, call it something such as:

### Agent Advantage

> Compare agent cost, completion time and result quality.

Small attribution:

`TermiX Challenge`

Do not imply that this is a TermiX software integration unless Hive actually integrates TermiX.

This distinction keeps the product accurate and prevents Hive from implying an integration that does not exist.

---

## 15. Agent Advantage should influence the UI

Because TermiX puts strong emphasis on service value and proven agent advantage, the UI should make actual agent outcomes visible wherever the data exists.

A strong agent profile could include:

### Recent outcomes

| Task | Time | Cost | Result |
|---|---:|---:|---|
| LP range review | 3m 12s | $0.42 | Completed |
| Yield scan | 1m 48s | $0.27 | Completed |

And, where benchmark evidence genuinely exists:

**Compared with manual workflow**

`4.3× faster`

`37% lower cost`

Do not manufacture these values.

Only show measured values.

---

## 16. Altana treatment

The current UI appears to reduce Altana to something like:

> Let an agent watch a wallet or position and save the alert.

That does not represent the actual partner track well.

Altana's criteria are about **sovereign agent wallets and user-controlled permissions**:

- agent has its own wallet;
- session has an allowlist;
- session has a spend cap;
- session expires;
- the user can see and revoke it;
- activity is verifiable onchain.

This is not a sidebar tool.

It belongs inside the **hiring and permissions workflow**.

---

## 17. Add an Autonomy & permissions section to hiring

If Hive has implemented the Altana track, after a user selects an agent, the hire flow should include:

### Agent permissions

**Allowed actions**
- Monitor position
- Swap tokens
- Manage liquidity

**Maximum spend**  
`[ 50 ] USDT`

**Permission expires**  
`[ 24 hours ▼ ]`

Then:

**Activate agent**

And after activation:

> Agent permissions active until 09 Aug, 14:20

Action:

**Revoke access**

This is far more meaningful than an Altana card in the right sidebar.

---

## 18. Altana status on agent profile

If the agent actually uses Altana:

Show:

**Autonomous wallet**

`Altana · Active session`

Then:

- Allowed actions
- Spend limit
- Expiry
- transaction/explorer access
- revoke action for the owner

Do not expose private keys or internal wallet mechanics.

---

## 19. 8004scan should become a trust/data source, not backend status

The current BSC status page lists:

`8004scan Connected`

inside an infrastructure status panel.

That wastes one of the marketplace's most useful trust and identity data sources.

8004scan provides structured ERC-8004 information including identity, capabilities, ownership, reputation, feedback and network activity.

This directly improves **data quality** and gives users better evidence for hiring decisions.

### Use it where users decide

Agent profile:

**Onchain identity**  
ERC-8004 #...

**Network**  
BNB Smart Chain

**Owner**  
0x12…89F

**Last activity**  
Today

**Reputation**  
...

Small source attribution:

`Data from 8004scan`

That is much more useful than:

> 8004scan: Connected.

---

## 20. Replace BSC Status with Verify Agent

The current `BSC status` page has two parts:

- useful address checking;
- irrelevant internal runtime information.

Remove the runtime information from the user UI.

Rename navigation:

**Verify**

Page title:

> **Verify an agent**

Description:

> Check an agent's BNB Chain identity and activity before you hire.

Input label:

**Agent or BNB address**

`0x…`

Action:

**Verify**

---

## 21. Verification result

Where data exists, show:

### Identity

**Registered agent**  
ERC-8004

### Network

BNB Smart Chain

### Owner

`0x12…E91`

### Live status

`Active`

### Last activity

`Today`

### Reputation / feedback

Use real 8004scan data.

### Capabilities

Rebalancing  
PancakeSwap liquidity  
Health monitoring

### Actions

**View agent**

**Hire agent**

External secondary link:

**View on 8004scan ↗**

That converts a technical page into a marketplace trust feature.

---

## 22. Remove the public infrastructure runtime panel

This recommendation remains unchanged.

Do not expose:

- Mongo
- BSC RPC
- Sessions
- Escrow service state

to marketplace users.

It does not improve marketplace functionality or user-facing data quality.

It can also make a functioning product appear broken when internal optional services show:

> Missing

Put technical monitoring behind `/admin` or an internal operations tool.

---

## 23. Agent directory is a core product surface

BNB Chain says users need to:

> find agents, understand what they do, and hire them.

It also says data must enable an informed hiring decision rather than show basic counts.

Therefore the directory should receive more attention than any marketing content.

---

## 24. Directory header

Use:

Small context:

`BNB Agent Studio`

Heading:

> **Find an agent**

Description:

> Compare live agents by capability, performance, price, and activity.

Do not use an enormous 70 px title with 100+ px of unused space.

---

## 25. Directory filters

Recommended:

### Search

`Search agents or capabilities`

### Category

- All categories
- Rebalancing
- Grid Trading
- Yield Optimisation
- Health Factor Monitoring

### Status

- Available
- Busy
- Offline

### Integration

- PancakeSwap
- Altana

Only include integrations that are genuinely present.

### Sort

- Best match
- Hive score
- Most active
- Most reviewed
- Price

---

## 26. Remove the Filter button if possible

Current filter bar ends with:

**Filter**

For a modern marketplace, filters should normally update automatically after selection.

Keep an explicit Apply button only on mobile/filter drawers or if the backend requires it.

---

## 27. Agent row redesign

The current card gives too much attention to `48` and too little attention to what the agent actually does.

Use the following hierarchy.

### Identity

**TrueDelta**

`TrueDelta.agent · TermiX Platform`

Only show the platform if it is useful sourcing information.

### Capability

`Yield Optimisation`

`PancakeSwap`

### One-line service explanation

> Scans BNB liquidity opportunities and compares available yield routes.

This is crucial.

A user should not need to open every profile just to understand what an agent does.

### Decision data

**Price**  
Set by agent

**Reviews**  
No reviews yet

**Activity**  
Active today

**Completed tasks**  
12

Only include fields you actually have.

### Score

**Hive score**  
48

Small `?` explanation.

The score must not dominate the card.

### Actions

**Hire**

`View profile →`

---

## 28. Replace unclear current labels

Current:

> Feedback 0/0

Replace with the real semantic value.

If it means review count:

> No reviews yet

If it represents successful versus total feedback:

> 0 of 0 reviews

but only if that interpretation is accurate.

Current:

> Freshness Today

Replace according to the actual data:

**Last active**  
Today

or:

**Data updated**  
Today

Do not use "Freshness" unless there is a clear product reason.

Current:

> Price Price set by agent

Fix immediately.

Use:

**Price**  
Set by agent

---

## 29. Hive Score needs an explanation

A user should be able to understand why Agent A ranks above Agent B.

If Hive Score is an internal composite, use a tooltip/popover:

### Hive score

> Based on activity, reputation, feedback and marketplace signals.

Only mention inputs that actually contribute.

If possible, show small components on the agent profile:

- Reputation
- Activity
- Reliability
- Feedback

This materially improves perceived data quality.

---

## 30. Agent profile page becomes essential

The current `Details` link should lead to the strongest trust surface.

Page structure:

### Identity header

Agent name  
Availability  
Category  
Network  
ERC-8004 identity

Primary:

**Hire agent**

### What this agent does

Plain-language description.

### Capabilities

Tasks / skills.

### Performance

Only actual measurable fields.

For example:

- Completed tasks
- Success rate
- Feedback
- Average completion time
- Recent activity

### Pricing

Explicitly state how the agent charges.

### Onchain identity

ERC-8004 information.

### Integrations

PancakeSwap  
Altana

Only if genuine.

### Recent work / evidence

Past results where privacy permits.

### Hire CTA

Persistent in the page sidebar on desktop.

---

## 31. Hiring should be a short step flow

Avoid dropping users into an empty technical form.

Recommended:

### Step 1 — Task

What should the agent do?

### Step 2 — Limits

Budget / relevant parameters.

### Step 3 — Permissions

Only if needed.

For an Altana-enabled agent:

- allowed actions;
- spend cap;
- expiry.

### Step 4 — Review

Agent  
Task  
Price/budget  
Permissions

**Hire agent**

The hiring flow requires minimal friction, so do not turn this into a six-screen wizard.

---

## 32. Receipts are a core trust and history surface

Keep this feature prominently.

Receipts can demonstrate that an agent:

- was hired;
- performed work;
- produced an output;
- took a given amount of time;
- cost a given amount.

That can reinforce marketplace trust and can support the TermiX Agent Advantage evidence.

---

## 33. Receipts signed-out state

The current full-width bordered box is still poor.

Use a compact panel:

> **Sign in to view receipts**

> Your hire history and agent results are private to your account.

**Sign in**

Do not stretch it across almost the whole viewport.

---

## 34. Receipt detail

Where the current product records the information, structure it as:

### Hire

Agent  
Task  
Started  
Completed

### Cost

Agent fee  
Network/payment data

### Result

Result summary  
Output/evidence

### Permissions

If an autonomous session was used:

Spend cap  
Expiry  
Status

### Verification

Relevant transaction / agent identity links.

Do not add fields that the implementation does not record.

---

## 35. Partner UI should be contextual, not a sponsor billboard

Avoid a permanent sidebar containing partner names only for visibility.

Users will not benefit from superficial integration, and it weakens product credibility.

Instead:

**PancakeSwap** should appear where an agent provides PancakeSwap value.

**Altana** should appear where permissions and autonomous wallets matter.

**TermiX Challenge** should appear where agent-versus-alternative performance is evidenced.

**8004scan** should appear as the source of agent identity/reputation data.

This makes each integration explain itself through actual functionality.

---

## 36. If a partner overview section is still desired

A small block near the bottom of the homepage is fine:

### Built for the BNB agent ecosystem

**PancakeSwap**  
Agent liquidity and trading workflows.

**Altana**  
Scoped autonomous wallet permissions.

**8004scan**  
ERC-8004 identity and reputation data.

Do not put TermiX here as an integration unless it actually is one.

Instead:

`Aligned with the TermiX Agent Advantage track`

can appear in an About or ecosystem page if that context is useful.

---

## 37. Homepage information architecture

Recommended final order:

1. **Header**
2. **Hero** — Find the right BNB agent.
3. **Task composer**
4. **Four category modules**
5. **Recommended agents**
6. **How hiring works** — Discover → Review → Set limits → Hire
7. **Verified agent data** — Short section explaining ERC-8004 / live BSC data.
8. **Ecosystem capabilities** — PancakeSwap / Altana / 8004scan where applicable.
9. **Footer**

No permanent right rail is necessary.

---

## 38. Button and action hierarchy

The current UI uses emerald fill too often. Keep the Hive green, but apply the supplied reference's accent-rationing rule.

### Accent action

Use Hive emerald fill for the highest-priority action in a view or flow.

Examples:

- `Find agents`
- `Hire agent` on an agent profile
- `Verify`
- `Activate agent`

Style:

- Hive emerald fill;
- near-black text;
- 10–12 px radius;
- 14–16 px UI text;
- 500 weight;
- no shadow.

Do not use a bright filled accent on every agent row.

### Primary dark action

Use for frequent row-level actions and actions that still need weight.

Style:

- `#181818` or `#212525` fill;
- pale phosphor text;
- 1 px green-tinted border;
- 10–12 px radius.

Examples:

- `Hire` in a repeated agent list;
- `View receipt`;
- `Continue`.

### Secondary action

Use a transparent or ground surface with a muted hairline border.

Examples:

- `View profile`
- `Clear filters`
- `Cancel`
- `Back`

### Text action

Use muted sage by default and Hive emerald on hover/focus.

Examples:

- `View all →`
- `View on 8004scan ↗`
- `Details`

### Destructive action

Do not force destructive actions into the green system.

Use a restrained red only where the meaning is genuinely destructive, such as:

- `Revoke access`;
- irreversible cancellation;
- destructive account action.

Do not use red for normal errors that can be corrected inline.

### Per-view priority rule

Each viewport should have one visually dominant action group.

If the page already has a bright `Find agents` control, do not also show a bright header `Hire an agent` control and bright `Hire` controls in every row.

The design should make the next action clear without turning every action into a CTA.


## 39. BNB network indicators

BNB matters here, so make network provenance visible without overwhelming the design.

A small badge can be:

`BNB Smart Chain`

Use on:

- agent profiles;
- agent identity information;
- transaction/receipt information;
- verification results.

Do not add a BNB badge to every small card if all results are BNB-only. That becomes noise.

---

## 40. Loading and data-quality states

Because users depend on accurate live data, data freshness should be explicit where it helps.

Possible agent metadata:

**Last updated**  
2 min ago

or:

**Last activity**  
Today

Do not silently serve stale data.

If the source is unavailable:

> Identity data is temporarily unavailable.

Do not turn that into:

> Agent unsafe.

Unavailable evidence and negative evidence are different states.

---

## 41. Empty marketplace states

### Category has no agents

Do not show an empty page.

> **No live Grid Trading agents found**

> Try all agents or check again later.

**View all agents**

This is especially important because all four categories are first-class marketplace entry points.

All four categories should have real, usable agent coverage before the product promotes them as primary entry points.

---

## 42. Design the core user journey explicitly

A new user should be able to do this:

1. Land on `bnb.uphive.xyz`
2. Immediately understand that this is a BNB agent marketplace.
3. Choose `Rebalancing`.
4. See multiple relevant agents.
5. Understand why they differ.
6. Open one.
7. Verify that it is a real BSC/ERC-8004 agent.
8. Understand its price, track record and capabilities.
9. Hire it.
10. Set limits if required.
11. Receive a visible confirmation/receipt.

There should be no point in this core path where the user must leave the product and read documentation to continue.

---

## 43. What should be completely removed

For the production marketplace:

- Public Mongo status.
- Public RPC connectivity status.
- `Escrow Missing`.
- `Sessions Missing`.
- `8004scan Connected` as raw backend health.
- Duplicate `Hire` nav destination.
- Duplicate Hire CTA beside the hero.
- Hero-level Receipts CTA.
- Repeated meaningless `Hive` eyebrow.
- `48 SHOWN`.
- `Feedback 0/0`.
- `Freshness` without explanation.
- Huge empty logged-out receipt box.
- Generic **Tools** label for the partner cards.
- **TermiX as a tool**, unless there is an actual TermiX integration.
- Oversized unexplained Hive Score.
- Huge marketing-style headers on operational screens.

---

## 44. What should be kept but redesigned

Keep:

- the four task chips → promote them into first-class category discovery;
- agent search;
- agent filters;
- agent status;
- Hive score;
- price;
- feedback;
- activity/freshness data;
- agent detail page;
- hiring;
- receipts;
- address checking;
- PancakeSwap capability;
- Altana capability;
- 8004scan connection.

But move each into the correct part of the user journey.

---

## 45. Product priorities and BNB ecosystem alignment

### P0 — Core production marketplace

1. Four categories equally visible.
2. Clear category discovery.
3. Rich agent cards.
4. Strong agent profiles.
5. Clear ERC-8004/BSC identity.
6. Simple hire flow.
7. Complete end-to-end success state.
8. Remove internal infrastructure UI.
9. Explain or demote Hive Score.
10. Make data freshness and trust legible.

These directly support marketplace functionality, data quality, trust, and category coverage.

### P1 — TermiX Agent Advantage alignment

1. Show meaningful performance data.
2. Capture time/cost/result when available.
3. Make agent outcomes inspectable.
4. Present Agent Advantage evidence.
5. Ensure high-stakes/trading agents expose actual track records where available.

### P1 — Altana autonomy and permission model

1. Agent wallet state.
2. Scoped permissions.
3. Spend cap.
4. Session expiration.
5. User-visible revoke.
6. Onchain activity link.

### P1 — PancakeSwap workflow depth

1. Clearly mark agents that deliver PancakeSwap value.
2. Expose relevant capabilities.
3. Show result/evidence rather than just a logo.
4. Make PancakeSwap agents discoverable via search/filter/category.
5. Do not imply automatic financial safety through marketing copy.

---

## 46. Final design principle

The goal is not:

> **make ecosystem partner logos visible.**

The goal is:

> **make the sponsor capabilities visible through real user value.**

A user should understand the PancakeSwap integration because they can see an agent perform a PancakeSwap-specific task.

They should understand Altana because the hire flow gives them clear autonomous-agent permissions.

They should understand 8004scan because agent identity and reputation become trustworthy.

They should understand the TermiX-aligned value because Hive can prove that hiring an agent was worthwhile.

That is a substantially stronger product than putting **PancakeSwap / TermiX / Altana** into a generic Tools sidebar. It also aligns naturally with the BNB Chain program without making the product feel temporary.

---

## References

### Product and BNB ecosystem context

- Hive: https://uphive.xyz
- BNB Chain — Build the Era: Build the Official BNB Agent Studio Marketplace: https://www.bnbchain.org/en/blog/build-the-era-build-the-official-bnb-agent-studio-marketplace

### Design reference

- Supplied **Modal — Style Reference**: dark phosphor/terminal visual system with black canvas, layered dark surfaces, green-tinted borders, pale phosphor text, tight geometric typography, low elevation, and rationed bright-green emphasis.

The designer must use the reference as inspiration, not as a template to copy. Hive branding and marketplace behavior remain primary.
