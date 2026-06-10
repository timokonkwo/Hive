import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { chargeToolInvocation, refundToolInvocation } from '@/lib/session-wallet';
import { validateOutboundUrl } from '@/lib/ssrf';
import { authenticateRequest } from '@/lib/api-key';
import { authenticateClient } from '@/lib/client-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

const MAX_PROVIDER_REQUEST_BYTES = 128 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
const MAX_MCP_REQUEST_BYTES = 128 * 1024;

function jsonRpcResult(id: JsonRpcRequest['id'], result: any) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result });
}

function jsonRpcError(id: JsonRpcRequest['id'], code: number, message: string, httpStatus?: number) {
  return NextResponse.json(
    { jsonrpc: '2.0', id: id ?? null, error: { code, message } },
    { status: httpStatus || (code === -32601 ? 404 : 400) }
  );
}

function toolText(text: string) {
  return { content: [{ type: 'text', text }] };
}

function authHeaders(req: NextRequest): Record<string, string> {
  const apiKey = req.headers.get('x-hive-api-key');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const key = apiKey || (bearer?.startsWith('hive_sk_') ? bearer : null);
  return key ? { 'x-hive-api-key': key } : {};
}

/**
 * Resolve the authenticated client userId from the request.
 * Checks x-hive-api-key first, then falls back to Privy JWT bearer token.
 */
async function resolveClientId(req: NextRequest): Promise<string | null> {
  const apiKey = req.headers.get('x-hive-api-key');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const key = apiKey || (bearer?.startsWith('hive_sk_') ? bearer : null);

  if (key) {
    try {
      const db = await getDb();
      const auth = await authenticateRequest(req.headers, db);
      if (auth?.agent) return auth.agent.ownerAddress || auth.agent.walletAddress || auth.agent.id;
    } catch { /* fall through */ }
  }

  const client = await authenticateClient(req);
  if (client) return client.userId;

  return null;
}

function requestTooLarge(req: NextRequest) {
  const rawLength = req.headers.get('content-length');
  const length = rawLength ? Number(rawLength) : 0;
  return Number.isFinite(length) && length > MAX_MCP_REQUEST_BYTES;
}

async function callJson(req: NextRequest, path: string, init: RequestInit = {}) {
  const url = new URL(path, req.url);
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders(req),
    ...(init.headers as Record<string, string> || {}),
  };
  const response = await fetch(url, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

const tools = [
  {
    name: 'hive_list_tasks',
    description: 'Browse open tasks on the Hive marketplace.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        status: { type: 'string', default: 'Open' },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'hive_get_task',
    description: 'Get task details by ID.',
    inputSchema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
  },
  {
    name: 'hive_get_task_matches',
    description: 'Get explainable Smart Matching rankings for a task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        limit: { type: 'number', default: 5 },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'hive_route_task',
    description: 'Create an instant-matched task. The best available agent is assigned automatically. Requires x-hive-api-key.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        budget: { type: 'string' },
      },
      required: ['title', 'description', 'category'],
    },
  },
  {
    name: 'hive_deliver',
    description: 'Submit completed work for an assigned task. Requires x-hive-api-key.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        summary: { type: 'string' },
        deliverables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              specIndex: { type: 'number' },
              type: { type: 'string', enum: ['file', 'url', 'text', 'code', 'image', 'token_launch'] },
              label: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['type', 'content'],
          },
        },
      },
      required: ['taskId', 'summary', 'deliverables'],
    },
  },
];

async function listExternalTools() {
  try {
    const db = await getDb();
    const agents = await db.collection(COLLECTIONS.AGENTS)
      .find({
        status: { $ne: 'suspended' },
        'registeredTools.endpoint': { $exists: true },
      })
      .project({ name: 1, reputation: 1, registeredTools: 1, solanaAddress: 1 })
      .limit(200)
      .toArray();

    const reserved = new Set(tools.map((tool) => tool.name));
    const seen = new Set<string>();
    return agents.flatMap((agent: any) =>
      (Array.isArray(agent.registeredTools) ? agent.registeredTools : [])
        .filter((tool: any) => tool?.name && tool?.endpoint && tool?.status !== 'disabled')
        .filter((tool: any) => {
          if (reserved.has(tool.name) || seen.has(tool.name)) return false;
          seen.add(tool.name);
          return true;
        })
        .map((tool: any) => ({
          name: tool.name,
          description: tool.description || `External Hive MCP tool from ${agent.name || 'registered provider'}.`,
          inputSchema: tool.inputSchema || { type: 'object', properties: {} },
          costPerCall: tool.costPerCall || 0,
          provider: {
            name: agent.name || null,
            address: agent.solanaAddress || null,
            reputation: agent.reputation || 0,
          },
          tokenMint: tool.tokenMint || null,
          feeVaultAddress: tool.feeVaultAddress || null,
        }))
    );
  } catch {
    return [];
  }
}

/**
 * Execute a built-in Hive tool. These are internal tools that don't
 * require forwarding to an external provider.
 */
async function callTool(req: NextRequest, name: string, args: any) {
  if (name === 'hive_list_tasks') {
    const params = new URLSearchParams();
    params.set('status', args?.status || 'Open');
    if (args?.category) params.set('category', args.category);
    if (args?.limit) params.set('limit', String(args.limit));
    const data = await callJson(req, `/api/tasks?${params.toString()}`);
    return toolText(JSON.stringify(data, null, 2));
  }

  if (name === 'hive_get_task') {
    const data = await callJson(req, `/api/tasks/${encodeURIComponent(args.taskId)}`);
    return toolText(JSON.stringify(data, null, 2));
  }

  if (name === 'hive_get_task_matches') {
    const limit = Math.min(Math.max(Number(args?.limit || 5), 1), 25);
    const data = await callJson(req, `/api/tasks/${encodeURIComponent(args.taskId)}/matches?limit=${limit}`);
    return toolText(JSON.stringify(data, null, 2));
  }

  if (name === 'hive_route_task') {
    // Use the instant-match endpoint for direct routing
    const data = await callJson(req, `/api/tasks/instant-match`, {
      method: 'POST',
      body: JSON.stringify({
        title: args.title,
        description: args.description,
        category: args.category,
        budget: args.budget || 'Negotiable',
      }),
    });
    return toolText(JSON.stringify(data, null, 2));
  }

  if (name === 'hive_deliver') {
    const data = await callJson(req, `/api/tasks/${encodeURIComponent(args.taskId)}/submit`, {
      method: 'POST',
      body: JSON.stringify({
        summary: args.summary,
        deliverables: args.deliverables,
      }),
    });
    return toolText(JSON.stringify(data, null, 2));
  }

  throw new Error(`Unknown tool: ${name}`);
}

/**
 * Check if the tool name is a registered external provider tool.
 * If so, resolve the provider endpoint and cost-per-call.
 */
async function resolveExternalTool(toolName: string): Promise<{
  providerEndpoint: string;
  providerAddress: string;
  costPerCall: number;
  agentId: string;
} | null> {
  try {
    if (typeof toolName !== 'string' || toolName.length > 128) return null;
    const db = await getDb();
    // Look for an agent that has registered this tool capability
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      'registeredTools.name': toolName,
      status: { $ne: 'suspended' },
    });

    if (!agent?.registeredTools) return null;

    const tool = agent.registeredTools.find((t: any) => t.name === toolName);
    if (!tool?.endpoint) return null;

    return {
      providerEndpoint: tool.endpoint,
      providerAddress: agent.solanaAddress || '',
      costPerCall: tool.costPerCall || 0,
      agentId: agent._id.toString(),
    };
  } catch {
    return null;
  }
}

/**
 * Forward a JSON-RPC tools/call request to an external provider endpoint.
 * Enforces a 5-second timeout.
 */
async function forwardToProvider(
  providerEndpoint: string,
  rpc: JsonRpcRequest
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const endpoint = await validateOutboundUrl(providerEndpoint, { purpose: 'Provider endpoint' });
    const body = JSON.stringify(rpc);
    if (Buffer.byteLength(body, 'utf8') > MAX_PROVIDER_REQUEST_BYTES) {
      throw new Error('Provider request payload is too large.');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}.`);
    }

    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new Error('Provider response payload is too large.');
    }

    const data = text ? JSON.parse(text) : {};
    if (data?.error) {
      const message = typeof data.error?.message === 'string' ? data.error.message : 'Provider returned a JSON-RPC error.';
      throw new Error(message.slice(0, 300));
    }
    return data.result || data;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── HTTP Handlers ──

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`mcp-get:${ip}`, { maxRequests: 120, windowSeconds: 60 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.resetInSeconds}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
    );
  }

  const baseUrl = new URL(req.url).origin;
  const externalTools = await listExternalTools();
  return NextResponse.json({
    name: 'Hive MCP Gateway',
    version: '0.2.0',
    endpoint: `${baseUrl}/api/mcp`,
    transport: 'http-json-rpc',
    authentication: {
      type: 'apiKey',
      header: 'x-hive-api-key',
      bearerSupported: true,
    },
    tools: [
      ...tools.map(({ name, description }) => ({ name, description })),
      ...externalTools.map(({ name, description, costPerCall, provider, tokenMint }) => ({
        name,
        description,
        costPerCall,
        provider,
        tokenMint,
      })),
    ],
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`mcp-post:${ip}`, { maxRequests: 60, windowSeconds: 60 });
  if (!rl.allowed) {
    return jsonRpcError(null, -32029, `Rate limited. Try again in ${rl.resetInSeconds}s.`, 429);
  }

  if (requestTooLarge(req)) {
    return jsonRpcError(null, -32600, 'MCP request payload is too large.', 413);
  }

  let rpc: JsonRpcRequest;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_MCP_REQUEST_BYTES) {
      return jsonRpcError(null, -32600, 'MCP request payload is too large.', 413);
    }
    rpc = JSON.parse(raw);
  } catch {
    return jsonRpcError(null, -32700, 'Invalid JSON');
  }

  try {
    if (rpc.method === 'initialize') {
      return jsonRpcResult(rpc.id, {
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'hive-mcp-gateway', version: '0.2.0' },
        capabilities: { tools: {}, resources: {}, prompts: {} },
      });
    }

    if (rpc.method === 'tools/list') {
      return jsonRpcResult(rpc.id, { tools: [...tools, ...(await listExternalTools())] });
    }

    if (rpc.method === 'tools/call') {
      const toolName = rpc.params?.name;
      const toolArgs = rpc.params?.arguments || {};
      if (typeof toolName !== 'string' || toolName.length === 0 || toolName.length > 128) {
        return jsonRpcError(rpc.id, -32602, 'tools/call requires a valid string params.name.');
      }

      // Check if this is a registered external provider tool
      const externalTool = await resolveExternalTool(toolName);

      if (externalTool && externalTool.costPerCall > 0) {
        // ─── Paid external tool: authenticate + charge + forward ───
        if (!externalTool.providerAddress) {
          return jsonRpcError(rpc.id, -32004, 'Provider payout wallet is not configured.', 409);
        }

        const clientId = await resolveClientId(req);
        if (!clientId) {
          return jsonRpcError(rpc.id, -32001, 'Authentication required. Provide x-hive-api-key or authorization header.', 401);
        }

        // Charge the client's session wallet
        const charge = await chargeToolInvocation(
          clientId,
          toolName,
          externalTool.providerAddress,
          externalTool.costPerCall
        );

        if (!charge.success) {
          return jsonRpcError(rpc.id, -32002, charge.error || 'Payment required: insufficient session balance.', 402);
        }

        // Forward JSON-RPC request to the provider
        try {
          const result = await forwardToProvider(externalTool.providerEndpoint, rpc);
          return jsonRpcResult(rpc.id, result);
        } catch (fwdError: any) {
          await refundToolInvocation(
            clientId,
            charge.ledgerId,
            charge.chargedCost || externalTool.costPerCall,
            fwdError.message || 'Provider execution failed.'
          ).catch(() => undefined);

          // Log as potential dispute candidate
          try {
            const db = await getDb();
            await db.collection(COLLECTIONS.ACTIVITY).insertOne({
              type: 'RoutingFailure',
              metadata: {
                toolName,
                providerAddress: externalTool.providerAddress,
                clientId,
                error: fwdError.message,
                chargedAmount: externalTool.costPerCall,
              },
              createdAt: new Date(),
            });
          } catch { /* best effort logging */ }

          return jsonRpcError(rpc.id, -32003, `Provider execution failed: ${fwdError.message}`);
        }
      }

      if (externalTool) {
        try {
          const result = await forwardToProvider(externalTool.providerEndpoint, rpc);
          return jsonRpcResult(rpc.id, result);
        } catch (fwdError: any) {
          return jsonRpcError(rpc.id, -32003, `Provider execution failed: ${fwdError.message}`);
        }
      }

      // ─── Built-in Hive tool: execute internally ───
      const result = await callTool(req, toolName, toolArgs);
      return jsonRpcResult(rpc.id, result);
    }

    if (rpc.method === 'resources/list') {
      return jsonRpcResult(rpc.id, {
        resources: [
          { uri: 'hive://config', name: 'Hive Gateway Configuration', mimeType: 'application/json' },
          { uri: 'hive://events', name: 'Hive Marketplace Events', mimeType: 'application/json' },
        ],
      });
    }

    if (rpc.method === 'resources/read') {
      const uri = rpc.params?.uri;
      if (uri === 'hive://config') {
        return jsonRpcResult(rpc.id, {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ baseUrl: new URL(req.url).origin, apiKeyConfigured: Object.keys(authHeaders(req)).length > 0 }, null, 2) }],
        });
      }
      if (uri === 'hive://events') {
        return jsonRpcResult(rpc.id, {
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(['task.routed', 'task.assigned', 'work.submitted', 'task.completed', 'session.charged', 'settlement.batch'], null, 2) }],
        });
      }
      return jsonRpcError(rpc.id, -32602, `Unknown resource: ${uri}`);
    }

    if (rpc.method === 'prompts/list') {
      return jsonRpcResult(rpc.id, {
        prompts: [
          { name: 'create_task', description: 'Create a task and assign it to the best available agent on the Hive marketplace.' },
          { name: 'task_brief', description: 'Turn rough client intent into a clear Hive task brief.' },
        ],
      });
    }

    if (rpc.method === 'prompts/get') {
      const name = rpc.params?.name;
      if (name === 'create_task' || name === 'route_task') {
        return jsonRpcResult(rpc.id, {
          messages: [{ role: 'user', content: { type: 'text', text: 'Create a task for the Hive marketplace. Include a clear title, category, requirements, budget, and deliverable specifications.' } }],
        });
      }
      if (name === 'task_brief') {
        return jsonRpcResult(rpc.id, {
          messages: [{ role: 'user', content: { type: 'text', text: 'Convert this rough request into a Hive task brief with title, category, requirements, budget guidance, and deliverable specs.' } }],
        });
      }
      return jsonRpcError(rpc.id, -32602, `Unknown prompt: ${name}`);
    }

    return jsonRpcError(rpc.id, -32601, `Unknown method: ${rpc.method}`);
  } catch (error: any) {
    return jsonRpcError(rpc.id, -32000, error.message || 'MCP gateway request failed');
  }
}
