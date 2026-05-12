import { NextRequest, NextResponse } from 'next/server';

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

function jsonRpcResult(id: JsonRpcRequest['id'], result: any) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result });
}

function jsonRpcError(id: JsonRpcRequest['id'], code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: '2.0', id: id ?? null, error: { code, message } },
    { status: code === -32601 ? 404 : 400 }
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
    name: 'hive_propose',
    description: 'Submit a proposal on a task. Requires x-hive-api-key.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        amount: { type: 'number' },
        coverLetter: { type: 'string' },
        timeEstimate: { type: 'string' },
      },
      required: ['taskId', 'amount', 'coverLetter'],
    },
  },
  {
    name: 'hive_deliver',
    description: 'Submit completed work for an accepted task. Requires x-hive-api-key.',
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

  if (name === 'hive_propose') {
    const data = await callJson(req, `/api/tasks/${encodeURIComponent(args.taskId)}/bids`, {
      method: 'POST',
      body: JSON.stringify({
        amount: args.amount,
        coverLetter: args.coverLetter,
        timeEstimate: args.timeEstimate,
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

export async function GET(req: NextRequest) {
  const baseUrl = new URL(req.url).origin;
  return NextResponse.json({
    name: 'Hive Remote MCP',
    version: '0.1.0',
    endpoint: `${baseUrl}/api/mcp`,
    transport: 'http-json-rpc',
    authentication: {
      type: 'apiKey',
      header: 'x-hive-api-key',
      bearerSupported: true,
    },
    tools: tools.map(({ name, description }) => ({ name, description })),
  });
}

export async function POST(req: NextRequest) {
  let rpc: JsonRpcRequest;
  try {
    rpc = await req.json();
  } catch {
    return jsonRpcError(null, -32700, 'Invalid JSON');
  }

  try {
    if (rpc.method === 'initialize') {
      return jsonRpcResult(rpc.id, {
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'hive-remote-mcp', version: '0.1.0' },
        capabilities: { tools: {}, resources: {}, prompts: {} },
      });
    }

    if (rpc.method === 'tools/list') {
      return jsonRpcResult(rpc.id, { tools });
    }

    if (rpc.method === 'tools/call') {
      const result = await callTool(req, rpc.params?.name, rpc.params?.arguments || {});
      return jsonRpcResult(rpc.id, result);
    }

    if (rpc.method === 'resources/list') {
      return jsonRpcResult(rpc.id, {
        resources: [
          { uri: 'hive://config', name: 'Hive Configuration', mimeType: 'application/json' },
          { uri: 'hive://events', name: 'Hive Webhook Events', mimeType: 'application/json' },
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
          contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(['task.created', 'bid.submitted', 'bid.accepted', 'bid.rejected', 'work.submitted', 'task.completed', 'payment.sent'], null, 2) }],
        });
      }
      return jsonRpcError(rpc.id, -32602, `Unknown resource: ${uri}`);
    }

    if (rpc.method === 'prompts/list') {
      return jsonRpcResult(rpc.id, {
        prompts: [
          { name: 'draft_proposal', description: 'Draft a strong proposal for a Hive task.' },
          { name: 'task_brief', description: 'Turn rough client intent into a clear Hive task brief.' },
        ],
      });
    }

    if (rpc.method === 'prompts/get') {
      const name = rpc.params?.name;
      if (name === 'draft_proposal') {
        return jsonRpcResult(rpc.id, {
          messages: [{ role: 'user', content: { type: 'text', text: 'Draft a concise proposal with approach, timeline, assumptions, and deliverables for this Hive task.' } }],
        });
      }
      if (name === 'task_brief') {
        return jsonRpcResult(rpc.id, {
          messages: [{ role: 'user', content: { type: 'text', text: 'Convert this rough request into a Hive task title, category, requirements, budget guidance, and deliverable specs.' } }],
        });
      }
      return jsonRpcError(rpc.id, -32602, `Unknown prompt: ${name}`);
    }

    return jsonRpcError(rpc.id, -32601, `Unknown method: ${rpc.method}`);
  } catch (error: any) {
    return jsonRpcError(rpc.id, -32000, error.message || 'MCP request failed');
  }
}
