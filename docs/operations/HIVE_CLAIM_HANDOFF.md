## Checker-first release  -  latest instruction

Publish the checker with “Claims start soon”. Do not start a countdown on checker release. `HIVE_CLAIMS_OPEN_AT` is the explicit future claim opening timestamp; leave unset until funding and readiness. The seven-day window derives from that timestamp. This supersedes the earlier release-plus-24-hours policy below. Claim execution remains disabled.

Unclaimed destination inventory: the administrator can call `withdrawSurplus(recipient, amount)`, limited to token balance minus reserved claims. Expired reservations must be cancelled after their claim deadlines (including grace) before their funds become surplus. No automatic return is implemented. Deposited old HIVE must still complete payout or refund reconciliation. An admin withdrawal is possible even before campaign close for unreserved inventory, so operationally wait until the campaign and settlement finish. Contracts remain undeployed.

## Launch preparation  -  23 September 2026

- Ordinary-wallet allocation finalized under the user's latest instruction: 72 signing wallets had at least 1M at snapshot; fixed denominator 564,937,895.383759533 old HIVE. The 10M pool is allocated proportionally with 37 destination raw units left by rounding. `data/hive-claim-allocation.json` records every row. Current balance remains a deposit-time gate; 60 currently pass both minimums at observation slot 449658222.
- Checker previews now use that final denominator. No allocations are assigned to unresolved program custody or pool addresses.
- Latest checks: TypeScript, scoped ESLint, production build, 54 JavaScript tests, EVM local suite, rebuilt SBF and 12 compiled Solana runtime tests passed. These are not deployed end-to-end evidence or an independent audit.
- Render owner Luxen Labs is accessible through the existing launchpad credential. Service `srv-dapqjf3bc2fs73bmu3t0` (`hive-claim-operator`) and disk `dsk-dapqjm0473hc73bu5irg` were created. Operator uses isolated branch `deploy/hive-claim-operator`, never main. No signing keys uploaded. Initial website-wide install failed on an Android-only dependency; fixed by operator-specific dependencies. Commit `5932a41` is live in standby with persistent disk attached; financial execution remains false. Dependency advisories still need resolution or reachability review before loading a signer.
- Netlify production site identified: `0f6ae960-8594-44a2-a892-84c18fdb3b64`, https://uphive.xyz. No production checker release or countdown start yet.
- Funding read: 2,713,267.226087040533084047 new HIVE in destination admin; shortage 7,286,732.773912959466915953. Solana admin has 0.025774674 SOL. Correct exact-sized program storage requirement is 0.661177240 SOL plus fees/setup; the earlier 1.321480720 SOL total double-counted buffer rent. Loader drains buffer to payer before creating ProgramData. Do not use the earlier 1.4 SOL funding request.
- User uses Phantom for source admin and MetaMask for destination admin. Browser signing can deploy, but unattended operation still requires a secure signer integration. No keys requested in chat. No contracts deployed, tokens transferred, or financial execution enabled.

## Checker release countdown

Set server environment `HIVE_CHECKER_RELEASE_AT` to the actual public checker release timestamp, with timezone (ISO 8601). Leave unset during preparation; page views and server restarts must never set or reset it. Claims open 24 hours later and close seven days after opening. Set the escrow campaign `opensAt` and derived `closesAt` to these same timestamps before activation. The countdown does not enable the financial service. Before opening, the proxy blocks new quotes, registration and deposits; saved claim status remains accessible after closure. Public release and financial activation have not occurred.

# HIVE migration implementation handoff

## Revised snapshot floor

The latest rule requires **at least 1M both at snapshot and immediately before deposit**. The same immutable source-campaign minimum now applies to the proof-bound snapshot allowance and the current source balance. Buying tokens after cutoff cannot repair an insufficient snapshot. Campaign preparation rejects below-minimum reviewed rows; authorization v5 explicitly binds both requirements and supersedes v4. The checker, quote builder and source contract enforce this rule. Partial deposits may still be smaller than 1M. Two-point balance checks do not prove continuous holding. The revised review has 72 snapshot candidates and 60 passing both tests in the latest observation, without enabling claims or approving a final allocation denominator.

## Current holding gate  -  22 September 2026

The user requires snapshot presence plus **at least 1M current spendable old HIVE**, with a **10M new-HIVE total budget**. A current census found 61 of 231 snapshot wallet candidates above that threshold at finalized slot 449504778; this is an observation, not a permanently frozen qualified count.

The checker blocks previews below the minimum. The quote builder and verifier enforce it before reservation/admin signing, and the gateway rechecks before deposit submission. The Solana campaign now stores `minimum_current_holding_raw` and checks the source balance atomically before the deposit CPI. The builder consolidates enough of the owner's token accounts to satisfy both the deposit and holding minimum, allowing a partial deposit smaller than 1M when total pre-deposit holdings meet the threshold. Payout/refund settlement never rechecks the remaining balance after deposit.

Validation of this revision: 52 focused checker/escrow JavaScript tests, TypeScript and scoped ESLint passed. Rust tests passed (11 native runtime tests and 2 interoperability/arithmetic tests), including rejection below the holding floor and acceptance exactly at it with a smaller partial deposit. No new SBF/deployed rehearsal or real deposit was performed.

**Compatibility:** regenerate campaign initialization/review artifacts and rebuild the Solana program; the source account layout changed. Authorization is now v4 and binds the current minimum. Old v3 signatures cannot authorize the revised policy. No deployed source program was changed. The EVM payout math/contract is unchanged and still depends on verified finalized source deposits. The 1M threshold is required by production preparation, while generic test configurations may use zero to exercise earlier arithmetic cases.

Current budget: **10M new HIVE total**, increased by the user after the original 7M review. Earlier 7M figures below are historical. The current checker, campaign inputs and 10M preview artifacts use the revised budget; funding has not been verified.

Local implementation completed 22 September 2026. Claims remain disabled. No deployment, funding transfer or live claim transaction was performed.

## Holder flow

`/token/claim` checks the frozen owner and current finalized spendable holdings. Partial deposits are capped by both balances. Amounts use K/M with at most one decimal; exact integer amounts remain available for review.

When separately enabled, the holder connects an injected Solana wallet and injected EVM wallet, requests a final reviewed quote, sees the exact deposit/payout/recipient/deadline, and signs the same authorization with both wallets. The verifier reserves destination inventory. The holder then signs the admin-approved Solana deposit. The verifier confirms finalized deposit evidence, pays the fixed Robinhood recipient and releases old HIVE to collection, or reconciles cancellation and refund.

The signed registration is saved locally before submission. Refresh claim status resumes the existing request without new signatures. A lost response can be retried using that exact saved registration. Deposit submissions are recorded durably before network broadcast and are never automatically rebroadcast. Unknown or failed submissions require reconciliation; the UI shows the transaction signature and blocks another deposit. This V1 uses one attempt per wallet, including terminal refunds. Expired requests that were never accepted require operator-assisted recovery; users should retain their browser's saved request rather than create competing terms. Clearing browser storage loses this local recovery handle. WalletConnect/mobile deep links and smart-contract-wallet signatures are not supported in this V1.

## Deployment topology

- Website: Next.js proxies `/api/token/claim/migration` to the private operator gateway. No signer or queue files live on the website/serverless filesystem.
- Gateway: `gateway-service.mjs` authenticates the website's server-only bearer token, verifies holder signatures and uses the same persistent requests/state volume as the verifier. It loads no administrator key.
- Verifier: existing `verifier-service.mjs` owns the signer loop, constructs/simulates admin-approved transactions and advances settlement. Keep its single-process lock and journal.
- Transport: HTTPS between a hosted website and operator service; loopback HTTP is supported only for local hosting. The gateway binds loopback by default. Do not expose its persistent volume or token.

Example gateway command, after provisioning approved configuration:

```sh
node --env-file=.env.local tools/hive-migration/escrow/gateway-service.mjs tools/hive-migration/escrow/verifier.inputs.json
```

Environment names are in `tools/hive-migration/escrow/gateway.env.example`. `HIVE_CLAIM_UI_ENABLED=true` alone does not activate claims: the gateway also requires `executionEnabled`, financial activation and all reviewed decisions. Quotes independently verify deployed code/configuration, finality, pause state, wallet allowance, inventory and time window. Use a randomly generated private gateway token of at least 32 characters in both services; never a `NEXT_PUBLIC` variable.

## Validation

- 53 focused JavaScript tests pass, including quote/signature/intake consistency, registration concurrency, altered signatures, submission persistence before broadcast, unknown-outcome deduplication, API origin/body limits and default-disabled behavior.
- TypeScript, scoped ESLint and the production build pass. The build reported a nonfatal cache-space warning and the existing sitemap MongoDB DNS failure; these are not live database validation.
- 28 Chrome checks pass against the production build: exact partial amounts, invalid inputs, both themes, responsive layouts, wrong wallet, rejected signature, registration, deposit, completion and saved-request recovery. Browser wallets/balances/gateway were mocked. No live transaction was used.
- Earlier unchanged contract validation: 24 EVM tests including two 256-case fuzz tests, 10 Solana native runtime tests and 2 Rust interoperability/arithmetic tests. The live EVM fork test was skipped.

## Remaining launch requirements

`HIVE_REIMBURSEMENT_INPUTS.md` and `campaign.inputs.json` remain authoritative. Finalize eligible owners/custody reconciliation, dates, terminal/refund/support terms and funding inventory. Then prepare the reviewed Merkle tree, obtain independent security review, deploy paused, verify code/authorities, fund inventory, provision persistent operator hosting and rehearse the connected-wallet payout/refund paths before explicit activation. No missing financial decision or approval was inferred from “finish up.”

The local flow is implemented and fixture-tested; it is not certified or proven operational on deployed chains.

## 2026-09-23 HIVE navigation correction

- Trade, Stake and Claim now share the persistent `app/token/layout.tsx` shell. `/token` and `?view=trade` render the token overview with a Pons link; Stake renders a designed Coming soon panel; Claim contains the short migration introduction and wallet checker.
- `SiteFrame` recognizes nested token routes as redesigned pages, preventing duplicate legacy layout on Claim. HIVE sidebar selection includes nested routes.
- Local Chrome checks verified 16 tab transitions across 375px/1280px and light/dark themes: identical tab coordinates, one main landmark, correct active link, no horizontal overflow or runtime exceptions. Screenshots were inspected. TypeScript, scoped ESLint and 27 token/claim tests passed.
- Release branch `deploy/hive-checker`, commit `6bfc6a5`; production Netlify build passed. Publication is recorded separately after hosted verification.
- Claims remain disabled and no countdown starts merely by publishing the checker. An explicit opening time starts the seven-day claim window.
- Distributor supports admin recovery of unreserved new HIVE through `withdrawSurplus`. Pending obligations remain protected; expired claims must be cancelled to release their reserves. Recovery behavior was tested locally, not executed against a deployed distributor.

### Publication

- Published verified Netlify deploy `6ab41889d2ebfc3f1127c050` to `https://uphive.xyz` on 2026-09-23. Build source is release commit `6bfc6a5`.
- Deploy the adapter-prepared `.netlify/static` directory when using Netlify CLI `--no-build`; uploading `.next` alone omits the public stylesheet/script paths. The incomplete preview was never promoted.
- Hosted Chrome repeated all 16 styled tab checks after hydration, with identical coordinates in every transition, one main landmark and no runtime exceptions. Real snapshot lookup returned current finalized balance; claim quotes returned 503 while disabled.

## 2026-09-24 checker refinement and explicit schedule

- User set claim opening to **2026-09-25 10:00 WAT / 09:00 UTC**, overriding the initial 24-hour target. `HIVE_CLAIMS_OPEN_AT=2026-09-25T09:00:00Z` configured in production (build/functions) and local development. Seven-day closing boundary: 2026-10-02 10:00 WAT.
- Only the countdown appears in the UI; the user explicitly removed visible date/timezone text. A machine-readable `data-opens-at` attribute retains the target for verification.
- Shared 1088px content boundary, consistent responsive panel padding, distinct introduction/countdown and checker sections. Network-specific HIVE wording replaces old/new token terminology.
- Eligible allocation remains visible before opening; all forward/deposit actions are hidden until both the scheduled window and claim-service readiness permit them. No funding, contract deployment or operator activation performed by this UI change.
- CSS loading feedback and result entrance respect reduced motion. Primary action text is explicitly dark on the lime button; disabled controls use readable foreground/background rather than reduced opacity.
- Validation: TypeScript and scoped ESLint passed; 27 token/claim tests passed; 16 local responsive/theme tab checks passed; 11 mocked browser checks passed for the exact target, no visible date/timezone, timer ticks, result/loading states, before/open/closed gating, contrast and reduced motion. No browser wallet transaction was performed.
- Release source commit: `435b0ee` on `deploy/hive-checker`. Final publication recorded after hosted verification below.

### FAQ and final schedule propagation

- Added three collapsed How it works entries: deposit Solana HIVE to receive Robinhood HIVE; at least 1M at snapshot and deposit time, later purchases cannot create eligibility or raise allowance; proportional 10M pool, partial deposits and 70% ceiling, single claim per wallet.
- Shared `CLAIM_OPENING_TIME` records the user-approved 2026-09-25T09:00:00Z explicitly in source for all deployment contexts. Both page and server gate use this value when no environment override is present. This prevents draft previews from omitting the countdown because the production-only environment variable is absent.
- Final release source `1986f5b`. All 13 local mocked browser checks passed, including FAQ expansion and wording. No date/timezone text is rendered.

### Final publication, 2026-09-24

- User removed the pool-size statement and the later-purchase warning from the FAQ. Eligibility and allocation enforcement remain unchanged. Final source: `d41cb69`.
- Published verified Netlify deploy `6ab4c014360e977afb31de39` to uphive.xyz. Hosted real balance/snapshot lookup passed; quote endpoint remains blocked with 503. All 14 hosted browser checks passed with mocked holdings/readiness and no wallet transactions. Desktop/mobile layout and final phone screenshots were inspected.
- Visible schedule is countdown only, with no date/timezone sentence. Opens 2026-09-25T09:00:00Z, closes seven days later. Funding and claim-service activation are still outstanding; the timer alone does not activate transactions.

### Final copy edits and domain check

- Removed the checker helper sentence and the FAQ percentage-ceiling sentence at the user's request. This only changes displayed copy; allocation calculations remain unchanged. Source `9a58d6f`.
- Public POST verification found Netlify retained the immutable deploy origin after promotion. `ab83648` permits the exact public `https://uphive.xyz` origin for this site's Netlify hostnames, while rejecting unrelated origins and lookalike hostnames. Added regression assertions, all 15 claim tests passed. Final publication will include this fix.

### Final copy release

Published deploy `6ab4c547837d2b5aa54d4039`, source `9a58d6f`, with all requested removals: date/timezone sentence, pool size, later-purchase warning, wallet-connection helper and percentage-ceiling sentence. The previous draft stalled in Netlify preparation; retry succeeded using the same verified build. Includes the public-origin fix. Countdown remains scheduled for 2026-09-25T09:00:00Z, and transaction execution remains disabled pending funding and activation.
