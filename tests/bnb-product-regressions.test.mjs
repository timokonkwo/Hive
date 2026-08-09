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

  it('routes request-only agents into access requests, not escrow hire', () => {
    assert.match(runtime, /agent\.activationStatus === "callable"/);
    assert.match(runtime, /Request access before hiring this agent/);
    assert.match(bnbUi, /agent\.activationStatus === "callable"/);
    assert.match(directory, /agent\.activationStatus === "callable"/);
    assert.match(profilePage, /<RequestAccessDialog agent=\{agent\} \/>/);
    assert.match(requestDialog, /<RequestAccessForm agent=\{agent\} showHeading=\{false\} \/>/);
    assert.match(activatePage, /canHireBnbAgent\(agent\)/);
    assert.match(activatePage, /<RequestAccessForm agent=\{agent\} \/>/);
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
    assert.match(directory, /label:\s*"Average score"/);
    assert.match(directory, /label:\s*"Supported protocols"/);
    assert.match(directory, /label:\s*"ERC-8004 identity"/);
    assert.match(directory, /label:\s*"Wallet"/);
    assert.match(agentsPage, /agents shown/);
    assert.doesNotMatch(directory, /of \{totalAgents\} agents/);
    assert.doesNotMatch(directory, /integrations:\s*integrationSummary/);
    assert.match(bnbCss, /grid-template-columns:\s*minmax\(190px,\s*0\.9fr\)\s*minmax\(260px,\s*1\.2fr\)\s*minmax\(150px,\s*0\.55fr\)\s*minmax\(220px,\s*240px\)/);
    assert.match(bnbCss, /\.bnb-directory-actions \{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(bnbCss, /\.bnb-wallet-panel/);
  });

  it('does not render empty profile sections or reusable filler copy', () => {
    assert.match(profilePage, /visibleServices\.length > 0/);
    assert.match(profilePage, /hasReviews \? \(/);
    assert.match(profilePage, /hasUsableService/);
    assert.match(profilePage, /visibleCapabilities/);
    assert.match(profilePage, /isSpecificCapability/);
    assert.match(profilePage, /bnb-agent-profile-layout/);
    assert.match(profilePage, /bnb-agent-profile-maincol/);
    assert.match(profilePage, /bnb-agent-action-card/);
    assert.match(profilePage, /<RequestAccessDialog agent=\{agent\} \/>/);
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
    assert.match(accountPage, /Manage your BNB wallet, hires, alerts, and payments/);
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

  it('keeps live 8004scan discovery populated without the slow sorted query', () => {
    assert.match(catalog, /Math\.max\(limit,\s*80\)/);
    assert.match(catalog, /sortAgents\(agents,\s*sort,\s*query\.q\)\.slice\(0,\s*limit\)/);
    assert.doesNotMatch(catalog, /sortBy",\s*"total_feedbacks"/);
  });

  it('does not mark live indexed protocol labels as directly hireable without endpoints', () => {
    assert.match(catalog, /const hasCallableEndpoint = services\.some\(\(service\) => Boolean\(service\.endpoint\)\)/);
    assert.match(catalog, /activationStatus:\s*hasCallableEndpoint \? "callable" : "request"/);
  });
});
