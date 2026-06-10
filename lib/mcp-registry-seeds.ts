export type RegistrySeedTool = {
  name: string;
  description: string;
  costPerCall: number;
  inputSchema: Record<string, unknown>;
  status: string;
  catalogOnly: true;
  remoteUrl: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  installCommand?: string;
  authRequired?: boolean;
  provider: {
    id: string;
    name: string;
    bio: string;
    reputation: number;
    avgSatisfaction: number;
    reviewCount: number;
    address: null;
  };
};

// Curated from the official MCP Registry and the MCP reference servers repo.
// These are public examples users can connect directly or register behind Hive.
export const MCP_REGISTRY_SEEDS: RegistrySeedTool[] = [
  {
    name: 'ac.inference.sh/mcp',
    description: 'Run image, video, audio, LLM, 3D, and other AI apps through a hosted MCP endpoint.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { app: { type: 'string' }, input: { type: 'object' } } },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: 'https://api.inference.sh/mcp',
    websiteUrl: 'https://inference.sh',
    sourceUrl: 'https://registry.modelcontextprotocol.io/v0/servers',
    provider: { id: 'seed-inference-sh', name: 'inference.sh', bio: 'Official MCP Registry entry', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
  {
    name: 'agency.lona/trading',
    description: 'AI trading strategy development with backtesting, market data, and portfolio analysis.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, symbol: { type: 'string' } } },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: 'https://mcp.lona.agency/mcp',
    websiteUrl: 'https://lona.agency',
    sourceUrl: 'https://github.com/mindsightventures/lona',
    provider: { id: 'seed-lona', name: 'Lona', bio: 'Official MCP Registry entry', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
  {
    name: 'ai.agentic-news/mcp',
    description: 'Personalized news monitoring, briefings, and semantic search for AI agents.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { topic: { type: 'string' }, timeframe: { type: 'string' } } },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: 'https://api.agentic-news.ai/mcp',
    websiteUrl: 'https://agentic-news.ai/mcp',
    sourceUrl: 'https://github.com/u00dxk2/agentic-news',
    provider: { id: 'seed-agentic-news', name: 'Agentic News', bio: 'Official MCP Registry entry', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
  {
    name: 'ai.agentdm/agentdm',
    description: 'Agent-to-agent messaging, channels, and skills through an MCP interface.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { channel: { type: 'string' }, message: { type: 'string' } } },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: 'https://api.agentdm.ai/mcp/v1/grid',
    websiteUrl: 'https://agentdm.ai',
    sourceUrl: 'https://github.com/agentdmai/agentdm',
    authRequired: true,
    provider: { id: 'seed-agentdm', name: 'AgentDM', bio: 'Official MCP Registry entry', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
  {
    name: 'ai.agenticterminal/directory',
    description: 'Directory of merchants accepting agentic payments over Lightning, L402, BOLT12, and USDT.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { rail: { type: 'string' }, category: { type: 'string' } } },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: 'https://mcp.agenticterminal.ai/mcp',
    websiteUrl: 'https://agenticterminal.ai',
    sourceUrl: 'https://github.com/observer-protocol/at-directory',
    provider: { id: 'seed-agentic-terminal', name: 'Agentic Terminal', bio: 'Official MCP Registry entry', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
  {
    name: 'ai.adadvisor/mcp-server',
    description: 'Query Meta Ads accounts, campaigns, ad sets, ads, metrics, and settings.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { accountId: { type: 'string' }, dateRange: { type: 'string' } } },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: 'https://api.adadvisor.ai/mcp',
    websiteUrl: 'https://www.adadvisor.ai/docs/user-guide/getting-started-with-mcp',
    sourceUrl: 'https://registry.modelcontextprotocol.io/v0/servers',
    authRequired: true,
    provider: { id: 'seed-adadvisor', name: 'AdAdvisor', bio: 'Official MCP Registry entry', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
  {
    name: 'mcp_fetch',
    description: 'Reference MCP server for fetching web content and converting it for efficient LLM usage.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: null,
    websiteUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    installCommand: 'uvx mcp-server-fetch',
    provider: { id: 'seed-reference-fetch', name: 'MCP Reference Servers', bio: 'Maintained by the MCP steering group', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
  {
    name: 'mcp_memory',
    description: 'Reference MCP server for knowledge graph-based persistent memory.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { entity: { type: 'string' }, relation: { type: 'string' } } },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: null,
    websiteUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    installCommand: 'npx -y @modelcontextprotocol/server-memory',
    provider: { id: 'seed-reference-memory', name: 'MCP Reference Servers', bio: 'Maintained by the MCP steering group', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
  {
    name: 'mcp_sequentialthinking',
    description: 'Reference MCP server for dynamic and reflective problem solving through thought sequences.',
    costPerCall: 0,
    inputSchema: { type: 'object', properties: { thought: { type: 'string' }, step: { type: 'number' } } },
    status: 'catalog',
    catalogOnly: true,
    remoteUrl: null,
    websiteUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    sourceUrl: 'https://github.com/modelcontextprotocol/servers',
    installCommand: 'npx -y @modelcontextprotocol/server-sequential-thinking',
    provider: { id: 'seed-reference-sequentialthinking', name: 'MCP Reference Servers', bio: 'Maintained by the MCP steering group', reputation: 0, avgSatisfaction: 0, reviewCount: 0, address: null },
  },
];
