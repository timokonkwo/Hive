import { endpointAuthHeaders } from "@/lib/bnb/endpoint-auth";
import { safeFetchJson } from "@/lib/bnb/endpoint-security";
import { normalizedEndpointCapabilityName } from "@/lib/bnb/capability-contracts";
import {
  asSchemaRecord as asRecord,
  chainNameForSchema,
  coerceSchemaValue as coerceToolValue,
  directSchemaFieldValue,
  firstEvmAddress,
  isGenericSelectionValue,
  normalizeEndpointInputSchema as normalizeInputSchema,
  normalizeSchemaPropertyName as normalizePropertyName,
  poolForSchema,
  protocolForSchema,
} from "@/lib/bnb/adapters/schema-arguments";
import type { BnbAgentProfile, BnbEndpointCapabilityContract, BnbExecutionEndpoint } from "@/lib/bnb/types";
import type { BnbAgentExecutionAdapter, BnbAdapterPreflightResult, BnbAdapterRunInput } from "@/lib/bnb/adapters/types";
import { completedAdapterWork } from "@/lib/bnb/adapters/types";

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

function mcpEndpoint(agent: BnbAgentProfile, selected?: BnbExecutionEndpoint) {
  if (selected?.adapter === "mcp") return selected;
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

function parseTools(payload: unknown): McpTool[] {
  const result = asRecord(asRecord(payload).result);
  const directTools = Array.isArray(result.tools) ? result.tools : [];
  return directTools
    .map((tool) => asRecord(tool))
    .map((tool) => ({
      name: typeof tool.name === "string" ? tool.name : "",
      description: typeof tool.description === "string" ? tool.description : undefined,
      inputSchema: tool.inputSchema ?? tool.input_schema ?? tool.parameters ?? tool.schema,
    }))
    .filter((tool) => tool.name);
}

function mcpCapabilityContracts(tools: McpTool[]): BnbEndpointCapabilityContract[] {
  return tools.map((tool) => ({
    name: tool.name,
    kind: "tool",
    ...(tool.description ? { description: tool.description } : {}),
    ...(tool.inputSchema !== undefined ? { inputSchema: normalizeInputSchema(tool.inputSchema) } : {}),
  }));
}

async function listTools(endpoint: BnbExecutionEndpoint) {
  const { response, payload } = await safeFetchJson(endpoint.url, {
    method: "POST",
    headers: endpointAuthHeaders(endpoint.url),
    body: jsonRpc("tools/list"),
    timeoutMs: 7_000,
    maxBytes: 192 * 1024,
  });
  const protectedReason = protectedMcpReason(response.status, payload);
  if (protectedReason) throw new Error(protectedReason);
  if (!response.ok) throw new Error(`Agent request failed with HTTP ${response.status}.`);
  const tools = parseTools(payload);
  if (tools.length === 0) throw new Error("This agent did not return any jobs.");
  return tools;
}

function payloadText(payload: unknown) {
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return "";
  }
}

function protectedMcpReason(status: number, payload: unknown) {
  const text = payloadText(payload).toLowerCase();
  if (status === 401 || /unauthorized|authentication required|access-token|api key|token required/.test(text)) {
    return "This agent requires external sign-in.";
  }
  if (status === 403 || /forbidden|csrf|sec-fetch/.test(text)) {
    return "This agent is not available for jobs.";
  }
  return "";
}

function chooseTool(tools: McpTool[], agent: BnbAgentProfile, record: BnbAdapterRunInput["record"]) {
  const capability = record.jobSpec?.capability || "custom";
  const taskType = record.jobSpec?.taskType || record.limits.task;
  const selectedCapability = record.jobSpec?.endpointCapability?.name;
  const selectedTool = selectedCapability
    ? tools.find((tool) => normalizedEndpointCapabilityName(tool.name) === normalizedEndpointCapabilityName(selectedCapability))
    : null;
  if (selectedCapability && !selectedTool) {
    throw new Error("The selected job is no longer available for this agent.");
  }
  if (selectedTool) {
    const text = toolContractText(selectedTool);
    const capabilityBlocker = capability === "custom"
      ? customToolBlocker(selectedTool, text)
      : capabilityToolBlocker(selectedTool, text, capability, taskType);
    if (capabilityBlocker) throw new Error(capabilityBlocker);
    toolArguments(selectedTool, agent, record);
    return selectedTool;
  }

  const terms = record.limits.task
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
  const scored = tools.map((tool) => {
    const text = toolContractText(tool);
    let score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
    score += capabilityToolScore(capability, text);
    score += taskToolScore(capability, taskType, text);
    score += capability === "custom" ? customToolScore(tool, text, record.limits.task, terms) : 0;
    const capabilityBlocker = capability === "custom"
      ? customToolBlocker(tool, text)
      : capabilityToolBlocker(tool, text, capability, taskType);
    if (capabilityBlocker) {
      score -= 100;
    } else if (capability !== "custom" && isDirectoryTool(tool, text)) {
      score -= 50;
    }
    let argsError = "";
    if (capabilityBlocker) {
      argsError = capabilityBlocker;
    } else {
      try {
        toolArguments(tool, agent, record);
        score += 2;
      } catch (error) {
        argsError = error instanceof Error ? error.message : "This job needs more details.";
        score -= 12;
      }
    }
    return { tool, score, argsError };
  });

  const sorted = scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  const minimumScore = 4;
  const matchingTools = sorted.filter((candidate) => candidate.score >= minimumScore);
  if (matchingTools.length === 0) {
    throw new Error(`This agent cannot run this ${capabilityLabel(capability)} job. Choose another agent.`);
  }

  const callable = matchingTools.find((candidate) => !candidate.argsError);
  if (callable) return callable.tool;

  throw new Error(matchingTools[0].argsError);
}

function capabilityToolBlocker(tool: McpTool, text: string, capability: string, taskType = "") {
  if (capability === "custom") return "";
  if (isDirectoryTool(tool, text)) {
    return "This agent returned agent listings instead of this job.";
  }
  if (isDocumentationTool(tool, text)) {
    return "This agent returned documentation instead of this job.";
  }

  const schema = normalizeInputSchema(tool.inputSchema);
  const properties = Object.keys(asRecord(schema.properties)).join(" ").toLowerCase();
  const spaced = `${text} ${properties}`.replace(/[_-]+/g, " ");
  const compact = spaced.replace(/[^a-z0-9]+/g, "");

  if (capability === "health_factor") {
    if (
      /getenabledcollateral|enabledcollateral|collateralassets|supportedcollateral|listcollateral/.test(compact) &&
      !/(healthfactor|healthindicator|liquidation|borrowposition|userhealth)/.test(compact)
    ) {
      return "This agent is not available for this job.";
    }
  }

  if (capability === "concentrated_liquidity") {
    if (!isV3DiscoveryTask(taskType) && /getdexinfo|listdex|supportedfees|supportedpools/.test(compact) && !/(create|position|range|liquidity|tick)/.test(compact)) {
      return "This agent returned discovery data instead of this job.";
    }
  }

  return "";
}

function customToolBlocker(tool: McpTool, text: string) {
  if (isDirectoryTool(tool, text)) return "This agent returned agent listings instead of this job.";
  if (isDocumentationTool(tool, text)) return "This agent returned documentation instead of this job.";
  return "";
}

function toolContractText(tool: McpTool) {
  const schema = normalizeInputSchema(tool.inputSchema);
  const properties = asRecord(schema.properties);
  const propertyText = Object.entries(properties)
    .map(([key, value]) => `${key} ${textFromSchema(value)}`)
    .join(" ");
  return `${tool.name} ${tool.description || ""} ${propertyText}`.toLowerCase();
}

function textFromSchema(value: unknown): string {
  const record = asRecord(value);
  return [
    record.title,
    record.description,
    Array.isArray(record.enum) ? record.enum.join(" ") : "",
  ].filter(Boolean).join(" ");
}

function isDirectoryTool(tool: McpTool, text: string) {
  const schema = normalizeInputSchema(tool.inputSchema);
  const properties = asRecord(schema.properties);
  const propertyText = Object.keys(properties).join(" ").toLowerCase();
  const spaced = `${text} ${propertyText}`;
  const compact = spaced.replace(/[^a-z0-9]+/g, "");

  return (
    /(?:^|[^a-z])(list|search|browse|discover|get)\s+(?:all\s+)?(?:agents?|nfas?|erc8004\s+agents?|sly\s+agents?)(?:[^a-z]|$)/.test(spaced) ||
    /(?:listagents|searchagents|browseagents|discoveragents|getagents|getallagents|listnfas|searchnfas|getnfas|nfadirectory|agentdirectory|erc8004agents|slyagents)/.test(compact) ||
    (/\bagents?\b/.test(spaced) && /(?:nfatokenid|erc8004agentid|slywalletaddress|riskprofile)/.test(compact))
  );
}

function isDocumentationTool(tool: McpTool, text: string) {
  const schema = normalizeInputSchema(tool.inputSchema);
  const properties = Object.keys(asRecord(schema.properties));
  const propertyText = properties.join(" ").toLowerCase();
  const spaced = `${text} ${propertyText}`.replace(/[_-]+/g, " ");
  const compact = spaced.replace(/[^a-z0-9]+/g, "");

  return (
    /(?:^|[^a-z])(help|guide|docs|documentation|overview|description|instructions|how\s+to|tutorial)(?:[^a-z]|$)/.test(spaced) ||
    /(?:getdescription|protocoloverview|documentation|instructions|tutorial|howto|userguide|usageguide)/.test(compact)
  ) && properties.length <= 2;
}

function capabilityLabel(capability: string) {
  if (capability === "health_factor") return "health factor";
  if (capability === "concentrated_liquidity") return "liquidity";
  if (capability === "yield_optimisation") return "yield";
  if (capability === "grid_trading") return "grid trading";
  if (capability === "rebalancing") return "rebalancing";
  return "job";
}

function capabilityToolScore(capability: string, text: string) {
  if (capability === "health_factor") {
    let score = 0;
    if (/getuserhealthindicators|getaccountliquidity|account\s*liquidity|borrow\s*limit|shortfall|health\s*factor|health\s*indicator|liquidation|borrow\s*position|risk/.test(text)) score += 16;
    if (/enabled\s*collateral|getenabledcollateral|collateral\s*assets/.test(text)) score -= 4;
    return score;
  }

  if (capability === "concentrated_liquidity") {
    return /v3|concentrated|liquidity|tick|range|position/.test(text) ? 12 : 0;
  }

  if (capability === "yield_optimisation") {
    return /yield|apy|route|earn|vault|deposit/.test(text) ? 10 : 0;
  }

  if (capability === "grid_trading") {
    return /grid|trading|bounds|range|strategy/.test(text) ? 10 : 0;
  }

  if (capability === "rebalancing") {
    return /rebalance|position|allocation|range|liquidity/.test(text) ? 10 : 0;
  }

  return 0;
}

function customToolScore(tool: McpTool, text: string, task: string, terms: string[]) {
  const compact = text.replace(/[^a-z0-9]+/g, "");
  let score = terms.reduce((sum, term) => sum + (text.includes(term) ? 2 : 0), 0);
  if (acceptsFreeformRequest(tool)) score += 4;
  if (/(run|execute|invoke|call|chat|message|ask|query|prompt|request|task)/.test(compact)) score += 2;

  if (/\b(buy|sell|swap|trade|transfer|bridge|stake|unstake|deposit|withdraw|borrow|repay|mint)\b/i.test(task)) {
    if (/(buy|sell|swap|trade|order|execute|transaction|calldata|quote|route)/.test(compact)) {
      score += 4;
    } else {
      score -= 4;
    }
  }

  return score;
}

function acceptsFreeformRequest(tool: McpTool) {
  const schema = normalizeInputSchema(tool.inputSchema);
  const properties = asRecord(schema.properties);
  const propertyNames = Object.keys(properties).map(normalizePropertyName);
  if (propertyNames.length === 0) return schema.additionalProperties !== false;
  return propertyNames.some((key) => ["query", "task", "prompt", "input", "message", "description", "request", "instruction", "instructions"].includes(key));
}

function taskToolScore(capability: string, taskType: string, text: string) {
  if (capability !== "concentrated_liquidity") return 0;
  const task = taskType.toLowerCase();
  const compact = text.replace(/[^a-z0-9]+/g, "");
  if (isV3DiscoveryTask(task) && /getdexinfo|supporteddex|feetier|supportedchains/.test(compact)) return 18;
  if (/pool\s*price|current\s*price/.test(task) && /getcurrentpoolprice|poolprice/.test(compact)) return 20;
  if (/predefined|range/.test(task) && /getpredefinedpriceranges|predefined/.test(compact)) return 20;
  if (/estimate/.test(task) && /estimateamountsforpositioncreation|estimateamounts/.test(compact)) return 20;
  if (/position|liquidity/.test(task) && /createposition/.test(compact)) return 20;
  return 0;
}

function isV3DiscoveryTask(taskType: string) {
  return /dex\s*support|dex\s*info|supported\s*v3|supported\s*dex|fee\s*support/.test(taskType.toLowerCase());
}

function toolArguments(tool: McpTool, agent: BnbAgentProfile, record: BnbAdapterRunInput["record"]) {
  const schema = normalizeInputSchema(tool.inputSchema);
  const properties = asRecord(schema.properties);
  const propertyNames = Object.keys(properties);
  if (propertyNames.length === 0) {
    if (schema.additionalProperties === false) return {};
    return { query: record.limits.task };
  }

  const args: Record<string, unknown> = {};
  for (const key of propertyNames) {
    const value = valueForToolProperty(key, asRecord(properties[key]), agent, record);
    if (value !== undefined && value !== "") {
      args[key] = value;
    }
  }

  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : [];
  const missing = required.filter((key) => args[key] === undefined || args[key] === "");
  if (missing.length > 0) {
    throw new Error(`This job needs ${humanList(missing)}. Add it to the job details, then run again.`);
  }

  if (Object.keys(args).length === 0 && schema.additionalProperties !== false) {
    args.query = record.limits.task;
  }

  return args;
}

function valueForToolProperty(
  key: string,
  property: Record<string, unknown>,
  agent: BnbAgentProfile,
  record: BnbAdapterRunInput["record"],
) {
  const fields = record.jobSpec?.fields || {};
  const lower = normalizePropertyName(key);
  const direct = directSchemaFieldValue(fields, key);

  if (lower === "chainnames" || lower === "chainname" || lower === "chains" || lower === "chain") {
    return coerceToolValue(property, chainNameForSchema(property));
  }
  if (lower === "chainids" || lower === "chainid") {
    return coerceToolValue(property, agent.chainId);
  }
  if (lower === "useraddress" || lower === "walletaddress" || lower === "accountaddress" || lower === "address") {
    const wallet = firstEvmAddress(
      fields.walletAddress,
      fields.walletOrPosition,
      fields.intentTarget,
      fields.position,
      record.clientAddress,
      record.limits.task,
    );
    return wallet ? coerceToolValue(property, wallet) : undefined;
  }
  if (
    lower === "protocol" ||
    lower === "protocols" ||
    lower === "project" ||
    lower === "projects" ||
    lower === "platform" ||
    lower === "platforms" ||
    lower === "market" ||
    lower === "markets" ||
    lower === "lendingproject" ||
    lower === "lendingprotocol"
  ) {
    const protocol = protocolForSchema(property, agent, record, direct);
    return protocol ? coerceToolValue(property, protocol) : undefined;
  }
  if (lower === "pool" || lower === "poolname" || lower === "poolid") {
    const pool = poolForSchema(property, agent, record, direct || fields.poolOrPair);
    return pool ? coerceToolValue(property, pool) : undefined;
  }
  if (direct) return coerceToolValue(property, direct);

  if (lower === "threshold" || lower === "healthfactor" || lower === "healthfactorthreshold") {
    return coerceToolValue(property, fields.threshold || "1.4");
  }
  if (lower === "risk" || lower === "riskpreference" || lower === "risklevel") {
    return coerceToolValue(property, fields.riskPreference || "Balanced");
  }
  if (lower === "pair" || lower === "poolorpair") {
    return coerceToolValue(property, fields.pair || fields.poolOrPair || fields.intentTarget);
  }
  if (lower === "asset" || lower === "token" || lower === "assetorwallet") {
    return coerceToolValue(property, assetForTool(fields));
  }
  if (lower === "amount") {
    return coerceToolValue(property, fields.amount);
  }

  const candidates = ["query", "task", "prompt", "input", "message", "description"];
  if (candidates.includes(lower)) {
    return coerceToolValue(property, record.limits.task);
  }

  return undefined;
}

function assetForTool(fields: Record<string, string>) {
  if (fields.customAsset && !isGenericSelectionValue(fields.customAsset)) return fields.customAsset;
  if (fields.asset && fields.asset !== "Custom token address" && !isGenericSelectionValue(fields.asset)) return fields.asset;
  if (fields.assetOrWallet && !firstEvmAddress(fields.assetOrWallet) && !isGenericSelectionValue(fields.assetOrWallet)) return fields.assetOrWallet;
  if (fields.intentTarget && !firstEvmAddress(fields.intentTarget) && !isGenericSelectionValue(fields.intentTarget)) return fields.intentTarget;
  return "";
}

function humanList(values: string[]) {
  const labels = values.map(humanToolFieldName);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function humanToolFieldName(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\btoken\s*(\d+)\b/gi, "token $1")
    .replace(/\bamount\s*(\d+)\b/gi, "amount $1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

  async preflight(agent: BnbAgentProfile, selected?: BnbExecutionEndpoint): Promise<BnbAdapterPreflightResult> {
    const endpoint = mcpEndpoint(agent, selected);
    if (!endpoint) return { ok: false, adapter: "mcp", reason: "This agent is not available for jobs." };

    try {
      const tools = await listTools(endpoint);
      return {
        ok: true,
        adapter: "mcp",
        endpoint,
        capabilities: tools.map((tool) => tool.name).slice(0, 20),
        capabilityContracts: mcpCapabilityContracts(tools),
      };
    } catch (error) {
      return {
        ok: false,
        adapter: "mcp",
        endpoint,
        reason: error instanceof Error ? error.message : "Agent check failed.",
      };
    }
  },

  async preflightJob({ agent, record, endpoint: selected }: BnbAdapterRunInput): Promise<BnbAdapterPreflightResult> {
    const endpoint = mcpEndpoint(agent, selected);
    if (!endpoint) return { ok: false, adapter: "mcp", reason: "This agent is not available for jobs." };

    try {
      const tools = await listTools(endpoint);
      const tool = chooseTool(tools, agent, record);
      toolArguments(tool, agent, record);
      return {
        ok: true,
        adapter: "mcp",
        endpoint,
        capabilities: [tool.name],
        capabilityContracts: mcpCapabilityContracts([tool]),
      };
    } catch (error) {
      return {
        ok: false,
        adapter: "mcp",
        endpoint,
        reason: error instanceof Error ? error.message : "Job details could not be prepared.",
      };
    }
  },

  async run({ agent, record, endpoint: selected }: BnbAdapterRunInput) {
    const endpoint = mcpEndpoint(agent, selected);
    if (!endpoint) throw new Error("This agent is not available for jobs.");
    const startedAt = new Date().toISOString();
    const tools = await listTools(endpoint);
    const tool = chooseTool(tools, agent, record);
    const { response, payload } = await safeFetchJson(endpoint.url, {
      method: "POST",
      headers: endpointAuthHeaders(endpoint.url),
      body: jsonRpc("tools/call", {
        name: tool.name,
        arguments: toolArguments(tool, agent, record),
      }),
      timeoutMs: 12_000,
      maxBytes: 384 * 1024,
    });
    const protectedReason = protectedMcpReason(response.status, payload);
    if (protectedReason) throw new Error(protectedReason);
    if (!response.ok) throw new Error(`Agent tool call failed with HTTP ${response.status}.`);
    const error = asRecord(payload).error;
    if (error) throw new Error(typeof asRecord(error).message === "string" ? asRecord(error).message as string : "Agent tool call failed.");

    return completedAdapterWork(
      stringifyOutput(payload),
      [`MCP:${endpoint.url}`, `MCP tool:${tool.name}`],
      startedAt,
      `mcp:${agent.chainId}:${agent.tokenId}:${tool.name}`,
      "mcp",
    );
  },
};
