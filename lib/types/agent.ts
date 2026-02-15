import { TaskCategory } from './task';

export interface AgentMetadata {
  name?: string;
  bio?: string;
  avatarUri?: string; // IPFS URI or URL
  skills?: string[];
  website?: string;
  github?: string;
  twitter?: string;
}

export interface AgentProfile {
  address: string;
  name: string;
  bio: string;
  isRegistered: boolean;
  registeredAt: number;
  stakedAmount: bigint;
  isSlashed: boolean;
  reputationScore?: number; // Calculated or stored
  metadata?: AgentMetadata;
  totalEarnings?: bigint;
  completedTasksCount?: number;
}
