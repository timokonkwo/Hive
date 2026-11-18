# HIVE launch review  -  2026-09-21

**Completed:** HIVE launched successfully at 07:48:16 UTC+1 on 2026-09-21. All 19 fills, metadata, fees, exemptions and actual Pons logo/social rendering verified. See [HIVE_PONS_LAUNCH_RESULT.md](HIVE_PONS_LAUNCH_RESULT.md). The review and pending-signature statements below are historical.

Approval received at approximately 06:43 UTC: the user replied **"Yes proceed"** to the exact launch review and the two stated Pons display limitations. Signing and submission of this reviewed HIVE payload are authorized; operator key import/signing is pending in the user's local Terminal. The reviewed transaction, allocation, hash and expiry remain unchanged. No further approval is needed for this exact payload; expiration or material changes require a refreshed concrete review.

## Verified executor

- Chain: Robinhood 4663.
- Executor: `0x052d938e3e73285dF9416d49ac92B25b3F359718`.
- Operator / launch signer: `0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2`.
- Deployment transaction: `0x8c9cc4288394be8e2cb9bbff928b6fe0fd165810b1d065ebf6d74a89fb0941bb`.
- Deployment receipt, local runtime match and immutable factory/operator verified. Separate deployment signer does not have launch authority.

## Exact unsigned launch

- Review hash: `0x7388439ff8c1f727bd6b5869ef7e04369e197099cdb7b57ee248b2a89fbd014d`.
- Expires **2026-09-21 07:50:07 UTC+1**. Reprepare and review if expired.
- $3,000 buy reference at $2,664.96/ETH: **1.125720461095100864 ETH**, including combined 3% trading charges.
- Pons launch fee: **0.0005 ETH**.
- Maximum transaction gas cost: **0.0003955387709808 ETH**.
- Maximum total transaction spend: **1.126615999866081664 ETH**.
- Operator balance: **1.174822577736602226 ETH**; remaining after maximum spend **0.048206577870520562 ETH**.
- 19 recipients, exact supplied order; operator at position 18. Approximately **39.392821%** total supply. Per-wallet supply strictly descends from **2.790989%** to **1.355623%**; all below 3% and above 0.5%.
- Predicted token: `0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8`.
- Predicted curve: `0x3e7F763CC6E24e7D2B9E90859653595c7f8219F7`.

Live `eth_call` using the deployed executor and actual operator funding passed at block **68589565**. Every simulated output matched the integer quote exactly. Full calldata simulation and gas estimation passed. The executor checked metadata, tax settings, exemptions, absolute token fills and spending; incomplete/refunded buys would revert the launch. This establishes current-state execution, not future transaction inclusion.

[Plan](tools/pons-launch/local/launch-review-1789972833655/launch.plan.json) · [Unsigned transaction](tools/pons-launch/local/launch-review-1789972833655/launch.unsigned.json) · [Simulation](tools/pons-launch/local/launch-review-1789972833655/launch.simulation.json) · [All 19 allocations and minimum outputs](tools/pons-launch/local/launch-review-1789972833655/allocations.json) · [Full manifest](tools/pons-launch/local/launch-review-1789972833655/launch.manifest.json) · [Source/runtime release](tools/pons-launch/local/launch-review-1789972833655/release.verified.json)

## Metadata

- Name / ticker: **Hive Protocol / HIVE**.
- Description: **Discovery and Execution Layer for AI agents on RobinHood.**
- Website: https://uphive.xyz
- X: https://x.com/uphivexyz
- Telegram: https://t.me/uphivexyz
- Discord / Farcaster: explicitly absent.
- Creator fee recipient: `0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19`.
- Creator charge 2%, base charge 1%; buybacks disabled; slippage floor 1%.
- [Hosted image](https://res.cloudinary.com/dgjseefcx/image/upload/v1789939094/hive-tokens/hive-launch-c5b20f0d02418499ee3001e8ebf0feb956b8ab1d32db6dcb1571b0e53e3f52da.jpg): JPEG 1024×1024, 74,299 bytes; download/hash verified during preparation. SHA-256 `c5b20f0d02418499ee3001e8ebf0feb956b8ab1d32db6dcb1571b0e53e3f52da`.

## Remaining launch decision

The inspected Pons V2 UI adapter omits the website link despite correct on-chain metadata. At **06:41:18 UTC**, the live Pons page still displayed **Degraded performance**, warning that backend upgrades may make launches/market data slow or out of date. The hosted JPEG decoded successfully in Pons' browser page context at 1024×1024. Its indexer and actual token-page rendering cannot be proven before creation. Browser image decoding proves image accessibility, not an indexed token page. Evidence: `tools/pons-launch/local/image-browser-check.json`.

The user required metadata and image certainty and has now accepted the two described display limitations. They remain technical limitations despite that acceptance. The approved launch is ready for local operator signing via `tools/pons-launch/local/sign-approved-launch.command`. No private key should be entered into chat; the script uses Foundry's hidden prompt and encrypted keystore.
