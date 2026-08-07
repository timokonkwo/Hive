import { NextRequest, NextResponse } from "next/server";
import { getBnbAgent, listBnbAgents, matchBnbAgents } from "@/lib/bnb/catalog";
import { analyzePancakeSwapV2Pair } from "@/lib/bnb/pancakeswap";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

const tools = [
  {
    name: "bnb_discover_agents",
    description: "List BSC agents indexed or configured for Hive.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string" },
        q: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "bnb_match_agents",
    description: "Rank BSC agents for a plain-English task.",
    inputSchema: {
      type: "object",
      required: ["intent"],
      properties: {
        intent: { type: "string" },
        category: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "bnb_get_agent",
    description: "Get one BSC agent by chain ID and token ID.",
    inputSchema: {
      type: "object",
      required: ["chainId", "tokenId"],
      properties: {
        chainId: { type: "number" },
        tokenId: { type: "string" },
      },
    },
  },
  {
    name: "bnb_analyze_pancake_pair",
    description: "Read PancakeSwap V2 pair reserves from BSC RPC.",
    inputSchema: {
      type: "object",
      properties: {
        tokenA: { type: "string" },
        tokenB: { type: "string" },
      },
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "bnb_discover_agents") {
    return listBnbAgents({
      category: typeof args.category === "string" ? args.category : null,
      q: typeof args.q === "string" ? args.q : null,
      limit: typeof args.limit === "number" ? args.limit : 10,
    });
  }

  if (name === "bnb_match_agents") {
    const intent = typeof args.intent === "string" ? args.intent : "";
    if (!intent.trim()) throw new Error("intent is required");
    return matchBnbAgents(intent, typeof args.category === "string" ? args.category : null, typeof args.limit === "number" ? args.limit : 5);
  }

  if (name === "bnb_get_agent") {
    const tokenId = typeof args.tokenId === "string" ? args.tokenId : "";
    const chainId = typeof args.chainId === "number" || typeof args.chainId === "string" ? args.chainId : 56;
    if (!tokenId) throw new Error("tokenId is required");
    return getBnbAgent(chainId, tokenId);
  }

  if (name === "bnb_analyze_pancake_pair") {
    return analyzePancakeSwapV2Pair({
      tokenA: typeof args.tokenA === "string" ? args.tokenA : null,
      tokenB: typeof args.tokenB === "string" ? args.tokenB : null,
    });
  }

  throw new Error(`Unknown BNB tool: ${name}`);
}

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "mcp:get", "read");
  if (limited) return limited;

  return NextResponse.json({
    name: "Hive BNB tools",
    tools,
  });
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "mcp:post", "write");
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const record = asRecord(body);

  if (record.method === "tools/list") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: record.id ?? null,
      result: { tools },
    });
  }

  try {
    const params = asRecord(record.params);
    const directTool = typeof record.tool === "string" ? record.tool : "";
    const mcpTool = typeof params.name === "string" ? params.name : "";
    const name = directTool || mcpTool;
    const args = directTool ? asRecord(record.args) : asRecord(params.arguments);
    const result = await callTool(name, args);

    if (record.jsonrpc || record.method) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: record.id ?? null,
        result: {
          content: [{ type: "json", json: result }],
        },
      });
    }

    return NextResponse.json({ status: "ok", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tool call failed.";
    if (record.jsonrpc || record.method) {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: record.id ?? null,
        error: { code: -32000, message },
      }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
