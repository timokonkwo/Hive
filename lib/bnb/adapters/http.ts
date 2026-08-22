import { assertPublicHttpsUrl, safeFetchJson } from "@/lib/bnb/endpoint-security";
import { endpointAuthHeaders } from "@/lib/bnb/endpoint-auth";
import type { BnbAgentProfile, BnbExecutionEndpoint } from "@/lib/bnb/types";
import type { BnbAdapterPreflightResult, BnbAdapterRunInput, BnbAgentExecutionAdapter } from "@/lib/bnb/adapters/types";
import { completedAdapterWork } from "@/lib/bnb/adapters/types";

function httpEndpoint(agent: BnbAgentProfile) {
  return agent.executionEndpoints?.find((endpoint) => endpoint.adapter === "http" || endpoint.adapter === "x402");
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

function httpArguments(endpoint: BnbExecutionEndpoint, agent: BnbAgentProfile, record: BnbAdapterRunInput["record"]) {
  const schema = normalizeInputSchema(endpoint.inputSchema);
  const properties = asRecord(schema.properties);
  const propertyNames = Object.keys(properties);
  const fields = record.jobSpec?.fields || {};

  if (propertyNames.length === 0) {
    return compactObject({
      query: record.limits.task,
      task: record.jobSpec?.summary || record.limits.task,
      expectedOutput: record.jobSpec?.expectedOutput,
      walletAddress: fields.walletAddress || fields.walletOrPosition || record.clientAddress,
      chainId: agent.chainId,
      ...fields,
    });
  }

  const args: Record<string, unknown> = {};
  for (const key of propertyNames) {
    const value = valueForProperty(key, asRecord(properties[key]), agent, record);
    if (value !== undefined && value !== "") args[key] = value;
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

function valueForProperty(
  key: string,
  property: Record<string, unknown>,
  agent: BnbAgentProfile,
  record: BnbAdapterRunInput["record"],
) {
  const fields = record.jobSpec?.fields || {};
  const normalizedKey = normalizePropertyName(key);
  const directKey = Object.keys(fields).find((fieldKey) => normalizePropertyName(fieldKey) === normalizedKey);
  const direct = fields[key] || fields[normalizedKey] || (directKey ? fields[directKey] : "");

  if (direct) return coerceValue(property, direct);
  if (["query", "task", "prompt", "input", "message", "description"].includes(normalizedKey)) {
    return coerceValue(property, record.limits.task);
  }
  if (["summary", "outcome", "expectedoutput"].includes(normalizedKey)) {
    return coerceValue(property, record.jobSpec?.expectedOutput || record.jobSpec?.summary || record.limits.task);
  }
  if (["walletaddress", "useraddress", "accountaddress", "address"].includes(normalizedKey)) {
    return coerceValue(property, firstEvmAddress(fields.walletAddress, fields.walletOrPosition, fields.intentTarget, record.clientAddress, record.limits.task));
  }
  if (["chainid", "chainids"].includes(normalizedKey)) {
    return coerceValue(property, agent.chainId);
  }
  if (["chain", "chains", "chainname", "chainnames", "network", "networks"].includes(normalizedKey)) {
    return coerceValue(property, "BSC");
  }
  if (["asset", "token", "symbol"].includes(normalizedKey)) {
    return coerceValue(property, fields.customAsset || fields.asset || fields.intentTarget);
  }
  if (["protocol", "protocols", "project", "projects"].includes(normalizedKey)) {
    return coerceValue(property, fields.protocol || inferProtocol(record.limits.task));
  }
  if (["risk", "riskpreference", "risklevel"].includes(normalizedKey)) {
    return coerceValue(property, fields.riskPreference || "Balanced");
  }

  return undefined;
}

function coerceValue(property: Record<string, unknown>, value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (schemaTypeIncludes(property, "array")) return Array.isArray(value) ? value : [value];
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
  return String(value);
}

function schemaTypeIncludes(property: Record<string, unknown>, expected: string): boolean {
  const type = property.type;
  if (type === expected) return true;
  if (Array.isArray(type) && type.includes(expected)) return true;
  return ["anyOf", "oneOf", "allOf"]
    .flatMap((key) => Array.isArray(property[key]) ? property[key] as unknown[] : [])
    .map(parseRecord)
    .some((variant) => schemaTypeIncludes(variant, expected));
}

function requestUrl(endpoint: BnbExecutionEndpoint, args: Record<string, unknown>) {
  if ((endpoint.method || "GET") !== "GET") return endpoint.url;

  const url = new URL(endpoint.url);
  Object.entries(args).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
    } else if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.href;
}

function compactObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (item === undefined || item === null || item === "") return false;
    if (Array.isArray(item)) return item.length > 0;
    return true;
  }));
}

function firstEvmAddress(...values: Array<string | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const match = value.match(/0x[a-fA-F0-9]{40}/);
    if (match) return match[0];
  }
  return "";
}

function normalizePropertyName(value: string) {
  return value.replace(/[_\-\s]+/g, "").toLowerCase();
}

function inferProtocol(task: string) {
  if (/\bvenus\b/i.test(task)) return "Venus";
  if (/\blista\b/i.test(task)) return "Lista";
  if (/\bpancake|pancakeswap\b/i.test(task)) return "PancakeSwap";
  return "";
}

function humanList(values: string[]) {
  const labels = values.map((value) => value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase());
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

function stringifyOutput(payload: unknown) {
  if (typeof payload === "string") return payload;
  return JSON.stringify(payload, null, 2);
}

function payloadText(payload: unknown) {
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return "";
  }
}

function protectedHttpReason(status: number, payload: unknown) {
  const text = payloadText(payload).toLowerCase();
  if (status === 401 || /unauthorized|authentication required|access-token|api key|token required/.test(text)) {
    return "This agent requires external sign-in.";
  }
  if (status === 403 || /forbidden|csrf|sec-fetch/.test(text)) {
    return "This agent cannot be run from Hive.";
  }
  return "";
}

export const httpAdapter: BnbAgentExecutionAdapter = {
  id: "http",

  canHandle(agent: BnbAgentProfile) {
    return Boolean(httpEndpoint(agent));
  },

  async preflight(agent: BnbAgentProfile): Promise<BnbAdapterPreflightResult> {
    const endpoint = httpEndpoint(agent);
    if (!endpoint) return { ok: false, adapter: "http", reason: "No supported execution endpoint is listed for this agent." };
    if (endpoint.paymentRequired) {
      return { ok: false, adapter: endpoint.adapter === "x402" ? "x402" : "http", endpoint, reason: "This endpoint requires x402 payment support before it can run." };
    }

    try {
      await assertPublicHttpsUrl(endpoint.url);
      return {
        ok: true,
        adapter: endpoint.adapter === "x402" ? "x402" : "http",
        endpoint,
        capabilities: [endpoint.label],
      };
    } catch (error) {
      return {
        ok: false,
        adapter: endpoint.adapter === "x402" ? "x402" : "http",
        endpoint,
        reason: error instanceof Error ? error.message : "Endpoint preflight failed.",
      };
    }
  },

  async preflightJob({ agent, record }: BnbAdapterRunInput): Promise<BnbAdapterPreflightResult> {
    const endpoint = httpEndpoint(agent);
    if (!endpoint) return { ok: false, adapter: "http", reason: "No supported execution endpoint is listed for this agent." };
    if (endpoint.paymentRequired) {
      return { ok: false, adapter: endpoint.adapter === "x402" ? "x402" : "http", endpoint, reason: "This endpoint requires x402 payment support before it can run." };
    }

    try {
      await assertPublicHttpsUrl(endpoint.url);
      httpArguments(endpoint, agent, record);
      return {
        ok: true,
        adapter: endpoint.adapter === "x402" ? "x402" : "http",
        endpoint,
        capabilities: [endpoint.label],
      };
    } catch (error) {
      return {
        ok: false,
        adapter: endpoint.adapter === "x402" ? "x402" : "http",
        endpoint,
        reason: error instanceof Error ? error.message : "Endpoint job arguments could not be prepared.",
      };
    }
  },

  async run({ agent, record }: BnbAdapterRunInput) {
    const endpoint = httpEndpoint(agent);
    if (!endpoint) throw new Error("No supported execution endpoint is listed for this agent.");
    if (endpoint.paymentRequired) throw new Error("This endpoint requires x402 payment support before it can run.");

    const startedAt = new Date().toISOString();
    const args = httpArguments(endpoint, agent, record);
    const method = endpoint.method || "GET";
    const { response, payload } = await safeFetchJson(requestUrl(endpoint, args), {
      method,
      headers: endpointAuthHeaders(endpoint.url),
      ...(method === "POST" ? { body: JSON.stringify(args) } : {}),
      timeoutMs: 12_000,
      maxBytes: 384 * 1024,
    });
    if (response.status === 402) throw new Error("This endpoint requires x402 payment support before it can run.");
    const protectedReason = protectedHttpReason(response.status, payload);
    if (protectedReason) throw new Error(protectedReason);
    if (!response.ok) throw new Error(`Agent endpoint failed with HTTP ${response.status}.`);

    return completedAdapterWork(
      stringifyOutput(payload),
      [`${endpoint.label}:${endpoint.url}`],
      startedAt,
      `http:${agent.chainId}:${agent.tokenId}`,
      endpoint.adapter,
    );
  },
};
