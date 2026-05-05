/**
 * HIVE Indexer GraphQL Client
 * Provides fast access to indexed blockchain data
 */

const INDEXER_URL = process.env.HIVE_INDEXER_URL || 'http://localhost:4350/graphql'

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

async function query<T>(queryString: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(INDEXER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryString, variables })
  })

  const json: GraphQLResponse<T> = await response.json()
  
  if (json.errors) {
    throw new Error(json.errors.map(e => e.message).join(', '))
  }
  
  if (!json.data) {
    throw new Error('No data returned from indexer')
  }
  
  return json.data
}

// Types matching the indexer schema
export interface IndexedAgent {
  id: string
  name: string
  bio: string | null
  registeredAt: string
  reputation: string
  isActive: boolean
}

export interface IndexedBounty {
  id: string
  client: string
  amount: string
  codeUri: string
  isOpen: boolean
  reportUri: string | null
  createdAt: string
  closedAt: string | null
  txHash: string
  assignedAgent: IndexedAgent | null
  completedBy: IndexedAgent | null
}

/**
 * Fetch all registered agents from the indexer
 */
export async function fetchAgents(options?: { limit?: number; activeOnly?: boolean }): Promise<IndexedAgent[]> {
  const limit = options?.limit || 100
  const where = options?.activeOnly ? 'where: { isActive: true }' : ''
  
  const data = await query<{ agents: IndexedAgent[] }>(`
    query {
      agents(limit: ${limit}, ${where}, orderBy: reputation_DESC) {
        id
        name
        bio
        registeredAt
        reputation
        isActive
      }
    }
  `)
  
  return data.agents
}

/**
 * Fetch bounties from the indexer
 */
export async function fetchBounties(options?: { 
  limit?: number
  openOnly?: boolean
  withReportsOnly?: boolean 
}): Promise<IndexedBounty[]> {
  const limit = options?.limit || 50
  const conditions: string[] = []
  
  if (options?.openOnly) conditions.push('isOpen: true')
  if (options?.withReportsOnly) conditions.push('reportUri_isNull: false')
  
  const where = conditions.length > 0 ? `where: { ${conditions.join(', ')} }` : ''
  
  const data = await query<{ bounties: IndexedBounty[] }>(`
    query {
      bounties(limit: ${limit}, ${where}, orderBy: createdAt_DESC) {
        id
        client
        amount
        codeUri
        isOpen
        reportUri
        createdAt
        closedAt
        txHash
        assignedAgent {
          id
          name
          reputation
        }
        completedBy {
          id
          name
        }
      }
    }
  `)
  
  return data.bounties
}

/**
 * Fetch submissions (bounties with reports) for the validator dashboard
 */
export async function fetchSubmissions(options?: { limit?: number }): Promise<IndexedBounty[]> {
  return fetchBounties({ 
    limit: options?.limit || 50, 
    withReportsOnly: true 
  })
}

/**
 * Fetch a single bounty by ID
 */
export async function fetchBountyById(id: string): Promise<IndexedBounty | null> {
  const data = await query<{ bountyById: IndexedBounty | null }>(`
    query {
      bountyById(id: "${id}") {
        id
        client
        amount
        codeUri
        isOpen
        reportUri
        createdAt
        closedAt
        txHash
        assignedAgent {
          id
          name
          bio
          reputation
        }
        completedBy {
          id
          name
        }
      }
    }
  `)
  
  return data.bountyById
}

/**
 * Fetch a single agent by ID (address)
 */
export async function fetchAgentById(id: string): Promise<IndexedAgent | null> {
  const data = await query<{ agentById: IndexedAgent | null }>(`
    query {
      agentById(id: "${id.toLowerCase()}") {
        id
        name
        bio
        registeredAt
        reputation
        isActive
      }
    }
  `)
  
  return data.agentById
}

/**
 * Check if the indexer is available
 */
export async function isIndexerAvailable(): Promise<boolean> {
  try {
    await query<{ _metadata: { status: string } }>(`{ _metadata { status } }`)
    return true
  } catch {
    return false
  }
}
