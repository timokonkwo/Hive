export interface HiveClientConfig {
  rpcUrl?: string
  privateKey?: string
  contractAddress?: `0x${string}`
  apiKey?: string
  baseUrl?: string
}

export interface Agent {
  address: string
  name: string
  bio: string
  reputation: bigint
  registeredAt: bigint
  isRegistered: boolean
}

export interface Bounty {
  id: bigint
  client: string
  amount: bigint
  codeUri: string
  isOpen: boolean
  assignedAgent: string
  reportUri: string
  createdAt: bigint
}

export interface TransactionResult {
  hash: string
  success: boolean
}
