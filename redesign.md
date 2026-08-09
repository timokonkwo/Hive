# Hive BNB Marketplace — Product UX Redesign Guide

The current product has the right basic objects—agents, search, categories, profiles, verification, comparison, and hiring—but the experience still feels assembled from generic dashboard patterns rather than designed around how someone would actually choose and hire an agent.

The main redesign should not be “make the same screens prettier.” It should reduce the amount of UI, improve information hierarchy, and make the product feel like a marketplace with a clear decision process.

---

# 1. What is wrong with the current product

## 1.1 Too much interface, too little decision support

The product repeatedly presents things such as:

* large section cards;
* bordered boxes inside bordered boxes;
* badges;
* verification icons;
* category labels;
* generic descriptions;
* separate buttons for related actions;
* generic explanatory sections.

But when someone reaches an agent, the important questions are still unanswered:

**What does this agent actually do?**
**Why should I choose this one?**
**Can I use it now?**
**What will it cost?**
**What has it done before?**
**What happens after I hire it?**

The redesign should optimize for those questions.

---

# 2. The strongest “AI-generated UI” signals

Several patterns make the current site feel generated.

## Repeated cards for everything

The homepage uses cards for:

* task categories;
* “Find an agent”;
* “Set the job terms”;
* “Review the result”;
* ecosystem integrations;
* agent rows.

The profile then uses more cards for:

* activity;
* capabilities;
* request access;
* metadata.

When every object is a card, there is no hierarchy.

Use cards only when something genuinely needs to behave as a self-contained object.

Sections can simply be sections.

Rows can simply be rows.

Metadata can simply be text.

---

## Generic three-step explainer

The blocks:

> Find an agent
> Set the job terms
> Review the result

look like generic SaaS landing-page content.

They explain what the interface itself should already make obvious.

Remove this entire section from the main application.

A real marketplace does not need to repeatedly explain that users browse, hire, and review.

---

## Generic ecosystem section

The current:

> Connected to the BNB ecosystem

followed by PancakeSwap, Altana, 8004scan, and “Agent performance” looks more like a pitch deck or submission page than an application.

Those capabilities should appear **where they are useful**.

For example:

* PancakeSwap on agents that support PancakeSwap.
* Altana inside agent wallet permission controls.
* 8004scan inside identity verification.
* performance inside the agent profile.

Remove the large homepage ecosystem block.

An About page can explain integrations if needed.

---

## Too much green-tinted text

Almost every text element is some shade of green.

This reduces hierarchy because:

* headings are green;
* descriptions are green;
* labels are green;
* links are green;
* buttons are green;
* verification marks are green.

Use neutral text for most content.

Reserve the Hive green for:

* active navigation;
* primary action;
* verified state;
* selected filters;
* important interactive links.

This alone would make the product feel much more deliberate.

---

## Every agent looks identical

The recommended-agent rows currently have the same:

* status;
* verification icon;
* description style;
* “Today” activity;
* buttons.

The result feels generated because there is almost no visible reason one agent was recommended over another.

If agents do not yet have enough useful differentiating data, **show fewer fields instead of filling every row with weak information**.

---

# 3. Product structure

The current top navigation is too thin for a real marketplace.

You currently have essentially:

**Agents**
**Verify**

plus account and Hire Agent.

A better product structure is:

### Agents

Browse and search agents.

### My hires

Active requests, ongoing work, completed work, and receipts.

### Saved

Agents the user bookmarked.

This can also live within My hires/account if you want a smaller navigation.

### Verify

Check agent identity or address.

The account menu can contain:

* Profile
* Wallet
* Settings
* Sign out

The global **Hire an agent** button is optional once the marketplace itself provides strong task-based discovery.

I would remove it from the persistent header if it simply opens the same workflow users reach through Agents.

---

# 4. Homepage should become a marketplace entry point

The current homepage is too long.

It should not contain six different product explanations.

A better homepage can finish in roughly three meaningful sections.

---

# 5. Homepage hero

Current:

> Find the right agent for the job

The headline is fine, but the screen gives the left half to marketing copy and the right half to a search box.

The actual product is the search.

Make the search the hero.

## Recommended structure

Small context:

**BNB Agent Marketplace**

Headline:

# What do you need an agent to do?

Large task input:

`Describe a task, strategy, position, or goal`

**Find agents**

Below the input, show the four categories as quick shortcuts:

**Rebalancing**
**Grid Trading**
**Yield Optimisation**
**Health Factor**

No second explanatory paragraph is necessary.

You can include one concise line:

> Find and hire agents registered on BNB Chain.

Do not put the `248k+ registered on BSC` badge in the hero unless that number has strong user value and is verified.

A huge ecosystem-wide registration number does not tell the user how many agents are actually usable on Hive.

---

# 6. Remove the category cards

The current four large category cards occupy too much space for simple navigation choices.

They should become compact navigation.

For example:

**Browse agents**

`All` `Rebalancing` `Grid Trading` `Yield Optimisation` `Health Factor`

Each can optionally show a count:

`Yield Optimisation 43`

There is no need for:

> Adjust LP ranges and rebalance positions.

every time users see the category.

Those descriptions can appear on first visit, hover, or category landing states if truly necessary.

---

# 7. Homepage recommended agents

Keep Recommended Agents, but make it useful.

Do not show four large database-style rows simply because four records are available.

Show approximately **3–5 agents** with a clear reason they are recommended.

Example:

### DeepFlow

Yield Optimisation · Available

Monitors BNB yield markets and compares active opportunities.

`Active today` · `12 completed jobs` · `4.8 from 9 reviews`

**View profile**

Small contextual reason:

> Recommended for yield monitoring

Do not show:

> “Agents with useful public details.”

That is internal/product-team language.

Either the algorithm can recommend agents or the section should instead be called:

**Active agents**

or:

**Popular agents**

Use a title that reflects the actual selection logic.

---

# 8. Remove the “How it works” section entirely

The three cards shown in the screenshot:

* Find an agent
* Set the job terms
* Review the result

should be removed from the application homepage.

If onboarding needs explanation, introduce it contextually during the first hire.

---

# 9. Remove the ecosystem grid from the homepage

Also remove the large:

> Connected to the BNB ecosystem

section.

It is not part of the main user journey.

Move integrations to their relevant contexts.

This makes the homepage significantly shorter:

**Search → Categories → Recommended/Active agents → Footer**

That is enough.

---

# 10. Agents directory needs the largest redesign

The current directory is materially better than the earlier version, but it still behaves like a large data table without proper information architecture.

The primary goal is:

> Narrow 100 agents down to a handful worth inspecting.

---

# 11. Remove “248k+ registered on BSC” from the Agents header

Current:

> Browse agents by capability, availability, and track record. 248k+ registered on BSC.

The number has no clear relationship to the results underneath.

If Hive shows 100 agents, then tell users about the 100 usable agents.

Use:

# Agents

> Search agents by capability and availability.

That is enough.

---

# 12. Improve category navigation

The top category tabs are a good direction.

Keep:

**All**
**Rebalancing**
**Grid Trading**
**Yield Optimisation**
**Health Factor**

But add real counts if available:

**All 100**

**Rebalancing 12**

**Grid Trading 8**

etc.

This makes the marketplace easier to understand.

---

# 13. Simplify filters

Current:

Search
Availability
Works with
Sort by

This is good structurally.

Do not add more visible filters unless there is real data to support them.

Use:

### Search

`Search agents`

### Availability

All
Available
Request required
Unavailable

But I would reconsider **Request access** as an availability state. More on that below.

### Integration

All
PancakeSwap
Altana
etc.

### Sort

Recommended
Most active
Highest rated
Most completed

Only show sort choices supported by meaningful data.

---

# 14. Filter changes should happen immediately

No **Apply** or **Find agents** button is needed.

Changing category, availability, integration, or sort should update the list.

When filters are active, show:

`Clear filters`

beside the result count.

Do not show Clear when nothing is selected.

---

# 15. “100 agents shown” should become “100 agents”

Current:

> 100 agents shown

This reads like debug UI.

Use:

**100 agents**

When filtered:

**14 agents**

When searching:

**7 agents for “liquidity”**

---

# 16. Do not render all agents on one page

The list should not be endless.

Use pagination.

Recommended:

**20–24 agents per page**

At the bottom:

`1  2  3  4  5  Next`

and:

> Showing 1–24 of 100

Pagination is better here than infinite scroll because users are comparing candidates.

It gives them a stable position and allows them to return to results.

Store the current state in the URL:

`/agents?category=yield&availability=available&sort=recommended&page=2`

Also restore scroll position when they return from a profile.

---

# 17. Redesign the agent row

Current rows have:

* agent;
* category / request access;
* description;
* activity;
* Save;
* Compare;
* View profile;
* Request.

There are too many equally visible actions.

The row should prioritize **inspection**, not immediate hiring.

## Better desktop structure

### Left — identity

**Ethgf3mh ✓**

Health Factor

### Center — useful summary

Short description, maximum two lines.

### Right-center — useful signals

Active today

4.7 · 12 reviews

or:

12 completed jobs

Only show fields that have real values.

### Far right

♡ Save

**View profile**

Do not show Compare as a permanent button on every row.

Do not show Request as another equal-weight action unless direct request is a dominant workflow.

---

# 18. Comparison should be selection-based

A permanent **Compare** button repeated 100 times creates clutter.

Instead put a small checkbox or comparison icon beside each row.

When the user selects the first agent:

> 1 selected

When they select the second:

A sticky tray appears:

> **2 agents selected**

**Compare**

`Clear`

Limit comparison to 3–4 agents.

This is more natural.

---

# 19. Saved agents should not appear as a text count floating above the list

Current:

> Saved agents 3

on the right.

This looks like a dashboard metric.

Use a real navigation/action:

♡ **Saved (3)**

Clicking it filters the current list or opens a Saved Agents page/drawer.

---

# 20. Fix recommendations and ranking

The default sort should be **Recommended**, but recommendation must mean something.

Do not base it on an opaque Hive Score.

Recommended should primarily reflect:

1. task/query relevance;
2. category match;
3. capability match;
4. availability;
5. completed work/reliability;
6. reviews;
7. recent activity;
8. price fit when a budget exists.

For a generic directory without a task/query, the default can use:

* completeness of profile;
* availability;
* successful completed jobs;
* review quality;
* activity.

Do not heavily rank an agent simply because it registered recently.

---

# 21. Explain why an agent appears

When possible, show a small reason below a recommended result:

> Matches Health Factor Monitoring

or:

> Works with PancakeSwap

or:

> Active today · 18 completed jobs

This is more useful than a score.

---

# 22. Search should understand intent

Search should not only search literal agent names.

Examples:

`liquidation risk`

should surface Health Factor agents.

`LP ranges`

should find rebalancing/liquidity agents.

`farm yield`

should find yield agents.

Synonyms can be normalized behind the scenes.

The user should not have to know Hive's exact taxonomy.

---

# 23. Agent names are a content problem

Several names shown are strings such as:

> Ethgf3mh
> Blockgaf9go58
> Zkgaf9huk1l4vqf

These make the marketplace look synthetic even if the records are genuine.

If the source has no human-readable name, do not pretend the identifier is a brand name.

Present it differently.

For example:

**Unnamed agent**

`Ethgf3mh`

or:

**Agent #259927**

Then show the source identifier as metadata.

If the product can derive or request a display name from the owner, prioritize that.

This is important.

A directory full of random alphanumeric names will always feel generated.

---

# 24. Agent descriptions are also hurting credibility

The screenshots show descriptions such as:

> An EvoEvo AI Agent focused on sports.

on an agent categorized as Yield Optimisation.

And another:

> Think like a strategic systems planner: identify the core drivers, map second-order effects...

for a Health Factor agent.

This is a major quality issue.

Do not surface generic agent prompts as marketplace descriptions.

The description should answer:

**What work can this agent perform here?**

If no suitable description exists, omit it.

Better to show:

**Health Factor**

`No public description`

than a long irrelevant paragraph.

---

# 25. Agent profile needs a complete restructuring

The profile screenshots show two different layouts, and the stronger one still has too much empty space and duplication.

The profile should answer:

**Who is this?**
**What does it do?**
**Can I use it?**
**What evidence exists?**
**How do I hire it?**

---

# 26. Profile top section

Current content includes:

* Agents breadcrumb
* Category
* Request access
* Verified
* huge agent name
* long description
* Request access card
* Compare
* Availability
* Last active

This is too fragmented.

## Better profile header

Breadcrumb:

`Agents / Ethgf3mh`

Then:

# Ethgf3mh ✓

`Health Factor` · `Available`

Short, relevant description.

Under that, one compact metadata line:

`Active today`
`ERC-8004 verified`

Do not show verification as a yellow badge beside several other labels.

Do not repeat Availability again in a separate box.

---

# 27. Use a persistent action panel

Desktop profile should use:

**Main content: ~70%**

**Action sidebar: ~30%**

The sidebar can remain sticky.

It should contain:

### Hire this agent

Price or pricing status.

Availability.

**Hire agent**

♡ Save

Compare should be a small secondary action.

Do not put a second large “Request access” form farther down the page.

---

# 28. “Request access” is confusing

This is currently one of the biggest UX problems.

The profile says:

> Request access

and:

> Request required

But the product is supposed to be a marketplace.

Users need to understand what they are requesting.

Does it mean:

* asking the owner for permission?
* requesting a quote?
* submitting a job?
* requesting the agent to accept?
* obtaining credentials?

The copy must describe the real action.

Possible replacements depending on the behavior:

**Send job request**

**Request a quote**

**Request to hire**

**Ask agent to accept**

If the user is simply sending job details to the agent owner, use:

**Send request**

with the section:

### Request this agent

This is much clearer than “access.”

---

# 29. Do not duplicate the request UI

In one screenshot there is:

* top-right **Request access**
* a full request form beneath the profile
* header **Hire agent**

That creates three versions of one action.

There should be one hiring path.

On desktop:

**Hire / Send request** in the sticky sidebar.

Click it opens either:

* a drawer;
* a modal;
* a dedicated short flow.

Do not permanently dedicate half the profile page to a form before the user decides to hire.

---

# 30. Profile content hierarchy

After the profile header, use this order:

## Overview

Only a useful public description.

## Capabilities

Actual capabilities.

Not generic:

> Web

unless “Web” is genuinely meaningful.

Use specific capabilities such as:

* Monitor lending positions
* Track health factor
* Watch liquidation thresholds
* Trigger alerts

Only show what data supports.

## Performance

When available:

* completed jobs;
* success rate;
* average response/completion time;
* reviews;
* recent activity.

If no performance data exists, omit the section rather than filling it with zeros.

## Integrations

Only where relevant.

PancakeSwap
Altana
A2A

## Identity

Lower on the page.

Network
ERC-8004 ID
Owner/address
Source
8004scan link

This is important for verification, but it should not dominate the hiring decision.

---

# 31. Do not repeat the description as “About”

The screenshot shows the same agent description once beneath the name and again under **About**.

Remove duplication.

Use one description.

If the About section has no additional information, do not have an About section.

---

# 32. Remove single-purpose activity cards

A huge box containing:

> Last active
> Today

is not worth a card.

Show this inline:

`Active today`

Cards should be reserved for objects with multiple related pieces of information.

---

# 33. Capabilities should not be a giant container for one chip

The screenshot has an entire wide panel:

> Capabilities
> Web

This wastes space and makes the page look templated.

Use:

### Capabilities

`Web`

inline.

Or skip the section if “Web” is not meaningful.

---

# 34. Verify page

The Verify page remains useful, but it should operate as a focused utility.

Use:

# Verify an agent

> Check an agent's onchain identity before you hire.

`Agent name or BNB address`

**Verify**

Results should explain:

* identity;
* registration;
* address;
* owner if available;
* activity;
* source;
* associated Hive profile.

Do not expose backend connectivity or infrastructure status.

---

# 35. Add a real “My hires” experience

The screenshots currently emphasize discovery but do not show the ongoing product journey.

A marketplace becomes worthwhile after the user presses Hire.

The product should have a home for that work.

## My hires

Tabs:

**Active**
**Pending**
**Completed**

Each hire should show:

Agent
Task
Status
Amount
Last update

Example:

**DeepFlow**

Monitor Venus health factor

`Running`

8 USDC

Updated 4m ago

Click into a hire workspace.

---

# 36. Hire workspace

Once work begins, the user should not need to return to the agent profile.

The hire workspace should contain:

### Task

What was requested.

### Status

Requested
Accepted
Running
Submitted
Completed
Cancelled

### Agent

Link back to profile.

### Payment

Budget / agreed fee.

### Activity

Chronological updates.

### Result

Agent output when submitted.

### Receipt

Available once relevant.

If permissions exist, show them here too.

---

# 37. The actual hiring flow

Avoid a large permanent form.

Use a short focused flow.

### 1. Task

`What do you need done?`

### 2. Budget

Optional or required according to the real model.

### 3. Permissions

Only when the agent requires them.

### 4. Review

Agent
Task
Price/budget
Permissions

**Send request**

Do not add artificial steps simply to make it look sophisticated.

---

# 38. Empty and incomplete data are normal

The current interface appears to fill every template slot even when data is weak.

Do the opposite.

If an agent has:

* no reviews;
* no price;
* no performance;
* no good description;

the interface should become simpler.

Do not fill the card with:

> No reviews yet
> Set by agent
> Hive score 48
> Today

just to preserve a standard shape.

A real product should visibly distinguish rich profiles from incomplete profiles.

That also provides an incentive for providers to improve their listings.

---

# 39. Introduce profile completeness for owners, not shoppers

If owners can manage their agents, show them:

**Profile completeness: 60%**

Suggestions:

* Add pricing
* Add description
* Add capabilities
* Add example result

Do not show this to marketplace shoppers.

This helps improve data quality over time.

---

# 40. Visual design changes

The current dark direction is workable. The problem is mostly hierarchy.

Keep the dark theme, but make it less monochromatically green.

### Main background

Near-black.

### Surfaces

One or two dark neutral surfaces.

### Primary text

Warm/off-white.

### Secondary text

Neutral gray with sufficient contrast.

### Green

Use Hive green only for:

* primary button;
* selected navigation;
* active state;
* verification;
* link hover/focus.

### Yellow

Use BNB yellow only for BNB-chain context.

Do not tint most typography green.

---

# 41. Reduce border usage

Currently almost every element has an outline.

This produces a generated-dashboard appearance.

Use:

* spacing;
* typography;
* dividers;
* surface differences

before reaching for another rounded rectangle.

Agent directories can be a single list container with horizontal row dividers.

Profile sections do not all need card boundaries.

---

# 42. Reduce corner radii

Keep:

* buttons: 8–10 px;
* inputs: 8 px;
* panels: 8 px.

Do not make every nested item a pill or large rounded card.

---

# 43. Avoid oversized headings in application screens

The homepage can have a large display title.

Agents should not need an enormous:

> Agents

with a large blank section around it.

Use roughly:

**36–44 px** for application page titles.

Profiles should prioritize the agent data rather than decorative whitespace.

---

# 44. Improve navigation density

Current header has considerable unused horizontal space.

That is acceptable, but once you introduce My hires/Saved, use a normal product navigation:

**Agents**
**My hires**
**Verify**

Right:

Account

Avoid adding a global Hire button if the Agents journey already handles hiring naturally.

---

# 45. Remove these elements entirely

From the screenshots, I would remove:

* homepage “Find / Set terms / Review result” cards;
* homepage ecosystem integration grid;
* `248k+ registered on BSC` hero badge;
* duplicate `248k+` directory claim;
* “Agents with useful public details”;
* giant single-value Last Active card;
* repeated About copy;
* oversized Capabilities card for one item;
* always-visible Compare button on every directory row;
* floating “Saved agents 3” text;
* duplicated Request Access buttons/forms;
* “Request required” unless that phrase represents a precise state users understand;
* generic descriptions that do not match the agent category;
* meaningless template metadata;
* repeated verification treatment everywhere;
* decorative badges when the whole page already shares the same chain/protocol state.

---

# 46. Keep these features, but improve them

Keep:

* task search;
* four core categories;
* agent directory;
* category filtering;
* availability filtering;
* integration filtering;
* sorting;
* saving;
* comparison;
* verification;
* profile pages;
* hiring/request;
* identity information.

They are useful.

They just need to be organized around decisions rather than exposed all at once.

---

# 47. Recommended product journey

The final experience should work like this:

### Discovery

User lands on Hive.

They either describe what they need or choose a category.

### Results

Hive shows relevant agents.

The user can search, filter, save, and compare.

### Evaluation

The user opens a profile.

The profile explains what the agent does, availability, useful performance information, and verified identity.

### Hire

The user submits the task and terms through a short flow.

### Work

The hire appears in **My hires**.

The user follows status and activity there.

### Result

The agent submits its output.

The user reviews it.

### Record

Payment/result details are retained in the completed hire/receipt.

That is a complete product loop.

The current interface is heavily weighted toward the first two steps.

The redesign should give equal thought to what happens **after the user chooses an agent**.

---

# 48. Design principle for every screen

Before adding an element, ask:

> **Does this help the user make the next decision?**

If not, remove it or move it deeper.

The product does not need to display every field Hive knows.

It needs to display the **right information at the right point in the journey**.

For this marketplace:

**Homepage = start discovery.**
**Directory = narrow the options.**
**Profile = decide whether to hire.**
**Hire flow = define the work.**
**My hires = manage the relationship.**
**Verify = inspect identity when needed.**

That structure will do more to make the product feel deliberate, credible, and production-ready than adding more visual polish to the current screens.
