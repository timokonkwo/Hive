import { assertPublicHttpsUrl, safeFetchJson } from "@/lib/bnb/endpoint-security";
import { endpointAuthHeaders } from "@/lib/bnb/endpoint-auth";
import {
  bnbX402PaymentHeaders,
  bnbX402ResponseHeaderName,
  decryptBnbX402PaymentHeader,
  isBnbX402SettlementConfigured,
  isBnbX402SettlementForPayment,
  parseBnbX402Challenge,
  parseBnbX402SettlementHeader,
  selectBnbX402PaymentRequirement,
} from "@/lib/bnb/x402";
import {
  asSchemaRecord as asRecord,
  chainNameForSchema,
  coerceSchemaValue as coerceValue,
  directSchemaFieldValue,
  firstEvmAddress,
  isGenericSelectionValue,
  normalizeEndpointInputSchema as normalizeInputSchema,
  normalizeSchemaPropertyName as normalizePropertyName,
  protocolForSchema,
} from "@/lib/bnb/adapters/schema-arguments";
import type { BnbAgentProfile, BnbEndpointCapabilityContract, BnbExecutionEndpoint } from "@/lib/bnb/types";
import type { BnbAdapterPreflightResult, BnbAdapterRunInput, BnbAgentExecutionAdapter } from "@/lib/bnb/adapters/types";
import { completedAdapterWork } from "@/lib/bnb/adapters/types";

function httpEndpoint(agent: BnbAgentProfile, selected?: BnbExecutionEndpoint) {
  if (selected?.adapter === "http" || selected?.adapter === "x402") return selected;
  return agent.executionEndpoints?.find((endpoint) => endpoint.adapter === "http" || endpoint.adapter === "x402");
}

function httpCapabilityContract(endpoint: BnbExecutionEndpoint, agent: BnbAgentProfile): BnbEndpointCapabilityContract {
  return {
    name: endpoint.label || endpoint.method || "HTTP endpoint",
    kind: "http",
    description: agent.description,
    tags: [agent.category, ...agent.capabilities].slice(0, 30),
    ...(endpoint.inputSchema !== undefined ? { inputSchema: normalizeInputSchema(endpoint.inputSchema) } : {}),
    paymentRequired: Boolean(endpoint.paymentRequired),
  };
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
  const direct = directSchemaFieldValue(fields, key);

  if (["protocol", "protocols", "project", "projects", "platform", "platforms", "market", "markets"].includes(normalizedKey)) {
    const protocol = protocolForSchema(property, agent, record, direct);
    return protocol ? coerceValue(property, protocol) : undefined;
  }
  if (direct && !(["asset", "token", "symbol"].includes(normalizedKey) && isGenericSelectionValue(direct))) {
    return coerceValue(property, direct);
  }
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
    return coerceValue(property, chainNameForSchema(property));
  }
  if (["asset", "token", "symbol"].includes(normalizedKey)) {
    return coerceValue(property, assetForProperty(fields));
  }
  if (["risk", "riskpreference", "risklevel"].includes(normalizedKey)) {
    return coerceValue(property, fields.riskPreference || "Balanced");
  }

  return undefined;
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

function assetForProperty(fields: Record<string, string>) {
  if (fields.customAsset && !isGenericSelectionValue(fields.customAsset)) return fields.customAsset;
  if (fields.asset && fields.asset !== "Custom token address" && !isGenericSelectionValue(fields.asset)) return fields.asset;
  if (fields.intentTarget && !firstEvmAddress(fields.intentTarget) && !isGenericSelectionValue(fields.intentTarget)) return fields.intentTarget;
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
    return "This agent is not available for jobs.";
  }
  return "";
}

function endpointUsesX402Payment(endpoint: BnbExecutionEndpoint) {
  return endpoint.adapter === "x402" && endpoint.paymentRequired;
}

async function x402PaymentPreflight(
  endpoint: BnbExecutionEndpoint,
  agent: BnbAgentProfile,
  args: Record<string, unknown>,
): Promise<BnbAdapterPreflightResult | null> {
  if (!endpointUsesX402Payment(endpoint)) return null;
  if (!isBnbX402SettlementConfigured()) {
    return {
      ok: false,
      adapter: "x402",
      endpoint,
      reason: "Payment is not configured.",
      capabilities: [endpoint.label],
      capabilityContracts: [httpCapabilityContract(endpoint, agent)],
    };
  }

  const method = endpoint.method || "GET";
  const targetUrl = requestUrl(endpoint, args);
  const { response, payload } = await safeFetchJson(targetUrl, {
    method,
    headers: endpointAuthHeaders(endpoint.url),
    ...(method === "POST" ? { body: JSON.stringify(args) } : {}),
    timeoutMs: 12_000,
    maxBytes: 384 * 1024,
  });

  if (response.status !== 402) {
    return {
      ok: false,
      adapter: "x402",
      endpoint,
      reason: "Payment is not available.",
      capabilities: [endpoint.label],
      capabilityContracts: [httpCapabilityContract(endpoint, agent)],
    };
  }

  const challenge = parseBnbX402Challenge(response.headers, payload);
  const selectedRequirement = challenge ? selectBnbX402PaymentRequirement(challenge.accepts) : undefined;
  const resourceUrl = selectedRequirement?.resource || challenge?.resource?.url || "";
  if (
    !challenge
    || challenge.x402Version < 2
    || !selectedRequirement
    || !resourceUrl
    || !sameX402Resource(resourceUrl, response.url || targetUrl)
  ) {
    return {
      ok: false,
      adapter: "x402",
      endpoint,
      reason: "Payment is not available.",
      capabilities: [endpoint.label],
      capabilityContracts: [httpCapabilityContract(endpoint, agent)],
    };
  }

  return {
    ok: true,
    adapter: "x402",
    endpoint,
    capabilities: [endpoint.label],
    capabilityContracts: [httpCapabilityContract(endpoint, agent)],
    payment: {
      x402Version: challenge.x402Version,
      ...(challenge.resource ? { resource: challenge.resource } : {}),
      paymentRequirements: challenge.accepts,
      selectedRequirement,
      ...(challenge.extensions ? { extensions: challenge.extensions } : {}),
      status: "pending",
    },
  };
}

export const httpAdapter: BnbAgentExecutionAdapter = {
  id: "http",

  canHandle(agent: BnbAgentProfile) {
    return Boolean(httpEndpoint(agent));
  },

  async preflight(agent: BnbAgentProfile, selected?: BnbExecutionEndpoint): Promise<BnbAdapterPreflightResult> {
    const endpoint = httpEndpoint(agent, selected);
    if (!endpoint) return { ok: false, adapter: "http", reason: "This agent is not available for jobs." };
    if (endpoint.paymentRequired) {
      if (!endpointUsesX402Payment(endpoint)) {
        return {
          ok: false,
          adapter: "http",
          endpoint,
          reason: "Payment is not available.",
          capabilities: [endpoint.label],
          capabilityContracts: [httpCapabilityContract(endpoint, agent)],
        };
      }
      if (!isBnbX402SettlementConfigured()) {
        return {
          ok: false,
          adapter: "x402",
          endpoint,
          reason: "Payment is not configured.",
          capabilities: [endpoint.label],
          capabilityContracts: [httpCapabilityContract(endpoint, agent)],
        };
      }
    }

    try {
      await assertPublicHttpsUrl(endpoint.url);
      const paymentPreflight = await x402PaymentPreflight(endpoint, agent, {});
      if (paymentPreflight) return paymentPreflight;
      return {
        ok: true,
        adapter: endpoint.adapter === "x402" ? "x402" : "http",
        endpoint,
        capabilities: [endpoint.label],
        capabilityContracts: [httpCapabilityContract(endpoint, agent)],
      };
    } catch (error) {
      return {
        ok: false,
        adapter: endpoint.adapter === "x402" ? "x402" : "http",
        endpoint,
        reason: error instanceof Error ? error.message : "Endpoint preflight failed.",
        capabilities: [endpoint.label],
        capabilityContracts: [httpCapabilityContract(endpoint, agent)],
      };
    }
  },

  async preflightJob({ agent, record, endpoint: selected }: BnbAdapterRunInput): Promise<BnbAdapterPreflightResult> {
    const endpoint = httpEndpoint(agent, selected);
    if (!endpoint) return { ok: false, adapter: "http", reason: "This agent is not available for jobs." };

    try {
      await assertPublicHttpsUrl(endpoint.url);
      const args = httpArguments(endpoint, agent, record);
      const paymentPreflight = await x402PaymentPreflight(endpoint, agent, args);
      if (paymentPreflight) return paymentPreflight;
      if (endpoint.paymentRequired) {
        return {
          ok: false,
          adapter: endpoint.adapter === "x402" ? "x402" : "http",
          endpoint,
          reason: "Payment is not available.",
          capabilities: [endpoint.label],
          capabilityContracts: [httpCapabilityContract(endpoint, agent)],
        };
      }
      return {
        ok: true,
        adapter: endpoint.adapter === "x402" ? "x402" : "http",
        endpoint,
        capabilities: [endpoint.label],
        capabilityContracts: [httpCapabilityContract(endpoint, agent)],
      };
    } catch (error) {
      return {
        ok: false,
        adapter: endpoint.adapter === "x402" ? "x402" : "http",
        endpoint,
        reason: error instanceof Error ? error.message : "Endpoint job arguments could not be prepared.",
        capabilities: [endpoint.label],
        capabilityContracts: [httpCapabilityContract(endpoint, agent)],
      };
    }
  },

  async run({ agent, record, endpoint: selected }: BnbAdapterRunInput) {
    const endpoint = httpEndpoint(agent, selected);
    if (!endpoint) throw new Error("This agent is not available for jobs.");

    const startedAt = new Date().toISOString();
    const args = httpArguments(endpoint, agent, record);
    const method = endpoint.method || "GET";
    const paymentHeader = endpointUsesX402Payment(endpoint)
      ? decryptBnbX402PaymentHeader(record.payment?.x402?.paymentHeader)
      : "";
    if (endpointUsesX402Payment(endpoint) && !paymentHeader) throw new Error("Payment is required before this job can run.");

    const { response, payload } = await safeFetchJson(requestUrl(endpoint, args), {
      method,
      headers: {
        ...endpointAuthHeaders(endpoint.url),
        ...(paymentHeader ? bnbX402PaymentHeaders(paymentHeader, record.payment?.x402?.x402Version || 2) : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(args) } : {}),
      timeoutMs: 12_000,
      maxBytes: 384 * 1024,
    });
    const parsedSettlement = parseBnbX402SettlementHeader(response.headers.get(bnbX402ResponseHeaderName(record.payment?.x402?.x402Version || 2)));
    const settlement = isBnbX402SettlementForPayment(
      parsedSettlement,
      record.payment?.x402?.selectedRequirement,
      record.payment?.x402?.payer,
    ) ? parsedSettlement : null;
    if (response.status === 402) throw new Error("Payment is required before this job can run.");
    const protectedReason = protectedHttpReason(response.status, payload);
    if (protectedReason) {
      if (!settlement?.success) throw new Error(protectedReason);
      return failedSettledHttpWork(agent, endpoint, startedAt, protectedReason, settlement);
    }
    if (!response.ok) {
      const reason = `Agent request failed with HTTP ${response.status}.`;
      if (!settlement?.success) throw new Error(reason);
      return failedSettledHttpWork(agent, endpoint, startedAt, reason, settlement);
    }

    const work = completedAdapterWork(
      stringifyOutput(payload),
      [`${endpoint.label}:${endpoint.url}`],
      startedAt,
      `http:${agent.chainId}:${agent.tokenId}`,
      endpoint.adapter,
    );
    if (settlement?.success) {
      work.paymentSettlement = x402Settlement(settlement);
    } else if (endpointUsesX402Payment(endpoint)) {
      work.paymentSettlement = {
        mode: "x402",
        status: "unconfirmed",
        settledAt: new Date().toISOString(),
        network: record.payment?.x402?.selectedRequirement.network,
        payer: record.payment?.x402?.payer,
      };
    }
    return work;
  },
};

function failedSettledHttpWork(
  agent: BnbAgentProfile,
  endpoint: BnbExecutionEndpoint,
  startedAt: string,
  error: string,
  settlement: NonNullable<ReturnType<typeof parseBnbX402SettlementHeader>>,
) {
  return {
    status: "failed" as const,
    startedAt,
    completedAt: new Date().toISOString(),
    error,
    dataSources: [`${endpoint.label}:${endpoint.url}`],
    adapter: endpoint.adapter,
    runId: `http:${agent.chainId}:${agent.tokenId}`,
    paymentSettlement: x402Settlement(settlement),
  };
}

function x402Settlement(settlement: NonNullable<ReturnType<typeof parseBnbX402SettlementHeader>>) {
  return {
    mode: "x402" as const,
    status: "settled" as const,
    settledAt: new Date().toISOString(),
    ...(settlement.transaction ? { transaction: settlement.transaction } : {}),
    ...(settlement.network ? { network: settlement.network } : {}),
    ...(settlement.payer ? { payer: settlement.payer } : {}),
  };
}

function sameX402Resource(challengeUrl: string, responseUrl: string) {
  try {
    const challenge = new URL(challengeUrl);
    const response = new URL(responseUrl);
    challenge.hash = "";
    response.hash = "";
    return challenge.protocol === "https:" && challenge.href === response.href;
  } catch {
    return false;
  }
}
