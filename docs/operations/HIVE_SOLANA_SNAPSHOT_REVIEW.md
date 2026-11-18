# Solana HIVE holder snapshot

**New cutoff captured on explicit user instruction:** finalized slot **449032979**, **21 September 2026 11:48:43 UTC+1**, with 248 nonzero owners. [Current holder CSV](tools/hive-migration/local/snapshot-2026-09-21T10-48-52.230Z/holders.csv). See [HIVE_REDEMPTION_PLAN.md](HIVE_REDEMPTION_PLAN.md). The earlier snapshot documented below remains intact for audit; it is not the active cutoff. Users must also surrender eligible old tokens at claim time under the current plan.

Captured **21 September 2026, 10:43:31 UTC+1** (09:43:31 UTC), finalized Solana slot **449018303**. This is a preserved current-state snapshot; it is not a reconstruction of holdings before the Robinhood launch. The final reimbursement cutoff still needs confirmation.

Mint: `6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS`.

| Check | Result |
|---|---:|
| Token accounts scanned | 1,172 |
| Nonzero token accounts | 251 |
| Distinct owners with nonzero balances | **250** |
| Decimals | 9 |
| Full outstanding supply / sum of balances | **999,960,398.822814692 HIVE** |
| Mint authority | Revoked / null |
| Freeze authority | Revoked / null |
| Owners with off-curve addresses | 17 |

All account balances reconciled exactly to the full outstanding supply. Accounts were fetched in one `getProgramAccounts` response with finalized context; all token accounts per owner were aggregated. This includes non-associated token accounts. Zero balances remain in account evidence but are not holder rows. A second independent binary decoder reproduced all 250 totals, validated file hashes, and checked slot/block identity. The mint data was unchanged in reads bracketing the scan.

**Download:** [Every holder and exact balance  -  CSV](tools/hive-migration/local/snapshot-2026-09-21T09-43-40.282Z/holders.csv) · [Full JSON](tools/hive-migration/local/snapshot-2026-09-21T09-43-40.282Z/holders.json) · [Snapshot summary and hashes](tools/hive-migration/local/snapshot-2026-09-21T09-43-40.282Z/summary.json)

## Eligibility findings

1. **Meteora pool authority:** `HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC` owns **420,579,921.686255711 HIVE** across two token accounts. Its primary token vault `GvmtLFoiEZCYfpxXNZmhLEmrdHQEjSQB2EwtEqL7VHFZ` holds 420,579,921.686255707 HIVE; another account holds four raw units. The primary vault was matched to decoded DAMM v2 pool `9ApyYn9ex9pHUMdr7k5B4qRHQsv48ijGuT7nh3Ekpaqg`, owned by program `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`. Do not reimburse the pool authority as an individual holder. Any LP-beneficiary treatment requires a separate rule and position-level accounting.
2. **249 other owners** remain in the draft review, including **16 other off-curve owners**. An off-curve address is not sufficient evidence of ineligibility: it can represent a program-controlled wallet or custody arrangement. They remain in a manual-review queue. On-curve addresses also are not automatically eligible individuals or unique people.
3. **Team/treasury addresses:** no team exclusion list has been supplied. The locally configured staking treasury `3LQuJTTLX9cjvAhRtnYrGJS3qESp494UCnA9UtCrdura` has no nonzero balance in this snapshot. Confirm production treasury configuration; do not infer there is no staking liability.
4. **Three unresolved staking records:** a read-only lookup of the configured Hive database found 1,000,001 active HIVE plus 1,100,000 locked HIVE, totaling **2,100,001 HIVE**. One address also holds 6,852,467.217358790 liquid HIVE; two have no liquid balance. These are database records read after the snapshot, not verified historical beneficial balances. Reconcile deposit/withdrawal signatures, record provenance and custody backing before assigning tiers. Do not add locked amount and its pending-unstake breakdown together; they describe the same funds.

[Pool and custody evidence](tools/hive-migration/local/snapshot-2026-09-21T09-43-40.282Z/custody-review-1789984815345.json) includes operational staking data: keep it internal. The public holder CSV contains only public on-chain balances and unfilled review fields.

## Evidence identity

- Block hash: `8pKWbdX8Z4SBFM32eg55tKodXFJPobB8zhbbgJuQpJM7`.
- Raw account response SHA-256: `d1e69cbf44026925bbb0cbe3161fb2d53c90868ffb214bb5fbbb0896b64a22f5`.
- Holder JSON SHA-256: `793e4e89da7b415628511bdefae0efb9de29c292e96c78cd0c3132abbc9defcb`.
- Holder CSV SHA-256: `061bac03316dd60c7d345f4aa2e36b03bd85ce3fa505c25c40dbaba0f74040b4`.

Preserve these source files. Record classifications and beneficiary corrections in separate versioned files. `minContextSlot` is a lower bound, not a way to request an earlier historical snapshot. Historical-cutoff selection would require a separate verified reconstruction/archive source; it cannot relabel this scan.

Technical references: [Solana getProgramAccounts](https://solana.com/docs/rpc/http/getprogramaccounts), [Solana token-account ownership](https://solana.com/docs/tokens/basics/create-token-account). `getTokenLargestAccounts` is insufficient for this task because it returns only the largest 20 accounts: [official reference](https://solana.com/docs/rpc/http/gettokenlargestaccounts).
