# Unit 15  -  Analytics

Status: implemented and locally validated; ready for review. Scope: public Analytics, its data contract and existing Solana fee reads. Report for review before Unit 16 (Disputes). X API setup remains deferred.

## Research and audit

The existing page totals completed-task budgets and calls them payouts. It silently suppresses read errors, presents unknown counts as zero, gives stale fee data a new page timestamp and waits for third-party fee calls before showing marketplace counts. There is no dated series. Task records provide createdAt, completedAt and explicit paidAmount/payment-chain/token/signature fields; budgets are not payment evidence.

[Component Gallery table patterns](https://component.gallery/components/table/) inform a proper tabular alternative to the chart. [Bags lifetime fees](https://docs.bags.fm/api-reference/get-token-lifetime-fees) documents lamport strings; preserve exact integer units and convert for display. [Bags claim statistics](https://docs.bags.fm/api-reference/get-token-claim-stats) defines recipients and totalClaimed, but does not specify the latter's unit in the inspected contract. Show recipient identities and source links without inventing a SOL amount from an unspecified field.

Direction: a dated activity report inside the existing app shell. One main chart, plain totals and a divided status list; no metric-card grid. Lime accents, light/dark themes, factual labels, local SVG chart interactions, GSAP element entrances and reduced-motion support. No new chart dependency, made-up growth rate or global-revenue claim.

## Implementation plan

1. Provide UTC windows of 7, 30 and 90 calendar days including the partial current day. Aggregate posted and completed timestamps in MongoDB, zero-fill known days, separately report undated records. Keep current task status counts and all-time agent/proposal counts distinct from window totals. Use bounded aggregate output rather than loading all tasks.
2. Record payment totals only for completed tasks with an explicit valid nonnegative paid amount, supported USDC/chain fields and payment signature. Report coverage and currency; do not substitute budgets. Include status normalization and an Other category so the denominator remains complete.
3. Load the marketplace report separately from existing Bags reads. Preserve the configured Solana token and read-only fee/recipient/creator features. Give cached data its actual fetched timestamp, stale/unavailable states, independent retry and bounded requests. Never relabel Solana data as Robinhood activity. Do not configure new integrations or claim fees.
4. Build a selectable posted/completed bar chart with pointer and keyboard day inspection, labelled zero-based scale, UTC dates and a full data table. Range selection lives in the URL. Add CSV export of the exact dated counts; no secrets or personal records. Display zero activity honestly without a fake trend.
5. Test date boundaries, missing timestamps, normalized states, coverage, malformed responses, currency, exact lamport conversion, partial provider failures, stale cache and request cancellation. Browser-audit both themes, 320–1440px layouts, keyboard/chart/table agreement, URL history, export, empty/sparse data, errors/retry and reduced motion. Use fixtures for scenarios; no wallet or account mutation.

## Limits

The report describes stored records, not an independent chain audit. Current status counts are a snapshot, not historical status transitions. Undated records cannot be assigned to a chart day. The current payment writer records Solana USDC; do not invent Robinhood payments. Fee USD estimates are separate from USDC payments, and fee-recipient shares are not marketplace revenue.


## Validation  -  2026-09-12

- Production build, TypeScript, scoped ESLint and `git diff --check` passed.
- 201 regression tests passed, including 15 new date, aggregation-contract, payment, CSV, fee-unit, cache, partial-failure and route tests.
- 68 browser checks passed: light/dark at ten widths from 320 to 1440px; physical axis-label sizing; keyboard day selection; chart/table/CSV agreement; 7/30/90-day URL/history behavior; delayed-response cancellation; empty/undated data; malformed currency; initial and refresh failures; retained old reports; independent and partial fee failure; stale timestamps; enlarged text and motion. All scenario reads were intercepted and zero API writes occurred.
- A separate real seven-day API read returned 556 task records, 272 listed agents and 1,479 proposals. It reported 406 completed records without valid completion dates and one explicit payment record totaling 1 USDC. The chart excludes undated records; no dates were inferred or database records changed. These are a point-in-time local read, not production or chain verification.
- The real fee endpoint returned fee, recipient and creator data. This is a read-only provider response, not proof of a claim transaction or platform revenue.
- Visual review found axis text shrank on phones. A ResizeObserver-backed viewBox now preserves physical label size; browser checks enforce at least 11px at every audited width.

Evidence: `/private/tmp/hive-analytics-build.log`, `hive-analytics-types.log`, `hive-analytics-lint.log`, `hive-analytics-tests.log`; browser report `/private/tmp/hive-redesign-qa/analytics-results.json`; screenshots `analytics-*.png`. Repeatable browser script: `scripts/redesign/check-analytics.mjs`.

Review at http://localhost:3100/analytics . Changes remain local and unpushed on `main_redesign`. Stop before Unit 16 (Disputes). X API setup stays deferred.


## September 12  -  Payment panel removal and token network selection

Removed the public recorded-task-payment panel, amount and payment-coverage sentence at the user's request. Kept task counts and a collapsed explanation of chart/count definitions. The backend report contract remains unchanged; budgets are not relabeled as payments or revenue.

Added accessible Robinhood/Solana fee tabs with Arrow, Home and End keyboard support. Solana is the initial view because it has current data. Robinhood shows Coming soon and no numerical placeholders or financial actions. Its panel makes no fee requests; switching back loads the existing Solana provider data. At Robinhood launch, a separate fee source and validated network/token response must be connected before replacing the placeholder. The trading/staking launch switch alone does not enable fee data.

Build, TypeScript, scoped lint and 15 analytics tests passed. All 79 browser checks passed, including both themes, 320–1440px, no payment-coverage copy, Robinhood no-request behavior, keyboard switching, Solana retry/stale/partial states, chart/CSV behavior and zero API writes. Updated evidence remains in `/private/tmp/hive-redesign-qa/analytics-results.json`; fee captures are `analytics-robinhood-*.png`. Changes are local and unpushed.
