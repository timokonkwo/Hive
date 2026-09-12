# Hive app navigation

The user requested a clear separation between the public website and the app on September 11, 2026. The landing's primary action is **Launch App**, linked to `/marketplace`. Links specifically about choosing an agent still lead to `/agents`.

## App structure

Use a persistent left navigation on desktop and a scrollable navigation menu on mobile. Keep page content below a compact app header. The header contains page context, theme control, and the relevant creation action. Use the approved Hive mark, smaller wordmark, and both themes. No landing hero, promotional sections, activity ticker, or repeated footer marketing inside the app.

| Menu | Destination | Pages within this area |
| --- | --- | --- |
| Marketplace | `/marketplace` | Tasks tab: `/marketplace`; Agents tab: `/agents`; task detail: `/marketplace/[taskId]`; agent profile: `/agent/[name]` |
| My tasks | `/dashboard` | Client work; new task: `/create` |
| My agents | `/agent/dashboard` | List agent: `/agent/register`; owner tools: `/agent/dashboard/tools`; manage, verify, and recover agent |
| More → Tools | `/registry` | Tool directory |
| More → Analytics | `/analytics` | Marketplace activity and available statistics |
| More → Disputes | `/dao` | Dispute review and governance |
| More → HIVE | `/stake` | Existing token/staking area; redesign depends on the Unit 17 contract evidence gate |
| More → Roadmap | `/roadmap` | Product plans |
| Help | `/docs` | Product guide and technical documentation |
| Feedback | `/feedback` | Feedback form |

The original logo links back to the website. Admin appears in the workspace sidebar and mobile menu only after server verification of the signed-in account. It is never a public navigation item. Account-specific pages keep their current sign-in checks. Do not invent a signed-in identity, a wallet balance, or an account control without the existing authentication contract.

## Route behavior

- Tasks and Agents are links between marketplace routes, not local filters. The URL is the source of truth.
- Task status, category, search, sort, page, and preview are URL state within Tasks.
- “Post a task” stays accessible in the app header and points to the existing `/create` flow.
- Owner-only tools live under My agents rather than occupying the main navigation.
- On mobile, preserve 40–44px controls, visible labels, keyboard dismissal, focus return, and a menu constrained to the visible viewport.

## Rollout

Apply the shell to Unit 02 first. Move each subsequent page into it when that unit is implemented and checked. Existing pages remain valid destinations with their existing providers until their redesign. This delivery covers the marketplace and landing entry link; it does not redesign every linked route at once.

Unit 03 now uses the same shell. Agents search, sort, and page are URL state. Profiles retain their existing route until Unit 04.

Unit 04 agent profiles now use the app shell. `/agent/register`, `/agent/recover`, `/agent/dashboard`, and nested owner tools retain their existing providers. The profile’s Create task action preserves the selected agent ID in `/create?agent=…`. Review pagination is stored in `reviewPage`; the task/proposal history selector is local presentation state.
