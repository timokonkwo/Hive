export interface SessionBudget {
  userId: string; // Privy DID or Client Wallet Address
  solanaAddress: string; // Connected Solana address used for deposits
  depositBalance: number; // Active balance in USDC
  reservedBalance: number; // Locked balance during execution
  lastSettledAt: Date;
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionLedgerEntry {
  userId: string;
  toolId: string;
  providerAddress: string;
  cost: number; // Transaction cost in USDC
  timestamp: Date;
  status: 'pending' | 'settled';
  settlementTxSignature?: string;
}

export interface Dispute {
  reportId?: string;
  providerAddress: string;
  toolId: string;
  category?: string;
  stakedAmount: number; // $HIVE tokens staked
  reason: string;
  evidenceUri: string; // URI containing proof metadata (IPFS/JSON)
  status: 'active' | 'queued' | 'slashed' | 'dismissed' | 'failed_quorum' | 'execution_failed';
  phase?: 'evidence' | 'voting' | 'queued' | 'resolved';
  votesForSlash: number; // Aggregated voting weight
  votesAgainstSlash: number; // Aggregated voting weight
  voteCount: number; // Total number of voters
  snapshotBlock: number; // Solana slot height at dispute creation
  evidenceOpenUntil?: Date;
  votingStartsAt?: Date;
  votingEndsAt?: Date;
  quorumRequired?: number;
  slashThresholdBps?: number;
  executionAvailableAt?: Date;
  deadline: Date;
  createdAt: Date;
}

export interface DisputeReport {
  reporterId: string;
  reporterType: 'client' | 'agent';
  providerAddress: string;
  toolId: string;
  category: 'failed_execution' | 'malicious_output' | 'billing' | 'uptime' | 'policy' | 'other';
  reason: string;
  evidenceUri: string;
  sessionLedgerId?: string | null;
  affectedParty: boolean;
  watchdogEligible: boolean;
  providerStake: number;
  status: 'submitted' | 'needs_evidence' | 'rejected' | 'escalated';
  triageReason?: string;
  disputeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DisputeEvidence {
  disputeId: string;
  submittedBy: string;
  submittedByRole: 'reporter' | 'provider' | 'admin' | 'voter';
  uri: string;
  summary: string;
  createdAt: Date;
}

export interface DisputeVote {
  userId: string;
  disputeId: string; // ObjectId string of the dispute
  vote: 'slash' | 'dismiss';
  weight: number; // Voter's active staked HIVE weight
  timestamp: Date;
}

export interface StakeRecord {
  stakerId: string; // Privy user id or agent ObjectId string
  stakerType: 'client' | 'agent';
  solanaAddress: string;
  activeAmount: number;
  lockedAmount: number;
  slashedAmount: number;
  status: 'active' | 'none';
  createdAt: Date;
  updatedAt: Date;
}

export interface StakeEvent {
  stakerId: string;
  stakerType: 'client' | 'agent';
  solanaAddress: string;
  txSignature: string;
  type: 'stake' | 'slash' | 'unlock';
  status: 'pending' | 'verified' | 'failed';
  amount: number;
  confirmedAmount?: number;
  resultingActiveAmount?: number;
  resultingTier?: string;
  createdAt: Date;
  verifiedAt?: Date;
}
