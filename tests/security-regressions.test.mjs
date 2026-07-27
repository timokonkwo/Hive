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
  const disputesRoute = read('app/api/disputes/route.ts');
  const disputeReportsRoute = read('app/api/dispute-reports/route.ts');
  const adminDaoRoute = read('app/api/admin/dao/route.ts');
  const disputeResolver = read('app/api/cron/resolve-disputes/route.ts');
  const sessionWallet = read('lib/session-wallet.ts');
  const dashboardPage = read('app/dashboard/page.tsx');
  const docs = read('app/docs/_components/ContentSections.tsx');
  const points = read('lib/points.ts');
  const logger = read('lib/logger.ts');
  const googleSheets = read('lib/google-sheets.ts');

  it('uses 100K+, 1M+, and 10M+ as the staking tiers', () => {
    assert.match(tokenUtils, /id:\s*'staker'[\s\S]*?threshold:\s*100_000/);
    assert.match(tokenUtils, /id:\s*'power'[\s\S]*?threshold:\s*1_000_000/);
    assert.match(tokenUtils, /id:\s*'governor'[\s\S]*?threshold:\s*10_000_000/);
  });

  it('enforces the 100K+ minimum before accepting stake or DAO voting', () => {
    assert.match(stakingRoute, /MIN_ACTIVE_STAKE_HIVE\s*=\s*STAKING_TIERS\.staker\.threshold/);
    assert.match(stakingRoute, /projectedActiveStake\s*<\s*MIN_ACTIVE_STAKE_HIVE/);
    assert.match(stakingRoute, /isStaked:\s*activeAmount\s*>=\s*MIN_ACTIVE_STAKE_HIVE/);
    assert.match(disputes, /activeStake\s*<\s*STAKING_TIERS\.staker\.threshold/);
    assert.match(stakePage, /MIN_ACTIVE_STAKE_HIVE\s*=\s*100_000/);
    assert.match(stakePage, /Stake Min" value="100K\+ HIVE"/);
  });

  it('keeps malformed or oversized staking amounts out of on-chain verification', () => {
    assert.match(stakingRoute, /MAX_STAKE_HIVE\s*=\s*1_000_000_000/);
    assert.match(stakingRoute, /hasValidHivePrecision\(amountHive\)/);
    assert.match(stakingRoute, /!Number\.isFinite\(amountHiveNumber\)/);
  });

  it('uses the live HIVE mint decimals for staking transfers and verification', () => {
    assert.match(tokenUtils, /HIVE_DECIMALS\s*=\s*9/);
    assert.match(tokenUtils, /parseHiveAmountToRaw/);
    assert.match(tokenUtils, /BigInt\(rawAmountText\)/);
    assert.match(tokenUtils, /hasOwnProperty\.call\(options,\s*'maxAgeMinutes'\)/);
    assert.match(stakePage, /HIVE_DECIMALS\s*=\s*9/);
    assert.match(stakePage, /parseHiveAmountToRaw\(amount\)/);
    assert.doesNotMatch(stakePage, /Math\.round\(amountNum\s*\*\s*Math\.pow\(10,\s*HIVE_DECIMALS\)\)/);
    assert.doesNotMatch(tokenUtils, /expectedAmountHive\s*\*\s*Math\.pow\(10,\s*HIVE_DECIMALS\)/);
  });

  it('retries staking transaction lookup to tolerate Solana indexing lag', () => {
    assert.match(tokenUtils, /Date\.now\(\)\s*-\s*startedAt\s*<\s*30_000/);
    assert.match(tokenUtils, /commitment:\s*'confirmed'/);
    assert.match(tokenUtils, /setTimeout\(resolve,\s*1500\)/);
  });

  it('implements cooldown-based unstaking with benefits removed from active stake', () => {
    assert.match(stakingRoute, /UNSTAKE_COOLDOWN_DAYS\s*=\s*7/);
    assert.match(stakingRoute, /action\s*===\s*'request_unstake'/);
    assert.match(stakingRoute, /action\s*===\s*'claim_unstake'/);
    assert.match(stakingRoute, /activeAmount:\s*-amountHive/);
    assert.match(stakingRoute, /lockedAmount:\s*amountHive/);
    assert.match(stakingRoute, /findStakeExitBlocker/);
    assert.match(stakePage, /handleRequestUnstake/);
    assert.match(stakePage, /handleClaimUnstake/);
    assert.match(docs, /7-day cooldown/);
  });

  it('keeps treasury HIVE custody on a dedicated signer env var', () => {
    assert.match(stakingRoute, /process\.env\.HIVE_TREASURY_KEYPAIR/);
    assert.match(disputeResolver, /process\.env\.HIVE_TREASURY_KEYPAIR/);
    assert.match(read('lib/points.ts'), /process\.env\.HIVE_TREASURY_KEYPAIR/);
    assert.doesNotMatch(stakingRoute, /HIVE_LAUNCH_KEYPAIR \|\| process\.env\.HIVE_AGENT_LAUNCH_KEYPAIR/);
    assert.doesNotMatch(disputeResolver, /HIVE_LAUNCH_KEYPAIR \|\| process\.env\.HIVE_AGENT_LAUNCH_KEYPAIR/);
  });

  it('preflights treasury SOL and HIVE balances before unstake claim payout', () => {
    assert.match(stakingRoute, /MIN_TREASURY_SOL_LAMPORTS\s*=\s*5_000_000/);
    assert.match(stakingRoute, /connection\.getBalance\(treasuryKeypair\.publicKey,\s*'confirmed'\)/);
    assert.match(stakingRoute, /needs SOL for unstake claim fees/);
    assert.match(stakingRoute, /treasuryHiveAccount\.amount\s*<\s*rawAmount/);
    assert.match(stakingRoute, /Treasury HIVE balance is insufficient/);
    assert.match(stakingRoute, /error\?\.getLogs/);
  });

  it('preflights treasury payouts for points conversion too', () => {
    assert.match(points, /MIN_TREASURY_SOL_LAMPORTS\s*=\s*5_000_000/);
    assert.match(points, /connection\.getBalance\(treasuryPubKey,\s*'confirmed'\)/);
    assert.match(points, /needs SOL for points conversion fees/);
    assert.match(points, /sourceAccount\.amount\s*<\s*rawAmount/);
    assert.match(points, /Treasury HIVE balance is insufficient for this conversion/);
    assert.match(points, /parseHiveAmountToRaw\(hiveAmount\)/);
    assert.doesNotMatch(points, /hiveAmount \* Math\.pow\(10,\s*HIVE_DECIMALS\)/);
  });

  it('bounds DAO slashing burns to the provider recorded stake and confirms on chain', () => {
    assert.match(disputeResolver, /slashAmount\s*=\s*Math\.min\(Math\.abs\(Number\(dispute\.stakedAmount/);
    assert.match(disputeResolver, /parseHiveAmountToRaw\(slashAmount\)/);
    assert.match(disputeResolver, /needs SOL for slashing fees/);
    assert.match(disputeResolver, /treasuryHiveAccount\.amount\s*<\s*rawAmount/);
    assert.match(disputeResolver, /connection\.confirmTransaction/);
    assert.doesNotMatch(disputeResolver, /dispute\.stakedAmount \* Math\.pow\(10,\s*HIVE_DECIMALS\)/);
  });

  it('does not log private key material or other secrets', () => {
    assert.match(logger, /SENSITIVE_KEY_PATTERN/);
    assert.match(logger, /Bearer \[REDACTED\]/);
    assert.match(logger, /hive_sk_\[REDACTED\]/);
    assert.match(logger, /mongodb\$1:\/\/\[REDACTED\]/);
    assert.doesNotMatch(googleSheets, /keyStart/);
    assert.doesNotMatch(googleSheets, /cleanKey\.slice\(0,\s*20\)/);
  });

  it('keeps in-flight unstake claims slashable and blocks dispute races', () => {
    assert.match(stakingRoute, /'pendingUnstakes\.\$\.status': 'claiming'/);
    assert.match(stakingRoute, /lockedAmount:\s*\{\s*\$gte:\s*amountHive\s*\}[\s\S]*?\$inc:\s*\{\s*lockedAmount:\s*-amountHive/);
    assert.doesNotMatch(stakingRoute, /claimStartedAt[\s\S]{0,180}\$inc:\s*\{\s*lockedAmount:\s*-amountHive/);
    assert.match(disputeReportsRoute, /status === 'claiming'/);
    assert.match(disputesRoute, /status === 'claiming'/);
    assert.match(adminDaoRoute, /status === 'claiming'/);
  });

  it('keeps cooldown-locked stake slashable during DAO disputes', () => {
    assert.match(disputesRoute, /activeAmount[\s\S]*lockedAmount/);
    assert.match(disputeReportsRoute, /activeAmount[\s\S]*lockedAmount/);
    assert.match(adminDaoRoute, /activeAmount[\s\S]*lockedAmount/);
    assert.match(disputeResolver, /lockedSlash/);
    assert.match(disputeResolver, /pendingUnstakes/);
    assert.match(disputeResolver, /status = 'slashed'/);
  });

  it('uses the 100K+ staker threshold for dispute watchdog and slashing gates', () => {
    assert.match(disputeReportsRoute, /STAKING_TIERS\.staker\.threshold/);
    assert.match(disputesRoute, /STAKING_TIERS\.staker\.threshold/);
    assert.match(adminDaoRoute, /STAKING_TIERS\.staker\.threshold/);
    assert.doesNotMatch(disputeReportsRoute, /activeAmount \|\| 0\) >= 10_000/);
    assert.doesNotMatch(disputesRoute, /MIN_SLASHABLE_STAKE_HIVE = 10_000/);
    assert.doesNotMatch(adminDaoRoute, /MIN_SLASHABLE_STAKE_HIVE = 10_000/);
  });

  it('uses the configured default treasury wallet consistently', () => {
    const treasury = 'BN1T9QNRAKnpKJ1EqzcjrzziSHvJhhnY8xV8F9FsFvCy';
    assert.match(stakingRoute, new RegExp(treasury));
    assert.match(sessionWallet, new RegExp(treasury));
    assert.match(dashboardPage, new RegExp(treasury));
    assert.doesNotMatch(stakingRoute, /3LQuJTTLX9cjvAhRtnYrGJS3qESp494UCnA9UtCrdura/);
    assert.doesNotMatch(sessionWallet, /3LQuJTTLX9cjvAhRtnYrGJS3qESp494UCnA9UtCrdura/);
    assert.doesNotMatch(dashboardPage, /3LQuJTTLX9cjvAhRtnYrGJS3qESp494UCnA9UtCrdura/);
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
    assert.match(mcpRoute, /Array\.isArray\(rpc\)/);
    assert.match(mcpRoute, /JSON-RPC batch requests are not supported/);
    assert.match(mcpRoute, /typeof toolName !== 'string'/);
    assert.match(mcpRoute, /tools\/call requires a valid string params\.name/);
  });

  it('keeps the OKX A2MCP probe path zero-price and read-only after replay', () => {
    assert.match(mcpRoute, /okxX402Challenge/);
    assert.match(mcpRoute, /'PAYMENT-REQUIRED'/);
    assert.match(mcpRoute, /amount:\s*'0'/);
    assert.match(mcpRoute, /export async function GET[\s\S]*!hasOkxPaymentProof\(req\)[\s\S]*okxX402Challenge\(req\)/);
    assert.match(mcpRoute, /hasOkxPaymentProof\(req\)\s*\?\s*freeServiceProbeResponse\(req\)\s*:\s*okxX402Challenge\(req\)/);
    assert.match(mcpRoute, /defaultAction:\s*'tools\/list'/);
    assert.match(mcpRoute, /publicTools:\s*\['hive_list_tasks',\s*'hive_get_task',\s*'hive_get_task_matches'\]/);
  });

  it('does not expose automated MCP task creation', () => {
    assert.doesNotMatch(mcpRoute, /hive_route_task/);
    assert.doesNotMatch(mcpRoute, /\/api\/tasks\/instant-match`,\s*\{/);
    assert.doesNotMatch(mcpRoute, /name:\s*'create_task'/);
    assert.doesNotMatch(mcpRoute, /name === 'create_task'/);
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

describe('human-gated task creation', () => {
  const taskRoute = read('app/api/tasks/route.ts');
  const instantRoute = read('app/api/tasks/instant-match/route.ts');
  const draftRoute = read('app/api/tasks/draft/route.ts');
  const taskSecurity = read('lib/task-security.ts');
  const humanVerification = read('lib/human-verification.ts');
  const createPage = read('app/create/page.tsx');
  const docs = read('app/docs/_components/ContentSections.tsx');

  it('requires Privy auth and human verification before task writes', () => {
    assert.match(taskRoute, /authenticateClient\(request\)/);
    assert.match(taskRoute, /requireHumanVerification\(request,\s*humanVerificationToken,\s*'create_task'\)/);
    assert.match(taskRoute, /validateHumanTaskInput/);
    assert.match(taskRoute, /taskBodyTooLarge\(request\)/);
    assert.match(taskRoute, /creationSurface:\s*'web'/);
    assert.match(taskRoute, /humanVerified:\s*!human\.skipped/);

    assert.match(instantRoute, /authenticateClient\(request\)/);
    assert.match(instantRoute, /requireHumanVerification\(request,\s*humanVerificationToken,\s*'instant_match_task'\)/);
    assert.match(instantRoute, /validateHumanTaskInput/);
    assert.match(instantRoute, /taskBodyTooLarge\(request\)/);
    assert.match(instantRoute, /creationSurface:\s*'web'/);
  });

  it('does not leave task draft generation public', () => {
    assert.match(draftRoute, /authenticateClient\(request\)/);
    assert.match(draftRoute, /requireHumanVerification\(request,\s*body\.humanVerificationToken,\s*'draft_task'\)/);
    assert.match(createPage, /authFetch\('\/api\/tasks\/draft'/);
    assert.match(createPage, /humanVerificationToken/);
    assert.match(createPage, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    assert.match(createPage, /<Turnstile/);
  });

  it('fails closed in production when human verification is not configured', () => {
    assert.match(humanVerification, /NODE_ENV === 'production'/);
    assert.match(humanVerification, /TURNSTILE_SECRET_KEY is not configured/);
    assert.match(humanVerification, /status:\s*503/);
    assert.match(humanVerification, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  });

  it('rejects low-quality or abusive task payloads before insert', () => {
    assert.match(taskSecurity, /MAX_TASK_BODY_BYTES\s*=\s*64\s*\*\s*1024/);
    assert.match(taskSecurity, /title\.length\s*<\s*8/);
    assert.match(taskSecurity, /description\.length\s*<\s*40/);
    assert.match(taskSecurity, /TASK_CATEGORY_SET\.has\(category\)/);
    assert.match(taskSecurity, /MAX_TASK_BUDGET_USDC\s*=\s*100_000/);
    assert.match(taskSecurity, /raw\.includes\('-'\)/);
  });

  it('documents task creation and drafting as authenticated human actions', () => {
    assert.match(docs, /Create a new task\. Requires Privy sign-in and human verification/);
    assert.match(docs, /Generate a structured task draft.*Requires Privy sign-in and human verification/);
    assert.match(docs, /humanVerificationToken/);
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
  const reconcileRoute = read('app/api/admin/stakers/reconcile/route.ts');
  const adminAuth = read('lib/admin-auth.ts');

  it('adds a protected admin stakers dashboard', () => {
    assert.match(adminPage, /"stakers"/);
    assert.match(adminPage, /\/api\/admin\/stakers/);
    assert.match(adminPage, /\/api\/admin\/stakers\/reconcile/);
    assert.match(adminPage, /Active HIVE/);
    assert.match(adminPage, /Slashed HIVE/);
    assert.match(stakersRoute, /verifyAdmin\(request\)/);
    assert.match(stakersRoute, /COLLECTIONS\.STAKES/);
    assert.match(stakersRoute, /COLLECTIONS\.STAKE_EVENTS/);
  });

  it('reconciles verified treasury transfers without opening replay or recipient loopholes', () => {
    assert.match(reconcileRoute, /verifyAdmin\(req\)/);
    assert.match(reconcileRoute, /createIndex\(\s*\{\s*txSignature:\s*1\s*\}/);
    assert.match(reconcileRoute, /verifyHiveTransfer/);
    assert.match(reconcileRoute, /maxAgeMinutes:\s*null/);
    assert.match(reconcileRoute, /solanaAddressVerifiedAt/);
    assert.match(reconcileRoute, /HIVE_TREASURY_WALLET/);
    assert.match(reconcileRoute, /deleteOne\(\{\s*txSignature,\s*status:\s*'pending_reconcile'\s*\}\)/);
  });

  it('does not allow request-supplied admin addresses unless explicitly enabled', () => {
    assert.match(adminAuth, /ADMIN_PRIVY_DID/);
    assert.match(adminAuth, /ENABLE_LEGACY_ADMIN_ADDRESS_AUTH === 'true'/);
    assert.match(adminAuth, /Disabled by default because the address is request-supplied/);
    assert.doesNotMatch(adminAuth, /if \(adminAddress\) \{/);
  });
});

describe('points conversion fund safety', () => {
  const convertRoute = read('app/api/points/convert/route.ts');
  const points = read('lib/points.ts');

  it('only converts points to a verified linked Solana wallet', () => {
    assert.match(convertRoute, /MAX_POINTS_CONVERT_BODY_BYTES/);
    assert.match(convertRoute, /Number\.isSafeInteger\(points\)/);
    assert.match(convertRoute, /solanaAddressVerifiedAt/);
    assert.match(convertRoute, /Points can only be converted to your verified linked Solana wallet/);
  });

  it('reserves points before treasury payout and does not restore after broadcast', () => {
    assert.match(points, /Treasury conversion keypair does not match HIVE_TREASURY_WALLET/);
    assert.match(points, /currentPointsBalance:\s*\{\s*\$gte:\s*pointsToConvert\s*\}/);
    assert.match(points, /currentPointsBalance:\s*-pointsToConvert/);
    assert.match(points, /if \(txSignature\)/);
    assert.match(points, /convert_to_hive_unconfirmed/);
    assert.match(points, /currentPointsBalance:\s*pointsToConvert/);
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
