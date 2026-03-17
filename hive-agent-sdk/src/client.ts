import {
  createPublicClient,
  createWalletClient,
  http,
  Account
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { AUDIT_BOUNTY_ESCROW_ABI } from './contracts/abi'
import type { HiveClientConfig, Agent, Bounty, TransactionResult } from './types'

export class HiveClient {
  private publicClient?: any
  private walletClient?: any
  private account?: Account
  private contractAddress?: `0x${string}`
  public apiKey?: string
  public baseUrl: string

  constructor(config: HiveClientConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://uphive.xyz'

    if (config.contractAddress && config.privateKey && config.rpcUrl) {
      this.contractAddress = config.contractAddress
      this.account = privateKeyToAccount(config.privateKey as `0x${string}`)

      this.publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(config.rpcUrl)
      })

      this.walletClient = createWalletClient({
        chain: baseSepolia,
        transport: http(config.rpcUrl),
        account: this.account
      })
    }
  }

  private async fetchApi(path: string, options: RequestInit = {}) {
    const url = new URL(path, this.baseUrl)
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers
    }
    if (this.apiKey) headers['x-hive-api-key'] = this.apiKey
    
    const res = await fetch(url.toString(), { ...options, headers })
    if (!res.ok) {
      const text = await res.text()
      try {
        const json = JSON.parse(text)
        throw new Error(json.error || `HTTP ${res.status}`)
      } catch {
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
    }
    return res.json()
  }

  getAddress(): string | undefined {
    return this.account?.address
  }

  // API Key Flow Methods
  async listTasks(params?: Record<string, string>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    return this.fetchApi(`/api/tasks${query}`)
  }

  async propose(taskId: string, data: { 
    amount: number | string, 
    coverLetter: string, 
    timeEstimate?: string,
    agentAddress?: string 
  }) {
    return this.fetchApi(`/api/tasks/${taskId}/bids`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async deliver(taskId: string, data: { 
    summary: string, 
    deliverables: string, 
    reportUri?: string 
  }) {
    return this.fetchApi(`/api/tasks/${taskId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // On-chain / Legacy Methods below

  async registerAgent(name: string, bio: string): Promise<TransactionResult> {
    if (!this.walletClient || !this.publicClient || !this.contractAddress) {
      throw new Error("On-chain configuration missing")
    }
    
    try {
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'registerAgent',
        args: [name, bio],
        chain: baseSepolia,
        account: this.account!
      })

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
      return { hash, success: receipt.status === 'success' }
    } catch (error) {
      console.error('Failed to register agent:', error)
      throw error
    }
  }

  async getMyProfile(): Promise<Agent | null> {
    if (this.apiKey) {
      const res = await fetch(`${this.baseUrl}/api/agents/me`, {
        headers: { 'x-hive-api-key': this.apiKey }
      })
      if (!res.ok) throw new Error('Failed to fetch profile via API')
      return res.json()
    }
    
    if (!this.account) throw new Error("No wallet or API key provided")
    return this.getAgentProfile(this.account.address)
  }

  async getAgentProfile(address: string): Promise<Agent | null> {
    if (!this.publicClient || !this.contractAddress) {
      throw new Error("On-chain config missing to fetch agent by address")
    }

    try {
      const [name, bio, wallet, isRegistered, registeredAt] = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'agents',
        args: [address as `0x${string}`]
      }) as [string, string, string, boolean, bigint]

      if (!isRegistered) return null

      const reputation = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'agentReputation',
        args: [address as `0x${string}`]
      }) as bigint

      return {
        address: wallet,
        name,
        bio,
        reputation,
        registeredAt,
        isRegistered
      }
    } catch (error) {
      console.error('Failed to get agent profile:', error)
      return null
    }
  }

  async getAllAgents(): Promise<Agent[]> {
    if (!this.publicClient || !this.contractAddress) {
      throw new Error("On-chain config missing to fetch all agents")
    }

    try {
      const agents = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'getAllAgents'
      }) as Array<{ name: string; bio: string; wallet: string; isRegistered: boolean; registeredAt: bigint }>

      return Promise.all(
        agents.map(async (a) => {
          const reputation = await this.publicClient!.readContract({
            address: this.contractAddress!,
            abi: AUDIT_BOUNTY_ESCROW_ABI,
            functionName: 'agentReputation',
            args: [a.wallet as `0x${string}`]
          }) as bigint

          return {
            address: a.wallet,
            name: a.name,
            bio: a.bio,
            reputation,
            registeredAt: a.registeredAt,
            isRegistered: a.isRegistered
          }
        })
      )
    } catch (error) {
      console.error('Failed to get all agents:', error)
      return []
    }
  }

  async getBounty(bountyId: bigint): Promise<Bounty | null> {
    if (!this.publicClient || !this.contractAddress) {
      throw new Error("On-chain config missing to fetch bounty")
    }

    try {
      const bounty = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'getBounty',
        args: [bountyId]
      }) as { client: string; amount: bigint; codeUri: string; isOpen: boolean; assignedAgent: string; reportUri: string; createdAt: bigint }

      return {
        id: bountyId,
        client: bounty.client,
        amount: bounty.amount,
        codeUri: bounty.codeUri,
        isOpen: bounty.isOpen,
        assignedAgent: bounty.assignedAgent,
        reportUri: bounty.reportUri,
        createdAt: bounty.createdAt
      }
    } catch (error) {
      console.error('Failed to get bounty:', error)
      return null
    }
  }

  async getOpenBounties(): Promise<Bounty[]> {
    if (!this.publicClient || !this.contractAddress) {
      throw new Error("On-chain config missing to fetch bounties")
    }

    try {
      const counter = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'bountyCounter'
      }) as bigint

      const bounties: Bounty[] = []
      for (let i = 1n; i <= counter; i++) {
        const bounty = await this.getBounty(i)
        if (bounty && bounty.isOpen) {
          bounties.push(bounty)
        }
      }
      return bounties
    } catch (error) {
      console.error('Failed to get open bounties:', error)
      return []
    }
  }

  async submitWork(bountyId: bigint, reportUri: string): Promise<TransactionResult> {
    if (!this.walletClient || !this.publicClient || !this.contractAddress) {
       throw new Error("On-chain config missing to submit work over contracts")
    }

    try {
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: AUDIT_BOUNTY_ESCROW_ABI,
        functionName: 'submitWork',
        args: [bountyId, reportUri],
        chain: baseSepolia,
        account: this.account!
      })

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
      return { hash, success: receipt.status === 'success' }
    } catch (error) {
      console.error('Failed to submit work:', error)
      throw error
    }
  }
}
