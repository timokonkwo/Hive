# Unit 14  -  Tool directory

Status: implemented and locally validated; ready for user review. Scope: `/registry` and its public listing response. X API setup stays deferred. Report this unit for review before Analytics (Unit 15).

## Research and contract

The API combines registered agent tools with curated external MCP servers. The old page uses repeated cards, treats missing registered prices as zero, gives external publishers placeholder reputation, truncates prices to four decimals and exposes a dead or ambiguous connection action. Categories are not supplied; do not invent them. Existing catalog source links are references, not proof that a service is currently available or free.

[coss Accordion](https://coss.com/ui/docs/components/accordion) and [Component Gallery disclosures](https://component.gallery/components/accordion/) inform expanding rows with real buttons, heading structure, named regions and keyboard access. Use the established Hive app shell, tokens, Lucide icons and GSAP; no added dependencies or copied layouts.

Direction: a compact comparison list with comfortable controls. Flat divided rows; quiet typography; price and provider remain visible. Restrained row entrances and detail reveals, with reduced-motion support. No metric-card grid, status dots, invented categories, inflated reputation or execution controls.

## Implementation sequence

1. Audit and normalize public data: stable provider/tool identity; preserve unavailable prices as null; registered price basis USDC per call; external price unknown. Bound the source response and disclose a source limit if reached. Keep external entries distinct even when a registered tool uses their name. Select only public fields and keep provider endpoints private.
2. Build a new app page with a search form, source filter, token filter, alphabetical/price sorting and URL-backed pagination. Preserve filter/history state and search input on retry. Unknown prices sort after known values. External catalog entries are not presented as free or verified.
3. Show full tool name, description, publisher, source type and price. Expand one row to show the existing shared Hive MCP URL or external URL/install command, schema details where supplied, provider profile/source links and supported Solana token link. Copy only on explicit action; await success and offer manual selection on failure. Do not execute commands or call tools.
4. Provide loading, unavailable, malformed response, no listings, no matches and out-of-range page states. Cancel obsolete requests, discard stale reads, preserve filters and offer refresh/retry. No silent fixture fallback.
5. Audit mobile at 320–1440px, both themes, long text and URLs, keyboard expansion/focus, copy failure, URL history, sorting/pagination, malformed data, API failure/retry and reduced motion. Use fixtures only for browser scenarios; no account or tool mutations.

## Boundaries

The directory is read-only. It does not prove endpoint uptime, current external pricing, authentication requirements absent from the catalog, or successful tool execution. Technical connection details belong in expanded rows because visitors use them to connect tools. Preserve wallet behavior from the earlier units; do not add chain-launch claims. Current public listing reads are capped; this unit must not label a capped snapshot as a complete platform total.


## Validation  -  2026-09-12

- Production build, TypeScript, scoped ESLint (including shared navigation) and `git diff --check` passed.
- 186 regression tests passed, including 13 new directory normalization and route cases.
- 56 browser checks passed: both themes at ten widths from 320 to 1440px, source/token/search/sort/page state, back navigation, keyboard expansion, retained focus, copy rejection/success, provided schema, price precision, safe links, loading/error/rate limit/malformed/empty/limited states, long content, enlarged text and motion. All scenario reads used fixtures; zero API writes occurred.
- A separate real public API read returned nine external catalog entries, zero registered Hive tools and `limited: false`. This does not establish external endpoint availability, current pricing or successful execution.
- Build/type/lint/regression logs: `/private/tmp/hive-registry-build.log`, `hive-registry-types.log`, `hive-registry-lint.log`, `hive-registry-tests.log`. Browser results: `/private/tmp/hive-redesign-qa/registry-results.json`; repeatable script: `scripts/redesign/check-registry.mjs`.

The shared app menu now opens More for its active destination so Tools remains visible in desktop and mobile navigation. The gateway still resolves tool names globally; the directory offers its shared discovery connection, not provider-specific execution.

Review: http://localhost:3100/registry . Changes remain local and unpushed on `main_redesign`. Next after review: Unit 15, Analytics. X API setup stays deferred.
