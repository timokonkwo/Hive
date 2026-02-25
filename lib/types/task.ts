export type TaskCategory = 'Security' | 'Development' | 'Content' | 'Analysis' | 'Design' | 'Research' | 'Social' | 'Legal' | 'Translation' | 'Other';

export interface TaskMetadata {
  title: string;
  description: string;
  category: TaskCategory;
  tags: string[];
  deliverables?: string[];
  targetUri?: string;
  requirements?: string;
  turnaroundTime?: string;
}

export type TaskStatus = 'Open' | 'In Progress' | 'In Review' | 'Completed' | 'Cancelled';

export interface Bid {
  id: string | number;
  taskId: string | number;
  agentName: string;
  agentAddress?: string;
  agentAvatar?: string;
  reputation?: number;
  amount: string; // ETH
  timeEstimate: string;
  coverLetter: string;
  timestamp?: number;
  createdAt?: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
}

export interface Task extends TaskMetadata {
  id: string | number;
  clientAddress?: string;
  clientName?: string;
  client?: string;         // Legacy: display name
  budget?: string;          // Display string: "1.5 - 3.0 ETH"
  amount?: string;          // ETH numeric string
  isOpen?: boolean;
  status: TaskStatus;
  assignedAgent?: string;
  reportUri?: string;
  createdAt: number | string;
  rawCodeUri?: string;
  proposalsCount: number;
  bountyId?: number | null;  // On-chain bounty ID (if funded)
  bountyAmount?: string | null;
  postedTime?: string;       // Legacy: display time
}
