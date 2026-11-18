# Completed launch inputs review

2026-09-21 revision: operator added as recipient 18 of 19. Current allocations are in HIVE_PONS_ALLOCATION_DRAFT.md and hive.manifest.draft.json. The 18-recipient schedule/evidence below is historical. Total draft buy ETH unchanged. Exact 19-recipient local fork rehearsal passed, including metadata/image URI, exemptions, descending holdings and allocation limits; local suite also passed 25 Solidity and 16 JavaScript tests. Local fork launch execution measured 5,330,642 gas, not a production Nitro fee estimate. Nothing signed or broadcast.

Latest recheck (2026-09-20 ~21:33 UTC): all 18 recipient wallets now have native gas. Operator: 1.175563645838602226 ETH at block 68,264,082. Current draft buys + launch fee leave 0.010950913838602226 ETH before gas; USD conversion and production gas quote remain pending. Exact-input 18-wallet fork passed with all stored metadata/image URI, exemptions, exact fills and allocation bounds verified. Cloudinary bytes/hash/MIME and Chrome decoding in Pons page context passed. See tools/pons-launch/PONS_METADATA_RESEARCH.md for details and the current Pons degraded-performance notice. Earlier balance and pending-fork findings below are historical and superseded by this recheck.

Reviewed 2026-09-20. This is preparation only. User approval is required before signing; nothing has been signed or broadcast. Draft manifest: tools/pons-launch/hive.manifest.draft.json. Missing transaction fields intentionally prevent it from passing final validation.

## Confirmed inputs

- Hive Protocol / HIVE; symbol follows the latest input file, overriding the earlier mixed-case example.
- Description preserved exactly: Discovery and Execution Layer for AI agents on RobinHood.
- Website and X retained; Telegram retained; Discord and Farcaster explicitly null.
- All 20 supplied addresses pass checksum validation and are distinct: 18 ordered recipients, one operator, one creator-fee recipient.
- USD 3,000 opening buys, 3% combined charge, buybacks off, 1% slippage, 10-minute review expiry. USD 50–100 additional overhead requested.
- Operator exemption requested and now included in executor logic alongside all buying recipients; duplicates avoided if operator is itself a recipient.
- Hosted image: https://res.cloudinary.com/dgjseefcx/image/upload/v1789939094/hive-tokens/hive-launch-c5b20f0d02418499ee3001e8ebf0feb956b8ab1d32db6dcb1571b0e53e3f52da.jpg
- Download verification: original JPEG, 1024×1024, 74,299 bytes, SHA-256 c5b20f0d02418499ee3001e8ebf0feb956b8ab1d32db6dcb1571b0e53e3f52da. Verified at 2026-09-20T21:18:16.614Z. This does not prove future Pons UI rendering.

## Ordered draft allocations

Amounts still use the previous USD 2,577.07/ETH reference, not a current executable quote. Live Coinbase and Kraken price endpoints timed out, including network-enabled retries. Refresh the price and recalculate exact integer amounts before preparing transactions.

| Order | Recipient | Draft supply % | Draft ETH |
|---|---|---:|---:|
| 1 | 0x388b1FE022e558189b7A8f81fd2eA4D44d8e162e | 2.949412% | 0.052635021 |
| 2 | 0x6BeC0e8C3bE9529Efe08E901F5CfE7cE8f916860 | 2.865143% | 0.054287755 |
| 3 | 0xcF822ab55ee9902B0b1F2F981C488A6bb7769463 | 2.780874% | 0.055945758 |
| 4 | 0x054e47c8DEF7Efa65Bf9F5bA4e3476c013482298 | 2.696605% | 0.057600250 |
| 5 | 0x340b5d62bAdB3b2dc71Cb2799c58bEbFF51Ff45B | 2.612336% | 0.059241070 |
| 6 | 0xd9dba9F0E6D3f1AC8b7F36E15ccba4aC6f740E95 | 2.528067% | 0.060856552 |
| 7 | 0x39F79d21304a67f06034ef4bDD8c98F224EDc560 | 2.443798% | 0.062433416 |
| 8 | 0xDde06f7A29E8533cb8649fAd97F6593c2415715B | 2.359530% | 0.063956665 |
| 9 | 0x5dD795542346194294bc08cc8dd4EedCb7dFAc3f | 2.275261% | 0.065409496 |
| 10 | 0x460DCD30245Ff0cc922353eB9B3E9F1452eAa4ce | 2.190992% | 0.066773236 |
| 11 | 0xAdba0Ef849F61508b5b612E6171FBF28011E43A3 | 2.106723% | 0.068027310 |
| 12 | 0xA490EE4c729224f28b6Fdf112d7574fd62605093 | 2.022454% | 0.069149249 |
| 13 | 0x43EaB2977aD90c80aDd025C9de9c816FaE44a929 | 1.938185% | 0.070114745 |
| 14 | 0x1bc377126216C5DDb97859B70D78dDEa5dDB9429 | 1.853916% | 0.070897774 |
| 15 | 0x10b33dceDd04Cf1A9c0503ebE9B2F13D2b3dF873 | 1.769647% | 0.071470789 |
| 16 | 0xd71a68f3701F49c0D6b328167de0124bA301B033 | 1.685378% | 0.071804995 |
| 17 | 0x3c764C64cA2F63d92538ddf649C71338dfE2Ef62 | 1.601109% | 0.071870728 |
| 18 | 0xA5800276Fe1B92f11fcd4Dc913e36578042a7724 | 1.516840% | 0.071637923 |

## Read-only chain findings

Pons config refreshed at block 68,253,386: supply 1 billion tokens, phantom quote 1.68 ETH, graduation threshold 4.2 ETH, launch fee 0.0005 ETH, curve base fee 1%, hook base fee 1%, maximum creator tax 10%, opening tax starts at 99% for 3 seconds. Requested creator tax remains 2%.

Balances read through a batch of latest-state calls near block 68,253,115 (not a single pinned-block snapshot):

- Operator: 1.167926612803158240 ETH.
- At the OLD reference, draft purchases total 1.164112732 ETH. After these and the 0.0005 ETH launch fee, 0.003313880803158240 ETH remains before deployment/launch gas (about USD 8.54 at the old reference). This does not match a USD 50–100 overhead cushion at that reference; current funding sufficiency requires a refreshed quote and gas estimate.
- Recipient wallets 4–8 and 13–17 currently have zero native ETH. These wallets can receive launch tokens without gas; later selling/transferring requires gas. The input's statement that all recipient gas funding is done is not confirmed by current balances.
- Fee recipient currently has zero ETH; receiving fees does not itself require native gas.

## Remaining preparation gates

- Refresh ETH/USD; calculate exact budget and descending allocations within 0.5%–3%, preserving address order. Review live funding and gas.
- Obtain final salt, deployable executor address prediction, fee/gas ceilings and time-limited expiry during transaction preparation. No fabricated values in the draft.
- Review matching upstream deployed source/ABI and runtime hashes as required by the launch checklist.
- Run an 18-wallet fork rehearsal of the revised executor; final metadata, exemptions and exact fills need actual execution verification. Existing fork fixture is still 15-wallet evidence and was skipped in this local test run.
- Resolve Pons website-display limitation already recorded in the checklist.
- Present exact deployment and launch payloads for user approval before signing.

Local validation after operator-exemption change: 25 Solidity tests and 16 JavaScript tests passed. These are local fixture results, not a mainnet simulation or approval.
