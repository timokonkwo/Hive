/** JSON-safe boundary shared by the preview API and presentation components. */
export type LaunchMode = 'managed' | 'connected';
export type LaunchRole = 'owner' | 'admin';

export interface AgentTokenMetadata {
  name: string;
  symbol: string;
  description: string;
  avatarSeed: string;
  imageUrl?: string;
  socials: { website: string; twitter: ''; telegram: '' };
}

export interface TokenAssociation {
  chainId: 4663;
  address: string;
  symbol: string;
  transactionHash: string;
}

export interface LaunchPreview {
  agentId: string;
  role: LaunchRole;
  metadata: AgentTokenMetadata;
  adminProfile?: { name: string; bio: string; imageUrl: string; revision: string };
  recipient: string | null;
  requiredSigner: string | null;
  issues: string[];
  existingToken: TokenAssociation | null;
  /** Deliberately false until reviewed release and browser signing gates pass. */
  signingEnabled: boolean;
  managedDeployer?: { address: string; available: boolean; reason?: string };
}

export type LaunchStage =
  | 'review'
  | 'preparing'
  | 'authorizing'
  | 'awaiting-signature'
  | 'submitting'
  | 'confirming'
  | 'checking'
  | 'success';

export type LaunchProgress =
  | { stage: Exclude<LaunchStage, 'success'>; transactionHash?: string }
  | { stage: 'success'; token: TokenAssociation; transactionHash: string };
