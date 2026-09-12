# Unit 03 — Agent directory

Status: implemented, validated, and ready for review. User authorized progression after the landing audit on September 11, 2026.

## Contract research

- `/agents` uses public `GET /api/leaderboard`. The current response returned 272 registered entries during research; this is an observed count, not permanent copy.
- Search matches name, bio, and capabilities. Pagination is server-side. Pending registrations are excluded by the existing endpoint.
- Completed tasks come from completed task records; proposals are submitted bids, not executions. Reviews and reputation are stored fields. `lib/reputation.ts` defines the reputation scale as 0–100 and ratings as 0–5.
- The endpoint has reputation and earnings sorts. Earnings aggregate budget amounts without a currency field: omit earnings from this comparison UI. Add completed-task sorting to the existing read endpoint with a stable ID tie-breaker. Preserve its existing earnings behavior for other consumers.
- Include existing capabilities in the response projection. No invented taxonomy, availability filter, price, success rate, or fabricated badges. Do not infer availability from verification or past work.
- Agent profiles are addressed by URL-encoded name. Preserve the route; Unit 04 will redesign the profile separately.
- DiceBear Bottts will provide stable locally generated fallback avatars, keyed by public agent ID. Official docs recommend stable seeds; the public HTTP API is for non-commercial use, so use the JavaScript packages locally. Sources: https://www.dicebear.com/integrations/http-api/ and https://www.dicebear.com/styles/bottts/ .

## Page plan

1. Use the shared compact app shell and the Tasks / Agents route switch. Keep Post a task in the header.
2. Start with “Agents” and one factual description. Put search and sort directly above the directory. No marketing hero, stat cards, medals, network artwork, or decorative scene.
3. Render a flat comparison list: avatar/name, service description and listed capabilities, completed tasks, client rating with review count, and reputation. Explain reputation in one optional disclosure, not repeated in each row. Use normal labels for missing values and zero counts.
4. Allow search, reputation/completed-work sort, refresh, pagination, and profile navigation. URL state supports Back and reload. Avoid redundant “agents/leaderboard” tabs that show the same data.
5. At narrow widths, move evidence below each identity with explicit labels. Keep the full service description available in a native disclosure. No horizontal table scrolling or hidden counts.
6. Short GSAP row entrances on result replacement; no motion on numerical values. Respect reduced motion, and finish entrance motion on focus.
7. Guard request/response boundaries: abort stale requests, 15-second timeout, retry, malformed payload, empty directory, no matches, out-of-range page. Never substitute fixtures into the application.

## Acceptance

- Parser tests: missing/zero/out-of-range metrics, malformed/duplicate rows, encoded names and search, URL defaults, pagination.
- Read endpoint: completed-task ordering, stable tie-breaks, capabilities projection, bounded query parsing.
- Browser: actual public data first, then isolated intercepted responses for failures, pagination, long/missing fields, and stale requests.
- Both themes at 320/375/390/600/760/768/1024/1280/1440; keyboard navigation, search submission, Back/reload, mobile menu, avatar fallback, reduced motion, readable evidence, and no document overflow.
- Scoped lint, TypeScript, production build, and visual review. Report this page for review before starting Unit 04.

## Delivery evidence

- Preview: http://localhost:3100/agents
- Production build, TypeScript, scoped redesign lint, and all 12 agent/task data-boundary tests passed.
- All 53 directory browser checks passed. Live public data, server ordering, invalid pagination defaults, and local avatars were checked before using browser-only response interceptions.
- Both themes passed layout checks at ten widths from 320 to 1440px. Visually reviewed desktop and phone screenshots; service text, completed tasks, rating/review counts, and reputation remain visible.
- URL search/sort/page, Back/reload, profile encoding, empty/no-match/out-of-range/error/rate-limit/malformed responses, retry, stale response cancellation, avatar failure, mobile navigation, and reduced motion passed.
- Evidence: `/private/tmp/hive-redesign-qa/agents-results.json` and `agents-live-{light,dark}-{320,390,1440}.png`.
- The app uses public data only; fixtures exist solely in the browser checks. No database mutation, wallet action, payment, push, or deployment was performed.
- Agent descriptions and capabilities remain as supplied by agent owners; the redesign does not rewrite those listings or validate their claims.
- Local Chrome emulation is not physical-device testing. Agent profile redesign remains Unit 04 and has not started.

## Rating-star revision

At the user’s request, actual client ratings now include a filled star; review counts remain underneath. Missing ratings do not display a star. All 54 directory browser checks pass after the change, including both themes and the 320px layout. Desktop and mobile screenshots were inspected.
