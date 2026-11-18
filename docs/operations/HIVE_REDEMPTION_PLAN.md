# HIVE redemption  -  current plan

> **Selected allocation:** distribute the **10M new-HIVE campaign budget proportionally to eligible frozen holdings**, subject to a maximum of **0.7 new HIVE per eligible old HIVE**. The tier model is superseded. Final eligibility and custody reconciliation remain pending; preview amounts are not yet claimable.
>
> **Pre-claim allocation check required:** let holders enter a public Solana address or connect their wallet without a transaction signature. Show the frozen snapshot balance, reviewed eligibility, assigned new-HIVE allocation, required old-HIVE surrender, current spendable balance, deadlines and claim status before requesting any deposit. Clearly distinguish a 70% ceiling from an assigned allocation. Pending classifications or an unapproved schedule must show “Allocation pending,” never an invented grant. Bind the eventual deposit quote to the same approved allocation shown in the checker. Proportional contract enforcement and unsigned tooling are implemented locally. The read-only checker is implemented locally at `/token/claim`; transaction signing and public launch remain pending.


The selected implementation is a **Solana escrow, prefunded Robinhood distributor and one admin running an automated verifier**. Contracts and the verifier are implemented locally; deployment, funding, the public claim page and financial activation remain pending. [Implementation and commands](tools/hive-migration/escrow/README.md) · [remaining user inputs](HIVE_REIMBURSEMENT_INPUTS.md).

## Frozen eligibility

The selected cutoff is **21 September 2026 at 11:48:43 UTC+1**, finalized Solana slot **449032979**. The preserved snapshot records 248 nonzero owners across 249 nonzero token accounts, totaling **999,960,398.822814692 old HIVE**. Excluding the known pool leaves **247 candidates**, including **16 unresolved program-controlled owners**. Candidates are not automatically approved beneficiaries.

- Old mint: `6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS` (9 decimals).
- New token: `0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8`, Robinhood chain 4663 (18 decimals).
- Collection: `CmKcjG6tvNy26z5CVd58mgPTs5RPzeJvmjGDvqXxpwLF`.
- [Original holder CSV](tools/hive-migration/local/snapshot-2026-09-21T10-48-52.230Z/holders.csv) · [JSON](tools/hive-migration/local/snapshot-2026-09-21T10-48-52.230Z/holders.json).
- Holder JSON SHA-256: `cce4c645194e8b7fa1f1b600c0332e099cb488dce47ffa66fcf6b50920f5daaa`.

Raw snapshot evidence and earlier previews remain unchanged. The separate campaign-policy file records current decisions. Preparation builds the final Merkle tree only from explicitly reviewed owners, with allowances no larger than their frozen balances. Pool, team, staking and program-custody classifications still need review. V1 does not support a program-controlled owner signing as an ordinary wallet.

At claim time, the maximum surrender is the lesser of the frozen allowance and currently spendable holdings. Buying later cannot increase the allowance or qualify a new address. A snapshot does not establish continuous holding: an eligible owner can sell and reacquire within the original allowance. The public terms must not promise detection of that behavior.

## Selected proportional allocation within 7 million HIVE

For each reviewed beneficiary, use:

`new HIVE = min(10,000,000 × eligible old holdings / total eligible old holdings, 0.7 × eligible old holdings)`

Freeze the denominator before activation. Round each allocation down to 18 decimals; leave the rounding remainder unallocated. If the 70% ceiling prevents spending the full budget, leave that excess unallocated too. No later claim or non-participation changes another holder's rate. The 10M is the token budget; gas is separate.

The current **provisional** preview includes all 247 non-pool snapshot candidates with **582,229,876.983614953 old HIVE**. It allocates **6,999,999.999999999999999870 new HIVE**, leaving 130 raw destination units (0.000000000000000130 HIVE). A 10M-old-HIVE holding receives approximately **120,227.426944581086898046 new HIVE**. The 16 program-controlled owners remain unresolved and are included only to model the budget; none are approved for payment. Final exclusions and reconciled custody/staking can change the denominator and all quotes.

[Per-owner preview](tools/hive-migration/local/proportional-7m-preview/allocations.csv) · [Summary](tools/hive-migration/local/proportional-7m-preview/summary.json). Snapshot bytes are hash-verified before generation. The preview is not an executable campaign or approved owner list.

The allocation model, preview, both escrow contracts, registration signatures and unsigned tooling now implement proportional economics. Preparation derives the denominator from the exact reviewed holder list and rejects legacy tier configurations or conflicting totals. Both contracts enforce the 70% ceiling and the explicit partial-surrender setting. The distributor also enforces lifetime budget/old-token limits; cancelled shares are not redistributed. The local `/token/claim` checker shows snapshot holdings, provisional estimates and finalized spendable balances; approved allocation and deposit terms stay pending. The earlier tier previews are historical only.

## Claim and settlement

1. The holder connects their original Solana wallet and Robinhood recipient wallet. Both sign the exact registration binding the campaign, wallets, assets, surrender amount, proportional allocation, deadlines, nonce and terminal-attempt terms. V1 supports EVM externally owned accounts; contract wallets require a separately reviewed path.
2. The automated verifier reserves the grant on Robinhood from actual prefunded inventory. The contract fixes its recipient and terms and protects the reserved balance from admin withdrawal.
3. After finalized reservation verification, the service constructs and co-signs the exact Solana deposit transaction. The user also signs it, paying deposit fees and account rent. Multiple source token accounts can be consolidated within the same transaction. No unlimited token approval is requested.
4. After a successful finalized deposit and exact vault credit, the verifier enables the bound Robinhood claim and submits it on the holder's behalf. The distributor pays the recipient once. Recipient ETH is unnecessary when the service sponsors this transaction.
5. After finalized Robinhood payment verification, the verifier authorizes the Solana program to release only that claim's old HIVE to the collection wallet.
6. If an unpaid claim expires, the service first records permanent cancellation on Robinhood. Only after finalized cancellation can it authorize refund to the original Solana owner. A source timer alone cannot authorize refund. An in-flight deposit arriving after cancellation still needs reconciliation and refund.

V1 allows **one escrow deposit per source owner per campaign**. Paid and refunded attempts are both terminal; no remainder claim or retry exists in this version. Smaller surrenders are allowed: the claim uses the same fixed proportional rate on the actual surrendered amount, capped by snapshot allowance; there is no full award for a partial deposit. This policy is explicit in the signing message and must be approved before activation.

## Administration, failure handling and trust

One operator controls a Solana admin address and an EVM admin address, with no separate attestors or approval quorum. The contracts enforce amounts, recipients, reservations and one-time state transitions. The service supplies cross-chain facts after reading finalized state and checking reviewed deployment fingerprints and transaction evidence. This is a project-operated redemption, not an atomic or trustless bridge.

A compromised admin can authorize false cross-chain outcomes; a lost or unavailable key can block source release/refunds. Admin identities are immutable in V1. Solana upgrade authority is a separate deployment choice; its policy and recovery consequences need review. Neither unconditionally refundable escrow nor guaranteed service uptime is promised.

The verifier defaults to dry-run. Explicit activation, matching admin identities and transaction fee limits are required before signing. It persists signed transactions before broadcast, reconciles by hash/nonce, holds an exclusive process lock and never automatically resubmits unknown or failed transactions. The admin nonce stream must not be used concurrently by another process. Pausing prevents new deposits and payouts while allowing cancellation and source settlement.

## Remaining activation work

Provide public admin addresses, funding addresses/contributions and claim dates. Review the final proportional allocations, eligible-owner selection, terminal-attempt rule, contingency allocation, upgrade/recovery policy and support terms in the inputs file. Reconcile staking and custodial beneficiaries without double counting the same units.

Then obtain an independent security review, deploy both sides paused, fund the approved inventory, verify deployment/configuration/authorities, integrate the public wallet interface and monitoring, and rehearse the complete deployed flow including refunds. Local contract, signature, evidence and recovery tests are recorded in [verification.json](tools/hive-migration/escrow/verification.json). They do not establish a deployed end-to-end claim service. No escrow deployment or reimbursement transfer has occurred.
