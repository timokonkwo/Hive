export const BNB_AGENT_CATEGORIES = [
  "Rebalancing",
  "Grid Trading",
  "Yield Optimisation",
  "Health Factor Monitoring",
] as const;

export type BnbAgentCategory = (typeof BNB_AGENT_CATEGORIES)[number];

export type BnbActivationStatus = "callable" | "request" | "discoverable";

export type BnbExecutionStatus = "ready_to_run" | "connectable" | "listed_only" | "unavailable";

export type BnbExecutionEndpoint = {
  adapter: "mcp" | "a2a" | "x402" | "http" | "web";
  url: string;
  label: string;
  verified: boolean;
  source: "8004scan" | "metadata" | "configured" | "local";
};

export type BnbAgentService = {
  name: string;
  type: "erc8183" | "a2a" | "mcp" | "x402" | "http" | "web" | "unknown";
  endpoint?: string;
  price?: string;
};

export type BnbScoreBreakdown = {
  total: number;
  fit: number;
  trust: number;
  activation: number;
  activity: number;
  risk: number;
  explanations: string[];
};

export type BnbAgentProfile = {
  chainId: number;
  tokenId: string;
  name: string;
  description: string;
  category: BnbAgentCategory;
  ownerAddress: string;
  agentWallet: string;
  identityRegistry: string;
  metadataUri?: string;
  services: BnbAgentService[];
  capabilities: string[];
  x402Support: boolean;
  erc8183Support: boolean;
  mcpSupport: boolean;
  a2aSupport: boolean;
  feedback: {
    count: number;
    positive: number;
    score: number;
    summary: string;
  };
  lastActivity: string;
  activationStatus: BnbActivationStatus;
  executionStatus?: BnbExecutionStatus;
  executionEndpoints?: BnbExecutionEndpoint[];
  scoreBreakdown?: BnbScoreBreakdown;
  sourceFreshness: {
    source: "8004scan" | "configured" | "local";
    fetchedAt: string;
    stale: boolean;
    note: string;
  };
  sourceMetrics?: {
    sourceAgentId?: string;
    verified?: boolean;
    starCount?: number;
    rank?: number;
    networkRank?: number;
    healthScore?: number;
    totalScore?: number;
    averageScore?: number;
    createdAt?: string;
    updatedAt?: string;
    supportedProtocols?: string[];
  };
};

export type BnbAgentQuery = {
  category?: string | null;
  q?: string | null;
  activation?: string | null;
  execution?: string | null;
  sort?: string | null;
  limit?: number;
  page?: number;
};

export type BnbAgentPageResult = {
  agents: BnbAgentProfile[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  source: string;
};

export type BnbPartnerTrack = "TermiX" | "PancakeSwap" | "Altana";

export type BnbPartnerTrackSummary = {
  id: string;
  name: BnbPartnerTrack;
  href: string;
  productFit: string;
  userProblem: string;
  hiveSurface: string;
};

export type BnbPancakeSwapUtility = {
  id: string;
  title: string;
  agentName: string;
  agentTokenId: string;
  userInput: string;
  agentOutput: string;
  decisionMetric: string;
  activationHref: string;
  scoring: Array<{ label: string; value: string }>;
};

export type BnbTermixCapture = {
  id: string;
  title: string;
  target: string;
};

export type BnbAltanaSessionTemplate = {
  id: string;
  title: string;
  agentTokenId: string;
  summary: string;
  spendCap: string;
  expiry: string;
};

export type BnbRecordStorage = {
  status: "database" | "process";
  collection: string;
  savedAt: string;
};

export type BnbTransactionRequest =
  | {
      status: "ready";
      chainId: 56;
      contractAddress: string;
      to: string;
      value: string;
      data: string;
      label: string;
    }
  | {
      status: "setup_required" | "budget_needs_bnb" | "agent_wallet_invalid" | "not_ready";
      reason: string;
    };

export type BnbAgentWork = {
  status: "not_started" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  output?: string;
  dataSources?: string[];
  error?: string;
};

export type BnbActivationRecord = {
  recordType: "hire";
  recordId: string;
  receiptId: string;
  status:
    | "saved"
    | "payment_submitted"
    | "payment_confirmed"
    | "payment_reverted"
    | "work_completed"
    | "release_submitted"
    | "released"
    | "refund_submitted"
    | "refunded";
  createdAt: string;
  updatedAt: string;
  clientAddress?: string;
  agent: Pick<BnbAgentProfile, "chainId" | "tokenId" | "name" | "activationStatus" | "executionStatus" | "agentWallet">;
  limits: {
    task: string;
    budget: string;
    expires: string;
    walletConfirmationRequired: true;
  };
  work?: BnbAgentWork;
  payment?: {
    chainId: 56;
    contractAddress?: string;
    transactionHash?: string;
    transactionStatus?: "success" | "reverted" | "pending";
    explorerUrl?: string;
    blockNumber?: string;
    jobId?: string;
  };
  settlement?: {
    action: "release" | "refund";
    transactionHash?: string;
    transactionStatus?: "success" | "reverted" | "pending";
    explorerUrl?: string;
    blockNumber?: string;
  };
  storage?: BnbRecordStorage;
};

export type BnbAccessRequestRecord = {
  recordType: "access_request";
  recordId: string;
  receiptId: string;
  status: "requested" | "cancelled" | "converted_to_hire";
  createdAt: string;
  updatedAt: string;
  clientAddress?: string;
  agent: Pick<BnbAgentProfile, "chainId" | "tokenId" | "name" | "activationStatus" | "executionStatus" | "agentWallet">;
  task: string;
  budget?: string;
  deadline?: string;
  contactPreference?: string;
  cancelReason?: string;
  cancelledAt?: string;
  convertedActivationRecordId?: string;
  storage?: BnbRecordStorage;
};

export type BnbTermixComparisonRecord = {
  recordType: "comparison";
  recordId: string;
  receiptId: string;
  status: "saved";
  createdAt: string;
  updatedAt: string;
  clientAddress?: string;
  caseId: string;
  title: string;
  target: string;
  manualTime: string;
  agentTime: string;
  agentTokenId: string;
  verdict: "pending" | "agent_better" | "equal" | "manual_better";
  artifactUrl?: string;
  transactionHash?: string;
  manualOutput?: string;
  agentOutput?: string;
  dataSources?: string[];
  qualityScore?: string;
  notes?: string;
  storage?: BnbRecordStorage;
};

export type BnbAltanaSessionRecord = {
  recordType: "wallet_watch";
  recordId: string;
  receiptId: string;
  status: "saved" | "grant_submitted" | "active" | "revoke_submitted" | "stopped";
  createdAt: string;
  updatedAt: string;
  clientAddress?: string;
  templateId: string;
  title: string;
  agentTokenId: string;
  walletLabel: string;
  walletAddress?: string;
  trigger: string;
  budget: string;
  expires: string;
  transactionHash?: string;
  permissionHash?: string;
  session?: {
    chainId: 56;
    contractAddress?: string;
    sessionId?: string;
    grantTransactionHash?: string;
    grantStatus?: "success" | "reverted" | "pending";
    grantExplorerUrl?: string;
    grantBlockNumber?: string;
    revokeTransactionHash?: string;
    revokeStatus?: "success" | "reverted" | "pending";
    revokeExplorerUrl?: string;
    revokeBlockNumber?: string;
  };
  stoppedAt?: string;
  stopNote?: string;
  storage?: BnbRecordStorage;
};

export type BnbRecordsSnapshot = {
  activations: BnbActivationRecord[];
  accessRequests: BnbAccessRequestRecord[];
  termixComparisons: BnbTermixComparisonRecord[];
  altanaSessions: BnbAltanaSessionRecord[];
  storage: "database" | "process";
  lastUpdated: string;
};

export type BnbBscAddressSummary = {
  address: string;
  valid: boolean;
  checkedAt: string;
  explorerUrl: string;
  balanceBNB?: string;
  transactionCount?: number;
  accountType?: "contract" | "wallet";
  error?: string;
};
