# Reimbursement decisions

Chosen ceiling: **at most 70% of eligible old-HIVE token units**. This supersedes the previous fixed-tier proposal; the user reconfirmed **10,000,000 new HIVE total for the entire campaign**. Selected distribution: **proportional to eligible frozen holdings**, within the 10M total budget and 70% ceiling.

No private keys, seed phrases, passwords or signatures belong in this file.

- Snapshot cutoff: **selected by your instruction to capture now: 21 September 2026, 11:48:43 UTC+1, finalized slot 449032979**. No new cutoff input required.
- Old-token destination: **your project collection wallet**, released from escrow after confirmed Robinhood payment.
- Solana collection wallet: **CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF** (provided by you).
- Total new-HIVE budget: **10,000,000 new HIVE total, reconfirmed under the 70% per-holder ceiling**. A full 70% conversion for all non-pool candidates would require 407,560,913.8885304671 new HIVE before exclusions. No funding or allocation change is authorized by this comparison.
- Allocation method: **selected: proportional to eligible frozen holdings**. Allocation = min(10M × holder eligible holdings / total eligible holdings, 70% × holder eligible holdings), rounded down to 18 decimals. Final eligibility and custody reconciliation remain pending. Prior fixed-tier grants are no longer the active proposal.
- Pre-claim check: **required**. Show reviewed allocation and exact surrender before any transaction signature; unresolved allocations remain explicitly pending.
- Claim rule: **selected: `allowPartialSurrender: true`**. One completed grant per snapshot owner, based on actual surrender capped by snapshot allowance. Smaller deposits receive the same proportional rate on the old HIVE actually surrendered; there is no full award for a partial deposit.
- Settlement design: **selected: Solana escrow plus prefunded Robinhood distributor**. Local implementation is in `tools/hive-migration/escrow/`.
- Escrow administration: **selected and implemented: one admin with automated cross-chain verification**. No additional attestor wallets. **Solana admin: `CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF`; Robinhood EVM admin: `0xC5496066af938bf19B0f78E2197262Bf10AF9FD0`**, supplied by the user. The Solana admin is also the selected collection wallet. Address format and EVM checksum validated; ownership/signing capability has not been verified. Contracts settle transfers; the verifier confirms finalized activity on the other chain.
- Terminal-attempt policy: **TODO review V1: one escrow deposit per owner/campaign; a completed refund is terminal too**. This avoids reopening stale reservations. Supporting a later retry would require a separately tested nonce/allowance design.
- Refund and operating terms: **TODO payout target, refund process, support contact, and admin recovery/contact details**.
- Holding minimum: **selected: at least 1,000,000 old HIVE (1M) at the frozen snapshot AND at least 1M in spendable holdings immediately before deposit**. This supersedes both unconditional qualification of all 231 wallets and the previous current-balance-only minimum. Later purchases cannot qualify a wallet below 1M at the cutoff. It is not a minimum partial-deposit amount. The payout remains capped by the frozen allowance. The total campaign budget is **10M new HIVE**. This proves the two balances, not uninterrupted holding between them.
- Team-owned Solana addresses to classify: **TODO public addresses only, or explicitly none**.
- Direct-wallet eligibility: **approved: include all 231 signing-wallet candidates**, holding 578,674,305.268883164 old HIVE at the frozen cutoff. No team/treasury exclusion is applied within those 231. Approved rows and the explicit user decision are recorded in `tools/hive-migration/local/eligibility-decisions-v1/`. Custody, LP and staking treatment remain separate; this approval does not assign the entire 10M budget to the 231 wallets.
- Pool/LP policy: **TODO no direct pool grant; decide whether to reconstruct LP beneficial holdings**.
- Staking: **TODO confirm production treasury and resolve three active/locked records totaling 2,100,001 HIVE; include only reconciled claims**.
- Multiple source wallets controlled by one beneficiary: **TODO one entitlement per owner address / aggregate proven same-owner balances without double counting / other explicit rule**.
- Robinhood funding source(s): **Selected funding wallet: `0xC5496066af938bf19B0f78E2197262Bf10AF9FD0`**, also the Robinhood admin. Campaign budget remains 10M HIVE. Maximum source contribution and current inventory are not yet verified; no funding transfer is authorized by recording the address.
- Appeal/custody contingency reserve: **TODO review after final allocation and total budget**; the prior 206,800 figure belongs to the superseded tier proposal.
- Registration/deposit window: **selected: seven days (604,800 seconds) from opening**. Opening timestamp remains TODO; campaign preparation derives the closing timestamp as `opensAt + 604800` and rejects a conflicting end date. The settlement grace for already accepted deposits remains a separate pending operational term, not an extension for new deposits.
- Appeal period: **TODO duration**.
- Unclaimed allocation after deadline: **TODO retained in treasury / later window / other disclosed rule**.

Proportional contracts, exact allocation tooling, the single-admin automated verifier, injected-wallet claim UI and persistent operator gateway are implemented locally. The campaign denominator is derived from the final reviewed owner allowances; legacy tier artifacts cannot be reused. Deployment, funding and public claims remain pending the decisions above, deployed hosting/rehearsal and independent security review. See `HIVE_CLAIM_HANDOFF.md` for validation and operating instructions. No mainnet escrow deposit or reimbursement payout has occurred.
