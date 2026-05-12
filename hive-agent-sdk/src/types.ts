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
  acceptanceRubric?: string[]
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

export interface DeliverableSubmission {
  specIndex?: number
  type: 'file' | 'url' | 'text' | 'code' | 'image' | 'token_launch'
  label?: string
  content: string
  metadata?: Record<string, unknown>
}

export interface AgentMatch {
  agentId: string
  agentName: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  matchedCapabilities: string[]
  agent: {
    id: string
    name: string
    bio?: string
    reputation: number
    capabilities: string[]
    isVerified: boolean
  }
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

export interface TaskMatchesResponse {
  taskId: string
  category: string
  matches: AgentMatch[]
}

export type WebhookEvent =
  | 'task.created'
  | 'bid.submitted'
  | 'bid.accepted'
  | 'bid.rejected'
  | 'work.submitted'
  | 'task.completed'
  | 'payment.sent'

export interface WebhookSubscription {
  id: string
  url: string
  events: WebhookEvent[]
  active: boolean
  description?: string | null
  createdAt: string
  updatedAt: string
  secret?: string
}

export interface WebhookDelivery {
  id: string
  subscriptionId: string
  event: WebhookEvent
  url: string
  status: 'pending' | 'sending' | 'delivered' | 'failed'
  attempts: number
  nextAttemptAt?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentOpportunity {
  taskId: string
  title: string
  category: string
  budget: string
  budgetAmount: number
  proposalsCount: number
  createdAt: string
  score: number
  confidence: 'high' | 'medium' | 'low'
  matchedCapabilities: string[]
  reasons: string[]
  url: string
}

export interface MessageThread {
  id: string
  taskId: string
  taskTitle: string
  clientName: string
  agentId?: string | null
  agentName?: string | null
  lastMessage?: string | null
  lastMessageAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ThreadMessage {
  id: string
  actorType: 'client' | 'agent'
  actorId: string
  actorName: string
  content: string
  createdAt: string
}

export interface TaskDraft {
  title: string
  description: string
  category: string
  requirements: string
  tags: string[]
  budget: string
  deliverableSpecs: Array<{
    type: string
    label: string
    description: string
    required: boolean
  }>
  acceptanceRubric: string[]
  confidence: 'high' | 'medium'
}

export interface PluginListing {
  id: string
  name: string
  description: string
  category: string
  capabilities: string[]
  authType: 'api_key' | 'oauth' | 'none'
  status: 'approved' | 'pending' | 'disabled'
  verifiedPublisher: boolean
  installCount?: number
}

export interface PluginInstall {
  id?: string
  pluginId: string
  pluginName?: string
  enabled: boolean
  capabilities?: string[]
  createdAt?: string
  updatedAt?: string
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
