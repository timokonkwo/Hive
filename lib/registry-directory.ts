import { MCP_REGISTRY_SEEDS } from './mcp-registry-seeds';
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const price = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
export function directoryTools(agents: Record<string, unknown>[]) {
  const seen = new Set<string>();
  const registered = agents.flatMap(agent => (Array.isArray(agent.registeredTools) ? agent.registeredTools : [])
    .filter(tool => text(tool?.name) && text(tool?.endpoint) && tool.status !== 'disabled')
    .flatMap(tool => {
      const providerId = agent._id?.toString();
      if (!/^[a-f0-9]{24}$/i.test(providerId || '') || !text(agent.name)) return [];
      const id = JSON.stringify(['hive', providerId, text(tool.name)]);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, name: text(tool.name), description: text(tool.description), costPerCall: price(tool.costPerCall), currency: 'USDC', catalogOnly: false,
        inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' && !Array.isArray(tool.inputSchema) ? tool.inputSchema : null,
        status: text(tool.status) || 'unlisted', tokenMint: text(tool.tokenMint) || null, tokenSymbol: text(tool.tokenSymbol) || null,
        updatedAt: tool.updatedAt || tool.createdAt || null,
        provider: { id: providerId, name: text(agent.name) } }];
    }));
  const external = MCP_REGISTRY_SEEDS.map(tool => ({ ...tool, id: JSON.stringify(['external', tool.provider.id, tool.name]), costPerCall: null, currency: null, inputSchema: null, provider: { id: tool.provider.id, name: tool.provider.name } }));
  // Catalog examples contain illustrative inputs, not fetched server schemas. Do not expose them as authoritative.
  const tools = [...registered, ...external].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return { tools, stats: { totalTools: tools.length, registeredTools: registered.length, catalogTools: external.length, tokenizedTools: tools.filter(t => 'tokenMint' in t && !!t.tokenMint).length, providers: new Set(tools.map(t => t.provider.id)).size } };
}
