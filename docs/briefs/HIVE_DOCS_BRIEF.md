# Unit 18  -  Documentation redesign

Approved by the user on September 12, 2026. Work locally on main_redesign and stop for review before Unit 19.

## Research and direction

The existing /docs is a 23-section dark-only document with duplicate desktop/mobile menus, many decorative cards, tiny code, no search or copy feedback, and incorrect or stale claims (free registration, automatic point conversion, owner/agent wording, old dashboard labels). New direction: a compact documentation workspace, one topic at a time, a stable left index, a readable article and a small on-page outline. Use the supplied Hive icon with manual text, Manrope, existing light/dark tokens and lime accents. Product guidance comes before integration details. No marketing hero, ambient background, metric cards or decorative 3D scene.

Reviewed the user-provided design-guides.md and inspiration.md; selected navigation/command patterns from coss.com/ui and component.gallery/components/navigation/. W3C APG dialog-modal guidance informs focus containment, Escape and returning focus. Existing app routes, redesign briefs, SDK source, MCP route, token launch configuration and API handlers are the source of truth for product behavior. Reference pages inform interactions, not Hive claims.

## Content plan

- Start here: What is Hive, workflow, roles, quick start.
- Clients: post a task, choose proposals, task status/review/payment, categories, My tasks.
- Agent owners: registration/access, how agents find and deliver work, reputation, My agents.
- Integrations: Agent SDK, OpenClaw, MCP and provider tools, REST reference, legacy holder API.
- HIVE and help: Robinhood coming soon with separate Solana support, recorded points without promised conversion, updates link, FAQ.

Keep all 23 existing topic hashes valid. Give article sections their own shareable hashes. Search a local index of actual titles and content; include clear no-results and unknown-topic states. Explain that owners manage configuration while agents propose/deliver. Remove unsupported outcome, multiplier, payment and token claims. Preserve useful endpoint coverage but label technical material as integration reference. No credentials embedded in copyable examples.

## Implementation units

1. [x] Replace legacy content with typed topic data and a reusable article renderer; verify code/endpoint examples against local source.
2. [x] Build public docs frame, desktop index, article outline, previous/next navigation, hash/history behavior and theme control. Remove legacy provider/background wrapper from /docs.
3. [x] Add real indexed search, keyboard shortcut, native modal mobile navigation, accessible code copy/fallback and restrained article entrances with reduced motion.
4. [x] Verify every topic/anchor, search, keyboard/focus, copy success/failure, links, mobile bounds, both themes, enlarged text, browser history and unknown hashes.
5. [x] Run build, typecheck and scoped lint. Review captures. Update project trackers and hand off this page for review.

## Boundaries

No account, API, wallet, payment or token behavior changes. Robinhood token and fee data remain coming soon; existing Solana instructions remain scoped to Solana. X verification stays as currently supported and can report unavailable. Do not claim SDK code was run against live accounts or that docs redesign proves deployed behavior. No new dependencies or external analytics.


## Content and contract corrections

The new guide preserves 23 original topic hashes and 55 endpoint entries. API path/method checks confirm local handlers exist; they are not evidence of live authorization or successful requests. Removed the unsupported free-registration claim, promotional task/point multipliers, instant token conversion language and old dashboard tab instructions. SDK browsing now uses the typed result.tasks response. Proposal and delivery examples are separate and state the assignment requirement. Remote MCP tool discovery is separate from the local stdio server, whose upload tool is not advertised as a remote built-in. The local package has no executable bin entry, so its configuration uses the compiled Node entry point rather than an unverified npx command.

Source checks: hive-agent-sdk/src/client.ts and types.ts; hive-mcp-server/package.json, tsconfig.json and src/index.ts; app/api/mcp/route.ts; registration and tool handlers; approved task, registration, recovery, wallet and token briefs. Paid X API setup remains deferred.

## Final validation

Production build, TypeScript, scoped lint and git diff --check passed. The content/index audit passed 257 checks covering original hashes, unique section anchors, internal links, populated API groups, existing route methods, search indexing and malformed hashes. All 89 Chrome browser checks passed: 23 topic articles at 320px; both themes at 320/390/768/900/901/1200/1440px; real content and endpoint search; empty/reset search; Ctrl K; modal focus/Escape; code copy and manual fallback; mobile topics with persistent access; deep link/reload/back; unknown topic recovery; theme persistence; enlarged text and completed motion. Final desktop/light and phone/dark captures were visually reviewed.

Evidence: `/private/tmp/hive-docs-build.log`, `hive-docs-types.log`, `hive-docs-lint.log`, `/private/tmp/hive-redesign-qa/docs-results.json`, `docs-light-1440.png`, `docs-dark-390.png`, `docs-api-320.png`, `docs-sdk-320.png`, `docs-topics-320.png`. Repeatable checks: `scripts/redesign/check-docs-index.mjs` and `scripts/redesign/check-docs.mjs`.

These are local production-preview and Chrome-emulation results, not physical-device or deployed integration proof. No API/account writes were made. Review: http://localhost:3100/docs . Changes remain unpushed on main_redesign. Stop before Unit 19, Roadmap.
