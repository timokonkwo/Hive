# HIVE redemption escrow

Implemented locally: a Solana SPL-token escrow program, a prefunded Robinhood ERC-20 distributor, unsigned client/preparation tools, a finalized-state inspector, and an automated single-admin verifier service. **The service has not been activated. The public checker is deployed. No mainnet escrow deployment, deposit, payout or unpause has occurred.**

The collection wallet selected by the user is **`CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF`**. Its old-HIVE associated token account derives to `46YZhh9FJtKufB7f6tBTZkLZxywzy5tHaG72RaNnLFJH`; derivation does not establish account creation or wallet ownership. The settlement builder creates the associated token account idempotently when needed.

## Settlement model

1. The holder signs the exact registration with their Solana wallet and Robinhood recipient wallet. `registration.mjs` binds the campaign, both assets, addresses, amount, proportional allocation, frozen denominator, budget, partial-surrender policy, cutoff allowance, deadlines and nonce. V1 supports an ordinary Solana signer and an EVM externally owned account; contract-wallet and program-custody claims need a separately reviewed path.
2. The admin's automated verifier reserves the proportional allocation on Robinhood. The contract enforces the snapshot proof, amount cap, fixed proportional rate, 70% ceiling, lifetime budget, recipient, deadlines and available token inventory. Reserved inventory cannot be withdrawn by the admin.
3. After reading the finalized reservation, the verifier constructs and partially signs the Solana deposit. The holder must sign it too. Exact old HIVE enters the program-controlled vault. Multiple token accounts can be consolidated within this same transaction; oversized transactions fail before signing.
4. The verifier checks the finalized deposit transaction, matching instruction and actual vault balance increase, then calls `confirmDeposit`. It submits the permissionless `claim` for the fixed recipient, sponsoring Robinhood gas.
5. After verifying the finalized Robinhood payment event and receipt, the verifier authorizes the Solana program to release that claim's old HIVE to the collection wallet.
6. For an expired unpaid claim, the verifier first submits permanent Robinhood cancellation. Only after verifying finalized cancellation does it authorize a refund to the original Solana owner. The admin can also cancel early through the separate CLI. Solana time alone never authorizes a refund.

**One operator controls administration and cross-chain verification.** They need one Solana signing address and one EVM signing address because the chains use different keys; there are no additional attestor wallets or approval quorums. Contracts enforce custody, amounts, recipient, reservation accounting and replay protection. The off-chain verifier supplies cross-chain facts. Neither contract verifies the other chain with a light client.

This model trusts the admin and its RPC observations. A compromised admin can falsely authorize a source refund/release or enable a destination payout. An unavailable or lost admin key can prevent source settlement indefinitely, even after destination cancellation. Automation removes routine manual approvals; it does not remove this trust or guarantee service uptime. Admin identities are immutable in this V1; a rotation/recovery change needs separate implementation and review.

A reservation can be cancelled while a previously co-signed deposit is in flight. The resulting late deposit must be refunded after finalized cancellation. Never treat quote expiry as proof that no deposit happened.

## Immutable campaign terms and V1 boundaries

- Frozen cutoff: **slot 449032979, 21 September 2026 at 11:48:43 UTC+1**. Raw snapshot evidence remains unchanged. A new tree includes only explicitly reviewed eligible owners and allowances no greater than that snapshot.
- Old mint: `6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS`, standard SPL, nine decimals, revoked mint/freeze authorities.
- New token: `0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8`, Robinhood chain **4663**, eighteen decimals. Allocations use the frozen eligible-holdings denominator and 10M ordinary campaign budget, rounded down to 18 decimals and capped at 70% of surrendered old HIVE. They are not price-oracle values or 1:1 conversion.
- V1 allows **one escrow deposit per source owner per campaign**. Both paid and refunded attempts are terminal. No close/reinitialize, remainder claim or retry nonce exists. This stricter rule requires confirmation before deployment; a retry feature would require a new allowance/nonce design and tests.
- Partial surrender is selected (`allowPartialSurrender: true`). Smaller deposits receive the same proportional rate on the amount actually surrendered, capped by the snapshot allowance; there is no full award for a partial deposit. Zero-allocation deposits are rejected. The quote must display the actual award and terminal-attempt policy before the user signs.
- The preparation tool excludes the known pool and rejects program-controlled source owners for V1. Custody, staking and team exclusions require separate review. Program custodians cannot automatically use an ordinary wallet-signature flow.
- Campaign/root/collection/admin/denominator/budget/partial-surrender policy/times are immutable in application state. Both sides start paused. Solana loader upgrade authority can still replace program code; its custody/timelock/revocation policy must be decided separately. The distributor has no proxy or upgrade function.
- Admin pause blocks new Solana deposits and destination reservations/confirmations/payouts. Source settlement and destination cancellation remain available while paused. Admins cannot sweep the pending source vault. Destination admins may withdraw only unreserved surplus.
- Accidental, unrecorded transfers to the escrow vault have no general sweep/recovery method in V1. Users must use the deposit instruction. Claim records and their rent are retained to prevent replay; disclose these fees.

## Files and commands

Run commands from the repository root unless noted. Dependencies for the JS tools already exist in the root package; the isolated Rust lockfile pins its dependency graph.

```sh
forge test --root tools/hive-migration/escrow/evm
node --test tools/hive-migration/escrow/*.test.mjs tools/hive-migration/proportional-model.test.mjs tools/hive-migration/allocation-cap.test.mjs
cargo test --manifest-path tools/hive-migration/escrow/solana/Cargo.toml -- --test-threads=1
cargo-build-sbf --manifest-path tools/hive-migration/escrow/solana/Cargo.toml --tools-version v1.57
```

To execute the actual compiled escrow binary in the local Solana bank, set `HIVE_ESCROW_TEST_SBF=1` and `BPF_OUT_DIR` to the absolute `solana/target/deploy` directory, then run the Rust `--test runtime` suite. The SPL-token processor executes through runtime CPIs. Native tests alone do not establish SBF execution.

The optional real-token test is **local only**, using remote state as a read-only fork:

```sh
HIVE_ESCROW_FORK_RPC=https://rpc.mainnet.chain.robinhood.com forge test --root tools/hive-migration/escrow/evm --match-contract HiveTokenForkTest
```

It deploys the distributor and transfers actual HIVE code/state inside the local EVM. It never broadcasts or changes a mainnet balance. It does not authorize the tested holder's funds for the campaign.

`campaign.inputs.json` is the agent-maintained deployment configuration. User decisions are tracked in the root `HIVE_REIMBURSEMENT_INPUTS.md`. Program/distributor addresses are deployment outputs, not addresses the user needs to invent. After public addresses, policy and grants are fixed, generate a separately reviewed holder selection with entries `{owner, amountRaw, eligible: true, reviewNote}`. No default automatic selection is made.

```sh
node tools/hive-migration/escrow/prepare-campaign.mjs tools/hive-migration/escrow/campaign.inputs.json tools/hive-migration/escrow/local/review-001
```

Preparation validates the exact saved snapshot hash, allowances, owner review, grant budget and both chains' configuration. It writes a new exclusive `campaign-review.json` containing the tree/proofs, constructor arguments/bytecode and unsigned Solana initialization instruction. Missing approvals/fields fail closed. Preparation does not deploy or enable claims.

`client.mjs` exports PDA and proof construction, Borsh encoders/decoders, exact deposit/consolidation and release/refund instructions, and unsigned transaction construction. Public deterministic `test-vectors.json` checks matching Rust/Solidity/JS commitments. No wallet keys appear in these vectors.

`export-action.mjs <campaign-review.json> <request.json> <new-output.json>` exports unsigned `reserve`, `deposit`, `confirm_deposit`, `claim`, `cancel`, `cancel_expired`, `release` or `refund` payloads. Requests use a source `owner`; reserve/deposit additionally require `amount`, `recipient`, `depositDeadline` (canonical decimal raw amounts/timestamps), and deposits require `sourceTokenAccount`. Confirmation requires `depositSignature`; release/refund require `destinationTransactionHash` and a public `feePayer`. Exporting a payload does not verify the truth of an attestation. Inspect the finalized state and exact transaction evidence before any signer approves it.

After deployment, `read-claim.mjs` compares finalized source/destination account state against the reviewed terms and suggests the next state transition. It requires a supported destination `finalized` block tag; it never silently falls back to latest. It is diagnostic, not a signer or substitute for verifying deployment code, transaction evidence and finalized settlement. The automated observer adds deployment fingerprint and transaction-evidence checks.

```sh
node --env-file=.env.local tools/hive-migration/escrow/read-claim.mjs <campaign-review.json> <Solana-owner>
node --env-file=.env.local tools/hive-migration/escrow/simulate-unsigned.mjs <instruction-array.json> <fee-payer-public-address>
```

Simulation explicitly uses `sigVerify:false`, reports this, and never broadcasts. It tests current-state execution, not actual signatures, future inclusion, cross-chain truth or a guaranteed payout. An undeployed program cannot be simulated against mainnet; use the local binary tests first.

## Automated verifier operation

`verifier-service.mjs` processes signed registration JSON files from a private local queue. It is a service runner, not a public API or claim page. Defaults are read-only. `verifier.inputs.json` is deliberately incomplete until deployment and fee limits have been reviewed.

```sh
node --env-file=.env.local tools/hive-migration/escrow/verifier-service.mjs tools/hive-migration/escrow/verifier.inputs.json --once
```

Inputs and activation:

- `campaignReviewFile` points to the reviewed campaign artifact. After paused deployment, add a reviewed `deployment` object containing `solanaProgramDataAddress`, `solanaProgramDataSha256` (SHA-256 of the complete raw ProgramData account, without `0x`), `destinationRuntimeCodeHash` (Keccak-256 of deployed runtime code), and `destinationBlock` (decimal deployment block). These are deployment outputs, not user-invented values. The Solana fingerprint also pins its loader upgrade authority.
- RPC environment: `SOLANA_RPC_URL` and optional `HIVE_REDEMPTION_RH_RPC_URL`. The observer verifies Solana mainnet genesis, Robinhood chain 4663, actual assets, deployed fingerprints, campaign terms, finalized states and reserved inventory. Unsupported finality or mismatched observations stop processing.
- Requests contain `owner`, `recipient`, `amount`, `depositDeadline`, a 32-byte hex `nonce`, `solanaSignature` (base58 Ed25519) and `evmSignature` (hex personal-message signature). Generate the exact signed text with `registrationMessage(review, request)`; both wallets sign that same message. Amounts/timestamps use canonical decimal strings. An optional `depositSignature` supports deposit recovery beyond the newest 1,000 claim-address signatures. The immutable owner/campaign claim ID prevents replay even though a registration may be processed repeatedly.
- Fill all positive decimal-string operating limits in `verifier.inputs.json`: per-transaction EVM gas and fee, total EVM maximum fee commitment, per-transaction Solana cost and total Solana cost. No unlimited fee defaults. Users currently pay Solana deposit fees and claim-account rent; the admin pays settlement and destination gas.
- Execution requires `--execute`, `executionEnabled: true`, `financialActivationApproved: true` in the reviewed campaign artifact, and the three approved campaign policy flags. Setting fields does not replace actual financial authorization or deployment review.
- When execution is authorized, provide signer material once through an inherited private file descriptor identified by `HIVE_ESCROW_SIGNER_FD` (integer >= 3). The descriptor carries JSON with `solanaSecretKey` (64 byte integers) and `evmPrivateKey` (32-byte hex). Supply it from a protected local secret manager/launcher, never a public file, command argument, browser, request queue or chat. Identities must match the reviewed admins. Signing keys remain in process memory while running; this is a local hot signer, not an HSM integration.

The worker writes a private result per claim in its state directory. A deposit result includes an admin-partially-signed transaction and expiry height for the user's wallet to sign and submit. It never signs arbitrary transaction bytes supplied by a client. Repeated polling can refresh that partial transaction; the on-chain owner/campaign record permits only one successful deposit.

`journal.mjs` fsyncs the signed transaction, hash and nonce/blockhash **before** broadcasting. An exclusive process lock prevents competing local signing loops. Unknown transactions block new transactions on that chain until finalized reconciliation. Transactions are never automatically retried, replaced or re-signed after unknown/failed outcomes. A stale process lock, missing transaction or expired blockhash needs operator investigation and explicit recovery; never delete a journal to force a retry. Only this service should use the admin's transaction nonce stream while running. Keep local queue/state directories protected from untrusted writes; no network request handler is implemented.

The verifier checks `depositEvidence` against a successful finalized source instruction and exact vault credit. The on-chain evidence hash is SHA-256 of the base58-decoded **64 raw signature bytes**; the hash itself is not a cross-chain proof. Release/refund requires a canonical finalized destination event/receipt and immutable claim terms. The tests exercise those checks, real local key signing and crash/restart behavior; a deployed end-to-end service run remains pending.

## Budget and activation

The selected budget is **10,000,000 new HIVE**, split proportionally by frozen eligible holdings, with a 70% per-holder ceiling. The reviewed holder list determines the denominator; preparation derives its exact sum and rejects a conflicting supplied total or legacy tier fields. Both contracts use integer arithmetic, and the distributor additionally bounds lifetime allocated HIVE and committed old-token amounts. Cancellation does not redistribute a share. High budgets that hit the 70% ceiling leave excess funds unallocated.

The final ordinary allocation covers 72 approved snapshot wallets, each with at least 1M Solana HIVE at the cutoff. Its denominator is 564,937,895.383759533 Solana HIVE. Current holdings must still meet the 1M minimum. A separately funded, explicitly approved 100K exception has been added for the admin wallet; it does not change this denominator or any ordinary award. See [the deployment review](deployment/README.md) for exact terms and current readiness.

The proportional contracts, serializers, registration v3 signatures, unsigned exports and finalized-state observers replace the previous tier implementation. Regenerate review/deployment artifacts; old initialization/account layouts are incompatible and are rejected. The read-only `/token/claim` checker is implemented locally; public launch, transaction claim integration and the deployed end-to-end rehearsal remain pending.

Before public deposits: approve the reviewed owner tree, final proportional allocations, terminal-attempt policy, public admin addresses, funding source, claim times, upgrade policy and recovery terms; obtain independent security review; deploy paused; fund inventory; verify deployment fingerprints/configuration; integrate the public wallet flow and operational monitoring; rehearse signing, settlement and refunds; then activate under explicit financial authorization. The current work implements the service and contracts but does not deploy, fund or enable them.

The applied [DeFi build skill](/Users/tim/.agents/skills/build-defi-protocol/SKILL.md) states: “Never deploy a DeFi program without at least one independent security review pass.” Local tests and this implementation's self-review are not that independent review. Its named static/formal tools were not available in this session; no formal verification or third-party audit is claimed.

Primary documentation: [Solana PDA authority](https://solana.com/docs/core/pda), [SPL checked transfers](https://solana.com/docs/tokens/basics/transfer-tokens), [Solana program deployment](https://solana.com/docs/programs/deploying), [Anza SBF tooling](https://github.com/anza-xyz/cargo-build-sbf).

## Authenticated request intake

`node accept-registration.mjs <verifier.inputs.json> <signed-registration.json>` validates both wallet signatures, recomputes exact proportional terms and checks the request window before publishing a request to the verifier's private queue. Run from the escrow directory or prefix the script path from the root. This command never signs or broadcasts transactions.

Intake requires reviewed eligibility/amount/terminal-attempt decisions and an explicitly activated deployed campaign artifact. It copies only the seven signed request fields. A complete fsynced file is published using an exclusive hard link; concurrent identical submissions return the existing registration, while changed recipient/amount/nonce/deadline terms cannot replace it. The queue and verifier state must remain on the same persistent local filesystem controlled by the operator; this is not serverless application storage. Expired requests fail even on retry. Recovery lookup and terminal settlement use the existing verifier state; do not submit a fresh request to recover an expired one.

The public website does not yet submit to this private intake. The remaining integration needs a deployed campaign, a durable authenticated transport to the operator and the wallet signing/deposit-status interface. Do not expose the queue directory or an unauthenticated arbitrary-file upload endpoint.
# Pre-signature quotes

Update: the public proxy, injected-wallet flow and durable gateway are now implemented. See the root `HIVE_CLAIM_HANDOFF.md` for the current architecture and validation; earlier pending-integration notes above are historical. Deployment and financial activation remain pending.

`quote-registration.mjs` exposes `quoteRegistration(review, input, observer)` and a read-only operator CLI:

```sh
node --env-file=.env.local tools/hive-migration/escrow/quote-registration.mjs tools/hive-migration/escrow/verifier.inputs.json unsigned-request.json
```

The input contains only `owner`, `recipient`, and `amount` (an exact old-token raw integer string). Client-supplied deadlines, nonces and grants are ignored. The service creates a random nonce and a deposit deadline up to ten minutes ahead, capped by campaign close. It verifies finalized deployments, pause state, absence of an existing attempt, spendable old HIVE and unreserved new-HIVE inventory. Both wallets must sign the returned `message`; append their signatures to the returned `request` and submit it through authenticated intake. Retain that request for retries; new quotes have new nonces and cannot replace an already accepted request.

A quote is not a reservation or a deposit transaction. State can change after the read; the verifier and contracts recheck before signing or execution. The current campaign configuration cannot issue these quotes because review/deployment/activation remain incomplete. `gateway-service.mjs` exposes authenticated private quote/register/status/deposit operations to the Next.js proxy. The wallet UI is wired to this proxy but remains disabled with the current configuration.
