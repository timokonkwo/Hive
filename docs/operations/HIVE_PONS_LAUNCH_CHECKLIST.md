# Hive Protocol ($Hive)  -  Pons CLI launch checklist

Status: **HIVE launched and verified on Robinhood mainnet at 07:48:16 UTC+1, 2026-09-21.** All 19 fills, metadata, exemptions, fees and Pons image/social rendering passed. See HIVE_PONS_LAUNCH_RESULT.md. Historical preparation deadlines below no longer apply.

## Agreed launch

- [x] Name `Hive Protocol`, symbol `HIVE` (latest completed input file).
- [x] Native ETH / Robinhood Chain 4663 / Pons V2.
- [x] Creator tax 2%, base trading fee 1%; buybacks off.
- [x] Atomic direct-recipient buys: 19 wallets (operator at position 18) in supplied order, strictly descending target holdings, maximum 3% and minimum 0.5% of supply each.
- [x] USD 3,000 opening buys, including trading charges; USD 50–100 additional launch overhead, subject to gas estimates and refreshed ETH/USD conversion.
- [x] One funding/operator wallet, executor recorded as deployer, separate explicit fee wallet.
- [x] Per-wallet ETH budgets; below-graduation launch; full fills or revert.
- [x] Website `https://uphive.xyz`, X `https://x.com/uphivexyz`, Telegram `https://t.me/uphivexyz`.
- [x] Live test token no longer mandatory, per user instruction. Local tests and unsigned simulation remain required.

## Inputs to complete

- [x] Final description copied exactly from completed inputs: Discovery and Execution Layer for AI agents on RobinHood.
- [x] User-supplied launch image: `public/hive-token-launch.jpg`, JPEG 1024×1024, 74,299 bytes.
- [x] Cloudinary HTTPS URI downloaded and verified against approved SHA-256; Pons rendering remains a post-launch check.
- [x] Discord/Farcaster explicitly absent; Telegram retained per completed inputs.
- [ ] Public operator/funding address and signing method (hardware or encrypted local keystore).
- [ ] Explicit creator-fee wallet address and control verification.
- [ ] Ordered list of 19 unique public recipient addresses and exact ETH budgets.
- [ ] Deployment budget, launch budget, total combined ceiling, transaction gas limit evidence, fee cap and gas reserves.
- [ ] Salt and launch timing; final review expires within one hour.

## Implementation and evidence

- [x] Isolated executor and CLI in `tools/pons-launch/`; app launch gate unchanged.
- [x] Full metadata manifest; missing fields rejected; unused socials explicitly null.
- [x] In-transaction metadata read-back for name/symbol/supply/decimals/image/description/all five socials.
- [x] Atomic exemptions, 200-bps creator tax, both 100-bps base fees, economics pin and sniper-setting checks.
- [x] Sequential quotes, absolute per-wallet token floors and refund/partial-fill rejection.
- [x] Reverting unsigned preview, exact unsigned simulation, export and explicit interactive signing.
- [x] Signed-payload comparison and submission journal before broadcast; no automatic retry on unknown outcome.
- [x] Receipt verification for same-transaction creation/fills, actual amounts/fees, metadata and creator fee wallet.
- [x] Foundry rollback/negative tests and JavaScript validation/signature tests.
- [x] Deployed-Pons local fork test: 15 recipient purchases and every metadata field verified. No mainnet writes.
- [x] Localhost CLI integration: unsigned deployment/preparation, offline signing and complete receipt reconciliation.

## Before any real deployment or launch

- [x] Read-only executor deployment review prepared, exact envelope simulated on production RPC, and refreshed 19-wallet allocation rehearsed on a local fork. See HIVE_PONS_DEPLOYMENT_REVIEW.md. Review expires; no signing approval or source-verification clearance is implied.

- [x] Resolved upstream source provenance through Sourcify API v2; source hashes/ABI shapes and executable runtime comparisons passed for all five Pons dependencies. Hook/escrow compiler metadata differences documented in tools/pons-launch/SOURCE_VERIFICATION.md; release.verified.json saved.
- [x] User explicitly accepted Pons website-link omission and degraded indexing/display risk with "Yes proceed" after the final launch review. These technical limitations remain.
- [x] Final manifest and image reviewed; all metadata/social fields explicitly set. See HIVE_PONS_FINAL_LAUNCH_REVIEW.md.
- [x] Executor deployed with approved signer 0x260952112ce9fCBF8E008B208C59B651D117557b; runtime and immutable operator/factory verified. Executor 0x052d938e3e73285dF9416d49ac92B25b3F359718; transaction 0x8c9cc4288394be8e2cb9bbff928b6fe0fd165810b1d065ebf6d74a89fb0941bb.
- [x] Fresh production-RPC simulation using deployed executor, real funding, final metadata and exact 19-recipient schedule passed at block 68589565. See HIVE_PONS_FINAL_LAUNCH_REVIEW.md; expires 2026-09-21 07:50:07 UTC+1.
- [x] Historical exact-input 18-wallet local fork passed with all metadata/image URI, exact fills, exemptions, descending holdings and supply bounds; production Nitro gas estimate still required.
- [x] Rechecked live Pons page at 06:41:18 UTC: degraded-performance/backend-upgrade banner remains; image decoded at 1024×1024. Indexing/display readiness remains unresolved and needs explicit acceptance or resolution before launch.
- [x] Exact predicted/simulated holdings descend from 2.790989% to 1.355623%, supplied address order preserved.
- [x] Exact full live simulation/estimate passed: no incomplete fill, no graduation crossing; gas/fee caps and real balance checked. Future inclusion is not guaranteed.
- [x] User approved the concrete launch review (19 allocations, full manifest and exact plan) with "Yes proceed". Hash 0x7388439ff8c1f727bd6b5869ef7e04369e197099cdb7b57ee248b2a89fbd014d, expires 07:50:07 UTC+1. Operator local signature pending.
- [x] User signed locally; exact reviewed HIVE payload broadcast once and verified. Transaction 0x3ff2f95bc348c6f548046a8c47a023e536e564f26e576c6dd7938c89f13d5205.

## After launch

- [x] Submission outcome resolved with successful canonical receipt; no replacement submitted.
- [x] Factory creation, all 19 exact fills, zero refunds and exact end-of-block balances verified.
- [x] Complete metadata, fee wallet, 1% base / 2% creator fees, disabled buyback and all 19 exemption flags verified; L2 receipt block 68594199.
- [ ] Check Ethereum batch/finality separately from sequencer confirmation.
- [x] Actual indexed Pons page displays name/ticker, correct image, description, X and Telegram. Website remains omitted by Pons UI; user accepted before launch. Screenshot and browser evidence saved.
- [ ] Publish verified token address and team wallet disclosure.
- [ ] Update `lib/hive-launch.ts` with reviewed actual token/trade destinations only after verification. Staking is a separate integration.

Operator commands and recovery procedure: `tools/pons-launch/README.md`. Incomplete example manifests and unreviewed release files intentionally cannot sign or broadcast.

- [x] Current 19-recipient manifest passed a fresh local Pons fork with operator at position 18, unchanged total draft ETH, descending allocations, 0.5%–3% limits, exact metadata/image URI and exemptions. Production gas and final signed-plan review remain pending.
