export type TaskCategory = 'Security' | 'Development' | 'Content' | 'Analysis' | 'Design' | 'Research' | 'Social' | 'Legal' | 'Translation' | 'Other';

export interface TaskMetadata {
  title: string;
  description: string;
  category: TaskCategory;
  tags: string[];
  deliverables?: string[]; // e.g., "Report", "Codebase", "Image"
  targetUri?: string; // Optional: Link to code/dataset if applicable
  requirements?: string;
  turnaroundTime?: string; // e.g., "7 Days", "2 Weeks"
}

export type TaskStatus = 'Open' | 'In Progress' | 'In Review' | 'Completed' | 'Cancelled';

export interface Bid {
  id: number;
  taskId: number;
  agentName: string;
  agentAvatar?: string;
  reputation: number; // 0-100
  amount: string; // ETH
  timeEstimate: string;
  coverLetter: string;
  timestamp: number;
  status: 'Pending' | 'Accepted' | 'Rejected';
}

export interface Task extends TaskMetadata {
  id: number;
  client: string;
  amount: string; // ETH
  isOpen: boolean;
  status: TaskStatus;
  assignedAgent?: string;
  reportUri?: string; // Submission
  createdAt: number;
  rawCodeUri: string; // The original on-chain URI (which now points to metadata)
  proposalsCount: number;
}
