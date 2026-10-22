# Multi-platform agent tokenization

Branch: `feat/multi-platform-agent-tokenization`

## Accepted behavior

- Independent tokens on Robinhood/Pons, Solana/Bags and Solana/pump.fun.
- Select one or several platforms. One token per agent/platform/network.
- Owner uses connected wallets. Admin defaults to hosted Hive deployers, with connected wallets optional per network.
- Stop the batch on uncertainty or failure. Keep successful launches. Resume remaining targets explicitly; never recreate a successful token.
- Preserve Pons fee recipients: verified owner wallet for owner launches; existing Hive fee wallet for admin launches.
- New Pons launches use 300 bps creator tax. Existing intents/tokens retain their recorded fee terms.
- Bags uses its standard 2% total trading-fee configuration. Hive receives the normal creator allocation; the required separate deployer share belongs to the configuration payer.
- pump.fun uses its native SOL fee schedule with Hive as creator. No mayhem, cashback or holder-reward mode.
- No creator-fee controls in the review UI. Show actual transaction spending estimates separately in SOL and ETH.
- Shared immutable metadata snapshot, Hive attribution, agent profile website, no X or Telegram.
- Published tokens use a compact profile summary and one Trade button. A dialog lists confirmed platform/network/ticker choices, with trade links and address copy actions.
- Editing an agent does not alter published token metadata. Admin can edit name, bio and image before reviewing new launches.

## Implementation sequence

1. Preserve historical Pons terms; add platform identity, catalog validation and stable profile URLs.
2. Add session/target state machine, durable reservations, idempotency and concurrency protection.
3. Add shared selection/progress UI, public trade chooser and admin multi-token presentation.
4. Adapt the existing Pons engine without copying its signing journal.
5. Add Solana transaction journal with message/signature validation, exact blockhash lifetime, durable pre-broadcast storage and recovery.
6. Add Bags adapter using verified standard configuration and staged setup/launch confirmation.
7. Add official pump.fun SDK adapter with durable mint identity, immutable metadata and receipt/state verification.
8. Connect authenticated APIs, connected wallets, hosted deployers and bounded recovery workers.
9. Validate all subsets, retries, partial success, permissions, historical fees, wallet changes, receipts and responsive UI.

## Safety and compatibility boundaries

- Unknown or expired transactions do not authorize a fresh launch.
- Recovery remains available when new launches are disabled.
- All write requests recheck current owner/admin access.
- Managed preparation is not permission to spend; confirmation must bind the exact reviewed transaction and maximum cost.
- Persist transaction identity before broadcasting. Preserve all existing partial signatures.
- Case-fold EVM addresses only. Solana addresses remain case-sensitive.
- Legacy Bags records reserve their slot until provenance is checked. Do not label them newly verified from an untrusted database flag.
- Public `agentTokens` is separate from tokens created by the agent as tools/tasks. Keep legacy API fields during rollout.
- Never send a paid mainnet acceptance transaction without an explicit reviewed spending authorization.
- Do not merge or enable incomplete adapters.

## Progress / evidence

- [x] Inspected clean tracked baseline `c525824`; created isolated feature branch.
- [x] Historical Pons policy regression tests.
- [x] Platform catalog and profile projection.
- [x] Persistent session coordinator.
- [x] Multi-platform selection/recovery UI.
- [x] Bags adapter, sponsored ordered setup, receipt and current fee-state verification.
- [x] pump.fun builder and receipt verifier implemented; no-purchase mainnet simulation passed.
- [x] Connected and managed signing paths implemented and tested with fixtures.
- [x] Admin counts and token management; existing Bags fee recovery preserved.
- [x] New pump.fun fee collection and separate Bags deployer-fee collection.
- [x] Typecheck, focused database/API tests, browser checks and build.
- [ ] Controlled live acceptance (separate from local verification).

### UI revision: trade chooser

- Replaced stacked profile trade actions with one compact summary and a Trade button.
- The modal lists platform, ticker and network; each row links directly to that token. Address copying is secondary.
- Native modal semantics, keyboard containment, Escape/outside-click/close dismissal, focus restoration and scroll locking are implemented. Reduced motion is respected.
- Browser checks passed in light/dark at 320, 390, 768 and 1440 px. Also checked empty/single/multiple token catalogs, different tickers, correct external URLs, clipboard success/failure and state reset on reopen. Inspected the mobile screenshot after the entrance animation finished.
- Typecheck passed. Focused profile/platform/Solana tests: 30 passed. Full suite: 433 passed, 3 failed (existing security-regression assertions), 3 skipped (Mongo integration environment absent).
- These are local component and domain checks, not a deployed launch or live signing acceptance.

### Runtime and UI integration

- Authenticated session API now drives the actual selection, review and progress dialog. Pons uses its existing signing/receipt engine with frozen session terms.
- Admin defaults to the hosted deployer per network. Owners select their verified wallet. Wallet selectors only open on an explicit connection action.
- Profile name, bio and image editing remains available before reserving a new launch. Name aliases retain existing profile URLs and task history; new token websites use stable agent IDs.
- Database leases and compare-and-swap updates fence overlapping tabs, standalone Pons preparation and profile edits. Completed tokens publish idempotently into the catalog.
- Solana mint secrets and signed transaction bytes use a dedicated encryption key. Signed bytes are stored before sending. Retries use the same saved transaction; missing receipts never authorize another mint.
- Scheduled recovery covers crashes between signed-transaction persistence and session updates. Unchanged reviews rotate through the worker rather than starving other submissions. Recovery never signs or advances queued targets.
- Fixed the full Solana genesis-hash check after an unsigned mainnet simulation exposed use of the abbreviated chain reference.
- Fixed the Pons client rejecting stable agent URLs and the completed-batch screen disappearing on reopen.
- Admin totals include verified new Solana catalog entries. Existing Pons journal counts and legacy Bags fee collection remain intact; the fee section is explicitly labeled Bags creator fees.

### Current validation

- `npm run typecheck`: passed.
- `npm run build`: passed after the integrated route/controller changes.
- Focused tokenization plus profile-route suite with isolated MongoDB: 122 passed, zero failures/skips. The session API suite was then rerun with an added release-gate regression: all four passed.
- Full suite with isolated MongoDB: 466 passed, 3 failed, zero skips. Existing failures are in `security-regressions.test.mjs`: old registry/page assertions and missing legacy docs paths; they predate this branch. No claim that the full suite is green.
- Actual batch dialog/hooks: browser fixtures passed at 390 and 1280 px, including all-platform managed progression, saved review/reopen, admin edit, lost responses, connected-wallet rejection and explicit retry. These use simulated provider/wallet boundaries.
- Existing Pons browser regressions passed, including hosted signing UI, connected fallback, wallet rejection, interrupted preparation, recovery and keyboard focus.
- Mainnet read-only pump.fun simulation: no opening purchase, 958-byte transaction, 6,070,440 lamports simulated total debit including a 10,000-lamport network fee. No payer signature or broadcast. This is a point-in-time simulation, not a fixed launch price or completed launch.
- Mainnet simulation exposed an oversized atomic pump create-and-buy transaction. Initial-purchase input is hidden unless `PUMP_LAUNCH_LOOKUP_TABLE` is configured. That optional path still needs a suitable table and simulation acceptance; it never falls back to a separate purchase. The SDK's built-in 1% input tolerance is compensated with integer arithmetic so the requested purchase cap is not exceeded.
- No branch push, merge, production deployment, key configuration or paid launch was performed.

### Bags interface mismatch — resolved on 21 October 2026

The current API creates fee-share configurations with a separate deployer allocation, as described in [Bags' configuration reference](https://docs.bags.fm/api-reference/create-fee-share-configuration). Normal recipients still total 10,000 BPS; the payer receives the separate deployer allocation. Pons recipients are unchanged.

Public finalized setup receipt inspected:
`4gAEL7BHJ5WxJKSDk4iJy81vHyAY52U37umTwANkRdgj9N1rnJx9DShNvu8KS75P9f88GLP4cAeFBagwuCCeVTA6`.

- Program: `FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK`.
- Setup discriminator: `[150, 2, 232, 174, 64, 234, 167, 205]`, 20 accounts for the observed single-recipient setup.
- The installed SDK, downloaded SDK 1.4.4 and the SDK repository's bundled IDL lack this instruction. The **separate official `bagsfm/bags-idl` repository does publish it** in 2.10.0. The earlier conclusion that no official interface existed was incomplete.
- Pinned the unmodified [official interface at commit 0ddae15](https://github.com/bagsfm/bags-idl/blob/0ddae15bcee99ed7a66eb0bd4f83153953af2f8b/fee-share-v2/idl.json), including its source and SHA-256. Removed the hard-coded Bags disable; normal release/configuration checks now control availability.
- Do not infer the new binary argument/account layout from one receipt or approve transactions based on program IDs alone.

Completed the live standard SOL plan: fee configuration, pool configuration, manager assignment, then launch. Validates the sponsor, every recipient/deployer address and share, standard pool economics, allowed reimbursements, and current finalized fee state. Stores all setup steps in order; preserves completed steps and mint on retry. Archives finalized failed submissions before creating a new review. Unsupported atomic bundle plans remain rejected; the supported single-recipient plan returns three ordinary ordered transactions.

Validation: replayed successful public setup/launch receipts, captured one- and two-recipient account fixtures, verified simulated Hive fee state, and simulated all three dependent setup instructions together on mainnet without signatures or broadcasts (1082 bytes, 191483 compute units). Individual point-in-time debit estimates: 8450800 lamports for fee setup and 5986580 for pool configuration. Those are simulations, not fixed charges or completed launches. No live acceptance launch has been sent.

Local and Netlify production release flags and a shared journal encryption key are configured. Existing worker credentials were preserved; the existing Solana deployer was restricted to production functions and marked secret. Hosted changes still require deployment. Latest full tokenization/fee regression run: 140 passed, zero failures/skips, using an isolated MongoDB. Production build and responsive batch-dialog checks passed before the final retry-preservation change; rerun final checks after all edits.

### Release work still outstanding

1. Bags interface/configuration verification is complete; exercise the first actual signed launch through the reviewed admin flow.
2. Native pump.fun fee collection and the separate Bags deployer-fee path are implemented. Verify the first paid collections when these new launches have accrued fees.
3. Legacy Bags tokens retain their existing links and reserved platform slots; receipt backfill is a later data-maintenance task, not permission to relaunch or publish unverified associations.
4. Hosting configuration is complete. Never rotate the journal key while mint/transaction records still need it. No keys belong in chat or source control.
5. Production release completed from `main` at `545c49f` (deploy `6ad8bff35f9c5b16f5786b7a`). Public pages, protected-route rejection and the real mobile trade dialog pass. A signed acceptance launch and authenticated hosted admin session remain separate checks; no user wallet signature or new privileged API credential was requested for release testing.
6. Resolved on 21 October: pump.fun initial purchases now have a Hive-owned address table and successful unsigned mainnet simulations; see the incident correction below.

### Fee collection completion — 21 October 2026

Admin displays three fee rows with separate claim actions: Bags creator, Bags deployer, and pump.fun creator. All use the same wallet-wide lease and transaction journal. An unresolved receipt prevents another provider from submitting. Provider errors remain unknown balances, never zero. Pons recipients are unchanged.

Bags deployer amounts reconcile token-specific pending/accrued fees with the aggregate vault without double counting. Its sponsored sweep/withdraw/unwrap message is decoded against the pinned official IDL, checked for wallet/PDA/program destinations, bounded sponsor repayment, simulation and expiry before signing. One atomic plan is processed per click; refresh exposes remaining fees. A public current-provider plan validates and recipient/spend tampering is rejected in tests.

pump.fun uses locally built official SDK instructions to sweep native-SOL fees from confirmed Hive token curves/pools and collect into Hive's creator wallet. Aggregate vaults are counted once. The appended AMM fee field follows the pinned pump SDK's layout; old accounts read zero only for that absent field. Re-reading each position avoids collecting an already-drained vault. Simulation bounds costs before signing.

Final local production build, typecheck, responsive admin fee controls and both launch/trade dialogs passed. These checks and unsigned simulations do not constitute signed mainnet acceptance.

### Hosted release evidence

- Source: `545c49f`, isolated branch `feat/multi-platform-agent-tokenization`.
- Clean checkout: `/tmp/hive-multiplatform-release-20261021`; locked dependencies installed inside the checkout, no local environment files or symlinked dependencies.
- Netlify draft built with production build settings: `6ad8b0ff0788dd2d71588799` (runtime context remains `deploy-preview`); prior published rollback: `6ad7a1ddf6707bac9c586bc6` (`c525824`). Production-only secrets were preserved, not exposed or copied to preview contexts.
- Draft checks passed: agents, Token and admin pages return 200; protected admin/worker endpoints return 401 anonymously; actual Sage profile trade dialog opens, links to its existing Pons token, fits mobile and restores focus without page errors.
- Real agent data through the server preview module offers Bags and pump.fun for Sage. Local Solana managed signer is available; the Pons managed key remains hosted only. No new admin API credential was added for testing.
- Focused suite: 147 passed, zero failures/skips. Wider suite: 482 passed, three pre-existing assertions fail against removed docs/old token and registry UI; two enclosing suites also report the missing docs file. No database tests skipped.
- Publication verification is separate from paid acceptance. No token launch, initial buy or fee claim was signed or broadcast by these checks. After launches begin, preserve the recovery worker and journal key when changing or rolling back the UI.
- Published from Git-connected `main`: `6ad8bff35f9c5b16f5786b7a`, source `545c49f1c395637991916e3a7fbf1ee960c4420b`, runtime context `production`. Production browser and protected-route checks passed. The configured recovery schedule is every two minutes.
- Canceled incomplete manual upload `6ad8bc8fb947adf1599e980e` before publication because skipping the Next.js build lifecycle produced a different file set. The old site stayed published until the normal Git-connected production build succeeded. Use the integrated Next.js build/deploy pipeline for future releases.

### UI and interaction review — 21 October 2026

Reviewed the public trade chooser, admin token/fee panel, platform selection, owner/admin review, profile editing, transaction approval and recovery. Kept Hive's existing typography, colors and simple row-based presentation.

| Interaction | Required behavior and implemented correction |
| --- | --- |
| Review on a phone | Compact agent identity, optional purchases collapsed initially, and a sticky action footer. Corrected a 320 px clipping issue found in screenshot inspection; checks now measure the button against the dialog boundary as well as the viewport. |
| Back or edit profile | Preserve ticker, deployer mode, selected wallets and purchase amounts in the parent draft. Editing name, bio or image does not silently reset launch terms. |
| Wallet choice | Match EVM identity without regard to casing, but use the provider's actual address as the select value. Solana matching stays case-sensitive. Only verified owner wallets appear; missing wallets have a connection action. |
| Optional purchases | Validate exact SOL/ETH inputs before reservation. Keep unsupported pump purchases out of the form. Selected amounts survive navigation and remain included when the optional section is collapsed. |
| Review Pons | An explicit batch review opens the first cost quote directly. Removed the duplicate review click. Final transaction approval is still required; status checks and reopening an existing submission never create a replacement launch. |
| Expired Solana estimate | Replace Approve with Refresh estimate. Show one main action, choosing wallet connection when needed. Keep the spending ceiling and any opening purchase visible. |
| Interrupted response | Hide additional approvals until the saved session is checked. Preserve the reservation and show one recovery action. Wallet rejection before submission remains retryable. |
| Completion and availability | Distinguish full success, partial/skipped completion and no tokens launched. Fully launched or unavailable catalogs have no dead-end Continue button. Read-only and blocked sessions offer no competing launch action. |

Validation for this review uses actual components/hooks with simulated API/wallet boundaries, not paid launches:

- Session browser coverage expanded to both themes at 320, 390, 768 and 1280 px: draft persistence, exact input validation, wallet casing and modal focus, hosted and connected paths, quote expiry, lost responses, retries, read-only, skipped and unavailable states.
- Trade chooser and admin panel browser checks passed in both themes at 320, 390, 768 and 1440 px, including keyboard/clipboard behavior, button contrast, fee-claim recovery and duplicate-click guards. Inspected captured mobile and desktop screenshots.
- Existing Pons browser regressions passed. Focused platform/policy/admin/profile-route tests: 31 passed, zero failures/skips. Typecheck and production build passed.
- The local build used the sitemap fallback because the MongoDB DNS lookup was unavailable. Dynamic sitemap contents were not verified by this review.
- This review does not clear the release blockers above. No push, deployment, hosted-secret change or real transaction was performed.

### Bags metadata and pump.fun initial purchase correction — 21 October 2026

- Reproduced Cipher's failure with the real Bags API. The reviewed and returned names were both `Cipher Agent`. Multipart upload changed description LF line endings to CRLF; all other reviewed fields matched. The comparator now treats only line-ending representations as equivalent and still rejects changed text, whitespace, names, tickers and links.
- Save a sanitized provider response before validating it, so a restart or validation failure reuses the same mint. Unknown provider fields (including `accountKeys`) are excluded. A missing response still requires explicit recovery; it cannot create another mint silently.
- Recovered Cipher session `4a4a05fa-c6e8-4e0e-b081-653f32deaa93` after verifying its intent had no mint, setup plan, transaction journal or signed submission. Its original response had been discarded by the old validator. One replacement off-chain metadata reservation was saved and validated, with the same frozen name/ticker/description and zero opening purchases. Mint `HTkEBQQ89Mu3ZfurAVEoZuMyjzv1uEthH2oJqxS1BAGS` was absent onchain. Preparation now reaches the Bags setup review (simulated maximum debit 0.0084508 SOL). No Cipher transaction was signed or broadcast.
- Created the reusable Hive-owned lookup table `9hybVsR8kdDtoKe6mYhGE2NgCKxibZCJ76qK7R5WMmDs`, containing 30 reusable program accounts and fee recipients. Actual setup debit: 0.00582152 SOL including network fees; Hive retains authority. The maintenance tool `scripts/tokenization/pump-lookup-table.mjs` journals each signed step before broadcast and reuses receipts on resume. Creation: `2ftveCzhd4gFKzPVjqma6w5kmBnizHCoC52MHzfFcPat2e2LxqzcFhNKfsonFj4duvJTPDewnLkjTFTauKRMFiwL`; extension: `5KKjqPQt1TdhD3PHqjE9X5mepT3ZtVS2Z7G8AxigRPFSrw9C2rXRV1rzbDPGC9Qt9ztpkcU757PVMqKyjBS1DbKt`. Both finalized.
- Set `PUMP_LAUNCH_LOOKUP_TABLE` locally and in Netlify Production/Functions. Build with the table before serializing an oversized message. The official SDK still builds one atomic create-and-buy transaction; the original purchase ceiling and Hive creator remain unchanged. No token launch or purchase was broadcast during these checks.
- Mainnet unsigned simulations passed: no-buy launch 958 bytes / 0.00607044 SOL total simulated debit; launch plus 0.001 SOL buy 903 bytes / 0.01057072 SOL total simulated debit. These are point-in-time estimates including account rent, not promised fees.
- Regression coverage: actual multipart roundtrip after rename; reject changed metadata; durable response recovery with no second provider POST; official SDK create-and-buy with the table and exact maximum input; missing/inactive table rejection. All 136 focused tokenization tests passed without skips. Session browser checks passed, including all three purchase fields, amount validation and preservation after profile editing.
- References: [Bags metadata API](https://docs.bags.fm/api-reference/create-token-info), [Solana lookup tables](https://solana.com/developers/cookbook/transactions/lookup-tables), pinned official `@pump-fun/pump-sdk` 4.2.0 source.

### Editable launch sessions and single approval — 21 October 2026

- Reopening Tokenize now shows the saved launch overview. Admins can pause and edit remaining platforms, ticker, purchases, wallet selection and agent name/bio/image. Pausing revokes execution approval. Submitted targets retain their frozen metadata and receipt tracking; unsigned changed attempts are archived, not overwritten. Completed platform associations remain unique. Replacing paid Bags setup is disclosed before approval.
- A single Launch tokens approval binds the session digest, per-platform spending limits and a 24-hour authorization expiry. SOL ceilings cover setup/fees plus the exact opening purchase; Pons quotes its current launch value plus twice the simulated maximum network fee. Every managed transaction reserves its maximum debit before signing. Replays reserve once, and costs above the remaining limit pause execution. Pons fee recipients are unchanged.
- Authenticated UI polling and the existing scheduled recovery worker advance only explicitly approved sessions. Legacy sessions never gain implicit signing authority. Managed setup, receipt checks and subsequent platforms advance without separate approval screens; connected wallets still sign their transactions. Closing the browser leaves execution durable. Editing, expiry and completion stop further automatic signing.
- Dropped Solana transactions remain unresolved until independent RPCs establish finalized blockheight beyond the saved last-valid height, invalid blockhash, and absent signature/receipt history. Expired attempts are archived before replacing their message. Preflight/broadcast errors retain a sanitized category instead of disappearing. No raw provider errors or secrets enter the UI.
- Cipher manager signature `2KCTHuEqGu5d18hkqvTJm8H4G9qHKzfN7BzZkmnZbny1jUY31UTdmjVHd1vbcFEcXDm21Wsw3ZJ5nyKnw43Aagpr` met those expiry checks. Its session is no longer stuck confirming; all three targets are editable. A fresh-blockhash unsigned simulation of the manager instruction succeeded. The two completed setup receipts were preserved. No new approval, signature, launch or opening purchase was issued during recovery.
- Corrected Pons validation to accept the stable Hive agent profile URL used by multi-platform metadata while retaining compatibility with earlier name-based profile links.
- Validation: 139 focused tokenization tests pass with the isolated MongoDB suites enabled. Browser checks cover both themes at 320/390/768/1280 px, reopening/editing/removing platforms, one-approval managed flow, connected-wallet rejection/retry, purchase/ticker preservation, wallet picker focus and readable action buttons. Typecheck and local production build pass. Paid end-to-end acceptance remains separate from these checks.
- Rollback boundary: preserve the new session/attempt records and journal key. Before rolling back execution code, pause approved sessions; older workers do not understand the new expiry and approval states. Previous published production deployment: `6ad911180a771c2e9fbc604f` at `7bd249e`.
- Live unsigned follow-up: Cipher's same manager step was refreshed successfully, with zero simulated Hive-wallet debit (provider-sponsored) and no signed submission. The expired signature remains archived. Live Pons balance was 177252672712334 wei against a 500000000000000 wei launch fee, before gas. The review now reports insufficient ETH explicitly and offers changing the wallet or platform selection; no attempt was made to fund or sign for the user.

### Cipher approval loop and Solana rent — 21 October 2026

- Reproduced the reported error with Cipher's exact Bags launch after all three setup steps finalized. The RPC returned `InsufficientFundsForRent` for static account 2, Hive's Solana deployer. Its 20,920,853-lamport balance minus the 20,604,640-lamport Bags reimbursement left 316,213 lamports, below the current RPC-reported 650,240-lamport wallet rent minimum. This was a funding failure, not an expired transaction or failed setup. The earlier generic simulation error concealed the cause.
- Classify structured simulation errors: identify an underfunded signing wallet, distinguish provider-account funding problems, distinguish blockhash expiry, and retain safe instruction/error numbers for program rejections. Provider logs and credentials are never displayed. [Solana simulation reference](https://solana.com/docs/rpc/http/simulatetransaction).
- Before offering another execution approval for a saved Solana intent, prepare and simulate the next unsigned step with current balances. Failure clears the estimate and stays on the overview with the actual problem. Success clears the old error and permits a fresh explicit approval. Fresh review timestamps no longer bypass blockhash validity. Existing mint, completed setup and historical submissions remain intact.
- After the user's funding, the observed balance was 38,728,423 lamports. The exact, unmodified Bags launch simulated successfully with 18,123,783 lamports remaining. The real session `estimate` action then passed both Solana preparation and Pons quoting, saved the same mint's unsigned launch review, and cleared the stale error. No execution approval was granted and no new wallet transaction was signed or broadcast during this repair.
- Validation: 140 focused tokenization tests passed without skips; actual-component browser tests cover insufficient funding, repeated Continue without an approval loop, funding recovery, existing mobile/desktop flows, and connected-wallet behavior. Typecheck and local production build passed. Paid launch finality still requires the admin's Launch tokens action and confirmed receipts.

### Pons inclusion versus final confirmation — 21 October 2026

- Cipher's Pons transaction `0x456fe3713fa42d279eafbcc80012f982d205e8ee8f8479f1c643cb5f92f1346e` succeeded in block 94,554,655. At the first incident read, the public RPC finalized head was 94,547,484; a later read showed the safe head beyond the receipt while finalized still lagged. This was network finality latency, not a failed submission. Bags and pump.fun were already confirmed and published.
- Preserve the finality requirement for public token associations. A matching successful transaction in its canonical block can now report inclusion separately while finality is pending. An observed reorg or missing receipt clears that status. Never retry or replace a mined launch merely because finality is behind. See [Arbitrum finality reference](https://developer.arbitrum.io/how-arbitrum-works/reference/finality-and-reorgs).
- Propagate inclusion status and transaction hash through the recovery journal and session even when the phase remains `confirming`. The batch dialog shows “Transaction confirmed · Finalizing…” with a View transaction link. Trade links remain tied to verified, finalized token associations.
- Validation: 142 tokenization tests passed without skips, including finality delay, reorg clearing, final publication and same-phase session updates. Browser coverage includes the new pending explorer link and mobile layout.

### Managed Pons deployer contention — 22 October 2026

- Prism's pump.fun launch was confirmed, but its Pons reservation collided with Echo's Pons transaction while Robinhood finality was pending. The generic conflict handler paused Prism and removed its execution approval. Echo subsequently finalized and released its reservation; Prism retained the obsolete error.
- Managed signer contention now has a distinct internal result. Preparation first asks the existing leased receipt worker to reconcile the blocking agent. If it is still pending, the requesting session keeps its original approval, expiry and spending limits, shows “Waiting for Hive deployer…” with a spinner, and resumes through polling or scheduled recovery once the reservation is free. Unsigned reviews and signed submissions are never discarded to clear the queue. Real preparation failures, explicit pauses and expired approvals still stop execution.
- Preserve the unique signer/nonce guards and completed platform associations. Progress writes normalize absent database fields so unchanged waiting polls do not churn session revisions. Paused preparation no longer displays a running spinner.
- Production repair: refreshed only Prism's unsigned cost review through the session runtime, clearing its old error. Its pump.fun token `22kWmPmJaAdGXQVC3oMCUpKqQobuGkhQ5hD4UVPEhreU` remains confirmed. No Pons transaction was signed or broadcast; the prior approval had been removed, so the admin must select Continue and approve the remaining launch once.
- Validation: 145 tokenization tests passed with zero skips. Coverage includes signer contention, receipt-worker handoff, restart and scheduled recovery, preservation of completed tokens, unchanged authorization limits, pause/expiry and genuine errors. Actual-component browser checks passed at mobile and desktop sizes, including reopening a waiting launch and automatic continuation with one approval. Typecheck and production build passed. Production publication is verified separately from execution of Prism's remaining token launch.

### Owner tokenization entry point — 22 October 2026

- Added a shared owner launch action directly beside View profile on My agents, available across all workspace tabs. It uses the existing authenticated owner request and launch dialog; existing token associations change the label to Manage tokens.
- The owner tools token view now uses the multi-platform trade dialog and retains token management after a Pons launch. Legacy Bags links remain only when absent from the verified catalog. Wallet verification and server ownership checks remain unchanged.
- Agent/session changes close the dialog, refreshed token details update the page, and keyboard focus returns to the launch action after the refresh.
- Validation: 30 owner/tools tests, typecheck and production build passed. Fixture-backed checks of the actual owner pages passed in both themes at 320/390/1280px, including every workspace tab, missing-wallet availability, existing-token management, agent switching, focus restoration and multi-platform trade. No wallet signatures or launch submissions were made by these checks.

### Release the managed deployer on successful inclusion — 22 October 2026

- Supersedes the earlier signer-wide finality wait: a matching successful canonical transaction, exact Pons launch event/opening purchase and an advanced pending nonce now release `managedPending` immediately. Finalized profile publication continues independently; it no longer blocks another agent's launch.
- Retain each transaction, encrypted submission and unique signer/nonce record. Reorg recovery cannot reclaim the signer-wide lock from a newer launch, and an RPC reporting an old nonce cannot create another transaction with the historical nonce. Missing receipts, wrong events, failed RPC reads and reverted transactions do not receive early-success release.
- Validation: 147 tokenization tests passed without skips, including pre-finality release, stale nonce reads, missing events, RPC failure, independent receipt recovery and duplicate-nonce rejection. Typecheck and production build passed.
