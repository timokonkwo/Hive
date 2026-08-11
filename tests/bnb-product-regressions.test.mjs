import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('BNB marketplace product flows', () => {
  const db = read('lib/db.ts');
  const types = read('lib/bnb/types.ts');
  const records = read('lib/bnb/records.ts');
  const runtime = read('lib/bnb/runtime.ts');
  const catalog = read('lib/bnb/catalog.ts');
  const display = read('lib/bnb/display.ts');
  const activateRoute = read('app/api/bnb/activate/route.ts');
  const accessRoute = read('app/api/bnb/access-request/route.ts');
  const runRoute = read('app/api/bnb/activate/run/route.ts');
  const settlementRoute = read('app/api/bnb/activate/settlement/route.ts');
  const altanaRoute = read('app/api/bnb/altana/session/route.ts');
  const activityClient = read('app/bnb/report/ReceiptsClient.tsx');
  const reportPage = read('app/bnb/report/page.tsx');
  const accountPage = read('app/bnb/account/page.tsx');
  const accountClient = read('app/bnb/account/BnbAccountClient.tsx');
  const accountButton = read('app/bnb/_components/BnbAccountButton.tsx');
  const requestForm = read('app/bnb/_components/RequestAccessForm.tsx');
  const activatePage = read('app/bnb/activate/page.tsx');
  const activateForm = read('app/bnb/activate/ActivationForm.tsx');
  const providers = read('components/providers/Providers.tsx');
  const profilePage = read('app/bnb/agents/[chainId]/[tokenId]/page.tsx');
  const statusPage = read('app/bnb/status/page.tsx');
  const agentsPage = read('app/bnb/agents/page.tsx');
  const directory = read('app/bnb/agents/AgentsDirectory.tsx');
  const bnbUi = read('app/bnb/_components/BnbUi.tsx');
  const copyButton = read('app/bnb/_components/CopyValueButton.tsx');
  const altanaSessionForm = read('app/bnb/altana/AltanaSessionForm.tsx');
  const altanaRevokeForm = read('app/bnb/altana/AltanaRevokeForm.tsx');
  const bnbAuthFetch = read('hooks/useBnbAuthFetch.ts');
  const bnbCss = read('app/bnb/bnb.css');
  const requestDialog = read('app/bnb/agents/[chainId]/[tokenId]/RequestAccessDialog.tsx');
  const clientAuth = read('lib/client-auth.ts');
  const endpointSecurity = read('lib/bnb/endpoint-security.ts');
  const adapterRegistry = read('lib/bnb/adapters/registry.ts');
  const mcpAdapter = read('lib/bnb/adapters/mcp.ts');
  const a2aAdapter = read('lib/bnb/adapters/a2a.ts');

  it('persists access requests as owner-scoped activity records', () => {
    assert.match(db, /BNB_ACCESS_REQUESTS:\s*"bnb_access_requests"/);
    assert.match(types, /export type BnbAccessRequestRecord/);
    assert.match(types, /recordType:\s*"access_request"/);
    assert.match(types, /status:\s*"requested"\s*\|\s*"cancelled"\s*\|\s*"converted_to_hire"/);
    assert.match(types, /accessRequests:\s*BnbAccessRequestRecord\[\]/);

    assert.match(records, /accessRequests:\s*BnbAccessRequestRecord\[\]/);
    assert.match(records, /createBnbAccessRequestRecord/);
    assert.match(records, /getProcessStore\(\)\.accessRequests\.unshift/);
    assert.match(records, /listBnbCollection<BnbAccessRequestRecord>\(COLLECTIONS\.BNB_ACCESS_REQUESTS/);
    assert.match(records, /accessRequests:\s*processStore\.accessRequests\.filter/);
  });

  it('requires auth and never trusts a body-provided owner for access requests', () => {
    assert.match(accessRoute, /enforceBnbRateLimit\(request,\s*"access-request",\s*"write"\)/);
    assert.match(accessRoute, /authenticateClient\(request\)/);
    assert.match(accessRoute, /Sign in to request access/);
    assert.match(accessRoute, /clientAddress:\s*client\.userId/);
    assert.doesNotMatch(accessRoute, /body\.clientAddress/);
    assert.doesNotMatch(requestForm, /clientAddress/);
  });

  it('routes only executable agents into escrow hire', () => {
    assert.match(runtime, /agent\.executionStatus === "ready_to_run"/);
    assert.match(runtime, /Hive cannot run it yet/);
    assert.match(display, /agent\.executionStatus === "ready_to_run"/);
    assert.match(directory, /bnbCanHireAgent/);
    assert.match(profilePage, /Check availability/);
    assert.doesNotMatch(profilePage, /<RequestAccessDialog agent=\{agent\}/);
    assert.match(activateRoute, /hasRunnableBnbAdapter\(agent\)/);
    assert.match(activatePage, /canHireBnbAgent\(agent\)/);
    assert.doesNotMatch(activatePage, /<RequestAccessForm agent=\{agent\}/);
    assert.doesNotMatch(directory, /\/bnb\/match\?intent=.*Contact/);
    assert.doesNotMatch(bnbUi, /\/bnb\/match\?intent=.*Contact/);
  });

  it('keeps Privy auth and BNB wallet transactions wired together', () => {
    assert.match(providers, /from "@privy-io\/wagmi"/);
    assert.match(activateForm, /useWallets\(\)/);
    assert.match(activateForm, /useSetActiveWallet\(\)/);
    assert.match(activateForm, /walletChainType:\s*"ethereum-only"/);
    assert.match(activateForm, /Saving creates the hire record/);
    assert.match(activateForm, /value:\s*"BNB escrow"/);
    assert.doesNotMatch(activateForm, /x402 or BNB escrow/);
    assert.match(activityClient, /connectWallet\(\{\s*walletChainType:\s*"ethereum-only"/s);
    assert.match(accountClient, /useWallets\(\)/);
    assert.match(accountClient, /useSetActiveWallet\(\)/);
    assert.match(accountClient, /walletChainType:\s*"ethereum-only"/);
    assert.match(altanaSessionForm, /connectWallet\(\{\s*walletChainType:\s*"ethereum-only"/s);
    assert.match(altanaRevokeForm, /connectWallet\(\{\s*walletChainType:\s*"ethereum-only"/s);
  });

  it('gates protected BNB calls on a real Privy access token', () => {
    assert.match(bnbAuthFetch, /export function useBnbAuthFetch/);
    assert.match(bnbAuthFetch, /useIdentityToken/);
    assert.match(bnbAuthFetch, /headers\.set\("x-privy-identity-token",\s*identityToken\)/);
    assert.match(bnbAuthFetch, /if \(token\) \{[\s\S]*headers\.set\("Authorization",\s*`Bearer \$\{token\}`\)/);
    assert.match(bnbAuthFetch, /credentials:\s*"include"/);
    assert.match(bnbAuthFetch, /response\.status === 401 && authenticated/);
    assert.match(bnbAuthFetch, /We could not verify your account\. Try again\./);
    assert.match(clientAuth, /req\.headers\.get\('x-privy-identity-token'\)/);
    assert.match(clientAuth, /req\.cookies\.get\('privy-token'\)/);
    assert.match(clientAuth, /req\.cookies\.get\('privy-id-token'\)/);
    assert.doesNotMatch(clientAuth, /x-privy-user-id/i);
    assert.match(requestForm, /useBnbAuthFetch/);
    assert.match(activateForm, /useBnbAuthFetch/);
    assert.match(activityClient, /!ready \|\| !authenticated/);
    assert.doesNotMatch(
      [bnbAuthFetch, requestForm, activateForm, activityClient].join('\n'),
      /Refresh session|Could not refresh|Preparing session|Preparing your session|protectedReady|tokenStatus|refreshToken|We could not finish sign-in|Sign in again|Session expired/,
    );
  });

  it('keeps the agent directory aligned and removes unsupported card fields', () => {
    assert.match(directory, /bnb-directory-summary-spacer/);
    assert.match(directory, /bnb-directory-meta-empty/);
    assert.match(directory, /const metadata = \[/);
    assert.match(directory, /label:\s*"Category"/);
    assert.match(directory, /label:\s*"Availability"/);
    assert.match(directory, /label:\s*"Reviews"/);
    assert.match(directory, /label:\s*"Price"/);
    assert.match(directory, /label:\s*"Identity"/);
    assert.match(agentsPage, /listBnbAgentsPage/);
    assert.match(agentsPage, /\$\{formatBnbAgentCount\(networkTotal\)\} BSC agents/);
    assert.match(directory, /compactPagination\(page,\s*pageCount\)/);
    assert.doesNotMatch(directory, /of \{totalAgents\} agents/);
    assert.doesNotMatch(directory, /item\.count|categories\.reduce\(\(sum,\s*item\) => sum \+ item\.count/);
    assert.doesNotMatch(directory, /label:\s*"Average score"|label:\s*"Supported protocols"|label:\s*"ERC-8004 identity"|label:\s*"Wallet"|label:\s*"x402"|label:\s*"Service endpoint"/);
    assert.match(bnbCss, /grid-template-columns:\s*minmax\(190px,\s*0\.86fr\)\s*minmax\(280px,\s*1\.24fr\)\s*minmax\(150px,\s*0\.5fr\)\s*minmax\(260px,\s*280px\)/);
    assert.match(bnbCss, /\.bnb-directory-actions \{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(bnbCss, /\.bnb-directory-actions \.bnb-button,/);
    assert.match(bnbCss, /\.bnb-wallet-panel/);
  });

  it('does not render empty profile sections or reusable filler copy', () => {
    assert.match(profilePage, /visibleServices\.length > 0/);
    assert.match(profilePage, /hasReviews \? \(/);
    assert.match(profilePage, /visibleCapabilities/);
    assert.match(profilePage, /bnbUsableServices/);
    assert.match(profilePage, /bnbSpecificCapabilities/);
    assert.match(profilePage, /bnb-agent-detail-grid/);
    assert.match(profilePage, /bnb-agent-profile-maincol/);
    assert.match(profilePage, /bnb-agent-action-card/);
    assert.match(profilePage, /Listed profile/);
    assert.match(profilePage, /Check availability/);
    assert.match(profilePage, /className="bnb-agent-section bnb-agent-technical-details"/);
    assert.doesNotMatch(profilePage, /BnbHero|BnbPanel|BnbSectionHeader|CategoryChip|StatusBadge/);
    assert.doesNotMatch(profilePage, /<RequestAccessForm agent=\{agent\}/);
    assert.doesNotMatch(profilePage, /What this agent handles/);
    assert.doesNotMatch(profilePage, /bnb-agent-work-panel|bnb-agent-profile-sections|bnb-agent-profile-rail/);
    assert.match(requestDialog, /role="dialog"/);
    assert.match(requestDialog, /showHeading=\{false\}/);
    assert.doesNotMatch(profilePage, /Marketplace signals|Selection signals|Why Hive ranks|Price not set|No service details|Service description unavailable/);
    assert.doesNotMatch(bnbUi, /export function ScoreGrid/);
    assert.doesNotMatch(bnbUi, /Price on request|No reviews yet|Data from 8004scan/);
  });

  it('lets users copy full wallet owner and agent wallet addresses from identity rows', () => {
    assert.match(copyButton, /navigator\.clipboard\.writeText\(value\)/);
    assert.match(copyButton, /aria-label=\{`Copy \$\{label\}`\}/);
    assert.match(profilePage, /label="Wallet owner"[\s\S]*copyValue=\{ownerAddress\}/);
    assert.match(profilePage, /label="Agent wallet"[\s\S]*copyValue=\{agentWallet\}/);
    assert.match(statusPage, /label="Wallet owner"[\s\S]*copyValue=\{matchedAgent\.ownerAddress\}/);
    assert.match(statusPage, /label="Agent wallet"[\s\S]*copyValue=\{matchedAgent\.agentWallet\}/);
    assert.match(bnbCss, /\.bnb-copy-button/);
    assert.match(bnbCss, /\.bnb-data-value/);
  });

  it('fails unavailable hire and session flows before producing dead wallet actions', () => {
    assert.match(activateRoute, /getBnbHireBlocker\(agent\)/);
    assert.match(activateRoute, /isNativeBnbBudget\(spendCap\)/);
    assert.match(activateRoute, /Enter a BNB budget/);
    assert.match(altanaRoute, /getBnbRuntimeReadiness\(\)/);
    assert.match(altanaRoute, /BNB session registry is not configured/);
  });

  it('keeps agent work and escrow settlement idempotent enough for retries', () => {
    assert.match(runRoute, /record\.work\?\.status === "completed"/);
    assert.match(runRoute, /record\.work\?\.status === "running"/);
    assert.match(settlementRoute, /record\.status === "released"/);
    assert.match(settlementRoute, /record\.status === "refunded"/);
    assert.match(settlementRoute, /Agent work must be completed before release/);
  });

  it('keeps account, wallet, and activity available from the header', () => {
    assert.match(bnbUi, /<BnbAccountButton active=\{active === "account"\} \/>/);
    assert.match(accountButton, /href="\/bnb\/account"/);
    assert.match(accountButton, /address \? shortAddress\(address\) : "Account"/);
    assert.match(accountButton, /bnb-account-desktop-label/);
    assert.match(accountButton, /bnb-account-mobile-label/);
    assert.match(bnbCss, /\.bnb-account-desktop-label \{[\s\S]*display:\s*none/);
    assert.match(accountPage, /<ReceiptsClient embedded \/>/);
    assert.match(accountPage, /Manage your wallet, requests, active work, and completed hires/);
    assert.match(accountClient, /Check wallet/);
    assert.match(accountClient, /Signed in as/);
    assert.doesNotMatch(accountClient, /Account ID|Status|accountId|Privy account/);
    assert.match(reportPage, /redirect\("\/bnb\/account#activity"\)/);
    assert.doesNotMatch(bnbUi, />Receipts</);
    assert.doesNotMatch(bnbUi, /\/bnb\/report/);
  });

  it('shows and manages access requests from account activity', () => {
    assert.match(activityClient, /records\.accessRequests\.map/);
    assert.match(activityClient, /cancelAccessRequest/);
    assert.match(activityClient, /\/api\/bnb\/access-request/);
    assert.match(activityClient, /Cancel request/);
    assert.match(activityClient, /Access requested/);
    assert.match(activityClient, /<h2>Activity<\/h2>/);
    assert.match(activityClient, /No activity yet/);
  });

  it('does not show stale prototype failure copy in the BNB app', () => {
    const appText = [
      statusPage,
      read('app/api/bnb/runtime/route.ts'),
      read('app/bnb/agents/AgentsDirectory.tsx'),
      read('app/bnb/_components/BnbUi.tsx'),
    ].join('\n');
    assert.doesNotMatch(appText, /Identity data is temporarily unavailable/);
    assert.doesNotMatch(appText, /verify a BNB address directly/i);
  });

  it('keeps the redesigned marketplace copy and display rules', () => {
    const home = read('app/bnb/page.tsx');
    assert.match(home, /What do you need an agent to do\?/);
    assert.match(home, /Find agents/);
    assert.doesNotMatch(home, /registered on BSC|Connected to the BNB ecosystem|Find an agent|Set the job terms|Review the result/);
    assert.match(agentsPage, /Search agents by capability and availability/);
    assert.doesNotMatch(agentsPage, /registered on BSC|agents shown/);
    assert.match(bnbUi, /function BnbFooter/);
    assert.match(bnbUi, /Find, hire, and track BNB Chain agents from one workspace/);
    assert.doesNotMatch(bnbUi, /components\/layout\/Footer|permissionless marketplace for autonomous agents/);
    assert.match(display, /export function bnbAgentDisplayName/);
    assert.match(display, /export function bnbListingDescription/);
    assert.match(display, /Ready to run/);
    assert.doesNotMatch(display, /Needs approval/);
    assert.match(display, /evoevo ai agent/i);
    assert.doesNotMatch(directory, /Request access/);
  });

  it('keeps live 8004scan discovery paged beyond the first 100 agents', () => {
    assert.match(catalog, /headers\["X-API-Key"\]\s*=\s*process\.env\.BNB_8004SCAN_API_KEY/);
    assert.match(catalog, /type Bnb8004SortBy = "created_at" \| "stars" \| "name" \| "token_id" \| "total_score"/);
    assert.match(catalog, /export async function listBnbAgentsPage/);
    assert.match(catalog, /const page = Math\.max\(Math\.trunc\(query\.page \|\| 1\),\s*1\)/);
    assert.match(catalog, /url\.searchParams\.set\("sortBy",\s*sortBy\)/);
    assert.match(catalog, /url\.searchParams\.set\("sortOrder",\s*"desc"\)/);
    assert.match(catalog, /url\.searchParams\.set\("page",\s*String\(safePage\)\)/);
    assert.match(catalog, /paginationRecord\.total/);
    assert.match(catalog, /hydrate8004AgentDetails/);
    assert.match(catalog, /sortAgents\(agents,\s*sort\)\.slice\(0,\s*limit\)/);
    assert.match(catalog, /fetch8004AgentDetail/);
    assert.match(catalog, /\/agents\/\$\{encodeURIComponent\(String\(chainId\)\)\}\/\$\{encodeURIComponent\(tokenId\)\}/);
    assert.match(catalog, /record\.agentWallet \?\? record\.agent_wallet/);
    assert.match(catalog, /record\.total_feedbacks/);
    assert.match(catalog, /record\.average_score/);
    assert.match(catalog, /record\.star_count/);
    assert.doesNotMatch(catalog, /sortBy",\s*"total_feedbacks"/);
    assert.doesNotMatch(catalog, /headers\.Authorization/);
  });

  it('ranks BNB agents by relevance, reputation, source quality, readiness, freshness, and completeness', () => {
    assert.match(catalog, /function scoreReputation\(agent: BnbAgentProfile\)/);
    assert.match(catalog, /agent\.feedback\.count/);
    assert.match(catalog, /agent\.sourceMetrics\?\.starCount/);
    assert.match(catalog, /agent\.sourceMetrics\?\.totalScore/);
    assert.match(catalog, /function scoreReadiness\(agent: BnbAgentProfile\)/);
    assert.match(catalog, /function scoreFreshness\(agent: BnbAgentProfile\)/);
    assert.match(catalog, /function scoreCompleteness\(agent: BnbAgentProfile\)/);
    assert.match(catalog, /const byRecommendation = \(a: BnbAgentProfile,\s*b: BnbAgentProfile\)/);
    assert.match(catalog, /\(b\.scoreBreakdown\?\.total \|\| 0\) - \(a\.scoreBreakdown\?\.total \|\| 0\)/);
    assert.match(catalog, /categorySearchText\(query\.category\)/);
    assert.match(catalog, /if \(directTerms\.length > 1\) \{[\s\S]*directHits >= Math\.min\(directTerms\.length,\s*2\)/);
    assert.match(catalog, /categoryInferenceKeywords/);
    assert.match(agentsPage, /listBnbAgentsPage\(\{[\s\S]*limit:\s*pageSize,[\s\S]*page,/);
    assert.doesNotMatch(agentsPage, /limit:\s*100/);
  });

  it('does not mark live indexed protocol labels as runnable without endpoints', () => {
    assert.match(types, /export type BnbExecutionStatus = "ready_to_run" \| "connectable" \| "listed_only" \| "unavailable"/);
    assert.match(catalog, /deriveExecutionStatus\(executionEndpoints\)/);
    assert.match(catalog, /activationFromExecution\(executionStatus\)/);
    assert.match(catalog, /record\.mcp_server \?\? record\.mcpServer/);
    assert.match(catalog, /record\.a2a_endpoint \?\? record\.a2aEndpoint/);
    assert.match(catalog, /rawMetadata\.offchain_content/);
    assert.doesNotMatch(catalog, /const hasCallableEndpoint = services\.some/);
    assert.doesNotMatch(catalog, /activationStatus:\s*hasCallableEndpoint \? "callable" : "request"/);
  });

  it('runs external agents only through bounded server-side adapters', () => {
    assert.match(endpointSecurity, /assertPublicHttpsUrl/);
    assert.match(endpointSecurity, /lookup\(checked\.url\.hostname,\s*\{ all:\s*true,\s*verbatim:\s*true \}\)/);
    assert.match(endpointSecurity, /Endpoint resolves to a private address/);
    assert.match(endpointSecurity, /Endpoint response is too large/);
    assert.match(mcpAdapter, /tools\/list|tools\/call/);
    assert.match(mcpAdapter, /safeFetchJson\(endpoint\.url/);
    assert.match(a2aAdapter, /message\/send/);
    assert.match(a2aAdapter, /fetchCard\(endpoint\)/);
    assert.match(adapterRegistry, /preflightBnbAgentAdapters/);
    assert.match(runRoute, /runBnbAgentAdapter\(agent,\s*record\)/);
  });
});
