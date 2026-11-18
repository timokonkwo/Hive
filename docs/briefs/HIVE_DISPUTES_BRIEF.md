# Disputes  -  Unit 16

Status: implemented and locally validated; ready for review. Analytics progression approved by the user's Continue. Stop for review before Unit 17 (token and staking).

## Research and verified boundaries

- Reviewed the existing `/dao`, disputes, reports, evidence, vote, wallet-proof, staking-tier and resolution code. Cases concern registered Solana tool providers; votes use active recorded HIVE stake and a signed Solana message. Keep this operational requirement without changing the app's primary wallet direction.
- Reports enter review; they do not create a public case directly. Direct case creation remains admin-only. Evidence on cases is public. Report history is private to the authenticated reporter.
- Existing defects: report history capped at 50 with only five displayed; public document spreads expose internal identifiers; missing/invalid dates permit writes; a late vote can race resolution; separately written votes and tallies can diverge; activity-log errors can hide successful writes. Address the boundaries used by this page.
- Use a flat case list and focused case detail, not repeated marketing cards. Existing design-guide references informed the shared controls. Native review dialogs follow [WAI modal guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for keyboard containment, Escape and focus restoration. The component-gallery master-detail URL did not resolve; do not claim it as a verified reference.

## Interface plan

1. App shell, heading and Report a problem action. Cases and My reports navigation. URL-backed case state/filter/pagination; all case history remains reachable.
2. Case rows show tool, provider, status and a valid closing date. Detail contains reason, evidence, exact recorded vote weights, quorum and threshold when available. Separate voting closed, failed execution and confirmed resolution states.
3. Supporting evidence has independent loading/retry and pagination. Open only safe HTTPS links; allow copying supported content URIs. Do not embed evidence or infer that submitted claims are true.
4. Report form: provider Solana address, tool, category, reason, evidence URI, optional usage reference. Validate and retain input; show the exact report before submission. Evidence form also requires review and clearly states public visibility.
5. Vote: sign in, select the actual connected Solana wallet, read eligibility and any saved vote, review the case/choice/address/weight, then sign the action-bound message. Never infer a connected wallet from an unrelated profile address. Server remains authoritative; no automatic signing or retries.
6. Private state unmounts on account change. Non-secret request receipts survive reload. Unknown writes require checking the saved result before further action; request identities prevent duplicate report/evidence submissions.
7. Both themes, 320–1440px, enlarged text, reduced motion and short element entrances. Native controls, visible focus, labelled fields, small-screen full-width detail and no hidden essential content.

## Delivery checks

- [x] Public/private DTOs, bounded pagination, eligibility and write validation tests.
- [x] Build, TypeScript, scoped lint and redesign regressions.
- [x] Browser fixtures: case/report/evidence/vote states, errors, history, narrow layouts, dialogs, keyboard and motion. Intercept all writes; no real vote/report/evidence publication.
- [x] Review the actual rendered page and record limitations. Update implementation and review trackers. Leave local and unpushed.

The existing resolution worker and chain operations are not executed in this unit. Paid X verification remains deferred.


## Validation and review evidence

- Production build completed successfully outside the sandbox, including the read-only dynamic sitemap lookup. TypeScript passed. Scoped ESLint has zero errors and 24 `no-explicit-any` warnings across existing route code and document-boundary types.
- `tests/disputes-redesign.test.mjs`: 28 focused tests. Full redesign regression selection: 229 passed. Covers public projections, URI validation, exact phase boundaries, private pagination and receipt ownership, tool/usage ownership, failure after persistence, voter eligibility and transactional vote/tally rollback.
- `scripts/redesign/check-disputes.mjs`: 79 browser checks passed against a production preview. Both themes at 320/375/390/600/760/768/1024/1100/1280/1440px; selected detail at five widths; enlarged text; native review dialogs; draft protection; primary-button contrast; external evidence inspection; clipboard errors; history/pagination; closed/missing dates; failure/rate-limit/empty states; private history; public evidence; and element motion.
- The isolated browser registered a simulated Wallet Standard Solana wallet. Vote review, cancel-before-sign, insufficient stake, exact proof identity, lost-response recovery and duplicate-vote UI were checked. Four submission requests were intercepted and handled with fixtures; no real account/chain writes occurred.
- Real read-only checks: `/api/disputes?status=active` returned 200 with zero open cases. `/api/dispute-reports?access=1` returned 401 without authentication. Populated-case screenshots and interaction proof use fixtures, not invented production records.
- Logs: `/private/tmp/hive-disputes-build.log`, `hive-disputes-types.log`, `hive-disputes-lint.log`, `hive-disputes-regression.log`, `hive-disputes-browser.log`. Browser results: `/private/tmp/hive-redesign-qa/disputes-results.json`.
- Screenshots: `/private/tmp/hive-redesign-qa/disputes-list-light-1440.png`, `disputes-detail-dark-320.png`, `disputes-report-review-dark-320.png`, `disputes-vote-review-dark-320.png`.

## Operational limits

The vote transaction is covered with a mocked database session; no real vote transaction or chain execution was performed. It requires MongoDB transaction support and fails closed if that is unavailable. The existing resolution worker, treasury operations, concurrent resolver behavior, network migration and staking integration still require their own operational validation. This page does not establish chain readiness. Report/evidence reference clearing is a deliberate local action after a successful empty lookup; it does not cancel a request or delete backend data. Paid X verification remains unchanged and deferred.

Review `/dao` before starting Unit 17. Changes remain local and unpushed.
