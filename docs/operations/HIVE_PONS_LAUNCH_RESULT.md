# HIVE launch result  -  2026-09-21

**Hive Protocol / HIVE launched successfully on Robinhood Chain 4663 at 07:48:16 UTC+1.**

- Token: `0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8`.
- Curve: `0x3e7F763CC6E24e7D2B9E90859653595c7f8219F7`.
- Executor / factory-recorded deployer: `0x052d938e3e73285dF9416d49ac92B25b3F359718`.
- Operator / transaction signer: `0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2`.
- Transaction: `0x3ff2f95bc348c6f548046a8c47a023e536e564f26e576c6dd7938c89f13d5205`.
- Successful L2 receipt in block **68594199**; canonical receipt/hash checked. Ethereum batch finality has not been independently established.

[Live Pons page](https://www.ponsfamily.com/launchpad/0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8) · [Explorer transaction](https://robinhoodchain.blockscout.com/tx/0x3ff2f95bc348c6f548046a8c47a023e536e564f26e576c6dd7938c89f13d5205)

## Fills and costs

All **19 buys** executed in the same transaction and L2 block as token creation. Every recipient, purchase amount, fee, tax and token output matched the reviewed plan in the approved order. No partial-fill refunds occurred. All balances at the end of the receipt block exactly matched their fills.

Total purchased supply: **39.3928209873%**. Individual allocations strictly descend from **2.7909893412%** to **1.3556233943%**. Operator is recipient 18 of 19. Every recipient's `snipeTaxExempt` flag was independently checked as true at the receipt block.

| Cost | ETH |
|---|---:|
| Opening buys, including 3% combined trading charges | 1.125720461095100864 |
| Pons launch fee | 0.0005 |
| Actual transaction gas | 0.00027012696291 |
| Actual launch total | **1.126490588058010864** |

Gas used: 5,376,945 at 0.050238 gwei effective price. Opening buys used the approved $3,000 reference at $2,664.96/ETH; USD value is not fixed after that quote. Executor deployment was a separate prior transaction paid by the separate deployment wallet. Operator balance checked after launch: **0.048331989678591362 ETH**.

## Metadata and Pons display

Exact on-chain metadata verified: Hive Protocol / HIVE; 1,000,000,000 supply, 18 decimals; description **Discovery and Execution Layer for AI agents on RobinHood.**; website https://uphive.xyz; X https://x.com/uphivexyz; Telegram https://t.me/uphivexyz; Discord/Farcaster explicitly empty; approved Cloudinary logo URI. Creator fee wallet `0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19`, creator tax 200 bps, base fee 100 bps, buybacks disabled.

At **07:50:38 UTC+1**, the actual indexed Pons token page visibly displayed the correct logo, name, ticker, description, X and Telegram links, supply and 2% creator tax. Both actual token images loaded at 1024×1024. This was the real token page, with no injected image or metadata. The website link remains omitted by Pons' UI despite correct on-chain storage. Pons' degraded-performance/backend-upgrade banner remains present; page data can be delayed.

## Evidence

- [Verified launch receipt and all 19 exact balances](tools/pons-launch/local/launch-review-1789972833655/launch.receipt-verified.json)
- [Exemptions, fee settings and actual gas audit](tools/pons-launch/local/launch-review-1789972833655/launch.postlaunch-audit.json)
- [Exact approved plan and allocation schedule](tools/pons-launch/local/launch-review-1789972833655/launch.plan.json)
- [Pons browser findings](tools/pons-launch/local/hive-live-pons.json)
- [Actual Pons token-page screenshot](tools/pons-launch/local/hive-live-pons.png)

Submission journal preserved under `tools/pons-launch/local/submissions/0x31a9fb923f1bcb2ceb1221dbdc06b94a6a749de2-1.json`. Its original pre-send status is intentionally retained as immutable submission evidence; the separate verified receipt resolves the outcome. No replacement or duplicate launch was submitted.
