export const BNB_AGENT_CATEGORIES = [
  "Rebalancing",
  "Grid Trading",
  "Yield Optimisation",
  "Health Factor Monitoring",
  "Other",
] as const;

export type BnbAgentCategory = (typeof BNB_AGENT_CATEGORIES)[number];

export type BnbActivationStatus = "callable" | "request" | "discoverable";

export type BnbExecutionStatus = "ready_to_run" | "connectable" | "listed_only" | "unavailable";

export type BnbAgentSource = "8004scan" | "configured" | "agent402" | "402index" | "x402direct" | "the402";

export type BnbExecutionEndpointSource = BnbAgentSource | "metadata";

export type BnbExecutionEndpoint = {
  adapter: "mcp" | "a2a" | "x402" | "http" | "web";
  url: string;
  label: string;
  verified: boolean;
  source: BnbExecutionEndpointSource;
  method?: "GET" | "POST";
  inputSchema?: unknown;
  paymentRequired?: boolean;
};

export type BnbEndpointCapabilityKind = "tool" | "skill" | "http";

export type BnbEndpointCapabilityContract = {
  name: string;
  kind: BnbEndpointCapabilityKind;
  adapter?: "mcp" | "a2a" | "x402" | "http";
  endpointUrl?: string;
  description?: string;
  inputSchema?: unknown;
  tags?: string[];
  paymentRequired?: boolean;
};

export type BnbEndpointCapabilitySnapshot = {
  agentKey: string;
  chainId: number;
  tokenId: string;
  adapter: "mcp" | "a2a" | "x402" | "http";
  endpointUrl: string;
  endpointLabel: string;
  endpointSource?: BnbExecutionEndpointSource;
  endpointVerified?: boolean;
  paymentRequired?: boolean;
  ok: boolean;
  capabilities: BnbEndpointCapabilityContract[];
  reason?: string;
  checkedAt: string;
  expiresAt: string;
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
  endpointCapabilities?: BnbEndpointCapabilityContract[];
  hasActionableEndpointCapabilities?: boolean;
  scoreBreakdown?: BnbScoreBreakdown;
  sourceFreshness: {
    source: BnbAgentSource;
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
  integration?: string | null;
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

export type BnbListingModerationStatus = "hidden" | "blocked";

export type BnbListingModerationReason =
  | "broken_endpoint"
  | "malformed_profile"
  | "wrong_category"
  | "unsafe_endpoint"
  | "spam"
  | "policy"
  | "other";

export type BnbListingModerationRecord = {
  key: string;
  chainId: number;
  tokenId: string;
  status: BnbListingModerationStatus;
  reason: BnbListingModerationReason;
  note?: string;
  actorId?: string;
  createdAt: string;
  updatedAt: string;
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

export type BnbPaymentMode = "none" | "escrow" | "x402";

export type BnbX402PaymentRequirement = {
  scheme: "exact";
  network: string;
  amount?: string;
  maxAmountRequired?: string;
  resource?: string;
  description?: string;
  mimeType?: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
  outputSchema?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

export type BnbX402PaymentHeaderCipher = {
  version: "v1";
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
  hash: string;
  createdAt: string;
};

export type BnbX402PaymentSnapshot = {
  x402Version: number;
  resource?: {
    url?: string;
    description?: string;
    mimeType?: string;
    serviceName?: string;
  };
  paymentRequirements: BnbX402PaymentRequirement[];
  selectedRequirement: BnbX402PaymentRequirement;
  extensions?: Record<string, unknown>;
  paymentHeader?: BnbX402PaymentHeaderCipher;
  paymentHeaderHash?: string;
  transaction?: string;
  network?: string;
  payer?: string;
  status?: "pending" | "verified" | "settled" | "unconfirmed" | "failed";
  verifiedAt?: string;
  settledAt?: string;
  error?: string;
};

export type BnbEscrowPaymentSnapshot = {
  chainId: number;
  contractAddress?: string;
  transactionHash?: string;
  transactionStatus?: "success" | "reverted" | "pending";
  explorerUrl?: string;
  blockNumber?: string;
  jobId?: string;
  expiresAt?: number;
};

export type BnbPaymentSnapshot = BnbEscrowPaymentSnapshot & {
  mode?: BnbPaymentMode;
  x402?: BnbX402PaymentSnapshot;
};

export type BnbPaymentRequest =
  | {
      status: "ready";
      mode: "escrow";
      chainId: number;
      contractAddress: string;
      to: string;
      value: string;
      data: string;
      gasLimit: string;
      amountLabel: string;
      expiresAt: number;
      label?: string;
    }
  | {
      status: "ready";
      mode: "x402";
      x402Version: number;
      paymentRequirements: BnbX402PaymentRequirement[];
      selectedPaymentRequirement: BnbX402PaymentRequirement;
      extensions?: Record<string, unknown>;
      amountLabel: string;
      network: string;
      asset: string;
      payTo: string;
      resource: string;
    }
  | {
      status: "not_required";
      mode: "none";
      reason: "";
    }
  | {
      status: "setup_required" | "budget_needs_bnb" | "agent_wallet_invalid" | "not_ready";
      mode?: BnbPaymentMode;
      reason: string;
    };

export type BnbTransactionRequest =
  | {
      status: "ready";
      chainId: number;
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
  adapter?: string;
  runId?: string;
  error?: string;
  paymentSettlement?: {
    mode: "x402";
    status: "settled" | "unconfirmed";
    transaction?: string;
    network?: string;
    payer?: string;
    settledAt: string;
  };
};

export type BnbJobCapability = "rebalancing" | "concentrated_liquidity" | "grid_trading" | "yield_optimisation" | "health_factor" | "custom";

export type BnbHireIntentInput = {
  capability?: BnbJobCapability;
  endpointCapability?: string;
  taskType?: string;
  outcome: string;
  target?: string;
  riskPreference?: "Low" | "Balanced" | "Aggressive";
  advancedFields?: Record<string, string>;
  instructions?: string;
};

export type BnbJobSpec = {
  capability: BnbJobCapability;
  taskType: string;
  endpointCapability?: BnbEndpointCapabilityContract;
  summary: string;
  expectedOutput: string;
  fields: Record<string, string>;
  instructions?: string;
};

export type BnbJobPreflightResult = {
  status: "ready" | "needs_input" | "blocked";
  canProceed: boolean;
  paymentRequired?: boolean;
  paymentMode?: BnbPaymentMode;
  jobSpec?: BnbJobSpec;
  missingInputs: string[];
  warnings: string[];
  assumptions: string[];
  selectedExecution?: BnbExecutionTarget;
  adapterPreflight: Array<{
    ok: boolean;
    adapter: "mcp" | "a2a" | "x402" | "http";
    endpoint?: BnbExecutionEndpoint;
    reason?: string;
    capabilities?: string[];
    capabilityContracts?: BnbEndpointCapabilityContract[];
  }>;
};

export type BnbExecutionTarget = {
  adapter: "mcp" | "a2a" | "x402" | "http";
  endpoint: BnbExecutionEndpoint;
  capability?: BnbEndpointCapabilityContract;
  selectedAt: string;
};

export type BnbAgentDelivery = {
  status: "pending" | "running" | "delivered" | "failed";
  summary?: string;
  rawOutput?: string;
  dataSources?: string[];
  adapter?: string;
  runId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type BnbActivationExecution = {
  state: "running" | "completed" | "failed";
  attemptId: string;
  idempotencyKey: string;
  requestHash: string;
  jobHash: string;
  adapter?: "mcp" | "a2a" | "x402" | "http";
  endpoint?: Pick<BnbExecutionEndpoint, "adapter" | "url" | "label" | "verified" | "source">;
  capability?: Pick<BnbEndpointCapabilityContract, "name" | "kind" | "description" | "tags" | "paymentRequired">;
  requestArgs?: Record<string, string>;
  sources?: string[];
  runId?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type BnbActivationRecord = {
  recordType: "hire";
  recordId: string;
  receiptId: string;
  status:
    | "awaiting_funding"
    | "funded"
    | "running"
    | "delivered"
    | "paid"
    | "failed"
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
  jobSpec?: BnbJobSpec;
  executionTarget?: BnbExecutionTarget;
  delivery?: BnbAgentDelivery;
  limits: {
    task: string;
    budget: string;
    expires: string;
    walletConfirmationRequired: boolean;
  };
  work?: BnbAgentWork;
  execution?: BnbActivationExecution;
  payment?: BnbPaymentSnapshot;
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
    chainId: number;
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
