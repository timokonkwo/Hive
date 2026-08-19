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
  const readiness = read('lib/bnb/readiness.ts');
  const studioV2 = read('lib/bnb/studio-v2.ts');
  const network = read('lib/bnb/network.ts');
  const bnbChain = read('lib/bnb/chain.ts');
  const clientChain = read('lib/bnb/client-chain.ts');
  const jobs = read('lib/bnb/jobs.ts');
  const delivery = read('lib/bnb/delivery.ts');
  const escrow = read('lib/bnb/escrow.ts');
  const settlementState = read('lib/bnb/settlement-state.ts');
  const catalog = read('lib/bnb/catalog.ts');
  const display = read('lib/bnb/display.ts');
  const activateRoute = read('app/api/bnb/activate/route.ts');
  const preflightRoute = read('app/api/bnb/activate/preflight/route.ts');
  const accessRoute = read('app/api/bnb/access-request/route.ts');
  const runRoute = read('app/api/bnb/activate/run/route.ts');
  const settlementRoute = read('app/api/bnb/activate/settlement/route.ts');
  const jobRoute = read('app/api/bnb/jobs/[recordId]/route.ts');
  const jobClient = read('app/bnb/jobs/[recordId]/BnbJobClient.tsx');
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
  const bnbAuth = read('lib/bnb/auth.ts');
  const walletAuth = read('lib/bnb/wallet-auth.ts');
  const walletChallengeRoute = read('app/api/bnb/auth/challenge/route.ts');
  const walletSessionRoute = read('app/api/bnb/auth/session/route.ts');
  const bnbCss = read('app/bnb/bnb.css');
  const requestDialog = read('app/bnb/agents/[chainId]/[tokenId]/RequestAccessDialog.tsx');
  const clientAuth = read('lib/client-auth.ts');
  const endpointSecurity = read('lib/bnb/endpoint-security.ts');
  const adapterRegistry = read('lib/bnb/adapters/registry.ts');
  const mcpAdapter = read('lib/bnb/adapters/mcp.ts');
  const a2aAdapter = read('lib/bnb/adapters/a2a.ts');
  const agentsRoute = read('app/api/bnb/agents/route.ts');
  const envExample = read('.env.example');

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
    assert.match(accessRoute, /requireBnbClient\(request,\s*"request access"\)/);
    assert.match(bnbAuth, /authenticateClientDetailed\(request\)/);
    assert.match(bnbAuth, /authReason:\s*auth\.reason/);
    assert.match(accessRoute, /clientAddress:\s*auth\.client\.userId/);
    assert.doesNotMatch(accessRoute, /body\.clientAddress/);
    assert.doesNotMatch(requestForm, /clientAddress/);
  });

  it('routes only executable agents into escrow hire', () => {
    assert.match(readiness, /export function classifyBnbAgentReadiness/);
    assert.match(readiness, /status:\s*"hireable"/);
    assert.match(readiness, /status:\s*"identity_only"/);
    assert.match(readiness, /status:\s*"unavailable"/);
    assert.match(readiness, /label:\s*"Ready to run"/);
    assert.match(readiness, /label:\s*"Listed"/);
    assert.match(readiness, /No callable job endpoint is available/);
    assert.match(readiness, /agent wallet is not a valid BSC address/i);
    assert.match(readiness, /export function bnbAgentReadinessLabel/);
    assert.match(readiness, /agent\.executionStatus === "ready_to_run"/);
    assert.match(runtime, /isBnbAgentHireable\(agent\)/);
    assert.match(runtime, /classifyBnbAgentReadiness\(agent\)/);
    assert.doesNotMatch(runtime, /Hive cannot run it yet/);
    assert.match(runtime, /does not expose a callable endpoint for this job/);
    assert.doesNotMatch(runtime, /Check this agent's endpoint before hiring/);
    assert.match(display, /bnbAgentReadinessLabel/);
    assert.match(display, /isBnbAgentHireable/);
    assert.match(directory, /bnbCanHireAgent/);
    assert.doesNotMatch(directory, /Connectable/);
    assert.doesNotMatch(directory, /Listed only/);
    assert.match(directory, /All identities/);
    assert.match(directory, /setStatus\("ready_to_run"\)/);
    assert.match(directory, /status && status !== "ready_to_run"/);
    assert.match(agentsPage, /const defaultStatus = "ready_to_run"/);
    assert.match(agentsPage, /if \(!value\) return defaultStatus/);
    assert.match(agentsPage, /if \(value === "all"\) return null/);
    assert.match(agentsPage, /ready BSC agents/);
    assert.match(agentsRoute, /function executionFilter/);
    assert.match(agentsRoute, /if \(!value\) return "ready_to_run"/);
    assert.match(agentsRoute, /if \(value === "all"\) return null/);
    assert.match(agentsRoute, /activation:\s*null/);
    assert.match(profilePage, /canHire \? \(/);
    assert.doesNotMatch(profilePage, /Check and hire/);
    assert.doesNotMatch(profilePage, /Check availability/);
    assert.doesNotMatch(profilePage, /<RequestAccessDialog agent=\{agent\}/);
    assert.match(preflightRoute, /preflightBnbAgentJob\(agent,\s*buildPreflightRecord/);
    assert.match(activateRoute, /hasRunnableBnbAdapter\(agent\)/);
    assert.match(activatePage, /canHireBnbAgent\(agent\)/);
    assert.match(activatePage, /redirect\(`\/bnb\/agents\/\$\{agent\.chainId\}/);
    assert.doesNotMatch(activatePage, /canCheck|canCheckAndHire|executionStatus === "connectable"/);
    assert.doesNotMatch(activatePage, /Not runnable through Hive|listed onchain|verified callable endpoint|Hive cannot run it yet/);
    assert.doesNotMatch(activatePage, /<RequestAccessForm agent=\{agent\}/);
    assert.doesNotMatch(directory, /Check and hire/);
    assert.doesNotMatch(directory, /agent\.executionStatus === "connectable"/);
    assert.doesNotMatch(directory, /\/bnb\/match\?intent=.*Contact/);
    assert.doesNotMatch(bnbUi, /\/bnb\/match\?intent=.*Contact/);
    assert.doesNotMatch(statusPage, /Request this agent/);
    assert.match(statusPage, /get8004scanAgentUrl\(matchedAgent\.chainId,\s*matchedAgent\.tokenId\)/);
  });

  it('keeps Privy auth and BNB wallet transactions wired together', () => {
    assert.match(providers, /from "@privy-io\/wagmi"/);
    assert.match(providers, /getClientBnbChain/);
    assert.match(clientChain, /bscTestnet/);
    assert.match(clientChain, /NEXT_PUBLIC_BNB_BSC_CHAIN_ID/);
    assert.match(activateForm, /useWallets\(\)/);
    assert.match(activateForm, /useSetActiveWallet\(\)/);
    assert.match(activateForm, /walletChainType:\s*"ethereum-only"/);
    assert.match(activateForm, /StepRail/);
    assert.match(activateForm, /paymentStages:\s*Exclude<Stage,\s*"job">\[\]\s*=\s*\["details",\s*"preflight",\s*"payment"\]/);
    assert.match(activateForm, /Validate job/);
    assert.match(activateForm, /Review payment/);
    assert.match(activateForm, /Create job/);
    assert.match(activateForm, /JobStatusPanel/);
    assert.match(activateForm, /getClientBnbChainId/);
    assert.match(activateForm, /authReadyTimedOut/);
    assert.match(activateForm, /authInitializing = !ready && !address && !authReadyTimedOut/);
    assert.match(activateForm, /Wallet sign-in is still initializing/);
    assert.match(activateForm, /disabled=\{loading \|\| authBusy \|\| authInitializing\}/);
    assert.doesNotMatch(activateForm, /disabled=\{loading \|\| \(!ready && !walletAddress\)\}/);
    assert.doesNotMatch(activateForm, /x402 or BNB escrow/);
    assert.doesNotMatch(activateForm, /DeliveryStage|Confirm and fund|Continue to payment|Create hire|Hire saved|Saving creates the hire record/);
    assert.match(activityClient, /connectWallet\(\{\s*walletChainType:\s*"ethereum-only"/s);
    assert.match(accountClient, /useWallets\(\)/);
    assert.match(accountClient, /useSetActiveWallet\(\)/);
    assert.match(accountClient, /walletChainType:\s*"ethereum-only"/);
    assert.match(altanaSessionForm, /connectWallet\(\{\s*walletChainType:\s*"ethereum-only"/s);
    assert.match(altanaRevokeForm, /connectWallet\(\{\s*walletChainType:\s*"ethereum-only"/s);
  });

  it('gates protected BNB calls on Privy tokens or a verified wallet session', () => {
    assert.match(bnbAuthFetch, /export function useBnbAuthFetch/);
    assert.match(bnbAuthFetch, /useIdentityToken/);
    assert.match(bnbAuthFetch, /useSignMessage/);
    assert.match(bnbAuthFetch, /headers\.set\("x-privy-identity-token",\s*tokens\.identityToken\)/);
    assert.match(bnbAuthFetch, /if \(tokens\.accessToken\) \{[\s\S]*headers\.set\("Authorization",\s*`Bearer \$\{tokens\.accessToken\}`\)/);
    assert.match(bnbAuthFetch, /headers\.set\("x-hive-bnb-session",\s*walletSessionToken\)/);
    assert.match(bnbAuthFetch, /headers\.set\("x-hive-bnb-wallet-address",\s*walletAddress\)/);
    assert.match(bnbAuthFetch, /\/api\/bnb\/auth\/challenge/);
    assert.match(bnbAuthFetch, /\/api\/bnb\/auth\/session/);
    assert.match(bnbAuthFetch, /signMessageAsync\(\{ message \}\)/);
    assert.match(bnbAuthFetch, /credentials:\s*"include"/);
    assert.match(bnbAuthFetch, /response\.status === 401 && authenticated/);
    assert.match(bnbAuthFetch, /shouldTryWalletSession\(await readJsonClone\(response\)\)/);
    assert.doesNotMatch(bnbAuthFetch, /restartBnbWalletLogin/);
    assert.doesNotMatch(bnbAuthFetch, /await logout\(\)/);
    assert.doesNotMatch(bnbAuthFetch, /readStoredPrivyTokens|localStorage|Session expired/);
    assert.doesNotMatch(bnbAuthFetch, /Hive could not get a Privy auth token yet/);
    assert.match(clientAuth, /export async function authenticateClientDetailed/);
    assert.match(clientAuth, /reason:\s*'missing_token'/);
    assert.match(clientAuth, /req\.headers\.get\('x-privy-identity-token'\)/);
    assert.match(clientAuth, /cookieTokenNames/);
    assert.match(clientAuth, /looksLikeJwt\(cookie\.value\)/);
    assert.doesNotMatch(clientAuth, /x-privy-user-id/i);
    assert.match(bnbAuth, /authenticateBnbWalletSession\(request\)/);
    assert.match(bnbAuth, /walletAuthReason:\s*walletAuth\.reason/);
    assert.match(walletAuth, /new SignJWT/);
    assert.match(walletAuth, /jwtVerify/);
    assert.match(walletAuth, /verifyMessage/);
    assert.match(walletAuth, /BNB_WALLET_SESSION_COOKIE/);
    assert.match(walletAuth, /httpOnly:\s*true/);
    assert.match(walletChallengeRoute, /createBnbWalletChallenge/);
    assert.match(walletSessionRoute, /createBnbWalletSession/);
    assert.match(walletSessionRoute, /setBnbWalletSessionCookie/);
    assert.match(requestForm, /useBnbAuthFetch/);
    assert.match(activateForm, /useBnbAuthFetch/);
    assert.match(activityClient, /\(!ready && !address\) \|\| \(!authenticated && !address\)/);
    assert.doesNotMatch([requestForm, activateForm, activityClient].join('\n'), /Refresh session|Could not refresh|protectedReady|tokenStatus|refreshToken|We could not finish sign-in/);
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
    assert.match(display, /GENERIC_SERVICE_LABELS/);
    assert.match(display, /UNLISTED_SERVICE_PRICES/);
    assert.match(display, /function isUserFacingBnbService/);
    assert.match(profilePage, /bnb-agent-detail-grid/);
    assert.match(profilePage, /bnb-agent-profile-maincol/);
    assert.match(profilePage, /bnb-agent-sidebar/);
    assert.match(profilePage, /bnb-agent-sidebar-card/);
    assert.doesNotMatch(profilePage, /Check and hire/);
    assert.doesNotMatch(profilePage, /Check availability/);
    assert.equal((profilePage.match(/description \? <p>\{description\}<\/p>/g) || []).length, 1);
    assert.match(profilePage, /className="bnb-agent-section bnb-agent-sidebar-card bnb-agent-technical-details"/);
    assert.doesNotMatch(profilePage, /BnbHero|BnbPanel|BnbSectionHeader|CategoryChip|StatusBadge/);
    assert.doesNotMatch(profilePage, /<RequestAccessForm agent=\{agent\}/);
    assert.doesNotMatch(profilePage, /What this agent handles/);
    assert.doesNotMatch(profilePage, /bnb-agent-action-card|bnb-agent-work-panel|bnb-agent-profile-sections|bnb-agent-profile-rail/);
    assert.doesNotMatch(profilePage, /<table className="bnb-agent-services">/);
    assert.doesNotMatch(profilePage, /<th>Availability<\/th>/);
    assert.doesNotMatch(profilePage, /service\.endpoint \? "Ready"/);
    assert.match(requestDialog, /role="dialog"/);
    assert.match(requestDialog, /showHeading=\{false\}/);
    assert.doesNotMatch(profilePage, /Marketplace signals|Selection signals|Why Hive ranks|Price not set|No service details|Service description unavailable/);
    assert.doesNotMatch(bnbUi, /export function ScoreGrid/);
    assert.doesNotMatch(bnbUi, /Price on request|No reviews yet|Data from 8004scan/);
  });

  it('lets users copy full wallet owner and agent wallet addresses from identity rows', () => {
    assert.match(copyButton, /navigator\.clipboard\.writeText\(value\)/);
    assert.match(copyButton, /aria-label=\{`Copy \$\{label\}`\}/);
    assert.match(bnbChain, /EIGHT004SCAN_AGENT_CHAIN_SLUGS:\s*Record<number,\s*string>/);
    assert.match(bnbChain, /56:\s*"bsc"/);
    assert.match(bnbChain, /97:\s*"bsc-testnet"/);
    assert.match(bnbChain, /export function get8004scanAgentUrl/);
    assert.match(profilePage, /const identityUrl = get8004scanAgentUrl\(agent\.chainId,\s*agent\.tokenId\)/);
    assert.doesNotMatch(profilePage, /8004scan\.io\/agents\/\$\{agent\.chainId\}/);
    assert.match(profilePage, /label="Wallet owner"[\s\S]*copyValue=\{ownerAddress\}/);
    assert.match(profilePage, /label="Agent wallet"[\s\S]*copyValue=\{agentWallet\}/);
    assert.match(statusPage, /label="Wallet owner"[\s\S]*copyValue=\{matchedAgent\.ownerAddress\}/);
    assert.match(statusPage, /label="Agent wallet"[\s\S]*copyValue=\{matchedAgent\.agentWallet\}/);
    assert.match(clientChain, /export function getClientBnbExplorerAddressUrl/);
    assert.match(clientChain, /export function getClientBnbExplorerTxUrl/);
    assert.match(activateForm, /getClientBnbExplorerAddressUrl\(escrowAddress\)/);
    assert.match(activateForm, /getClientBnbExplorerTxUrl\(paymentHash\)/);
    assert.match(activateForm, /CopyValueButton/);
    assert.match(jobClient, /label="Escrow contract"[\s\S]*getClientBnbExplorerAddressUrl\(record\.payment\.contractAddress\)[\s\S]*copyValue=\{record\.payment\.contractAddress\}/);
    assert.match(jobClient, /label="Escrow job"[\s\S]*copyValue=\{record\.payment\.jobId\}/);
    assert.match(jobClient, /label="Funded"[\s\S]*href=\{fundedExplorerUrl\}[\s\S]*copyValue=\{record\.payment\.transactionHash\}/);
    assert.match(jobClient, /label="Settlement"[\s\S]*href=\{settlementExplorerUrl\}[\s\S]*copyValue=\{record\.settlement\.transactionHash\}/);
    assert.match(bnbCss, /\.bnb-copy-button/);
    assert.match(bnbCss, /\.bnb-data-value/);
    assert.match(bnbCss, /\.bnb-data-value a/);
  });

  it('fails unavailable hire and session flows before producing dead wallet actions', () => {
    assert.match(activateRoute, /const escrowRequired = shouldRequireBnbEscrow\(agent\)/);
    assert.match(activateRoute, /getBnbHireBlocker\(agent,\s*\{\s*requireEscrow:\s*escrowRequired\s*\}\)/);
    assert.match(activateRoute, /escrowRequired && !isNativeBnbBudget\(spendCap\)/);
    assert.match(activateRoute, /Enter a positive BNB budget/);
    assert.match(altanaRoute, /getBnbRuntimeReadiness\(\)/);
    assert.match(altanaRoute, /BNB session registry is not configured/);
  });

  it('keeps the hire form constrained instead of accepting arbitrary task input', () => {
    assert.match(jobs, /export type BnbJobFieldKind = "text" \| "textarea" \| "select" \| "amount" \| "integer" \| "address_or_text"/);
    assert.match(types, /"concentrated_liquidity"/);
    assert.match(types, /export type BnbHireIntentInput/);
    assert.match(types, /export type BnbJobPreflightResult/);
    assert.match(types, /paymentRequired\?: boolean/);
    assert.match(jobs, /taskTypes:\s*readonly string\[\]/);
    assert.match(jobs, /BNB_YIELD_SOURCE_CONNECTED_WALLET/);
    assert.match(jobs, /BNB_YIELD_SOURCE_SELECTED_ASSET/);
    assert.match(jobs, /BNB_YIELD_ASSETS/);
    assert.match(jobs, /BNB_HEALTH_PROTOCOLS/);
    assert.match(jobs, /BNB_YIELD_PROTOCOLS/);
    assert.match(jobs, /BNB_V3_DEXES/);
    assert.match(jobs, /label:\s*"Asset"/);
    assert.match(jobs, /label:\s*"Token address"/);
    assert.match(jobs, /label:\s*"Protocol"/);
    assert.doesNotMatch(jobs, /All supported/);
    assert.doesNotMatch(jobs, /label:\s*"Asset or wallet"/);
    assert.match(jobs, /normalizeYieldFields/);
    assert.match(jobs, /getBnbAgentJobCapability/);
    assert.match(jobs, /supportedBnbProtocolsForAgent/);
    assert.match(jobs, /detectNamedProtocols/);
    assert.match(jobs, /concentrated_liquidity/);
    assert.match(jobs, /Token 0/);
    assert.match(jobs, /Token 1 amount/);
    assert.match(jobs, /Lower price/);
    assert.match(jobs, /Upper price/);
    assert.match(jobs, /capabilityForBnbAgent/);
    assert.match(jobs, /allowedBnbJobCapabilitiesForAgent/);
    assert.match(jobs, /isBnbJobCapabilityAllowedForAgent/);
    assert.match(jobs, /unsupportedBnbJobCapabilityReason/);
    assert.match(jobs, /validateBnbJobField/);
    assert.match(jobs, /validateOptionalBnbJobField/);
    assert.match(jobs, /validateBnbJobPriceBounds/);
    assert.match(jobs, /buildBnbIntentJobSpec/);
    assert.match(jobs, /withBnbWalletJobContext/);
    assert.match(jobs, /walletOrPosition:\s*walletAddress/);
    assert.match(jobs, /field\.kind === "select"/);
    assert.match(jobs, /field\.kind === "amount"/);
    assert.match(jobs, /Choose a valid task/);
    assert.match(jobs, /validateBnbJobDefinitionFields/);
    assert.match(jobs, /visibleBnbJobFields/);
    assert.match(jobs, /summaryBnbJobFields/);
    assert.match(jobs, /isBnbJobFieldRequired/);
    assert.match(jobs, /buildBnbIntentJobSpec\(input:\s*BnbHireIntentInput,\s*agent\?:\s*BnbAgentCapabilitySource/);
    assert.match(jobs, /buildBnbJobSpec\([\s\S]*agent\?:\s*BnbAgentCapabilitySource/);
    assert.match(jobs, /Upper bound must be higher than lower bound/);
    assert.match(preflightRoute, /intentWithDefaultCapability/);
    assert.match(preflightRoute, /isBnbJobCapabilityAllowedForAgent\(agent,\s*intentWithDefaultCapability\.capability\)/);
    assert.match(preflightRoute, /buildBnbIntentJobSpec\(withDefaultWalletTarget\(intentWithDefaultCapability,\s*walletAddress\),\s*agent\)/);
    assert.match(preflightRoute, /executionWalletAddress\(request,\s*auth\.client\.address\)/);
    assert.match(preflightRoute, /preflightBnbAgentJob\(agent,\s*buildPreflightRecord/);
    assert.match(preflightRoute, /const blocker = adapterBlocker \|\| hireBlocker/);
    assert.match(preflightRoute, /canProceed:\s*!blocker/);
    assert.match(activateRoute, /isBnbJobCapabilityAllowedForAgent\(agent,\s*requestedCapability\)/);
    assert.match(activateRoute, /buildBnbIntentJobSpec\(withDefaultWalletTarget\(intentWithDefaultCapability as BnbHireIntentInput,\s*walletAddress\),\s*agent\)/);
    assert.match(activateRoute, /buildBnbJobSpec\(\{[\s\S]*instructions:\s*readString\(jobSpecInput\.instructions\),[\s\S]*\},\s*agent\)/);
    assert.match(activateRoute, /preflightBnbAgentJob\(agent,\s*buildPreflightRecord/);
    assert.match(activateForm, /validateJobForm/);
    assert.match(activateForm, /capabilityForBnbAgent\(agent\)/);
    assert.match(activateForm, /allowedBnbJobCapabilitiesForAgent\(agent\)/);
    assert.match(activateForm, /getBnbAgentJobCapability\(agent,\s*capability\)/);
    assert.match(activateForm, /visibleBnbJobFields\(definition,\s*options\)/);
    assert.match(activateForm, /isBnbJobFieldRequired\(capability,\s*taskType,\s*fields,\s*field\)/);
    assert.match(activateForm, /allowedCapabilities\.includes\(nextCapability\)/);
    assert.match(activateForm, /capabilityOptions\.length > 1/);
    assert.match(activateForm, /bnb-static-field/);
    assert.doesNotMatch(activateForm, /Object\.values\(BNB_JOB_CAPABILITIES\)/);
    assert.match(activateForm, /validateBnbJobField/);
    assert.match(activateForm, /validateBnbJobPriceBounds/);
    assert.match(activateForm, /Job validated/);
    assert.match(activateForm, /Job cannot run/);
    assert.match(activateForm, /blockedIssues/);
    assert.match(activateForm, /body=\{result\?\.canProceed \? "Agent and job inputs checked\." : "This agent cannot run this job\."\}/);
    assert.doesNotMatch(activateForm, /MCP endpoint|endpoint accepted job|endpoint rejected job|accepted job|rejected job/);
    assert.match(activateForm, /Desired outcome \*/);
    assert.match(activateForm, /Optional details/);
    assert.match(activateForm, /visibleJobFields\(definition,\s*\{\s*fields,\s*taskType\s*\}\)/);
    assert.match(activateForm, /yieldUsesConnectedWallet/);
    assert.match(activateForm, /applyJobFieldDefaults/);
    assert.match(activateForm, /defaultYieldSource/);
    assert.match(activateForm, /defaultYieldAsset/);
    assert.match(activateForm, /validateYieldClientFields/);
    assert.match(jobs, /if \(field\.key === "yieldSource"\) return false/);
    assert.match(activateForm, /Scope[\s\S]*All wallet assets/);
    assert.match(activateForm, /isConditionallyRequiredJobField/);
    assert.match(activateForm, /jobFieldValue\(\{ capability,\s*field,\s*fields,\s*walletAddress \}\)/);
    assert.match(activateForm, /defaultIntentTarget\(capability,\s*advancedFields,\s*walletAddress\)/);
    assert.match(activateForm, /validateOptionalBnbJobField/);
    assert.match(activateForm, /definition\.taskTypes\.map/);
    assert.match(activateForm, /inputMode=\{kind === "integer" \? "numeric" : kind === "amount" \? "decimal" : "text"\}/);
    assert.match(activateForm, /paymentRequired \? \(/);
    assert.match(activateForm, /Escrow budget \*/);
    assert.match(activateForm, /expiryOptions\.map/);
    assert.match(activateForm, /bnb-field-error/);
    assert.match(activateForm, /\/api\/bnb\/activate\/preflight/);
    assert.doesNotMatch(activateForm, /<input value=\{taskType\}/);
    assert.doesNotMatch(activateForm, /placeholder=\{`0\.001 \$\{nativeSymbol\}`\}/);
  });

  it('does not require escrow for unpriced public agent runs', () => {
    assert.match(runtime, /export function shouldRequireBnbEscrow/);
    assert.match(runtime, /BNB_AGENT_RUN_REQUIRES_ESCROW/);
    assert.match(runtime, /BNB_ZERO_PRICE_RUNS_ENABLED/);
    assert.match(runtime, /function zeroPriceRunsEnabled/);
    assert.match(runtime, /if \(!listedPayment && zeroPriceRunsEnabled\(\) && !forceEscrowForUnpricedAgents\(\)\) return false/);
    assert.match(runtime, /BNB_FORCE_ESCROW_FOR_UNPRICED_AGENTS/);
    assert.match(runtime, /forceEscrowForUnpricedAgents/);
    assert.match(runtime, /if \(listedPayment\) return configured \?\? true/);
    assert.match(runtime, /hasListedPayment\(agent\)/);
    assert.match(display, /export function bnbAgentHasListedPayment/);
    assert.match(activateForm, /bnbAgentHasListedPayment\(agent\)/);
    assert.match(activateForm, /effectivePaymentRequired = listedPaymentRequired \|\| preflightResult\?\.paymentRequired === true \|\| result\?\.paymentRequired === true/);
    assert.match(activateForm, /paymentRequired:\s*effectivePaymentRequired/);
    assert.match(activateForm, /spendCapLabel = effectivePaymentRequired/);
    assert.match(runtime, /requireEscrow && !isAddress\(agent\.agentWallet\)/);
    assert.match(preflightRoute, /paymentRequired = shouldRequireBnbEscrow\(runnableAgent\)/);
    assert.match(preflightRoute, /getBnbHireBlocker\(runnableAgent,\s*\{\s*requireEscrow:\s*paymentRequired\s*\}\)/);
    assert.match(activateRoute, /status:\s*"not_required" as const/);
    assert.match(activateRoute, /walletConfirmationRequired:\s*escrowRequired/);
    assert.match(runRoute, /shouldRequireBnbEscrow\(agent\)/);
    assert.match(runRoute, /record\.limits\.walletConfirmationRequired !== false/);
    assert.match(jobRoute, /status:\s*"not_required" as const/);
    assert.match(activateForm, /paymentRequest\?\.status === "not_required" \? "job" : "payment"/);
    assert.match(activateForm, /paymentRequest\.status === "not_required"/);
    assert.match(activateForm, /Create job/);
    assert.match(activateForm, /showSettlementActions = !paymentNotRequired && delivered && !closed/);
    assert.doesNotMatch(activateForm, /No escrow payment is required|public endpoint|Start job|Agent is running|Delivery ready|Review the work before releasing payment/);
    assert.match(jobClient, /paymentRequest\?\.status === "not_required"/);
    assert.match(jobClient, /return "Ready"/);
    assert.match(jobClient, /Run details/);
    assert.match(jobClient, /showSettlementActions = !paymentNotRequired && delivered && !closed/);
    assert.match(activityClient, /showSettlementActions = !paymentNotRequired && completed && !closed/);
    assert.doesNotMatch(jobClient, /No escrow payment is required|public endpoint/);
    assert.doesNotMatch(activityClient, /No escrow payment is required|public endpoint/);
  });

  it('keeps agent work and escrow settlement idempotent enough for retries', () => {
    assert.match(runRoute, /record\.work\?\.status === "completed"/);
    assert.match(runRoute, /record\.work\?\.status === "running"/);
    assert.match(settlementRoute, /record\.status === "paid"/);
    assert.match(settlementRoute, /record\.status === "released"/);
    assert.match(settlementRoute, /record\.status === "refunded"/);
    assert.match(settlementRoute, /Review the agent delivery before releasing payment/);
    assert.match(settlementRoute, /readBnbEscrowJob/);
    assert.match(settlementRoute, /buildBnbEscrowSettlementRequest\(settlementRecord,\s*action\)/);
    assert.match(escrow, /BNB_ESCROW_FUND_GAS_LIMIT = 600_000n/);
    assert.match(escrow, /BNB_ESCROW_SETTLEMENT_GAS_LIMIT = 500_000n/);
    assert.match(escrow, /gasLimit:\s*BNB_ESCROW_FUND_GAS_LIMIT\.toString\(\)/);
    assert.match(escrow, /gasLimit:\s*BNB_ESCROW_SETTLEMENT_GAS_LIMIT\.toString\(\)/);
    assert.match(activateForm, /gas:\s*result\.paymentRequest\.gasLimit \? BigInt\(result\.paymentRequest\.gasLimit\) : undefined/);
    assert.match(activateForm, /gas:\s*settlementRequest\.gasLimit \? BigInt\(settlementRequest\.gasLimit\) : undefined/);
    assert.match(jobClient, /gas:\s*job\.paymentRequest\.gasLimit \? BigInt\(job\.paymentRequest\.gasLimit\) : undefined/);
    assert.match(jobClient, /gas:\s*settlementRequest\.gasLimit \? BigInt\(settlementRequest\.gasLimit\) : undefined/);
    assert.match(activityClient, /gas:\s*settlementRequest\.gasLimit \? BigInt\(settlementRequest\.gasLimit\) : undefined/);
    assert.match(escrow, /getBnbEscrowRefundBlocker/);
    assert.match(escrow, /nowSeconds <= expiresAt/);
    assert.match(escrow, /Refund unlocks after/);
    assert.match(settlementState, /bnbRefundUnavailableReason/);
    assert.match(settlementState, /if \(!expiresAt\) return ""/);
    assert.match(jobClient, /bnbRefundUnavailableReason\(record\)/);
    assert.match(activityClient, /bnbRefundUnavailableReason\(record\)/);
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
    assert.doesNotMatch(accountClient, /Account ID|accountId|Privy account/);
    assert.match(reportPage, /redirect\("\/bnb\/account#activity"\)/);
    assert.doesNotMatch(bnbUi, />Receipts</);
    assert.doesNotMatch(bnbUi, /\/bnb\/report/);
  });

  it('shows and manages access requests from account activity', () => {
    assert.match(activityClient, /records\.accessRequests\.map/);
    assert.match(activityClient, /\/bnb\/jobs\/\$\{encodeURIComponent\(record\.recordId\)\}/);
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
    assert.match(readiness, /Ready to run/);
    assert.doesNotMatch(display, /Needs approval/);
    assert.match(display, /evoevo ai agent/i);
    assert.doesNotMatch(directory, /Request access/);
  });

  it('keeps live 8004scan discovery paged beyond the first 100 agents', () => {
    assert.match(catalog, /process\.env\.BNB_8004SCAN_PRO_API_KEY\?\.trim\(\) \|\| process\.env\.BNB_8004SCAN_API_KEY\?\.trim\(\)/);
    assert.match(catalog, /headers\["X-API-Key"\]\s*=\s*apiKey/);
    assert.match(catalog, /function get8004CacheTtlSeconds/);
    assert.match(catalog, /BNB_8004SCAN_CACHE_TTL_SECONDS/);
    assert.match(catalog, /next:\s*\{\s*revalidate:\s*get8004CacheTtlSeconds\(revalidate\)\s*\}/);
    assert.match(catalog, /type Bnb8004SortBy = "created_at" \| "stars" \| "name" \| "token_id" \| "total_score"/);
    assert.match(catalog, /export async function listBnbAgentsPage/);
    assert.match(catalog, /const page = Math\.max\(Math\.trunc\(query\.page \|\| 1\),\s*1\)/);
    assert.match(catalog, /url\.searchParams\.set\("sortBy",\s*sortBy\)/);
    assert.match(catalog, /url\.searchParams\.set\("sortOrder",\s*"desc"\)/);
    assert.match(catalog, /url\.searchParams\.set\("page",\s*String\(safePage\)\)/);
    assert.match(catalog, /paginationRecord\.total/);
    assert.match(catalog, /hydrate8004AgentDetails/);
    assert.match(catalog, /const liveAgents = uniqueAgents\(\[\.\.\.semanticAgents,\s*\.\.\.livePage\.agents\]\)\.slice\(0,\s*limit\)/);
    assert.doesNotMatch(catalog, /const liveAgents = await hydrate8004AgentDetails/);
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
    assert.match(mcpAdapter, /normalizeInputSchema/);
    assert.match(mcpAdapter, /tool\.inputSchema \?\? tool\.input_schema \?\? tool\.parameters \?\? tool\.schema/);
    assert.match(mcpAdapter, /chainnames/);
    assert.match(mcpAdapter, /useraddress/);
    assert.match(mcpAdapter, /lower === "project"/);
    assert.match(mcpAdapter, /protocolForSchema/);
    assert.match(mcpAdapter, /poolForSchema/);
    assert.match(mcpAdapter, /capabilityToolBlocker/);
    assert.match(mcpAdapter, /getenabledcollateral/);
    assert.match(mcpAdapter, /This agent does not expose a health-factor tool for this job/);
    assert.match(mcpAdapter, /exposes a directory tool, not a/);
    assert.match(mcpAdapter, /capabilityToolScore/);
    assert.match(mcpAdapter, /isDirectoryTool/);
    assert.match(mcpAdapter, /This agent does not expose a matching/);
    assert.match(mcpAdapter, /getuserhealthindicators/);
    assert.match(mcpAdapter, /toolArguments\(tool,\s*agent,\s*record\)/);
    assert.match(mcpAdapter, /enumValuesForSchema/);
    assert.match(mcpAdapter, /enumValueForSchema\(property,\s*\[String\(value\)\]\) \|\| undefined/);
    assert.doesNotMatch(mcpAdapter, /lower === "pair" \|\| lower === "pool" \|\| lower === "poolorpair"/);
    assert.match(mcpAdapter, /schema\.additionalProperties === false/);
    assert.match(mcpAdapter, /preflightJob/);
    assert.match(a2aAdapter, /message\/send/);
    assert.match(a2aAdapter, /fetchCard\(endpoint\)/);
    assert.match(adapterRegistry, /preflightBnbAgentAdapters/);
    assert.match(adapterRegistry, /preflightBnbAgentJob/);
    assert.match(runRoute, /withRunWalletContext\(record,\s*executionWalletAddress\(request,\s*auth\.client\.address\)\)/);
    assert.match(runRoute, /runBnbAgentAdapter\(agent,\s*executionRecord\)/);
  });

  it('uses BSC Testnet-aware chain configuration for escrow testing', () => {
    assert.match(network, /HIVE_BNB_TESTNET/);
    assert.match(network, /chainId:\s*97/);
    assert.match(network, /nativeSymbol:\s*"tBNB"/);
    assert.match(network, /testnet\.bscscan\.com/);
    assert.match(network, /BNB_NETWORK/);
    assert.match(network, /BNB_BSC_CHAIN_ID/);
    assert.match(runtime, /network:\s*network\.network/);
    assert.match(runtime, /chainId:\s*network\.chainId/);
    assert.match(envExample, /BNB_NETWORK=testnet/);
    assert.match(envExample, /NEXT_PUBLIC_BNB_BSC_CHAIN_ID=97/);
  });

  it('documents BNB Agent Studio V2 configuration without exposing secrets at runtime', () => {
    [
      'BNB_AGENT_STUDIO_ENABLED',
      'BNB_AGENT_STUDIO_API_BASE',
      'BNB_AGENT_STUDIO_API_KEY',
      'BNB_AGENT_STUDIO_PROJECT_ID',
      'BNB_AGENT_STUDIO_PAYMASTER_ENABLED',
      'BNB_8004SCAN_PRO_API_KEY',
      'BNB_8004SCAN_TIMEOUT_MS',
      'BNB_8004SCAN_CACHE_TTL_SECONDS',
      'BNB_ERC8183_ENABLED',
      'BNB_X402_ENABLED',
      'BNB_X402_FACILITATOR_URL',
      'BNB_X402_RECEIVER_WALLET',
      'BNB_ZERO_PRICE_RUNS_ENABLED',
      'BNB_REFERENCE_AGENTS_JSON',
      'BNB_REFERENCE_AGENT_SIGNING_KEY',
      'BNB_REFERENCE_AGENT_WEBHOOK_SECRET',
      'BNB_ALTANA_ENABLED',
      'BNB_ALTANA_API_BASE',
      'BNB_ALTANA_API_KEY',
      'BNB_ALTANA_EXPLORER_BASE',
      'BNB_ALTANA_KEYSTORE_ADDRESS',
      'BNB_PANCAKESWAP_ENABLED',
      'BNB_PANCAKESWAP_API_BASE',
      'BNB_PANCAKESWAP_SUBGRAPH_URL',
      'BNB_PANCAKESWAP_DEEPLINK_BASE',
      'BNB_TERMIX_REPORT_ENABLED',
      'BNB_TERMIX_EVIDENCE_BUCKET_URL',
      'BNB_MARKETPLACE_ANALYTICS_ENABLED',
      'BNB_MARKETPLACE_ADMIN_SECRET',
      'BNB_MARKETPLACE_ERROR_WEBHOOK_URL',
    ].forEach((name) => assert.match(envExample, new RegExp(`${name}=`)));

    assert.match(studioV2, /export function getBnbStudioV2Readiness/);
    assert.match(studioV2, /apiConfigured:\s*envPresent\("BNB_AGENT_STUDIO_API_BASE"\) && envPresent\("BNB_AGENT_STUDIO_API_KEY"\)/);
    assert.match(studioV2, /scanProConfigured:\s*envPresent\("BNB_8004SCAN_PRO_API_KEY"\) \|\| envPresent\("BNB_8004SCAN_API_KEY"\)/);
    assert.match(studioV2, /boundedInteger\("BNB_8004SCAN_TIMEOUT_MS",\s*3000,\s*500,\s*15000\)/);
    assert.match(studioV2, /x402FacilitatorConfigured:\s*envPresent\("BNB_X402_FACILITATOR_URL"\)/);
    assert.match(studioV2, /altanaApiConfigured:\s*envPresent\("BNB_ALTANA_API_BASE"\) && envPresent\("BNB_ALTANA_API_KEY"\)/);
    assert.match(studioV2, /pancakeSwapSubgraphConfigured:\s*envPresent\("BNB_PANCAKESWAP_SUBGRAPH_URL"\)/);
    assert.match(studioV2, /errorWebhookConfigured:\s*envPresent\("BNB_MARKETPLACE_ERROR_WEBHOOK_URL"\)/);
    assert.match(catalog, /type ConfiguredBnbAgentEnvName = "BNB_REFERENCE_AGENTS_JSON" \| "BNB_HIVE_AGENTS_JSON"/);
    assert.match(catalog, /function getConfiguredBnbAgentsFromEnv\(envName:\s*ConfiguredBnbAgentEnvName\)/);
    assert.match(catalog, /\.\.\.getConfiguredBnbAgentsFromEnv\("BNB_REFERENCE_AGENTS_JSON"\)/);
    assert.match(catalog, /\.\.\.getConfiguredBnbAgentsFromEnv\("BNB_HIVE_AGENTS_JSON"\)/);
    assert.match(catalog, /return uniqueAgents\(\[/);
    assert.match(runtime, /getBnbStudioV2Readiness/);
    assert.match(runtime, /studioV2/);
    assert.doesNotMatch(runtime, /BNB_AGENT_STUDIO_API_KEY|BNB_ALTANA_API_KEY|BNB_REFERENCE_AGENT_SIGNING_KEY|BNB_MARKETPLACE_ADMIN_SECRET/);
    assert.doesNotMatch(studioV2, /process\.env\.[A-Z0-9_]+[^?\n]*}/);
  });

  it('stores capability-specific job specs and first-class delivery state', () => {
    assert.match(types, /export type BnbJobSpec/);
    assert.match(types, /export type BnbAgentDelivery/);
    assert.match(types, /expiresAt\?: number/);
    assert.match(jobs, /rebalancing/);
    assert.match(jobs, /grid_trading/);
    assert.match(jobs, /yield_optimisation/);
    assert.match(jobs, /health_factor/);
    assert.match(jobs, /buildBnbJobSpec/);
    assert.match(activateRoute, /buildBnbJobSpec/);
    assert.match(records, /jobSpec\?:\s*BnbJobSpec/);
    assert.match(records, /status:\s*walletConfirmationRequired \? "awaiting_funding" : "saved"/);
    assert.match(records, /delivery:\s*\{[\s\S]*status:\s*"pending"/);
    assert.match(records, /expiresAt:\s*payment\.expiresAt/);
    assert.match(runRoute, /delivery:\s*\{[\s\S]*status:\s*isComplete \? "delivered" : "running"/);
    assert.match(runRoute, /formatBnbDeliveryText\(work\.output,\s*executionRecord\.jobSpec\)/);
    assert.match(runRoute, /rawOutput:\s*work\.output/);
    assert.match(delivery, /formatBnbDeliveryText/);
    assert.match(delivery, /formatAgentDirectoryPayload/);
    assert.match(delivery, /This is not the requested result/);
    assert.match(delivery, /The agent returned a list of agents instead/);
    assert.match(delivery, /formatStructuredPayload/);
    assert.match(delivery, /Protocol mismatch/);
    assert.match(delivery, /healthFactor === "-1"/);
    assert.match(jobClient, /formatBnbDeliveryText\(output,\s*record\.jobSpec\)/);
    assert.match(activityClient, /formatBnbDeliveryText\(output,\s*record\.jobSpec\)/);
  });

  it('makes saved hires clickable jobs with resumable actions', () => {
    assert.match(jobRoute, /getBnbActivationRecord/);
    assert.match(jobRoute, /clientAddress:\s*auth\.client\.userId/);
    assert.match(jobRoute, /buildBnbEscrowPaymentRequest\(record\)/);
    assert.match(jobClient, /Fund .*job\.paymentRequest\.amountLabel/);
    assert.match(jobClient, /\/api\/bnb\/activate\/payment/);
    assert.match(jobClient, /\/api\/bnb\/activate\/run/);
    assert.match(jobClient, /\/api\/bnb\/activate\/settlement/);
    assert.match(jobClient, /showSettlementActions = !paymentNotRequired && delivered && !closed/);
    assert.match(jobClient, /Release payment/);
    assert.match(jobClient, /Refund after expiry/);
    assert.match(activityClient, /View/);
  });
});
