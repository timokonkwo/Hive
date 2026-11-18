# Hive executor deployment review  -  2026-09-21

## Completed deployment  -  06:36 UTC

The user signed the approved deployment locally, then confirmed completion. The exact signature was validated and broadcast once with a durable submission journal. Receipt status is success in Robinhood L2 block **68587376**, using **2,806,918 gas**. Ethereum batch finality is not established by this check.

- Transaction: `0x8c9cc4288394be8e2cb9bbff928b6fe0fd165810b1d065ebf6d74a89fb0941bb`.
- Executor: `0x052d938e3e73285dF9416d49ac92B25b3F359718`.
- Deployed runtime matches the local compiled artifact; immutable factory and operator match the reviewed constructor.
- Operator remains `0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2`.
- [Verified receipt](tools/pons-launch/local/deployment-review-1789972093925/deployment.receipt-verified.json).

**Executor deployment only is complete. No HIVE token has been created or bought.** Pending-signature language below is historical and superseded by this result.

## Current approved roles and replacement unsigned review  -  06:28 UTC

Signing-tool fix at 06:32 UTC: Foundry's imported encrypted keystore omits optional `address` metadata. The original local helper incorrectly reported this as a wallet mismatch before signing. It now derives the public address through `cast wallet address --keystore` with a hidden password prompt, verifies it against the approved signer, then separately prompts for the password to sign. Existing encrypted keystore is reused; no key re-import needed. All 18 CLI tests pass. The transaction and review hash are unchanged by this fix.

User approved executor deployment and explicitly selected **0x260952112ce9fCBF8E008B208C59B651D117557b as deployment signer only**. Operator remains **0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2**, recipient 18 of 19. Nothing signed or broadcast yet; local hidden key entry is pending. This section supersedes all transaction values and approval status in the historical review below.

- Deployment signer balance: 0.00074 ETH; nonce 0.
- Predicted executor: **0x052d938e3e73285dF9416d49ac92B25b3F359718**.
- Constructor operator and factory unchanged. Transaction value: zero ETH.
- Estimated gas: 2,830,362; gas limit: 3,396,435; maximum fee: 0.060792 gwei.
- Maximum deployment gas cost: **0.00020647607652 ETH**, about **$0.55**.
- Review hash: `0x6c11d3192286934d88f480c913a9e30c319626b96fc9664c38bbefb0e86c203d`.
- Expires: **07:37:56 UTC+1**, 2026-09-21. Deadline is enforced by tooling, not by on-chain CREATE.
- Live exact unsigned deployment simulation, source runtime checks, and hosted image hash verification passed. Seventeen CLI tests passed, including separate signer funding, launch authority and CREATE-address enforcement.

[Current plan](tools/pons-launch/local/deployment-review-1789972093925/deployment.plan.json) · [Current unsigned transaction](tools/pons-launch/local/deployment-review-1789972093925/deployment.unsigned.json) · [Current simulation](tools/pons-launch/local/deployment-review-1789972093925/deployment.simulation.json) · [Current balances and buy reference](tools/pons-launch/local/deployment-review-1789972093925/summary.json)

Fresh $3,000 buy reference: 1.122120358629666618 ETH at $2,673.51/ETH, approximately 39.316372% supply across the same 19 recipients. Operator balance: 1.174822577736602226 ETH; after buys and 0.0005 ETH launch fee, 0.052202219106935608 ETH remains before launch gas. Deployment gas comes from the separate signer. These are unsigned references, not a token-launch authorization.

Run the local `tools/pons-launch/local/sign-approved-executor.command` in your own Terminal for hidden key import and deployment signing. It saves an encrypted keystore and a signed transaction locally. Nothing is broadcast by that command. Return to the conversation after signing for transaction submission and receipt verification under the existing executor-deployment authorization.

## Historical review  -  superseded

Status: source-provenance verification resolved; exact unsigned deployment prepared and live simulation passed. **Awaiting user approval before signing.** Nothing signed, broadcast or deployed. This review supersedes the earlier expired review.

## Approval scope

Deploy the operator-only HiveLaunchExecutor on Robinhood Chain 4663. This transaction sends zero ETH value to the new contract and pays gas only. It does not create HIVE or execute token buys. HIVE launch preparation and approval are separate.

- Operator: 0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2
- Factory constructor argument: 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e
- Predicted executor: 0x7D4615F49299Ef8A990d3d21B7CCb39f29B42C9A
- Operator nonce: 0; no pending transaction during preparation
- Estimated gas: 2830362
- Transaction gas limit: 3396435 (20% reserve)
- Maximum fee per gas: 0.060768 gwei
- Maximum transaction gas cost: **0.00020639456208 ETH**, approximately **USD 0.55** at the reference price
- Review hash: 0xf3c09e675ac344e7f73614d74753c58624f69961e0d80f0fe2473075aeece71c
- Review expires: 2026-09-21T06:25:50.000Z, **07:25:50 UTC+1**. Refresh and review the new hash if expired; this is a tooling deadline, not an on-chain CREATE expiry.

[Exact plan](tools/pons-launch/local/deployment-review-1789971366511/deployment.plan.json) · [unsigned envelope](tools/pons-launch/local/deployment-review-1789971366511/deployment.unsigned.json) · [simulation](tools/pons-launch/local/deployment-review-1789971366511/deployment.simulation.json) · [verified upstream release](tools/pons-launch/local/deployment-review-1789971366511/release.verified.json)

## Source verification

Sourcify API v2 supplied the verified sources missing from its legacy repository API. Factory, deployer and forwarder are exact matches. Hook and escrow executable code matches with documented compiler-CBOR differences; immutable fields are normalized only at declared slots. All saved source hashes and the CLI's read ABI shapes were checked. Live code hashes were revalidated during this preparation. Details: [SOURCE_VERIFICATION.md](tools/pons-launch/SOURCE_VERIFICATION.md).

This establishes source provenance and executable runtime compatibility; it is not a full independent security audit. Our executor still needs post-deployment runtime and immutable verification before the launch release can include it.

## Opening-buy reference (not approved by executor deployment)

USD 2666.09/ETH from CoinGecko at 2026-09-21T06:13:20.000Z. Refreshed buys: **1.125243333870949592 ETH** for USD 3,000, including 3% combined charge; approximately **39.382700%** of supply.

Operator balance: 1.175563645838602226 ETH. Pons launch fee: 0.0005 ETH. Remaining after buys, launch fee and executor deployment maximum: **0.049613917405572634 ETH**, before production launch gas. Final launch gas/metadata simulation requires the deployed executor. This conversion is not a locked exchange rate.

| Order | Recipient | Reference ETH buy | Expected supply % |
|---|---|---:|---:|
| 1 | 0x388b1FE022e558189b7A8f81fd2eA4D44d8e162e | 0.049713507414687113 | 2.790272% |
| 2 | 0x6BeC0e8C3bE9529Efe08E901F5CfE7cE8f916860 | 0.051104277052895302 | 2.710550% |
| 3 | 0xcF822ab55ee9902B0b1F2F981C488A6bb7769463 | 0.052485106785869418 | 2.630828% |
| 4 | 0x054e47c8DEF7Efa65Bf9F5bA4e3476c013482298 | 0.053847412815589223 | 2.551106% |
| 5 | 0x340b5d62bAdB3b2dc71Cb2799c58bEbFF51Ff45B | 0.055181481238244275 | 2.471384% |
| 6 | 0xd9dba9F0E6D3f1AC8b7F36E15ccba4aC6f740E95 | 0.056476397565622526 | 2.391662% |
| 7 | 0x39F79d21304a67f06034ef4bDD8c98F224EDc560 | 0.057719985393867717 | 2.311940% |
| 8 | 0xDde06f7A29E8533cb8649fAd97F6593c2415715B | 0.058898758232555296 | 2.232218% |
| 9 | 0x5dD795542346194294bc08cc8dd4EedCb7dFAc3f | 0.059997889169195046 | 2.152496% |
| 10 | 0x460DCD30245Ff0cc922353eB9B3E9F1452eAa4ce | 0.061001203697556345 | 2.072774% |
| 11 | 0xAdba0Ef849F61508b5b612E6171FBF28011E43A3 | 0.061891201640590958 | 1.993052% |
| 12 | 0xA490EE4c729224f28b6Fdf112d7574fd62605093 | 0.062649114595363794 | 1.913330% |
| 13 | 0x43EaB2977aD90c80aDd025C9de9c816FaE44a929 | 0.063255005650039504 | 1.833607% |
| 14 | 0x1bc377126216C5DDb97859B70D78dDEa5dDB9429 | 0.063687918190449971 | 1.753885% |
| 15 | 0x10b33dceDd04Cf1A9c0503ebE9B2F13D2b3dF873 | 0.063926080334173468 | 1.674163% |
| 16 | 0xd71a68f3701F49c0D6b328167de0124bA301B033 | 0.063947170805070945 | 1.594441% |
| 17 | 0x3c764C64cA2F63d92538ddf649C71338dfE2Ef62 | 0.063728650793145909 | 1.514719% |
| 18 | 0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2 | 0.063248164446384753 | 1.434997% |
| 19 | 0xA5800276Fe1B92f11fcd4Dc913e36578042a7724 | 0.062484008049648029 | 1.355275% |

The operator remains recipient 18 of 19. Every allocation is below 3%, above 0.5%, and strictly descending. This refreshed reference has integer quote validation; previous successful local fork evidence used the prior quote. Rehearse/re-simulate the exact final launch payload after deployment before launch approval.

## Metadata and image

Hive Protocol / HIVE. Description preserved: "Discovery and Execution Layer for AI agents on RobinHood.". Website https://uphive.xyz; X https://x.com/uphivexyz; Telegram https://t.me/uphivexyz; Discord/Farcaster absent. Fee wallet 0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19; 2% creator charge, 1% base charge, buybacks off, 1% slippage floor.

Image: https://res.cloudinary.com/dgjseefcx/image/upload/v1789939094/hive-tokens/hive-launch-c5b20f0d02418499ee3001e8ebf0feb956b8ab1d32db6dcb1571b0e53e3f52da.jpg

The exact hosted image passed preparation-time download/hash checks again. Original JPEG 1024×1024, 74,299 bytes; SHA-256 c5b20f0d02418499ee3001e8ebf0feb956b8ab1d32db6dcb1571b0e53e3f52da. Previous Chrome page-context decoding passed. Pons currently displays a degraded-performance banner, and its inspected V2 adapter omits the website link. These concern the eventual launch's indexed display and remain open; executor deployment creates no token page.

No private key is needed for review. Signing requires user approval plus their chosen local/hardware/external signing method. Never paste private keys or seed phrases into chat or these artifacts.
