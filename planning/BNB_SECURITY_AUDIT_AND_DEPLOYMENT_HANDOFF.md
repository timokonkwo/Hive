# BNB Security Audit And Deployment Handoff

Date: 2026-08-07
Branch: `bnb`

## Scope

This audit covers the BNB product surface added to Hive:

- `/bnb` pages and client flows.
- `/api/bnb/*` API routes.
- `lib/bnb/*` runtime, catalog, BSC, PancakeSwap, record, worker, escrow, and session code.
- `contracts/bnb/HiveBscAgentEscrow.sol`.
- `contracts/bnb/HiveBscSessionRegistry.sol`.
- Netlify runtime environment expectations.

## Architecture

Hive remains a Next app deployed on Netlify. The BNB surface uses:

- Privy JWT auth for signed-in writes.
- MongoDB for production records.
- BSC JSON-RPC for address, PancakeSwap, and transaction receipt reads.
- 8004scan public API for real BSC ERC-8004 agents.
- Optional configured Hive-operated agents through `BNB_HIVE_AGENTS_JSON`.
- Optional separate worker through `BNB_AGENT_WORKER_URL`.
- BSC contracts for native BNB escrow and session permission receipts.

## Findings

### High: Payment confirmation accepted insufficiently-bound transaction hashes

Location:

- `lib/bnb/records.ts`
- `lib/bnb/escrow.ts`
- `app/api/bnb/activate/payment/route.ts`
- `app/api/bnb/activate/settlement/route.ts`

Impact:

A user could submit a successful BSC transaction hash that did not correspond to the saved Hive hire, causing the database to mark the wrong hire as paid or settled.

Fix:

The app now verifies that the BSC receipt contains the expected `JobFunded`, `JobReleased`, or `JobRefunded` event from the configured escrow contract. Payment confirmation now checks:

- configured escrow contract address,
- agent wallet,
- BNB amount,
- receipt ID,
- task hash,
- settlement job ID.

Status: fixed.

Production blocker: resolved.

### High: Session grant/revoke confirmation accepted insufficiently-bound transaction hashes

Location:

- `lib/bnb/session.ts`
- `lib/bnb/records.ts`
- `app/api/bnb/altana/session/route.ts`
- `app/api/bnb/altana/revoke/route.ts`

Impact:

A user could submit an unrelated session transaction hash and make a wallet alert look active or revoked in Hive.

Fix:

The app now verifies that the BSC receipt contains the expected `SessionGranted` or `SessionRevoked` event from the configured session registry. Grant confirmation now checks:

- configured registry address,
- agent wallet,
- spend cap,
- receipt ID,
- permissions hash.

Revocation confirmation checks the saved session ID.

Status: fixed.

Production blocker: resolved.

### Medium: BNB API routes had no route-level rate limiting

Location:

- `app/api/bnb/*`
- `lib/bnb/rate-limit.ts`

Impact:

Public agent search, MCP-style tool calls, BSC reads, and signed-in writes could be spammed, increasing RPC/API spend and putting pressure on Netlify functions.

Fix:

The BNB API surface now uses Hive's existing `checkRateLimit` helper:

- read routes use `RATE_LIMITS.READ`,
- write and tool-execution routes use `RATE_LIMITS.WRITE`,
- 429 responses include `Retry-After`.

Status: fixed.

Production blocker: resolved for initial deployment. A Redis/Upstash limiter is still recommended if traffic grows across many Netlify function instances.

### Medium: Runtime status incorrectly implied local agents were enabled in development

Location:

- `app/api/bnb/runtime/route.ts`

Impact:

The status endpoint previously exposed local-agent mode. Local seeded agents have since been removed from marketplace discovery.

Fix:

Runtime status now reports live 8004Scan discovery and configured endpoint-backed agent readiness only.

Status: fixed.

Production blocker: resolved.

### Medium: Dependency audit found unresolved vulnerable transitive packages

Location:

- `package.json`
- `package-lock.json`

Evidence:

`npm audit --omit=dev` completed with 60 vulnerabilities: 24 high, 34 moderate, 2 low. The largest clusters are transitive through Next, wallet libraries, Solana libraries, Bags SDK, WalletConnect, Axios, and related packages.

Attempted fix:

`npm audit fix`, `npm audit fix --omit=optional`, and `npm_config_optional=false npm audit fix` all failed locally before applying fixes because npm attempted to process `@rollup/rollup-android-arm-eabi@4.59.0`, which is Android/ARM-only and not installable on this macOS ARM64 machine.

Status: unresolved.

Production blocker: not a smart-contract deployment blocker, but it is a web-app hardening item before broad public traffic. Do not run `npm audit fix --force` without a separate dependency-upgrade branch and full regression pass because npm reports breaking changes.

Recommended next action:

Handle dependency remediation separately with explicit package upgrades, starting with Next and wallet-stack packages, then run full build/test/smoke tests.

## Smart Contract Audit

### HiveBscAgentEscrow

Source: `contracts/bnb/HiveBscAgentEscrow.sol`

Behavior:

- Client funds a native BNB job for an agent.
- Job ID is derived from chain ID, contract address, client, agent, receipt ID, and task hash.
- Only the client can release funds to the agent.
- Anyone can trigger refund after expiry, but funds always return to the client.
- State changes happen before external transfers.
- Transfers are protected by a simple non-reentrancy lock.

Checked risks:

- Reentrancy: mitigated by state-before-call and non-reentrant modifier.
- Unauthorized release: only client can release.
- Early refund: blocked until `block.timestamp > expiresAt`.
- Zero agent: rejected.
- Zero amount: rejected.
- Expired funding: rejected.
- Duplicate job ID: rejected.
- Contract owner/admin risk: no owner and no privileged withdrawal path.

Residual notes:

- Agent contracts that reject native BNB can block release, but the client can refund after expiry.
- Receipt strings are unbounded; the funder pays the gas. This is not a custody risk.

Status: deployable.

### HiveBscSessionRegistry

Source: `contracts/bnb/HiveBscSessionRegistry.sol`

Behavior:

- Client grants a session receipt to an agent with spend cap, expiry, permissions hash, and receipt ID.
- Only the client can revoke.
- Contract records status and emits grant/revoke events.

Checked risks:

- Unauthorized revoke: only client can revoke.
- Zero agent: rejected.
- Expired grant: rejected.
- Duplicate session ID: rejected.
- Contract owner/admin risk: no owner and no privileged mutation path.
- Custody risk: registry holds no funds.

Residual notes:

- Expiry is recorded but not automatically enforced by a contract function. Offchain callers must treat `expiresAt` as part of permission validation.
- Spend cap can be zero, which supports read-only/watch sessions.

Status: deployable.

## Verification

Passed:

```bash
forge build --offline
forge test --offline
npm run typecheck
npx eslint app/api/bnb lib/bnb app/bnb
npm test
npm run build
```

Foundry test coverage:

- native escrow fund and release,
- client-only release,
- refund only after expiry,
- session grant and revoke,
- client-only revoke,
- invalid agent and invalid expiry reverts.

Build note:

`npm run build` succeeds. The sandbox still logs a sitemap MongoDB SRV `ECONNREFUSED` during build-time dynamic sitemap collection, but the build exits successfully.

Foundry note:

Normal `forge test` and live `cast` RPC calls crash in this macOS sandbox due to a Foundry proxy/signature lookup bug. `forge test --offline` passes, and raw BSC JSON-RPC through `curl` works.

## Deployment Estimate

BSC RPC checked:

- Chain ID: `0x38` / `56`.
- Gas price at check time: `0x2faf080` wei / `50,000,000` wei / `0.05 gwei`.

Deployment gas estimates from BSC RPC:

- `HiveBscAgentEscrow`: `0xab66e` gas / `702,062`.
- `HiveBscSessionRegistry`: `0x8a579` gas / `566,649`.
- Total: `1,268,711` gas.
- 50% buffer: `1,903,066` gas.

Estimated deployment cost at checked gas price:

- Escrow: `0.00003510 BNB`.
- Session registry: `0.00002833 BNB`.
- Total: `0.00006343 BNB`.
- 50% buffer: `0.00009515 BNB`.

Funding instruction:

Fund the deployer account with `0.05 BNB`. The raw deployment cost is far below this, but `0.05 BNB` gives enough room for retries, verification, and initial operational transactions without another funding step.

## Deployment Handoff

Required from the owner:

1. Add a BSC deployer private key locally as `BNB_DEPLOYER_PRIVATE_KEY`.
2. Fund that deployer address with `0.05 BNB`.

Do not paste the private key in chat. Add it to `.env.local` locally:

```bash
BNB_DEPLOYER_PRIVATE_KEY=0x...
```

Then provide only the deployer public address so its balance can be checked before deployment.

Deploy commands:

```bash
npm run bnb:deploy:escrow
npm run bnb:deploy:sessions
```

Post-deploy:

1. Set `BNB_AGENT_ESCROW_ADDRESS` to the deployed escrow address.
2. Set `BNB_SESSION_REGISTRY_ADDRESS` to the deployed session registry address.
3. Add both values to Netlify Production environment variables.
4. Redeploy Netlify.
5. Smoke-test hire, fund escrow, run agent, release escrow, grant wallet alert session, revoke wallet alert session.

## Testnet Deployment Result

Deployed on BSC Testnet, chain ID `97`, on 2026-08-11.

| Contract | Address | Deployment transaction |
|:--|:--|:--|
| `HiveBscAgentEscrow` | `0xAAA70e3AD453faB26B9ea33E3C7CF4f94ad00c2d` | `0xfb713be0752b1a4488cc6247abd8d012d48d593787c3077d723f1a64db4e6d99` |
| `HiveBscSessionRegistry` | `0x1DDCd63282CDd4e5531B65902808Ab0673B0Cd02` | `0x64584a22a1af993885c7eba539d88dda80b14f55acfec01872086e8c4a7fde5a` |

Bytecode was confirmed at both BSC Testnet addresses through RPC after deployment.

Local `.env.local` has been updated for BSC Testnet:

```bash
BNB_NETWORK=testnet
NEXT_PUBLIC_BNB_NETWORK=testnet
BNB_BSC_CHAIN_ID=97
NEXT_PUBLIC_BNB_BSC_CHAIN_ID=97
BNB_BSC_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
NEXT_PUBLIC_BNB_BSC_RPC_URL=https://data-seed-prebsc-1-s1.bnbchain.org:8545
BNB_AGENT_ESCROW_ADDRESS=0xAAA70e3AD453faB26B9ea33E3C7CF4f94ad00c2d
BNB_SESSION_REGISTRY_ADDRESS=0x1DDCd63282CDd4e5531B65902808Ab0673B0Cd02
```

Lifecycle smoke test passed on BSC Testnet:

```bash
npm run bnb:testnet:smoke
```

Result:

- Smoke account: `0xD1B72614e53d3CD62A5586f64d64b081EE2417CC`.
- Record: `13e06884-7e7a-4f11-8617-5860d06214e1`.
- Escrow funding tx: `https://testnet.bscscan.com/tx/0x2d98a82d636397ac8c8346682b3e5c5fbad9881e1b33ed6db38a922120e51f22`.
- Escrow release tx: `https://testnet.bscscan.com/tx/0x1a220e4221bc2b1068d947f1877cc3a46fb23803d6f9fd624a80b709d166eb0f`.
- Final saved status: `paid`.

## Mainnet Deployment Result

Deployed on BSC mainnet, chain ID `56`, on 2026-08-07.

| Contract | Address | Deployment transaction | Block | Gas used |
|:--|:--|:--|:--|--:|
| `HiveBscAgentEscrow` | `0xaaa70e3ad453fab26b9ea33e3c7cf4f94ad00c2d` | `0x79266504ba1a8071022ed0f52863591569b0a59c49a71839e670967c1389d281` | `114550870` | `695376` |
| `HiveBscSessionRegistry` | `0x1ddcd63282cdd4e5531b65902808ab0673b0cd02` | `0x3c68bcb667244a1f0322953f4449433e9a510633937789a6984625fd0338d86e` | `114550873` | `561029` |

Bytecode verification through BSC RPC:

| Contract | Runtime bytecode hash | Matches local artifact |
|:--|:--|:--|
| `HiveBscAgentEscrow` | `0x90414a0a0e64c8900c8c2c45548f86f2cceb8864d784530581f06e01595bddfc` | Yes |
| `HiveBscSessionRegistry` | `0xee5abe42904101b1f3c05b4fab1029eea4033a9145b132cf371bb62464d1f616` | Yes |

Local production smoke test:

- `GET /api/bnb/runtime`: `escrowConfigured=true`, `sessionRegistryConfigured=true`, `live8004scanEnabled=true`.
- `GET /api/bnb/agents?limit=2`: returns live `8004scan` agents.
- `POST /api/bnb/pancakeswap`: returns live WBNB/USDT PancakeSwap V2 reserve data from BSC RPC.

Local `.env.local` has been updated:

```bash
BNB_AGENT_ESCROW_ADDRESS=0xaaa70e3ad453fab26b9ea33e3c7cf4f94ad00c2d
BNB_SESSION_REGISTRY_ADDRESS=0x1ddcd63282cdd4e5531b65902808ab0673b0cd02
```

Add the same two values to Netlify Production environment variables, then redeploy the site.
