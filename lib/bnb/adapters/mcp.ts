import { endpointAuthHeaders } from "@/lib/bnb/endpoint-auth";
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

function parseRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return asRecord(value);
}

function normalizeInputSchema(value: unknown): Record<string, unknown> {
  const schema = parseRecord(value);
  if (schema.properties || schema.type === "object") return schema;

  for (const key of ["inputSchema", "input_schema", "parameters", "schema", "jsonSchema", "json_schema"]) {
    const nested = parseRecord(schema[key]);
    if (nested.properties || nested.type === "object") return nested;
  }

  return schema;
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
  if (!response.ok) throw new Error(`Agent tools could not be loaded with HTTP ${response.status}.`);
  const tools = parseTools(payload);
  if (tools.length === 0) throw new Error("This agent did not return callable tools.");
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
    return "This agent cannot be run from Hive.";
  }
  return "";
}

function chooseTool(tools: McpTool[], agent: BnbAgentProfile, record: BnbAdapterRunInput["record"]) {
  const capability = record.jobSpec?.capability || "custom";
  const taskType = record.jobSpec?.taskType || record.limits.task;
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
        argsError = error instanceof Error ? error.message : "This tool needs more job details.";
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
    return `This agent exposes a directory tool, not a ${capabilityLabel(capability)} tool.`;
  }
  if (isDocumentationTool(tool, text)) {
    return `This agent exposes documentation, not a ${capabilityLabel(capability)} tool.`;
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
      return "This agent does not expose a health-factor tool for this job.";
    }
  }

  if (capability === "concentrated_liquidity") {
    if (!isV3DiscoveryTask(taskType) && /getdexinfo|listdex|supportedfees|supportedpools/.test(compact) && !/(create|position|range|liquidity|tick)/.test(compact)) {
      return "This agent exposes discovery data, not a liquidity-position tool.";
    }
  }

  return "";
}

function customToolBlocker(tool: McpTool, text: string) {
  if (isDirectoryTool(tool, text)) return "This agent cannot run this job. Choose another agent.";
  if (isDocumentationTool(tool, text)) return "This agent cannot run this job. Choose another agent.";
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
  const directKey = Object.keys(fields).find((fieldKey) => normalizePropertyName(fieldKey) === lower);
  const direct = fields[key] || fields[lower] || (directKey ? fields[directKey] : "");

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
    return coerceToolValue(property, protocolForSchema(property, direct || fields.protocol || inferProtocol(record.limits.task)));
  }
  if (lower === "pool" || lower === "poolname" || lower === "poolid") {
    return coerceToolValue(property, poolForSchema(property, direct || fields.poolOrPair || "", fields.protocol || inferProtocol(record.limits.task)));
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

function coerceToolValue(property: Record<string, unknown>, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (schemaTypeIncludes(property, "array")) {
    const values = Array.isArray(value) ? value : [value];
    const enumValues = enumValuesForSchema(property);
    const coerced = values
      .map((item) => enumValues.length > 0 ? enumValueForSchema(property, [String(item)]) : item)
      .filter((item) => item !== undefined && item !== null && item !== "");
    return coerced.length > 0 ? coerced : undefined;
  }
  if (schemaTypeIncludes(property, "integer")) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (schemaTypeIncludes(property, "number")) {
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (schemaTypeIncludes(property, "boolean")) {
    if (typeof value === "boolean") return value;
    if (/^(true|yes|1)$/i.test(String(value))) return true;
    if (/^(false|no|0)$/i.test(String(value))) return false;
    return undefined;
  }
  if (enumValuesForSchema(property).length > 0) {
    return enumValueForSchema(property, [String(value)]) || undefined;
  }
  return String(value);
}

function schemaTypeIncludes(property: Record<string, unknown>, expected: string): boolean {
  const type = property.type;
  if (type === expected) return true;
  if (Array.isArray(type) && type.includes(expected)) return true;
  return schemaVariants(property).some((variant) => schemaTypeIncludes(variant, expected));
}

function chainNameForSchema(property: Record<string, unknown>): string {
  const itemSchema = asRecord(property.items);
  const enumValues = [
    ...(Array.isArray(property.enum) ? property.enum : []),
    ...(Array.isArray(itemSchema.enum) ? itemSchema.enum : []),
    ...schemaVariants(property).flatMap((variant) => {
      const variantItems = asRecord(variant.items);
      return [
        ...(Array.isArray(variant.enum) ? variant.enum : []),
        ...(Array.isArray(variantItems.enum) ? variantItems.enum : []),
      ];
    }),
  ].filter((item): item is string => typeof item === "string");
  const preferred = ["BSC", "BNB Smart Chain", "BNB Chain", "bsc", "bnb"];
  return preferred.find((candidate) => enumValues.includes(candidate)) || enumValues[0] || "BSC";
}

function schemaVariants(property: Record<string, unknown>): Record<string, unknown>[] {
  return ["anyOf", "oneOf", "allOf"]
    .flatMap((key) => Array.isArray(property[key]) ? property[key] as unknown[] : [])
    .map(parseRecord);
}

function normalizePropertyName(value: string) {
  return value.replace(/[_\-\s]+/g, "").toLowerCase();
}

function firstEvmAddress(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const match = value.match(/0x[a-fA-F0-9]{40}/);
    if (match) return match[0];
  }
  return "";
}

function assetForTool(fields: Record<string, string>) {
  if (fields.customAsset) return fields.customAsset;
  if (fields.asset && fields.asset !== "Custom token address") return fields.asset;
  if (fields.assetOrWallet && !firstEvmAddress(fields.assetOrWallet)) return fields.assetOrWallet;
  if (fields.intentTarget && !firstEvmAddress(fields.intentTarget)) return fields.intentTarget;
  return "";
}

function inferProtocol(task: string) {
  if (/\bvenus\b/i.test(task)) return "Venus";
  if (/\blista\b/i.test(task)) return "Lista";
  return "Venus";
}

function protocolForSchema(property: Record<string, unknown>, protocol: string) {
  const aliases = protocolAliases(protocol);
  return enumValueForSchema(property, aliases) || aliases[0];
}

function poolForSchema(property: Record<string, unknown>, requestedPool: string, protocol: string) {
  const requestedMatch = enumValueForSchema(property, poolAliases(requestedPool));
  if (requestedMatch) return requestedMatch;

  const protocolMatch = enumValueForSchema(property, poolAliases(protocol));
  if (protocolMatch) return protocolMatch;

  return enumValueForSchema(property, poolAliases("core")) || firstEnumValueForSchema(property) || requestedPool;
}

function protocolAliases(protocol: string) {
  const normalized = protocol.trim().toLowerCase();
  if (normalized.includes("lista")) return ["lista", "Lista", "LISTA"];
  if (normalized.includes("venus")) return ["venus", "Venus", "VENUS"];
  return ["venus", "Venus", "VENUS"];
}

function poolAliases(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("liquid") || normalized.includes("lst") || normalized.includes("staked")) {
    return [
      value,
      "Liquid Staked BNB",
      "Liquid Staked BNB Pool",
      "Liquid Staking",
      "LST",
      "lst",
    ];
  }
  if (normalized.includes("stable")) {
    return [
      value,
      "Stablecoins",
      "Stablecoin",
      "Stablecoin Pool",
      "Stable",
      "stable",
    ];
  }
  if (normalized.includes("core") || normalized.includes("venus") || normalized.includes("all") || !normalized) {
    return [
      value,
      "Core",
      "Core Pool",
      "core",
      "core pool",
      "Main",
      "Main Pool",
      "main",
      "main pool",
      "Venus",
      "venus",
    ];
  }
  return [value];
}

function enumValuesForSchema(property: Record<string, unknown>) {
  const itemSchema = asRecord(property.items);
  return [
    ...(Array.isArray(property.enum) ? property.enum : []),
    ...(Array.isArray(itemSchema.enum) ? itemSchema.enum : []),
    ...schemaVariants(property).flatMap((variant) => {
      const variantItems = asRecord(variant.items);
      return [
        ...(Array.isArray(variant.enum) ? variant.enum : []),
        ...(Array.isArray(variantItems.enum) ? variantItems.enum : []),
      ];
    }),
  ].filter((item): item is string => typeof item === "string");
}

function enumValueForSchema(property: Record<string, unknown>, candidates: string[]) {
  const enumValues = enumValuesForSchema(property);
  if (enumValues.length === 0) return "";
  const lowerCandidates = candidates.map((candidate) => candidate.toLowerCase());
  return enumValues.find((value) => lowerCandidates.includes(value.toLowerCase())) || "";
}

function firstEnumValueForSchema(property: Record<string, unknown>) {
  return enumValuesForSchema(property)[0] || "";
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

  async preflight(agent: BnbAgentProfile): Promise<BnbAdapterPreflightResult> {
    const endpoint = mcpEndpoint(agent);
    if (!endpoint) return { ok: false, adapter: "mcp", reason: "No supported execution endpoint is listed for this agent." };

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

  async preflightJob({ agent, record }: BnbAdapterRunInput): Promise<BnbAdapterPreflightResult> {
    const endpoint = mcpEndpoint(agent);
    if (!endpoint) return { ok: false, adapter: "mcp", reason: "No supported execution endpoint is listed for this agent." };

    try {
      const tools = await listTools(endpoint);
      const tool = chooseTool(tools, agent, record);
      toolArguments(tool, agent, record);
      return {
        ok: true,
        adapter: "mcp",
        endpoint,
        capabilities: [tool.name],
      };
    } catch (error) {
      return {
        ok: false,
        adapter: "mcp",
        endpoint,
        reason: error instanceof Error ? error.message : "MCP job arguments could not be prepared.",
      };
    }
  },

  async run({ agent, record }: BnbAdapterRunInput) {
    const endpoint = mcpEndpoint(agent);
    if (!endpoint) throw new Error("No supported execution endpoint is listed for this agent.");
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
