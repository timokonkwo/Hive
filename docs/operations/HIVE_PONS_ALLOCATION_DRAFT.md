# Hive opening allocation draft

Updated 2026-09-21. Planning only, not a signed or approved transaction.

19 recipients in supplied order. Operator is recipient 18; former recipient 18 is now recipient 19. All other addresses retain their positions.

USD 3,000 opening-buy target plus USD 50–100 overhead. Draft total remains 1.164112732 ETH using the previous USD 2,577.07/ETH reference; refresh the quote before final preparation. Curve reference: 1 billion supply, 1.68 ETH phantom reserve and 3% combined charge.

Descending token weights: 35 through 17, sum 494. All draft allocations meet the 0.5%–3% bounds. ETH inputs were calculated in integer wei with the remaining budget assigned to the last buy; exact quote results were checked. These remain provisional amounts.

| Order | Address | Supply % | Draft ETH |
|---|---|---:|---:|
| 1 | 0x388b1FE022e558189b7A8f81fd2eA4D44d8e162e | 2.847914% | 0.050770597281930757 |
| 2 | 0x6BeC0e8C3bE9529Efe08E901F5CfE7cE8f916860 | 2.766545% | 0.052253775503664248 |
| 3 | 0xcF822ab55ee9902B0b1F2F981C488A6bb7769463 | 2.685176% | 0.053732093658873566 |
| 4 | 0x054e47c8DEF7Efa65Bf9F5bA4e3476c013482298 | 2.603807% | 0.055196856385923721 |
| 5 | 0x340b5d62bAdB3b2dc71Cb2799c58bEbFF51Ff45B | 2.522438% | 0.056638147254250227 |
| 6 | 0xd9dba9F0E6D3f1AC8b7F36E15ccba4aC6f740E95 | 2.441069% | 0.058044742338248594 |
| 7 | 0x39F79d21304a67f06034ef4bDD8c98F224EDc560 | 2.359700% | 0.059404031849065248 |
| 8 | 0xDde06f7A29E8533cb8649fAd97F6593c2415715B | 2.278331% | 0.060701954148785159 |
| 9 | 0x5dD795542346194294bc08cc8dd4EedCb7dFAc3f | 2.196962% | 0.061922947272345283 |
| 10 | 0x460DCD30245Ff0cc922353eB9B3E9F1452eAa4ce | 2.115593% | 0.063049923898071561 |
| 11 | 0xAdba0Ef849F61508b5b612E6171FBF28011E43A3 | 2.034224% | 0.064064276493552119 |
| 12 | 0xA490EE4c729224f28b6Fdf112d7574fd62605093 | 1.952855% | 0.064945920059377173 |
| 13 | 0x43EaB2977aD90c80aDd025C9de9c816FaE44a929 | 1.871486% | 0.065673380421641879 |
| 14 | 0x1bc377126216C5DDb97859B70D78dDEa5dDB9429 | 1.790117% | 0.066223936290087123 |
| 15 | 0x10b33dceDd04Cf1A9c0503ebE9B2F13D2b3dF873 | 1.708748% | 0.066573823191498166 |
| 16 | 0xd71a68f3701F49c0D6b328167de0124bA301B033 | 1.627379% | 0.06669850678487633 |
| 17 | 0x3c764C64cA2F63d92538ddf649C71338dfE2Ef62 | 1.546010% | 0.066573031839012815 |
| 18 | 0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2 | 1.464641% | 0.066172451184554552 |
| 19 | 0xA5800276Fe1B92f11fcd4Dc913e36578042a7724 | 1.383272% | 0.065472336144241479 |

The operator funds the whole transaction and also receives the second-to-last token allocation. Its exemption is included only once. The executor contract remains the token deployer recorded by Pons. All buys occur in one transaction.

Final metadata, public image checks, live configuration, gas/funding and unsigned simulation must be rechecked before signing.
