import { safeFetchJson } from "@/lib/bnb/endpoint-security";
import type { BnbAgentProfile, BnbExecutionEndpoint } from "@/lib/bnb/types";
import type { BnbAgentExecutionAdapter, BnbAdapterPreflightResult, BnbAdapterRunInput } from "@/lib/bnb/adapters/types";
import { completedAdapterWork } from "@/lib/bnb/adapters/types";

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

function mcpEndpoint(agent: BnbAgentProfile) {
  return agent.executionEndpoints?.find((endpoint) => endpoint.adapter === "mcp");
}

function jsonRpc(method: string, params?: unknown) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: `hive-${Date.now()}`,
    method,
    ...(params ? { params } : {}),
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function parseTools(payload: unknown): McpTool[] {
  const result = asRecord(asRecord(payload).result);
  const directTools = Array.isArray(result.tools) ? result.tools : [];
  return directTools
    .map((tool) => asRecord(tool))
    .map((tool) => ({
      name: typeof tool.name === "string" ? tool.name : "",
      description: typeof tool.description === "string" ? tool.description : undefined,
      inputSchema: tool.inputSchema,
    }))
    .filter((tool) => tool.name);
}

async function listTools(endpoint: BnbExecutionEndpoint) {
  const { response, payload } = await safeFetchJson(endpoint.url, {
    method: "POST",
    body: jsonRpc("tools/list"),
    timeoutMs: 7_000,
    maxBytes: 192 * 1024,
  });
  if (!response.ok) throw new Error(`MCP tools/list failed with HTTP ${response.status}.`);
  const tools = parseTools(payload);
  if (tools.length === 0) throw new Error("MCP endpoint did not return callable tools.");
  return tools;
}

function chooseTool(tools: McpTool[], task: string) {
  const terms = task
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
  const scored = tools.map((tool) => {
    const text = `${tool.name} ${tool.description || ""}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
    return { tool, score };
  });
  return scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))[0]?.tool || tools[0];
}

function toolArguments(tool: McpTool, task: string) {
  const schema = asRecord(tool.inputSchema);
  const properties = asRecord(schema.properties);
  const args: Record<string, unknown> = {};
  const candidates = ["query", "task", "prompt", "input", "message", "description"];
  const key = candidates.find((candidate) => properties[candidate]) || candidates.find((candidate) => tool.name.toLowerCase().includes(candidate)) || "query";
  args[key] = task;
  return args;
}

function stringifyOutput(payload: unknown) {
  const result = asRecord(asRecord(payload).result);
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .map((item) => {
      const record = asRecord(item);
      if (typeof record.text === "string") return record.text;
      if (record.json) return JSON.stringify(record.json, null, 2);
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
  if (text) return text;
  if (typeof result.output === "string") return result.output;
  return JSON.stringify(result || payload, null, 2);
}

export const mcpAdapter: BnbAgentExecutionAdapter = {
  id: "mcp",

  canHandle(agent: BnbAgentProfile) {
    return Boolean(mcpEndpoint(agent));
  },

  async preflight(agent: BnbAgentProfile): Promise<BnbAdapterPreflightResult> {
    const endpoint = mcpEndpoint(agent);
    if (!endpoint) return { ok: false, adapter: "mcp", reason: "No MCP endpoint is listed." };

    try {
      const tools = await listTools(endpoint);
      return {
        ok: true,
        adapter: "mcp",
        endpoint,
        capabilities: tools.map((tool) => tool.name).slice(0, 20),
      };
    } catch (error) {
      return {
        ok: false,
        adapter: "mcp",
        endpoint,
        reason: error instanceof Error ? error.message : "MCP preflight failed.",
      };
    }
  },

  async run({ agent, record }: BnbAdapterRunInput) {
    const endpoint = mcpEndpoint(agent);
    if (!endpoint) throw new Error("No MCP endpoint is listed for this agent.");
    const startedAt = new Date().toISOString();
    const tools = await listTools(endpoint);
    const tool = chooseTool(tools, record.limits.task);
    const { response, payload } = await safeFetchJson(endpoint.url, {
      method: "POST",
      body: jsonRpc("tools/call", {
        name: tool.name,
        arguments: toolArguments(tool, record.limits.task),
      }),
      timeoutMs: 12_000,
      maxBytes: 384 * 1024,
    });
    if (!response.ok) throw new Error(`MCP tools/call failed with HTTP ${response.status}.`);
    const error = asRecord(payload).error;
    if (error) throw new Error(typeof asRecord(error).message === "string" ? asRecord(error).message as string : "MCP tool call failed.");

    return completedAdapterWork(
      stringifyOutput(payload),
      [`MCP:${endpoint.url}`, `MCP tool:${tool.name}`],
      startedAt,
      `mcp:${agent.chainId}:${agent.tokenId}:${tool.name}`,
    );
  },
};
