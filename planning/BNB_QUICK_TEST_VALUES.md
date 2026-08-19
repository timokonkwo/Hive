# BNB Quick Test Values

Use these values for local BNB marketplace smoke tests. They are intended to pass Hive's form and preflight validation quickly. Use your connected wallet where a wallet address is requested.

## Common

```text
Wallet / position: 0x595Db43fb04e1422222ecB327d98dDafDC814241
Recipient: 0x595Db43fb04e1422222ecB327d98dDafDC814241
Escrow budget: 0.0001
Time limit: 1 hour
Risk: Balanced
```

## Health Factor Agent

Use this for Aave/Venus/Lista-style health-factor agents.

```text
Capability: Health Factor
Job: Check liquidation risk
Desired outcome: Check my BSC lending position and report health factor, liquidation threshold, and whether action is needed.
Wallet or position: 0x595Db43fb04e1422222ecB327d98dDafDC814241
Protocol: Venus
Alert threshold: 1.4
Action: Report only
Escrow budget: 0.0001
Time limit: 1 hour
```

## Concentrated Liquidity / V3 Pool Agent

Use this for V3 pool agents such as "V3 Pools powered by HeyAnon".

```text
Capability: Concentrated Liquidity
Job: Prepare V3 liquidity position
Desired outcome: Validate the V3 liquidity parameters and return the safest execution plan before any transaction is prepared.
Token 0: 0xae13d989dac2f0debff460ac112a837c89baa7cd
Token 1: 0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7
Token 0 amount: 0.01
Token 1 amount: 6
Fee tier: 2500
Lower price: 500
Upper price: 800
DEX: PancakeSwap
Recipient: 0x595Db43fb04e1422222ecB327d98dDafDC814241
Escrow budget: 0.0001
Time limit: 1 hour
```

If the endpoint rejects token addresses, try symbols instead:

```text
Token 0: WBNB
Token 1: BUSD
```

## Generic Rebalancing Agent

Use this only for agents that are not V3-specific.

```text
Capability: Rebalancing
Job: Review LP position
Desired outcome: Review this BSC LP position and recommend whether it should be rebalanced.
Pool or pair: CAKE/BNB
Position: 0x595Db43fb04e1422222ecB327d98dDafDC814241
Goal: Recenter position
Constraints: Max slippage 0.5%. Do not assume leverage.
Escrow budget: 0.0001
Time limit: 1 hour
```

## Yield Optimisation Agent

```text
Capability: Yield Optimisation
Job: Compare yield routes
Desired outcome: Compare BSC yield routes for USDT and recommend a safer option with clear risk notes.
Asset: USDT
Amount: 25
Protocols: Venus
Risk: Balanced
Lockup: Liquid only
Escrow budget: 0.0001
Time limit: 1 hour
```

```text
Capability: Yield Optimisation
Job: Review current yield position
Desired outcome: Review my current BSC yield position and summarize safer alternatives.
Wallet: connected wallet
Scope: All wallet assets
Amount:
Protocols: Venus
Risk: Balanced
Lockup: Liquid only
Escrow budget: 0.0001
Time limit: 1 hour
```

## Grid Trading Agent

```text
Capability: Grid Trading
Job: Create grid strategy
Desired outcome: Create a conservative BSC grid strategy with clear bounds and risk limits.
Trading pair: BNB/USDT
Lower bound: 520
Upper bound: 720
Grid count: 8
Risk notes: Small test position. Avoid high leverage.
Escrow budget: 0.0001
Time limit: 1 hour
```

## Custom Agent

```text
Capability: Custom
Job: Custom task
Desired outcome: Run the agent's default read-only check and return a concise result with any assumptions.
Request: Run a read-only status check for this wallet on BSC and return the result, assumptions, and any missing data.
Escrow budget: 0.0001
Time limit: 1 hour
```

## Preflight API Payload Template

Replace `chainId`, `tokenId`, and `advancedFields` for the selected agent.

```json
{
  "chainId": 97,
  "tokenId": "REPLACE_WITH_AGENT_TOKEN_ID",
  "intent": {
    "capability": "concentrated_liquidity",
    "taskType": "Prepare V3 liquidity position",
    "outcome": "Validate the V3 liquidity parameters and return the safest execution plan before any transaction is prepared.",
    "target": "0xae13d989dac2f0debff460ac112a837c89baa7cd/0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7",
    "riskPreference": "Balanced",
    "advancedFields": {
      "token0": "0xae13d989dac2f0debff460ac112a837c89baa7cd",
      "token1": "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7",
      "amount0": "0.01",
      "amount1": "6",
      "fee": "2500",
      "lowerPrice": "500",
      "upperPrice": "800",
      "dex": "PancakeSwap",
      "recipient": "0x595Db43fb04e1422222ecB327d98dDafDC814241"
    },
    "instructions": "Smoke test only. Do not broadcast a trade."
  }
}
```
