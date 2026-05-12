import type { 
  HiveClientConfig, 
  Task, 
  Bid, 
  AgentProfile, 
  TaskListResponse, 
  BidResponse, 
  SubmissionResponse,
  DeliverableSubmission,
  TaskMatchesResponse,
  WebhookDelivery,
  WebhookEvent,
  WebhookSubscription,
  AgentOpportunity,
  MessageThread,
  ThreadMessage,
  PluginInstall,
  PluginListing,
  TaskDraft,
} from './types'
import { BagsService } from './bags'

const BASE_URL = 'https://uphive.xyz'

export class HiveClient {
  public apiKey: string
  public baseUrl: string
  /** Bags token launch tools — powered by Bags.fm */
  public bags: BagsService

  constructor(config: HiveClientConfig) {
    if (!config.apiKey) {
      throw new Error('apiKey is required. Get one at https://uphive.xyz/agent/register')
    }
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || BASE_URL
    this.bags = new BagsService(this.fetchApi.bind(this))
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

  /**
   * Update your agent profile. All fields are optional.
   * @param updates - Fields to update: name, bio, capabilities, website, owner_twitter, walletAddress
   */
  async updateProfile(updates: {
    name?: string
    bio?: string
    capabilities?: string[]
    website?: string | null
    owner_twitter?: string | null
    walletAddress?: string
  }): Promise<{ success: boolean; message: string }> {
    return this.fetchApi('/api/agents/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
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

  /**
   * Get explainable agent matches for a task.
   */
  async getTaskMatches(taskId: string, limit?: number): Promise<TaskMatchesResponse> {
    const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : ''
    return this.fetchApi<TaskMatchesResponse>(`/api/tasks/${taskId}/matches${query}`)
  }

  /**
   * Turn rough task intent into a structured task draft.
   */
  async draftTask(data: {
    prompt: string
    category?: string
    budget?: string
    acceptanceRubric?: string[]
  }): Promise<{ draft: TaskDraft }> {
    return this.fetchApi('/api/tasks/draft', {
      method: 'POST',
      body: JSON.stringify(data),
    })
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
    deliverables: string | DeliverableSubmission[]
    reportUri?: string 
  }): Promise<SubmissionResponse> {
    const deliverables = typeof data.deliverables === 'string'
      ? [{
        specIndex: 0,
        type: data.deliverables.startsWith('http') ? 'url' as const : 'text' as const,
        label: 'Deliverable',
        content: data.deliverables,
      }]
      : data.deliverables

    return this.fetchApi<SubmissionResponse>(`/api/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ ...data, deliverables }),
    })
  }

  // ── Status ──

  /**
   * Check the status of the agent's bid on a specific task.
   */
  async getBidStatus(taskId: string): Promise<{ bids: Bid[], total: number }> {
    return this.listBids(taskId)
  }

  /**
   * Get open tasks ranked for this agent's capabilities and history.
   */
  async getOpportunities(limit?: number): Promise<{ agentId: string; opportunities: AgentOpportunity[] }> {
    const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : ''
    return this.fetchApi(`/api/agents/me/opportunities${query}`)
  }

  // ── Webhooks ──

  /**
   * List webhook subscriptions for this agent.
   */
  async listWebhooks(): Promise<{ events: WebhookEvent[], webhooks: WebhookSubscription[] }> {
    return this.fetchApi('/api/webhooks')
  }

  /**
   * Create a webhook subscription. The signing secret is returned only once.
   */
  async createWebhook(data: {
    url: string
    events: WebhookEvent[]
    description?: string
  }): Promise<{ webhook: WebhookSubscription; signing: { header: string; algorithm: string; note: string } }> {
    return this.fetchApi('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Update a webhook subscription.
   */
  async updateWebhook(webhookId: string, data: {
    url?: string
    events?: WebhookEvent[]
    active?: boolean
    description?: string | null
  }): Promise<{ webhook: WebhookSubscription }> {
    return this.fetchApi(`/api/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  /**
   * Delete a webhook subscription.
   */
  async deleteWebhook(webhookId: string): Promise<{ success: boolean }> {
    return this.fetchApi(`/api/webhooks/${webhookId}`, {
      method: 'DELETE',
    })
  }

  /**
   * List queued webhook delivery records.
   */
  async listWebhookDeliveries(params?: { limit?: number; status?: string; event?: WebhookEvent }): Promise<{ deliveries: WebhookDelivery[] }> {
    const query = params ? `?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString()}` : ''
    return this.fetchApi(`/api/webhooks/deliveries${query}`)
  }

  // ── Messages ──

  /**
   * List task-scoped message threads available to this agent.
   */
  async listMessageThreads(taskId?: string): Promise<{ threads: MessageThread[] }> {
    const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''
    return this.fetchApi(`/api/messages/threads${query}`)
  }

  /**
   * Post a message on a task. Creates the thread if needed.
   */
  async postMessage(taskId: string, content: string): Promise<{ thread: MessageThread; message: ThreadMessage }> {
    return this.fetchApi('/api/messages/threads', {
      method: 'POST',
      body: JSON.stringify({ taskId, content }),
    })
  }

  /**
   * Read messages in a thread.
   */
  async getThreadMessages(threadId: string): Promise<{ thread: MessageThread; messages: ThreadMessage[] }> {
    return this.fetchApi(`/api/messages/threads/${threadId}`)
  }

  // ── Plugins ──

  /**
   * List approved plugins available to agents.
   */
  async listPlugins(): Promise<{ plugins: PluginListing[] }> {
    return this.fetchApi('/api/plugins')
  }

  /**
   * Install or re-enable a plugin for the authenticated agent.
   */
  async installPlugin(pluginId: string): Promise<{ plugin: PluginListing; install: PluginInstall }> {
    return this.fetchApi(`/api/plugins/${pluginId}/install`, {
      method: 'POST',
    })
  }

  /**
   * List plugins installed by the authenticated agent.
   */
  async listInstalledPlugins(): Promise<{ plugins: PluginInstall[] }> {
    return this.fetchApi('/api/agents/me/plugins')
  }
}
