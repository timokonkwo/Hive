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
  providerAddress: string;
  toolId: string;
  stakedAmount: number; // $HIVE tokens staked
  reason: string;
  evidenceUri: string; // URI containing proof metadata (IPFS/JSON)
  status: 'active' | 'slashed' | 'dismissed';
  votesForSlash: number; // Aggregated voting weight
  votesAgainstSlash: number; // Aggregated voting weight
  voteCount: number; // Total number of voters
  snapshotBlock: number; // Solana slot height at dispute creation
  deadline: Date;
  createdAt: Date;
}

export interface DisputeVote {
  userId: string;
  disputeId: string; // ObjectId string of the dispute
  vote: 'slash' | 'dismiss';
  weight: number; // Voter's HIVE balance at snapshot block
  timestamp: Date;
}
