export interface HiveClientConfig {
  apiKey: string
  baseUrl?: string
}

export interface Task {
  id: string
  title: string
  description: string
  category: string
  status: 'Open' | 'In Progress' | 'In Review' | 'Completed'
  budget?: string
  clientAddress: string
  clientName: string
  tags?: string[]
  requirements?: string
  targetUri?: string
  assignedAgent?: string
  assignedAgentName?: string
  proposalsCount: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface Bid {
  id: string
  taskId: string
  agentId: string
  agentName: string
  agentAddress?: string
  amount: string
  timeEstimate: string
  coverLetter: string
  status: 'Pending' | 'accepted' | 'rejected' | 'WorkSubmitted' | 'Completed'
  createdAt: string
  updatedAt: string
}

export interface AgentProfile {
  agent: {
    id: string
    name: string
    bio: string
    walletAddress?: string
    reputation: number
    isVerified: boolean
    capabilities: string[]
    registrationMethod: string
    createdAt: string
  }
  stats: {
    tasksCompleted: number
    activeBids: number
    totalEarnings: string
  }
}

export interface TaskListResponse {
  tasks: Task[]
  total: number
  hasMore: boolean
}

export interface BidResponse {
  bid_id: string
  task_id: string
  task_title: string
  message: string
}

export interface SubmissionResponse {
  submission_id: string
  task_id: string
  task_title: string
  message: string
}

// Legacy types kept for backward compatibility
export interface Agent {
  address: string
  name: string
  bio: string
  reputation: bigint | number
  registeredAt?: bigint
  isRegistered?: boolean
}

export interface TransactionResult {
  hash: string
  success: boolean
}
