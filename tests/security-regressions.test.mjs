import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('staking thresholds and governance invariants', () => {
  const tokenUtils = read('lib/token-utils.ts');
  const stakingRoute = read('app/api/staking/route.ts');
  const stakePage = read('app/stake/page.tsx');
  const disputes = read('lib/disputes.ts');

  it('uses 100K, 1M, and 10M as the staking tiers', () => {
    assert.match(tokenUtils, /id:\s*'staker'[\s\S]*?threshold:\s*100_000/);
    assert.match(tokenUtils, /id:\s*'power'[\s\S]*?threshold:\s*1_000_000/);
    assert.match(tokenUtils, /id:\s*'governor'[\s\S]*?threshold:\s*10_000_000/);
  });

  it('enforces the 100K minimum before accepting stake or DAO voting', () => {
    assert.match(stakingRoute, /MIN_ACTIVE_STAKE_HIVE\s*=\s*STAKING_TIERS\.staker\.threshold/);
    assert.match(stakingRoute, /projectedActiveStake\s*<\s*MIN_ACTIVE_STAKE_HIVE/);
    assert.match(stakingRoute, /isStaked:\s*activeAmount\s*>=\s*MIN_ACTIVE_STAKE_HIVE/);
    assert.match(disputes, /activeStake\s*<\s*STAKING_TIERS\.staker\.threshold/);
    assert.match(stakePage, /MIN_ACTIVE_STAKE_HIVE\s*=\s*100_000/);
    assert.match(stakePage, /Stake Min" value="100K HIVE"/);
  });

  it('keeps malformed or oversized staking amounts out of on-chain verification', () => {
    assert.match(stakingRoute, /MAX_STAKE_HIVE\s*=\s*1_000_000_000/);
    assert.match(stakingRoute, /hasValidHivePrecision\(amountHive\)/);
    assert.match(stakingRoute, /!Number\.isFinite\(amountHive\)/);
  });

  it('uses the live HIVE mint decimals for staking transfers and verification', () => {
    assert.match(tokenUtils, /HIVE_DECIMALS\s*=\s*9/);
    assert.match(stakePage, /HIVE_DECIMALS\s*=\s*9/);
    assert.match(stakePage, /amountNum\s*\*\s*Math\.pow\(10,\s*HIVE_DECIMALS\)/);
    assert.match(tokenUtils, /expectedAmountHive\s*\*\s*Math\.pow\(10,\s*HIVE_DECIMALS\)/);
  });

  it('retries staking transaction lookup to tolerate Solana indexing lag', () => {
    assert.match(tokenUtils, /Date\.now\(\)\s*-\s*startedAt\s*<\s*30_000/);
    assert.match(tokenUtils, /commitment:\s*'confirmed'/);
    assert.match(tokenUtils, /setTimeout\(resolve,\s*1500\)/);
  });
});

describe('MCP gateway and registry security invariants', () => {
  const mcpRoute = read('app/api/mcp/route.ts');
  const toolsRoute = read('app/api/agents/me/tools/route.ts');
  const registryPage = read('app/registry/page.tsx');
  const toolsPage = read('app/agent/dashboard/tools/page.tsx');
  const ssrf = read('lib/ssrf.ts');
  const seeds = read('lib/mcp-registry-seeds.ts');

  it('does not trust spoofable Privy identity headers for paid MCP calls', () => {
    assert.doesNotMatch(mcpRoute, /x-privy-user-id/i);
    assert.match(mcpRoute, /authenticateClient\(req\)/);
    assert.match(mcpRoute, /authenticateRequest\(req\.headers,\s*db\)/);
  });

  it('validates MCP request size and tool name shape before DB lookup', () => {
    assert.match(mcpRoute, /MAX_MCP_REQUEST_BYTES\s*=\s*128\s*\*\s*1024/);
    assert.match(mcpRoute, /Buffer\.byteLength\(raw,\s*'utf8'\)\s*>\s*MAX_MCP_REQUEST_BYTES/);
    assert.match(mcpRoute, /typeof toolName !== 'string'/);
    assert.match(mcpRoute, /tools\/call requires a valid string params\.name/);
  });

  it('requires paid provider tools to use a valid Solana payout wallet', () => {
    assert.match(toolsRoute, /isValidSolanaAddress\(auth\.agent\.solanaAddress\)/);
    assert.doesNotMatch(mcpRoute, /agent\.solanaAddress\s*\|\|\s*agent\.walletAddress/);
  });

  it('keeps catalog MCP entries from opening raw protected transport URLs', () => {
    assert.match(registryPage, /Copy URL/);
    assert.match(registryPage, /copyConnectValue\(tool\)/);
    assert.doesNotMatch(registryPage, /href=\{tool\.remoteUrl\}/);
    assert.match(registryPage, /href="\/agent\/dashboard\/tools\?from=registry"/);
    assert.match(toolsPage, /new URLSearchParams\(window\.location\.search\)\.get\("from"\)\s*===\s*"registry"/);
    assert.match(toolsPage, /const backHref = fromRegistry \? "\/registry"/);
  });

  it('hardens SSRF validation for provider endpoints', () => {
    assert.match(ssrf, /host\.endsWith\('\.internal'\)/);
    assert.match(ssrf, /host\.endsWith\('\.cluster\.local'\)/);
    assert.match(ssrf, /url\.port && url\.port !== '443'/);
    assert.match(ssrf, /resolves to a private or internal IP address/);
  });

  it('marks seeded public MCP entries as catalog-only examples', () => {
    assert.match(seeds, /catalogOnly:\s*true/);
    assert.match(seeds, /Official MCP Registry entry/);
    assert.match(seeds, /MCP Reference Servers/);
  });
});

describe('token page consolidation', () => {
  it('keeps /token as a redirect to the unified /stake page', () => {
    const tokenPage = read('app/token/page.tsx');
    assert.match(tokenPage, /redirect\("\/stake"\)/);
  });
});

describe('admin staking visibility', () => {
  const adminPage = read('app/admin/page.tsx');
  const stakersRoute = read('app/api/admin/stakers/route.ts');

  it('adds a protected admin stakers dashboard', () => {
    assert.match(adminPage, /"stakers"/);
    assert.match(adminPage, /\/api\/admin\/stakers/);
    assert.match(adminPage, /Active HIVE/);
    assert.match(adminPage, /Slashed HIVE/);
    assert.match(stakersRoute, /verifyAdmin\(request\)/);
    assert.match(stakersRoute, /COLLECTIONS\.STAKES/);
    assert.match(stakersRoute, /COLLECTIONS\.STAKE_EVENTS/);
  });
});

describe('Solana browser transaction routing', () => {
  const rpcProxy = read('app/api/solana/rpc/route.ts');
  const stakePage = read('app/stake/page.tsx');
  const dashboardPage = read('app/dashboard/page.tsx');
  const swapWidget = read('components/token/SwapWidget.tsx');

  it('routes client-side staking and deposits through the same-origin RPC proxy by default', () => {
    assert.match(stakePage, /getClientSolanaRpcEndpoint/);
    assert.match(stakePage, /window\.location\.origin\}\/api\/solana\/rpc/);
    assert.doesNotMatch(stakePage, /api\.mainnet-beta\.solana\.com/);
    assert.match(dashboardPage, /getClientSolanaRpcEndpoint/);
    assert.match(dashboardPage, /window\.location\.origin\}\/api\/solana\/rpc/);
    assert.doesNotMatch(dashboardPage, /api\.mainnet-beta\.solana\.com/);
  });

  it('does not use browser WebSocket confirmation against the HTTP RPC proxy', () => {
    assert.match(stakePage, /confirmSignatureByPolling/);
    assert.match(stakePage, /getSignatureStatuses/);
    assert.match(stakePage, /getBlockHeight/);
    assert.doesNotMatch(stakePage, /confirmTransaction\(/);
    assert.match(dashboardPage, /confirmSignatureByPolling/);
    assert.match(dashboardPage, /getSignatureStatuses/);
    assert.match(dashboardPage, /getBlockHeight/);
    assert.doesNotMatch(dashboardPage, /confirmTransaction\(/);
  });

  it('allows signed transaction broadcast through the RPC proxy without reopening broad RPC access', () => {
    assert.match(rpcProxy, /'sendTransaction'/);
    assert.match(rpcProxy, /MAX_RPC_BODY_BYTES\s*=\s*96\s*\*\s*1024/);
    assert.match(rpcProxy, /MAX_SIGNED_TRANSACTION_CHARS\s*=\s*32\s*\*\s*1024/);
    assert.match(rpcProxy, /BASE64_PATTERN/);
    assert.match(rpcProxy, /sendTransaction requires base64 transaction encoding/);
    assert.match(rpcProxy, /encoding:\s*'base64'/);
    assert.doesNotMatch(rpcProxy, /getProgramAccounts/);
  });

  it('submits Bags swap transactions as base64 and surfaces RPC send errors', () => {
    assert.match(swapWidget, /bytesToBase64/);
    assert.match(swapWidget, /encoding:\s*"base64"/);
    assert.match(swapWidget, /preflightCommitment:\s*"confirmed"/);
    assert.match(swapWidget, /sendData\.error\?\.message/);
    assert.doesNotMatch(swapWidget, /encoding:\s*"base58"/);
  });
});
