# Solana-to-Robinhood HIVE reimbursement plan

**Superseded by [HIVE_REDEMPTION_PLAN.md](HIVE_REDEMPTION_PLAN.md):** the user requested a fresh fixed snapshot now, plus claim-time verification and transfer of eligible old HIVE into a project collection wallet before new-HIVE payout. The current cutoff is slot 449032979 at 11:48:43 UTC+1. The no-surrender flow, earlier cutoff and 249-owner budget below are historical; do not implement them as the current policy.

Scope: holder snapshot and a **partial reimbursement using fixed grants by holding-size tier**, as selected by the user. No pro-rata distribution, automatic 1:1 swap, or guarantee of equivalent USD value. No reimbursement transfer or public announcement has been authorized or made.

Source mint: `6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS`, Solana mainnet, 9 decimals. Destination: **Robinhood Chain 4663**, HIVE `0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8`, 18 decimals. The destination is the existing launched token. This does not require a new token or transfer of the Solana tokens through a bridge.

## 1. Freeze eligibility and classify custody

Use the preserved snapshot at finalized slot **449018303**, **21 September 2026 10:43:31 UTC+1**, subject to final cutoff confirmation. It contains all 250 nonzero owners with exact balances. See [snapshot review](HIVE_SOLANA_SNAPSHOT_REVIEW.md). If an earlier cutoff is desired, retain this evidence and perform a historical reconstruction; never pretend this is pre-launch data.

Keep pools, burn addresses, custody, team and ordinary holders as separate categories with recorded evidence. The confirmed Meteora pool authority receives no direct wallet grant in the draft. Its LP beneficiaries are a separate policy decision, not automatically included or discarded. Review 16 other program-controlled owners individually. Obtain the team's Solana wallet list and decide its treatment explicitly. No silent dust threshold or automatic disqualification merely because an address is off-curve.

Reconcile the three staking records before adding beneficial holdings: establish deposits at/before cutoff, subtract confirmed exits, match treasury backing and avoid counting the same units under both treasury and beneficiary. Aggregate liquid plus verified custodial entitlement for a beneficiary before choosing one tier. Investigate unbacked/inconsistent records; do not dilute verified holders to cover unexplained ledger balances.

## 2. Approve fixed grants and budget

The following is an **illustrative schedule, not an approved promise**. Every approved beneficiary in a band receives the same fixed grant regardless of the exact balance within that band.

| Old HIVE held at cutoff | Candidate owners | Fixed new-HIVE grant | Draft tier total |
|---|---:|---:|---:|
| More than 0, below 1,000 | 70 | 100 | 7,000 |
| 1,000 to below 10,000 | 15 | 1,000 | 15,000 |
| 10,000 to below 100,000 | 35 | 5,000 | 175,000 |
| 100,000 to below 1 million | 55 | 25,000 | 1,375,000 |
| 1 million to below 10 million | 58 | 100,000 | 5,800,000 |
| 10 million or more | 16 | 250,000 | 4,000,000 |
| **Total** | **249** | | **11,372,000** |

This is **1.1372% of the new token's 1 billion supply**, before team exclusions, custody decisions and staking corrections. It includes provisional reserves for all 16 unresolved program owners. The under-1,000 band is a nominal goodwill grant; it can be removed or changed only as an explicit policy decision. Grant size is not an assertion of USD loss or make-whole value.

Budget alternatives with the same bands: half each grant = **5,686,000 HIVE (0.5686%)**; double each grant = **22,744,000 HIVE (2.2744%)**. Select amounts before public commitments. Do not automatically prorate if funds are insufficient; revise and approve a new fixed schedule. Reserve a separately approved contingency for genuine omitted/custodial claims. Unclaimed grants are not redistributed without a published rule.

[Per-owner draft allocation CSV](tools/hive-migration/local/snapshot-2026-09-21T09-43-40.282Z/tier-preview.csv) · [Tier summary](tools/hive-migration/local/snapshot-2026-09-21T09-43-40.282Z/tier-summary.json). No row is payment-approved and no destination is prefilled.

## 3. Register Robinhood destinations with ownership proof

Build a small registration page on the verified Hive domain. Each claimant connects their original Solana wallet, sees its immutable snapshot balance/tier and supplies an EVM address they control for Robinhood Chain. Solana addresses cannot be converted into corresponding EVM addresses.

Ask the Solana wallet to sign a readable **message**, not a token transfer, approval or seed-phrase submission. Bind the exact message to domain, campaign/version, Solana genesis/mint, snapshot slot and file hash, Solana owner, destination EVM address, Robinhood chain 4663, new HIVE address, draft/final grant, nonce and expiry. Verify Ed25519 signature server-side against the snapshot owner. Display both addresses prominently. A second EVM signature proving destination control is recommended; support contract-wallet signature validation or a reviewed exception path rather than assuming every address is an EOA.

Use one unique entitlement per source owner/campaign, atomically record nonce consumption and permit destination changes only through fresh signed proofs before payout. If multiple Solana wallets map to one destination, retain their separate evidence and flag for the published duplicate-control rule; do not infer fraud or erase balances automatically. The fixed snapshot prevents post-cutoff splitting or buying from creating new entitlements, but cannot retrospectively prove one person per wallet. Define wallet-versus-beneficiary limits before registration.

Program wallets, multisigs and custodians need a supported authorization/beneficial-owner process; they cannot always sign a normal Ed25519 message for the displayed owner address. CEX deposit addresses are poor automatic destinations because arbitrary token deposits may not be credited. Recipients should use self-custody wallets supporting chain 4663. No private keys are collected.

References: [Phantom message signing](https://docs.phantom.com/solana/signing-a-message), [EIP-712 structured signing](https://eips.ethereum.org/EIPS/eip-712). Nonces and campaign state provide replay protection; EIP-712 alone does not.

## 4. Fund and distribute

Nominate exact team-controlled Robinhood funding addresses and verify their current HIVE balances and native ETH before preparation. The 19 launch-wallet allocations are historical holdings, not evidence of today's available treasury. The new HIVE token supply is already created; grants must be funded from existing balances or a separately approved purchase.

Recommended for this roughly 250-owner campaign: verify registrations, close a first window, freeze a signed/hashed payout CSV, and make **team-paid token transfers in reviewed batches**. Recipients do not need ETH merely to receive an ERC-20 transfer; they will need ETH for later on-chain actions. Optional later claim windows use the same fixed entitlement registry. No requirement to send the old tokens, buy new tokens, or pay a registration fee is proposed.

Use individually journaled transfers or an audited, idempotent batch distributor with explicit maximum batch size determined from gas estimates. Do not improvise a transfer function in the launch executor. A gasless claim site plus team-paid distributions is simpler here than requiring each holder to fund and execute a Merkle claim. If scale later justifies a claim contract, separately review its root, claim identifiers, duplicate protection, chain binding, funding and unclaimed-token policy.

Persist campaign, source owner, destination, entitlement ID, token amount, source wallet, nonce and transaction hash **before broadcast**. Reconcile uncertain transactions by hash/nonce and token logs, never blindly resend. Mark payments completed only after successful receipts and exact transferred amounts. No reimbursement signing/broadcast is within the current snapshot-and-plan scope.

## 5. Test before payment

Completed now: full supply reconciliation, independent re-decoding and aggregation of raw token accounts, evidence hashes, mint/chain verification, and exact tier-boundary tests including dust and zero balances.

Before implementation release: test malformed/stale/wrong-wallet signatures, wrong domain/chain/mint/campaign, nonce replay, duplicate/concurrent registration, destination changes, multisig exceptions, tier boundaries, custody double counting and budget exhaustion. Keep amounts in integer raw units; Solana has 9 decimals and Robinhood HIVE has 18. Never compare raw units across chains or use floating point for allocations.

Before financial execution: simulate the **exact signed-address payout list** on a fresh Robinhood fork with real source balances; verify destination balance deltas, totals, allowances (if any), ordinary-transfer fee behavior and sufficient ETH. The 3% launch/trading charge must not be blindly subtracted from a reimbursement; inspect and test the actual transfer path. Exercise partial-batch failure, receipt reconciliation, reorg handling and rerun protection. Prepare exact unsigned transactions for review, then obtain approval for their actual transfers.

## 6. Communication and audit

After cutoff, eligibility and budget approval, publish an announcement with old/new contract addresses, snapshot slot/time, fixed table, exclusions, registration window, claim mechanism, support/appeal route and unclaimed-token policy. Explain explicitly that this is partial goodwill compensation, not a bridge or guaranteed USD-value replacement. Make clear whether old tokens remain tradable/held; this plan does not burn or redeem them.

Publish the snapshot hash and reproducible method. Public allocation/disbursement data can use wallet addresses, tiers, amounts and transaction hashes. Keep internal staking records and unproven wallet links private. Set a short, announced review/appeal period before payout and reserve for valid corrections. Do not announce amounts before source funding and eligibility are reconciled.

User decisions are collected in [HIVE_REIMBURSEMENT_INPUTS.md](HIVE_REIMBURSEMENT_INPUTS.md).
