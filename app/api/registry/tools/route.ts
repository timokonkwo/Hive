import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { logger } from '@/lib/logger';
import { MCP_REGISTRY_SEEDS } from '@/lib/mcp-registry-seeds';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`registry-tools:${ip}`, RATE_LIMITS.READ);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const agents = await db.collection(COLLECTIONS.AGENTS)
      .find({
        status: { $ne: 'suspended' },
        'registeredTools.endpoint': { $exists: true },
      })
      .project({
        name: 1,
        bio: 1,
        reputation: 1,
        avgSatisfaction: 1,
        reviewCount: 1,
        solanaAddress: 1,
        walletAddress: 1,
        registeredTools: 1,
      })
      .limit(300)
      .toArray();

    const registeredTools = agents.flatMap((agent: any) =>
      (Array.isArray(agent.registeredTools) ? agent.registeredTools : [])
        .filter((tool: any) => tool?.name && tool?.endpoint && tool?.status !== 'disabled')
        .map((tool: any) => ({
          name: tool.name,
          description: tool.description || '',
          costPerCall: Number(tool.costPerCall || 0),
          inputSchema: tool.inputSchema || { type: 'object', properties: {} },
          status: tool.status || 'active',
          tokenMint: tool.tokenMint || null,
          feeVaultAddress: tool.feeVaultAddress || null,
          tokenSymbol: tool.tokenSymbol || null,
          tokenizedAt: tool.tokenizedAt || null,
          updatedAt: tool.updatedAt || tool.createdAt || null,
          provider: {
            id: agent._id?.toString?.() || null,
            name: agent.name || 'Registered Provider',
            bio: agent.bio || '',
            reputation: Number(agent.reputation || 0),
            avgSatisfaction: Number(agent.avgSatisfaction || 0),
            reviewCount: Number(agent.reviewCount || 0),
            address: agent.solanaAddress || agent.walletAddress || null,
          },
        }))
    );

    const registeredNames = new Set(registeredTools.map((tool) => tool.name));
    const tools = [
      ...registeredTools,
      ...MCP_REGISTRY_SEEDS.filter((tool) => !registeredNames.has(tool.name)),
    ];

    tools.sort((a, b) => {
      if (!!a.catalogOnly !== !!b.catalogOnly) return a.catalogOnly ? 1 : -1;
      if (b.provider.reputation !== a.provider.reputation) {
        return b.provider.reputation - a.provider.reputation;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      tools,
      stats: {
        totalTools: tools.length,
        tokenizedTools: tools.filter((tool) => !!tool.tokenMint).length,
        providers: new Set(tools.map((tool) => tool.provider.id || tool.provider.name)).size,
        catalogTools: tools.filter((tool) => !!tool.catalogOnly).length,
        registeredTools: registeredTools.length,
      },
    });
  } catch (error: any) {
    logger.error('GET /api/registry/tools error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load registry.' }, { status: 500 });
  }
}
