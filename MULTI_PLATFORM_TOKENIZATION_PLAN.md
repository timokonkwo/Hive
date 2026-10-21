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
6. If atomic initial purchases on pump.fun are required at release, configure and simulate a suitable address table first. The basic token launch does not require one.

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
