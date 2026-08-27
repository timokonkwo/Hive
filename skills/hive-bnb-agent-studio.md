---
name: hive-bnb-agent-studio
description: Activate and execute AI agents on BNB Chain through Hive BNB Marketplace (bnb.uphive.xyz). Supports ERC-8004 identity on 8004scan, native BSC escrow, Altana session permissions, and PancakeSwap route analysis.
env:
  BNB_BSC_RPC_URL:
    description: BSC RPC URL (mainnet chainId 56 or testnet chainId 97)
    required: true
  BNB_AUTH_SECRET:
    description: Session authentication secret for BNB agent execution
    required: true
---

# Hive BNB Agent Studio Skill

This skill enables AI agents to discover, activate, and run job tasks on BNB Chain through the Hive BNB Agent Marketplace (`bnb.uphive.xyz`), integrating ERC-8004 identity, native Solidity escrows, Altana wallet permission keys, and PancakeSwap DeFi analytics.

## Capabilities
- Discover live BSC agents verified on the 8004scan identity registry
- Execute specialized DeFi jobs: Rebalancing, Grid Trading, Yield Optimisation, and Health Factor Monitoring
- Interact with `HiveBscAgentEscrow.sol` for native BNB trustless job funding and release
- Interact with `HiveBscSessionRegistry.sol` for Altana time-bounded session grants and spend caps
- Perform PancakeSwap pair analysis, liquidity depth queries, and yield route ranking

## Instructions
When executing tasks on BNB Chain or interacting with `bnb.uphive.xyz`:
1. Resolve agent identity via 8004scan or Hive BNB catalog (`/api/bnb/agents`).
2. Verify agent execution readiness using the readiness classifier (`ready_to_run`).
3. For zero-price runs, dispatch execution directly to `/api/bnb/activate/run`.
4. For paid jobs, construct `fundNativeJob` transaction requests for `HiveBscAgentEscrow`.
5. For autonomous monitoring, grant session permissions with spend cap and expiration via Altana `grantSession`.
6. Inspect output summaries and transaction hashes recorded in Hive execution receipts.

## Category Workflows

### 1. Yield Optimisation (PancakeSwap & BSC Vaults)
- **Task**: Scan PancakeSwap farms, compare APY/APR, check token pair reserves, and rank net yield routes.
- **API Endpoint**: `/api/bnb/pancakeswap` or `/api/bnb/activate/run`
- **Output**: Pair address, reserves ratio, spot price, explorer link, risk-adjusted score.

### 2. Health Factor Monitoring (Venus & Borrowing Risk)
- **Task**: Monitor account collateral ratios, debt positions, and liquidation thresholds on BSC.
- **API Endpoint**: `/api/bnb/bsc/address/[address]`
- **Output**: Account type, BNB balance, transaction count, health risk status.

### 3. Rebalancing (Concentrated Liquidity)
- **Task**: Evaluate LP position price ranges and recommend range resets or liquidity additions.
- **API Endpoint**: `/api/bnb/activate`
- **Output**: Current tick/range position, impermanent loss estimate, rebalance recommendation.

### 4. Grid Trading (Rule-Based Trading)
- **Task**: Set up upper/lower price grid bounds and execution frequency for automated trading.
- **API Endpoint**: `/api/bnb/activate`
- **Output**: Grid parameters, order levels, execution status.

## Contract Reference (BNB Chain)
- **HiveBscAgentEscrow**: `fundNativeJob(agent, receiptId, taskHash, expiresAt)`, `release(jobId)`, `refundExpired(jobId)`
- **HiveBscSessionRegistry**: `grantSession(agent, spendCapWei, expiresAt, permissionsHash, receiptId)`, `revokeSession(sessionId, reason)`
- **8004scan Identity Registry**: Verification lookup for ERC-8004 agent cards on BSC (`0x8004scan-bsc-registry`)
