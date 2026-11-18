# Frozen holder eligibility review

**Latest rule supersedes the current-only check below:** at least **1M at snapshot AND 1M currently**. Of the 231 original signing-wallet candidates, **72** pass the snapshot minimum and **159** are permanently excluded by that cutoff requirement. Applying the latest saved balance observation (slot 449504778) leaves **60** passing both requirements; one of the earlier 61 had less than 1M at snapshot. [Revised approved snapshot candidates](tools/hive-migration/local/eligibility-minimum-v2/approved-wallets.json), [excluded rows](tools/hive-migration/local/eligibility-minimum-v2/excluded-wallets.json), and [decision record](tools/hive-migration/local/eligibility-minimum-v2/decision.json). Final allocation/denominator approval remains pending. No continuous holding history was established.

**Latest qualification rule:** snapshot presence AND at least **1M current spendable old HIVE**. The 231 approved addresses are snapshot candidates, not 231 currently eligible recipients. At finalized slot **449504778** (22 September 2026, 21:50:32 UTC), **61** met the current minimum and **170** did not. At the original snapshot, 72 wallet candidates held at least 1M and 44 held less than one token. [Current read evidence](tools/hive-migration/local/current-qualification-449504778.json). Counts may change; they are rechecked before deposit. This read does not approve a new denominator or redistribute the 10M budget.

**User decision recorded:** include all 231 signing-wallet candidates. [Approved wallet rows](tools/hive-migration/local/eligibility-decisions-v1/approved-wallets.json) and [decision record](tools/hive-migration/local/eligibility-decisions-v1/decision.json) preserve that approval separately from the original blank worksheet. Custody, pool beneficiaries, staking and final budget accounting remain pending. `reviewedHoldersFile` is still unset; `approvedWalletCandidatesFile` points to this partial eligibility decision without making it a launchable campaign.

Prepared from the original holder file with SHA-256 `cce4c645194e8b7fa1f1b600c0332e099cb488dce47ffa66fcf6b50920f5daaa`. Cutoff: finalized slot **449032979**, 21 September 2026 at 11:48:43 UTC+1. No current balance census replaces this frozen evidence.

| Category | Owners | Old HIVE at cutoff | Decision state |
|---|---:|---:|---|
| On-curve signing-wallet candidates | 231 | 578.10M | All approved by user; final allocation pending |
| Off-curve custody review | 16 | 3.6M | Beneficiaries and custody backing unresolved |
| Known pool authority | 1 | 417.10M | No direct ordinary-wallet grant; LP beneficiary policy pending |
| Non-pool candidates | 247 | 582.2M | Provisional allocation population |

Curve classification determines compatibility with the V1 signature path; it does not establish an individual beneficiary or prove team ownership. The initial worksheet remains blank/null for audit. The separate decision file approves all 231 direct-wallet rows. No custody owner has been approved or excluded, and the campaign's final reviewed-holder path remains unset.

## Independent recount and revised budget

The user increased the total disbursement budget to **10M new HIVE**. Funding is intended, not yet verified on chain. Earlier 7M artifacts are preserved as historical drafts. The new review estimates do not overwrite wallet eligibility approvals.

An independent decode of all 1,168 frozen raw token-account records found **249 nonzero token accounts and 248 unique nonzero owners** (919 token accounts have zero balances). Every owner balance matched the holder JSON, and the summed **999,960,398.822814692 old HIVE** matched the binary mint supply before and after the scan. Both evidence hashes were verified. These are addresses at the cutoff, not unique people or a live holder count. The earlier count of 250 belongs to the superseded 09:43 UTC snapshot.

[Recount evidence](tools/hive-migration/local/snapshot-recount-10m.json)

## Review files

- [All 248 owners and exact balances](tools/hive-migration/local/eligibility-review-10m-v2/holders.csv)
- [16 custody addresses to reconcile](tools/hive-migration/local/eligibility-review-10m-v2/custody.csv)
- [Full review worksheet](tools/hive-migration/local/eligibility-review-10m-v2/review.json)
- [Category totals and allocation sensitivity](tools/hive-migration/local/eligibility-review-10m-v2/summary.json)

These are local review artifacts, not an executable Merkle tree. `eligible` and `review_note` are deliberately unfilled. Original snapshots are unchanged. The generator refuses to overwrite an existing review directory.

## Allocation consequences

Keeping all 247 non-pool candidates in the provisional denominator gives the 231 signing wallets **9,938,931.823060123561901248 new HIVE** in aggregate and the 16 unresolved custody addresses **61,068.176939876438098626 new HIVE** (about **61.1K**). Per-owner rounding leaves 126 raw destination units unallocated. This is a review estimate, not an approved reserve or payout.

Allocating all 10M to the 231 signing wallets instead would use a smaller denominator of **578,674,305.268883164 old HIVE**, raising their rate and consuming the custody share. That sensitivity is recorded as `selected: false`; it is not applied to the checker or campaign. The non-pool denominator currently used by the checker remains **582,229,876.983614953 old HIVE**.

V1 campaign preparation only accepts on-curve owners and derives its denominator from the selected allowances. It cannot silently preserve an extra custody denominator. If custody needs a reserved share or reconstructed beneficiaries, finalize that policy and its budget accounting before approving a campaign artifact; do not deploy a wallet-only tree with the full budget while promising the same funds to custody beneficiaries.

## Separate staking reconciliation

Earlier internal evidence reported three active/locked records totaling **2,100,001 old HIVE**. The database read was at 10:00:15 UTC, before the active 10:48:43 UTC cutoff, and was associated with the superseded slot 449018303. It does not prove beneficial balances at the active cutoff. These amounts are not added to the worksheet or denominator. Reconcile historical deposit/withdrawal signatures, treasury backing and overlap with liquid balances before recognizing a claim. Do not count locked balances and their pending-unstake breakdown twice. Operational staking records remain private.

## Current custody metadata leads

A read-only mainnet check at finalized slot **449499920** found accounts for all 16 custody authorities. Thirteen are currently owned by `11111111111111111111111111111111`; the other three are owned respectively by `2DAtv2URAcb9ZHVMHEB8E3TFBTk9PoNSYknjq8DVr69c`, `REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3`, and `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`. These are current account ownership observations, not proof of a beneficiary, controlling authority derivation or historical custody backing. No protocol labels have been inferred.

[Sixteen case files with evidence requirements](tools/hive-migration/local/custody-cases-v1/cases.json) preserve the observations and exact frozen balances. The thirteen System Program-owned authority accounts represent 3,374,451.531830013 frozen old HIVE; the remaining three represent 181,120.182901776. Their eligibility remains unresolved.

## Decisions needed to finalize

1. Completed: user approved all 231 signing-wallet candidates at their exact frozen balances, with no additional minimum or team exclusion applied to these rows.
2. Decide custody/LP/staking treatment after reviewing beneficiary evidence. Record excluded owners explicitly; a missing review is not an exclusion.
3. Approve final allowances and aggregate budget accounting, then export a separate reviewed-holder array for campaign preparation. Keep the worksheet as the decision trail.

The seven-day registration/deposit duration is already selected. Opening time and settlement grace remain unset; preparation will derive close exactly seven days after opening. Financial activation remains disabled.

Validation: original snapshot hash verified, category counts and balances reconciled, all candidate draft allocations plus rounding remainder equal 10M, and two review regression tests pass.
