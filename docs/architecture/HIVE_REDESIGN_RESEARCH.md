# Hive redesign research

Research date: 2026-09-11. This document describes a new direction. Prior Hive design plans are not design authority for this branch.

## Supplied local references

| Source | Inspected information | Design decision |
| --- | --- | --- |
| `/Users/tim/Coding/vibecoding/Design styles/design-guides.md` | Component sources, coss UI, Utopia, iconcreator, interaction references | Use consistent iconography, semantic controls, fluid type, and an explicit token scale. Do not collect unrelated effects. |
| `/Users/tim/Coding/vibecoding/Design styles/AI Agent.md` | Alden: controlled color, type hierarchy, functional mockups, quiet surfaces | Use restraint and concrete output illustrations. Reject the healthcare palette, centered sequence, repeated cards, and inherited brand. |
| `/Users/tim/Coding/vibecoding/Design styles/inspiration.md` | Dala, Steep, and other style references; large typography, editorial sections, particle art, diagrams | Use type scale and section rhythm. Reject multicolor clouds, copied compositions, promotional metrics, and generic feature grids. |

## External sources and applied decisions

### Robinhood

Source: https://robinhood.com/us/en/

Read the public page and inspected its delivered CSS color values. `#CCFF00`, `#110E08`, and white are present. Use the lime as an accent with dark text. Retain the existing Hive mark and different page composition. Color affinity does not imply affiliation.

Source: https://docs.robinhood.com/chain/deploy-smart-contracts/

The current official documentation provides chain deployment information. This is infrastructure documentation, not evidence of Hive's deployment. The landing will not state “live on Robinhood” or present an invented token address. The token page unit has an explicit evidence gate.

### Rare UI

Sources:
- https://www.rareui.com/components
- https://www.rareui.com/components/stepplayer
- https://www.rareui.com/components/scrollprogressindicator

The Step Player supports manual seeking and a clear current step. Apply that interaction principle to the hiring guide, with named stages and no automatic playback. Scroll Progress informed restrained progress feedback. The guide implementation is original GSAP/React code, not an imported Rare UI component. Reject animated counters because the landing has no verified number to present. Reject fluid orbs, gooey navigation, and gravity text for this product.

### ThreeUI

Sources:
- https://threeui.com/
- https://threeui.com/backgrounds/liquid-form
- https://threeui.com/three-js/structure-flow
- https://threeui.com/terms

The homepage is client-rendered, so the public catalog metadata and Liquid Form thumbnail were inspected directly. Liquid Form demonstrates studio metal reflections and smoothed pointer response. Structure Flow demonstrates geometry-based scenes and bounded renderer controls. Use the material study and Logic Core scene structure to inform an original 3D agent group with selectable roles. The user requested this hero replacement after the initial checkpoint. Do not copy paid code or republish a reference asset. Record the implementation as ThreeUI-inspired, built with Three.js. The artwork illustrates agent roles. It does not represent connected providers or measured activity.

### Component and icon references

Sources:
- https://coss.com/ui/docs/components/button
- https://coss.com/ui/docs/components/accordion
- https://iconcreator.dev/
- https://utopia.fyi/

Use the coss UI approach to accessible buttons and inline disclosures. Use one Lucide icon family as in the reference examples. Use Utopia's fluid-scaling principle, with explicit `clamp()` limits. The existing Hive mark is brand artwork rather than an icon-library asset. No generic component theme is imported wholesale.

### Avatars

Sources:
- https://www.dicebear.com/
- https://www.dicebear.com/styles/bottts/
- https://www.dicebear.com/licenses/

Use deterministic Bottts avatars with local SVG files so the landing does not depend on a remote avatar request. Record generation seeds, upstream version and URLs in the asset attribution file. Avatars identify the illustrative role in each example; they do not stand for fabricated marketplace sellers. Bottts is by Pablo Stanley; retain its license information with the assets.

### Typography

Sources:
- https://fonts.google.com/specimen/Manrope
- https://github.com/google/fonts/tree/main/ofl/manrope

Use new local Manrope assets, with their OFL license. Its open counters and wide lowercase forms support large, plain headings and legible smaller labels. Do not reuse the existing Montserrat font on the landing.

### Motion and accessibility

Sources:
- https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- https://threejs.org/docs/#api/en/renderers/WebGLRenderer
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/

Use scoped motion contexts, cleanup, native buttons, and reduced-motion alternatives. 3D motion must not prevent reading or selecting an action. Test no-WebGL and reduced-motion paths in the browser.

### ASD-STE100

Sources:
- https://www.asd-ste100.org/
- https://www.asd-ste100.org/about.html

The official site identifies Issue 9 and describes controlled technical English. The full dictionary requires an official copy and is not present in the supplied material. Apply short sentences, active voice, consistent nouns and direct instructions; do not claim a formal dictionary-compliance audit without that text.

Working product nouns: Hive (proper name); AI agent (software that performs a task); task (requested work); brief (task description); proposal (agent's offer to do the task); output (submitted work); review (inspection of submitted work); budget (amount available for a task); marketplace (place to find agents or tasks); USDC (proper token name, only in verified payment context).

## Repository evidence

Base commit: `72f793c`. `git status --short` was empty before branching. Source remote: `https://github.com/timokonkwo/Hive.git`.

- `app/marketplace/page.tsx`: tasks API, category/status filters, pagination.
- `app/agents/page.tsx`: leaderboard API, search and sort.
- `app/create/page.tsx`: task brief, budget, draft, optional direct hire, submission.
- `app/marketplace/[taskId]/page.tsx`: proposals, task lifecycle, work review and messages.
- `components/providers/Providers.tsx`: existing auth and wallet provider boundaries.
- `app/overview/page.tsx`, `app/feed/page.tsx`, `app/leaderboard/page.tsx`, `app/token/page.tsx`: redirect routes.

These files establish route and action contracts only. Their layout, cards, artwork, flow, and copy are not inputs to the new landing composition.

## Open questions for later units

1. Token deployment, contract, supply and migration details: needed for Unit 17; not needed to design the landing.
2. Agent service pricing and availability fields: verify endpoint schema before Unit 03.
3. Public proof and samples: require a attributable data source before displaying real provider claims.
4. The full STE Issue 9 dictionary: needed for formal lexical verification before publication.
5. Native app distribution: this repository is a Next.js web app. The plan covers the responsive web app. Native applications need a separate platform scope if requested.

## Expanded landing implementation

The user requested a more animated background, page reveals, an interactive agent hero, and a longer landing. A checkpoint with the earlier Hive-logo hero was pushed first, as requested (`4519a58`). The expanded landing adds local task-brief drafting and copy, a comparison guide, and an agent-owner section. These are useful product interactions without fabricated metrics. Existing Hive logos remain unchanged in the header, footer, and page illustrations.

## Unit 02 app shell and marketplace

The user directed that the landing open the app and that subsequent pages use app navigation. The route map is in `HIVE_APP_NAVIGATION.md`. The marketplace brief records the task API contract and its limitations. The coss table/select documentation was reviewed again for this unit; the implementation uses an original responsive task list, native selects, and a native modal preview on small screens. It retains the approved visual identity and extracts the theme/font foundation for shared use.

The public task endpoint returned HTTP 200 during verification. Production QA covers real task rendering separately from isolated browser fixtures used for error, empty, long-content, stale-request and pagination states. No promotional counts, client identities, budgets, currencies, or provider claims are invented.

## Unit 03 and landing audit  -  September 11

The landing audit and changes are recorded in `HIVE_LANDING_AUDIT.md`. `HIVE_AGENTS_BRIEF.md` records the agent data contract, new app composition, and validation plan. The public leaderboard returned 272 entries at inspection; counts remain data, never static marketing claims. The directory adds completed-task sorting to the read endpoint, with stable ID tie-breaks, and projects existing capabilities. It omits currency-less earnings, invented prices, activity badges, and availability claims.

DiceBear documentation was rechecked at https://www.dicebear.com/integrations/http-api/ and https://www.dicebear.com/styles/bottts/ . Version 9 remains supported. Use local JavaScript generation because the public HTTP service is described for non-commercial use. The installed Bottts license permits personal and commercial artwork use.

## Unit 04  -  agent profile

See `HIVE_PROFILE_BRIEF.md`. Source contracts: the by-name profile endpoint, the public reviews endpoint, task creation/assignment, and `lib/reputation.ts`. Review text is now shown from existing records; no author identity or output samples are invented. Stored zero reputation no longer invokes a synthetic formula. Profile task counts now include the legacy name assignment case used by the directory.

Encoding was verified against the installed Next.js implementation and browser requests: `node_modules/next/dist/shared/lib/router/utils/get-dynamic-param.js` encodes page parameters, while route matching decodes API parameters. Page and API boundaries must handle this distinction. Review pagination preserves the current path and updates its query instead of navigating to a newly reconstructed profile URL.

## Unit 05  -  create task

See `HIVE_CREATE_TASK_BRIEF.md` for the input/authentication/assignment contract audit and new form sequence. The audit found an unconditional auto-assignment that could conflict with the profile’s selected agent, plus a false success message after assignment failure. The redesign uses explicit selection modes and separate creation/assignment outcomes. The existing Solana token-launch behavior remains explicit within its conditional fields. No Robinhood-chain transaction support is inferred from accent colors.

Rare UI and ThreeUI were revisited for motion references. This working form uses short element entrances and focus-safe transitions instead of a decorative 3D scene. Cloudflare’s widget configuration documents a compact 150px widget suitable for narrow form rails and light/dark theme options: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/ .


## Unit 06  -  task detail

The contract audit and implementation sequence are in `HIVE_TASK_DETAIL_BRIEF.md`. The old page mixed public data, private messages/work, proposals, and payment state in one component. The new workspace separates the brief, proposal decisions, submitted work, and stored activity; independent request states prevent one failed endpoint from blanking the page. Public task GET now supplies an explicit authenticated access result with private/no-store headers.

The audit also found an unconditional task update during proposal acceptance and a payment-signature claim that blocked recovery of an interrupted verification. The scoped changes add an atomic Open-task claim and same-task/client signature retry while retaining replay protection. Existing Solana payment behavior is preserved, with exact preview details and a stored reference before broadcast. No Robinhood-chain payment behavior is inferred.


## Unit 07  -  My tasks

See `HIVE_DASHBOARD_BRIEF.md` for the contract audit and design sequence. The legacy dashboard's wallet-address query missed canonical account tasks and accepted arbitrary address reads. Canonical ownership plus a signature-verified Solana link now determine the task selection. Profile, session and points requests use the existing authenticated transport.

The old browser deposit destination was hardcoded while server verification used an environment setting. The authenticated session read now exposes that public destination/mint so the exact configured route is shown and used. Conversion rate/minimum come from the existing points constants. Stored signatures and conservative unknown-outcome states protect against automatic duplicate writes. Global governance disputes remain in their app destination rather than being relabeled as a client's private cases.

## Unit 08  -  agent registration and wallet direction

The user approved continuation and specified Robinhood priority with Solana support retained, without launch explanations in product copy. This is recorded as an implementation constraint. Official network details were checked at https://docs.robinhood.com/chain/connecting/ . The installed Privy configuration types support mixed Ethereum/Solana wallet selection, ordered wallet choices and a default EVM chain. Shared authentication now uses that configuration; existing Solana payment routes are preserved and have not been migrated by this unit.

See `HIVE_REGISTER_BRIEF.md` for the contract audit. Registration accepts service identity and optional links/address details; no price, integration endpoint or listing fee exists in its contract. The editor omits unsupported fields. Token launch remains a separate owner action. Credential acknowledgement now precedes explicit activation; uncertain writes retain a non-secret receipt. Name checks reject stale results and registration retains pending names. Local DiceBear seeds are stored and exposed consistently across agent surfaces.

## Unit 09  -  My agents

The owner-page audit found a session-key path that bypassed its normal PIN step, no assigned-work list, currency-agnostic payment totals, and PIN/key writes without a prior-value condition. The implementation uses an explicit PIN gate, an agent-scoped work query, per-record payment evidence, and compare-and-set updates. Verified wallet fallback is allowed only without a conflicting canonical assignment ID. Names and unverified address fields are not sufficient for private work ownership.

The design brief is in `HIVE_OWNER_BRIEF.md`. Coss underline navigation, Rare UI and ThreeUI were reviewed again; the working page uses native navigation and restrained GSAP leaf entrances. Task rows and profile fields carry the useful content. No ranking score, arbitrary progress chart, synthetic balance or Robinhood launch claim was added. Owner integrations and legacy token/points controls are grouped into the next tools unit instead of reproducing the old all-in-one dashboard.


## Unit 10  -  Owner tools

See `HIVE_TOOLS_BRIEF.md` for the contract audit, source references and implementation sequence. The previous dashboard grouped tool configuration, webhook delivery, token creation and points conversion into one surface. The replacement uses four focused app views. Coss dialog guidance, Rare UI and ThreeUI were revisited; forms use native dialogs and short GSAP entrances without decorative scenes around configuration controls.

The API audit found full-array tool replacement without conflict detection and tool-token creation without a scoped atomic claim. Tool changes now compare the previous array. Tool launches verify the exact authenticated agent and registered tool, claim that target before the external call and preserve unrelated token entries. Webhook secrets remain a one-time result. Uncertain creations, launches and conversions are retained across reload instead of automatically retried. These protections were checked with isolated transport/database fixtures; no external delivery or on-chain execution was performed.


## Unit 11  -  Agent wallet settings

The legacy manage route ignored its agent ID and called a now-signature-protected Solana PATCH without a proof. Its generic primary-wallet write also accepted an unsigned address. The replacement uses exact-agent access checks, a private wallet response, explicit address review and network-specific message signatures. The primary wallet remains immutable after linking; Solana retains replacement/removal. Prior address and revision conditions reject stale writes.

Official Robinhood configuration was rechecked at https://docs.robinhood.com/chain/connecting/ . It matches the existing shared default network. Privy's installed EVM/Solana wallet interfaces and https://docs.privy.io/wallets/using-wallets/solana/sign-a-message informed the connector use. Coss dialog references informed the review interaction. See `HIVE_WALLET_BRIEF.md` for the sequence and limits. No payment migration, fee-wallet change or real wallet action is implied.


## Unit 12  -  Agent verification

The old endpoint accepted a post URL without owner authorization or reading the post, then immediately set verification and increased reputation. The replacement retains the X-post method but requires an exact-agent key or unexpired claim token, plus a matching author and agent-specific code from an official post lookup. Failed or unavailable proof checks cannot grant verification. Historical flags are not retrospectively changed.

Sources: https://docs.x.com/x-api/posts/lookup/quickstart , https://docs.x.com/fundamentals/authentication/oauth-1-0a/creating-a-signature , and coss field guidance https://coss.com/ui/docs/components/field . The lookup uses bearer authentication or the existing OAuth credentials, a fixed API host and author expansion. The current local environment has no lookup credential set, so live verification remains unavailable. See `HIVE_VERIFY_BRIEF.md` for test evidence and configuration boundaries.


## Unit 13  -  Recovery audit (2026-09-12)

The legacy page advertised unsigned wallet recovery although the API rejects it. The replacement supports the issued offline recovery code only. It uses the app shell, two labelled fields, a consequence review and a separate masked-key result. Robinhood-first wallet settings and supported Solana actions remain as implemented in Unit 11. Paid X API setup is deferred and does not block this unit.

References: [coss Field](https://coss.com/ui/docs/components/field) for label/description/error relationships; [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) for credential error consistency, bounded attempts and private recovery handling. Recovery retains the existing reusable offline code and unchanged PIN policy. Proof is included in a bounded exact-name database lookup. A previous-key comparison rejects concurrent writes; logging failure does not hide an already-created key. Browser state retains only a non-secret pending marker to explain reload uncertainty. See `HIVE_RECOVERY_BRIEF.md` for the implementation sequence and validation boundary.


## Unit 14  -  Tool directory (2026-09-12)

The public API combines agent-registered tools and curated external MCP entries. External prices and reputation are placeholders, and their input schemas are hand-written examples; remove these from factual presentation. Preserve source identities rather than suppressing external entries when a Hive tool shares a name. Registered prices use the existing USDC-per-call contract. Missing prices stay unknown; source status is not an uptime check.

[coss Accordion](https://coss.com/ui/docs/components/accordion) and [Component Gallery accordion patterns](https://component.gallery/components/accordion/) informed a divided list with keyboard-operated detail panels. Search, source, token, sort and pagination use URL state. No categories are invented because the source does not provide them. Connection details, copy controls and input schema belong inside the selected row, while price and provider stay visible for comparison.

The public response remains bounded to 300 providers, now with a deterministic order and an explicit limit marker if a 301st record exists. Pending/suspended providers are excluded. Private provider endpoints are never returned. The shared Hive MCP connection is a general discovery endpoint: the current gateway resolves tool names globally and does not accept a provider ID for selection. The directory therefore offers no provider-specific invocation or claim that a row is callable. Changing gateway resolution is outside this design unit. See `HIVE_REGISTRY_BRIEF.md`.


## Unit 15  -  Analytics (2026-09-12)

The previous endpoint summed completed-task budgets and the page called them payouts. It had no dated series, suppressed read failures and relabelled stale Bags values with a current timestamp. The replacement uses Mongo aggregation of creation/completion dates with UTC zero-filled 7/30/90-day windows, explicit undated coverage, complete normalized status categories and payment records with amount/currency/chain/signature evidence. Budgets are excluded.

[Component Gallery table patterns](https://component.gallery/components/table/) informed the chart's semantic data-table alternative. The chart uses native range keyboard controls for date inspection and a labelled SVG with a zero baseline. A responsive viewBox keeps axis text readable on phones. CSV exports the same daily records displayed in the table. Counts for the selected period and all-time records are separate.

[Bags lifetime-fee documentation](https://docs.bags.fm/api-reference/get-token-lifetime-fees) specifies lamport strings. The existing SDK converts these using parseInt, so the read now preserves the raw integer string and displays SOL using bigint conversion. [Claim statistics documentation](https://docs.bags.fm/api-reference/get-token-claim-stats) did not establish the unit for totalClaimed; the new page preserves recipient identities and source links without inventing a converted amount. Existing creator fee shares remain in percent from documented basis points.

Marketplace and fee reads are independent. Each fee component keeps its source fetch timestamp and explicit stale/unavailable state; requests are bounded and concurrent, with five-minute caching and in-flight deduplication. The existing Solana mint remains identified as Solana, and USD estimates remain distinct from task USDC. No Robinhood analytics or X integration is invented. See `HIVE_ANALYTICS_BRIEF.md`.


## Unit 16  -  Disputes research and delivery

Read the existing dispute/report/evidence/vote routes, Solana proof verification, recorded staking tiers and resolution worker before designing the page. Reports are reviewed before public case creation; evidence is public; vote weight comes from active recorded stake, not wallet balances or a fabricated historical snapshot. Existing dates and result states govern the interface. Exact account and connected-wallet binding informed the review flow.

Used the existing shared app controls and a case list/detail structure. Checked the WAI modal pattern at https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ for focus, keyboard containment and restoration. The attempted component-gallery master-detail reference did not resolve and was not treated as verified evidence. No copied component implementation or additional UI dependency was introduced.

The full page contract, API boundary fixes, validation evidence and operational limits are in `HIVE_DISPUTES_BRIEF.md`. Token/staking remains behind the next review gate.


## September 12  -  token, select controls and supplied identity

Token research and network/launch boundaries: `HIVE_TOKEN_BRIEF.md`. Shared dropdown behavior follows the W3C select-only combobox interaction pattern; see `HIVE_CONTROLS_AUDIT.md`. The user's new SVG/PNG exports supersede the original green identity, while retaining its supplied geometry; placements and theme handling are recorded in `HIVE_BRAND_UPDATE.md`.


## Unit 18  -  Documentation research

Audited the old 23-topic guide against the approved redesigned workflows and local SDK/MCP/API source. Kept original topic hashes, moved product guidance ahead of integrations, and separated human owner setup from agent proposal/delivery actions. The SDK returns result.tasks; its local MCP package lacks a bin entry, and local upload is not a remote built-in. Removed unsupported old promotion, multiplier and instant-conversion claims.

The supplied design-guides.md and inspiration.md informed the research pass. [coss UI](https://coss.com/ui) and [Component Gallery navigation](https://component.gallery/components/navigation/) informed the topic index and search presentation. [W3C modal dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) informed native modal focus, Escape and return-to-trigger behavior. No external component code or dependencies were added. Detailed implementation and validation: HIVE_DOCS_BRIEF.md.
