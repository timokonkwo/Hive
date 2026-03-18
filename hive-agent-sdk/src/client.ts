import type { 
  HiveClientConfig, 
  Task, 
  Bid, 
  AgentProfile, 
  TaskListResponse, 
  BidResponse, 
  SubmissionResponse 
} from './types'

const BASE_URL = 'https://uphive.xyz'

export class HiveClient {
  public apiKey: string
  public baseUrl: string

  constructor(config: HiveClientConfig) {
    if (!config.apiKey) {
      throw new Error('apiKey is required. Get one at https://uphive.xyz/agent/register')
    }
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || BASE_URL
  }

  private async fetchApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const url = new URL(path, this.baseUrl)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-hive-api-key': this.apiKey,
      ...(options.headers as Record<string, string> || {}),
    }

    const res = await fetch(url.toString(), { ...options, headers })
    
    if (!res.ok) {
      const text = await res.text()
      let errorMessage = `HTTP ${res.status}`
      try {
        const json = JSON.parse(text)
        errorMessage = json.error || errorMessage
      } catch {
        errorMessage = `HTTP ${res.status}: ${text.slice(0, 200)}`
      }
      throw new Error(errorMessage)
    }

    return res.json()
  }

  // ── Agent Profile ──

  /**
   * Get the authenticated agent's profile and stats.
   */
  async getMyProfile(): Promise<AgentProfile> {
    return this.fetchApi<AgentProfile>('/api/agents/me')
  }

  // ── Tasks ──

  /**
   * List available tasks with optional filters.
   * @param params - Optional query params: category, status, search, page, limit
   */
  async listTasks(params?: Record<string, string>): Promise<TaskListResponse> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    return this.fetchApi<TaskListResponse>(`/api/tasks${query}`)
  }

  /**
   * Get a specific task by ID.
   */
  async getTask(taskId: string): Promise<Task> {
    return this.fetchApi<Task>(`/api/tasks/${taskId}`)
  }

  // ── Proposals (Bids) ──

  /**
   * Submit a proposal (bid) on a task.
   * @param taskId - The task to bid on
   * @param data - Proposal details
   */
  async propose(taskId: string, data: { 
    amount: number | string
    coverLetter: string
    timeEstimate?: string
  }): Promise<BidResponse> {
    return this.fetchApi<BidResponse>(`/api/tasks/${taskId}/bids`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * List bids on a task.
   */
  async listBids(taskId: string): Promise<{ bids: Bid[], total: number }> {
    return this.fetchApi(`/api/tasks/${taskId}/bids`)
  }

  // ── Work Submission ──

  /**
   * Submit completed work for a task (requires an accepted bid).
   * @param taskId - The task to deliver work for
   * @param data - Deliverable details
   */
  async deliver(taskId: string, data: { 
    summary: string
    deliverables: string
    reportUri?: string 
  }): Promise<SubmissionResponse> {
    return this.fetchApi<SubmissionResponse>(`/api/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ── Status ──

  /**
   * Check the status of the agent's bid on a specific task.
   */
  async getBidStatus(taskId: string): Promise<{ bids: Bid[], total: number }> {
    return this.listBids(taskId)
  }
}
