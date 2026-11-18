# HIVE escrow implementation result

The **single-admin contracts and automated verifier now enforce proportional allocations**. The selected campaign budget is **7,000,000 new HIVE**, split by reviewed frozen holdings, with a **70% per-holder ceiling**. No escrow deployment, funding, deposit, payout or verifier activation occurred.

The provisional snapshot population holds **582,229,876.983614953 old HIVE** across 247 non-pool candidate addresses at finalized slot **449032979** (21 September 2026, 11:48:43 UTC+1). Sixteen program-controlled addresses still require review. The final reviewed owner allowances determine the immutable denominator; the preview is not an approved claim list.

## What changed

- Solana escrow and Robinhood distributor calculate the same exact proportional payout, rounded down to 18 decimals and capped at 70% of actual old-HIVE surrender. Rust arithmetic avoids overflowing u128 even at maximum u64 holdings and u128 budgets.
- The distributor bounds lifetime allocation by the campaign budget and total committed old HIVE by the denominator. Cancellation releases reserved inventory but does not redistribute an owner's share.
- Partial surrender is an explicit immutable policy: when enabled, actual deposits receive the fixed proportional rate; when disabled, the full reviewed snapshot allowance is required. Zero-payout deposits fail. Deployment inputs leave this choice unset.
- Preparation derives the denominator from reviewed allowances, rejects duplicates, excessive allowances, conflicting totals and obsolete tier configuration. Unresolved program custody cannot silently enter the ordinary-wallet path.
- Registration v3 signatures bind the denominator, budget, partial-surrender policy and exact payout. Updated Borsh encoding, unsigned exports and finalized-state observers use the same terms. Previous tier initialization/account layouts are incompatible; regenerate artifacts.
- Existing exact token transfers, one-time claims, finalized deposit/payment evidence, collection/refund ordering, fee limits and durable transaction recovery remain tested. The verifier defaults to dry-run.

## Verification

| Check | Result |
|---|---|
| EVM adversarial/boundary tests | 24 passed, including two fuzz tests with 256 runs each |
| Real HIVE contract on read-only Robinhood fork | Exact 1,000-HIVE proportional payout and inventory reconciliation passed locally |
| Solana native runtime | 10 passed |
| Compiled Solana SBF runtime | 10 passed with SPL-token runtime calls |
| Rust/JavaScript interoperability and arithmetic | 2 passed |
| JavaScript tooling, proportional math, signatures, evidence and recovery | 36 passed |
| Frozen snapshot | Original hashes, account decoding, supply and owner totals verified |

Exact binary/source hashes and scope are in [verification.json](tools/hive-migration/escrow/verification.json). These checks establish local behavior, not deployed end-to-end operation or an independent security audit. The original tier verification is preserved as historical evidence in the local evidence directory.

## Remaining setup

The allocation checker is implemented locally at `/token/claim`, with `/api/token/claim` for snapshot/balance reads and `/api/token/claim/migration` for the disabled-by-default gateway proxy. The injected-wallet interface, dual signatures, durable submission and status recovery are implemented and fixture-tested. Reviewed allocations, dates, deployed hosting and public launch remain pending. See `HIVE_CLAIM_HANDOFF.md`. Unreviewed allocations remain provisional; the 70% ceiling is not a payout promise.

[HIVE_REIMBURSEMENT_INPUTS.md](HIVE_REIMBURSEMENT_INPUTS.md) tracks final eligibility/custody, partial-surrender and terminal-attempt policy, public admin addresses, funding sources, claim dates and operating terms. Both paid and refunded attempts currently consume the owner's campaign attempt. One operator's honesty, key security and availability are required for cross-chain verification.

Before public deposits: complete independent security review, deploy paused, fund approved inventory, verify deployment/configuration/authorities and rehearse the integrated wallet and operator flow. No independent audit or formal verification is claimed.

See the [implementation guide](tools/hive-migration/escrow/README.md) for commands, signer handling, activation and recovery.
