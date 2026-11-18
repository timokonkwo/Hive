# Hive Protocol Pons Launch Inputs

Status: **launched and verified 2026-09-21**. Token `0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8`; see HIVE_PONS_LAUNCH_RESULT.md. Inputs below are the retained launch configuration; any old TODOs are historical. Do not paste private keys, seed phrases, keystore passwords, or signed transaction blobs into this file.

## Token Metadata

Token name: Hive Protocol

Ticker: HIVE

Recommended description:

> Hive is the AI agent marketplace where clients post tasks, compare proposals, review delivered work, and autonomous agents earn for development, research, design, content, security, and analysis.

Current short description, for comparison:

> Discovery and Execution Layer for AI agents.

Final description to use:

```text
Discovery and Execution Layer for AI agents on RobinHood.
```

Website: https://uphive.xyz

X/Twitter: https://x.com/uphivexyz

Telegram: https://t.me/uphivexyz

Discord: none

Farcaster: none

Token image local file: public/hive-token-launch.jpg

Token image hosted URI: https://res.cloudinary.com/dgjseefcx/image/upload/v1789939094/hive-tokens/hive-launch-c5b20f0d02418499ee3001e8ebf0feb956b8ab1d32db6dcb1571b0e53e3f52da.jpg

## Wallets

Operator / funding wallet address: 0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2

Executor deployment signer (deployment gas only): 0x260952112ce9fCBF8E008B208C59B651D117557b

Deployed executor (receipt/runtime/operator verified 2026-09-21): 0x052d938e3e73285dF9416d49ac92B25b3F359718

Confirmed 2026-09-21: the deployment signer does not replace the operator or any recipient. Operator remains recipient 18 of 19.

Creator fee recipient wallet address: 0x4a7c1d6872c6B7D0AAC1ab2311F15b2D750A9B19

Should the operator wallet also be exempt from sniper tax? yes

Recipient wallets for opening buys, in final order:

```text
1. 0x388b1FE022e558189b7A8f81fd2eA4D44d8e162e
2. 0x6BeC0e8C3bE9529Efe08E901F5CfE7cE8f916860
3. 0xcF822ab55ee9902B0b1F2F981C488A6bb7769463
4. 0x054e47c8DEF7Efa65Bf9F5bA4e3476c013482298
5. 0x340b5d62bAdB3b2dc71Cb2799c58bEbFF51Ff45B
6. 0xd9dba9F0E6D3f1AC8b7F36E15ccba4aC6f740E95
7. 0x39F79d21304a67f06034ef4bDD8c98F224EDc560
8. 0xDde06f7A29E8533cb8649fAd97F6593c2415715B
9. 0x5dD795542346194294bc08cc8dd4EedCb7dFAc3f
10. 0x460DCD30245Ff0cc922353eB9B3E9F1452eAa4ce
11. 0xAdba0Ef849F61508b5b612E6171FBF28011E43A3
12. 0xA490EE4c729224f28b6Fdf112d7574fd62605093
13. 0x43EaB2977aD90c80aDd025C9de9c816FaE44a929
14. 0x1bc377126216C5DDb97859B70D78dDEa5dDB9429
15. 0x10b33dceDd04Cf1A9c0503ebE9B2F13D2b3dF873
16. 0xd71a68f3701F49c0D6b328167de0124bA301B033
17. 0x3c764C64cA2F63d92538ddf649C71338dfE2Ef62
18. 0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2
19. 0xA5800276Fe1B92f11fcd4Dc913e36578042a7724
```

## Opening Buy Plan

Opening-buy budget: **USD 3,000**, including the 3% trading charge. Additional overhead budget: **USD 50–100** for executor deployment, launch fee and gas, subject to actual estimates.

Total ETH for opening buys (calculated during final preparation):

```text
Refresh ETH/USD before preparation and convert the USD 3,000 buy budget. Previous reference: 1.1641127326770324 ETH at USD 2,577.07/ETH; not a final transaction amount.
```

Per-wallet ETH amounts:

```text
Generate 19 sequential buy amounts in exactly the address order above. Target token holdings must strictly decrease from wallet 1 to wallet 19. The operator is recipient 18 (second to last). Do not sort addresses or split ETH equally. See HIVE_PONS_ALLOCATION_DRAFT.md for the provisional schedule.
```

Maximum target per recipient:

```text
At most 3% of total supply per recipient; minimum 0.5%. Preserve strictly descending token holdings. Validate exact integer quotes and simulation results against these limits before signing.
```

Slippage tolerance:

```text
1%
```

Total buy must remain below Pons graduation threshold:

```text
yes
```

## Tax And Launch Settings

Creator tax:

```text
2%
```

Expected total trading tax:

```text
3%
```

Buybacks:

```text
off
```

Fee wallet:

```text
same as creator fee recipient
```

Launch review expiry / signing deadline:

```text
10 minutes
```

## Funding Readiness

Operator wallet will hold total buy ETH, Pons launch fee, and gas:

```text
yes
```

Recipient wallets will be funded with RH-chain ETH for later sells/transfers:

```text
yes
```

Recipient gas funding method:

```text
already done
```

## Execution Preference

Choose one:

```text
you choose, but i have to approve everything before signing.
```

## Notes

- The final manifest should reject missing metadata, empty optional-social ambiguity, duplicate recipients, and unsafe tax or buy settings.
- The hosted image URI must be checked before launch. A local image passing validation does not prove Pons can fetch it.
- The live Pons/Robinhood configuration must be re-read immediately before preparing any signed payload.
- No mainnet executor deployment, token creation, signing, or broadcast should happen from this file alone.
