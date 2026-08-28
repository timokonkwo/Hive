import { endpointAuthHeaders, hasEndpointAuthHeaders } from "@/lib/bnb/endpoint-auth";
import { safeFetchJson, validatePublicHttpsUrl } from "@/lib/bnb/endpoint-security";
import { normalizedEndpointCapabilityName } from "@/lib/bnb/capability-contracts";
import type { BnbAgentProfile, BnbEndpointCapabilityContract, BnbExecutionEndpoint } from "@/lib/bnb/types";
import type { BnbAgentExecutionAdapter, BnbAdapterPreflightResult, BnbAdapterRunInput } from "@/lib/bnb/adapters/types";
import { completedAdapterWork } from "@/lib/bnb/adapters/types";

type A2aCard = {
  name?: string;
  description?: string;
  url?: string;
  skills?: Array<{ id?: string; name?: string; description?: string; tags?: string[] }>;
  security?: Array<Record<string, unknown>>;
  securitySchemes?: Record<string, unknown>;
  authentication?: unknown;
  supportsAuthenticatedExtendedCard?: boolean;
  capabilities?: {
    streaming?: boolean;
  };
  registrations?: Array<{ agentRegistry?: string }>;
};

const A2A_PREFLIGHT_METHOD = "hive/preflight";

function a2aEndpoint(agent: BnbAgentProfile, selected?: BnbExecutionEndpoint) {
  if (selected?.adapter === "a2a") return selected;
  return agent.executionEndpoints?.find((endpoint) => endpoint.adapter === "a2a");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function parseCard(payload: unknown): A2aCard {
  const record = asRecord(payload);
  const skills = Array.isArray(record.skills)
    ? record.skills.map((skill) => asRecord(skill)).map((skill) => ({
      id: typeof skill.id === "string" ? skill.id : undefined,
      name: typeof skill.name === "string" ? skill.name : undefined,
      description: typeof skill.description === "string" ? skill.description : undefined,
      tags: Array.isArray(skill.tags) ? skill.tags.filter((tag): tag is string => typeof tag === "string") : [],
    }))
    : [];
  return {
    name: typeof record.name === "string" ? record.name : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    url: typeof record.url === "string" ? record.url : undefined,
    skills,
    security: Array.isArray(record.security) ? record.security.map(asRecord) : [],
    securitySchemes: asRecord(record.securitySchemes ?? record.security_schemes),
    authentication: record.authentication,
    supportsAuthenticatedExtendedCard: record.supportsAuthenticatedExtendedCard === true,
    capabilities: asRecord(record.capabilities) as A2aCard["capabilities"],
    registrations: Array.isArray(record.registrations)
      ? record.registrations.map(asRecord).map((registration) => ({
        agentRegistry: typeof registration.agentRegistry === "string" ? registration.agentRegistry : undefined,
      }))
      : [],
  };
}

function a2aCapabilityContracts(skills: NonNullable<A2aCard["skills"]>): BnbEndpointCapabilityContract[] {
  return skills
    .map((skill) => ({
      name: skill.name || skill.id || "",
      kind: "skill" as const,
      ...(skill.description ? { description: skill.description } : {}),
      ...(skill.tags && skill.tags.length > 0 ? { tags: skill.tags } : {}),
    }))
    .filter((skill) => skill.name);
}

async function fetchCard(endpoint: BnbExecutionEndpoint) {
  const { response, payload } = await safeFetchJson(endpoint.url, {
    method: "GET",
    headers: endpointAuthHeaders(endpoint.url),
    timeoutMs: 7_000,
    maxBytes: 192 * 1024,
  });
  if (!response.ok) throw new Error(`Agent details could not be loaded with HTTP ${response.status}.`);
  const card = parseCard(payload);
  const serviceUrl = card.url || endpoint.url;
  const checked = validatePublicHttpsUrl(serviceUrl);
  if (!checked.ok) throw new Error(checked.reason);
  return { card, serviceUrl: checked.url.toString() };
}

function cardRequiresAuth(card: A2aCard, serviceUrl: string) {
  if (hasEndpointAuthHeaders(serviceUrl)) return false;
  if (card.security && card.security.length > 0) return true;
  if (card.authentication && !isEmptyA2aPayload(card.authentication)) return true;
  return false;
}

function payloadText(payload: unknown) {
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return "";
  }
}

function protectedA2aReason(status: number, payload: unknown) {
  const text = payloadText(payload).toLowerCase();
  if (status === 401 || /unauthorized|authentication required|access-token|no-access-token|session/.test(text)) {
    return "This agent requires external sign-in.";
  }
  if (status === 403 || /forbidden|csrf|sec-fetch/.test(text)) {
    return "This agent is not available for jobs.";
  }
  return "";
}

function isJsonRpcProbeResponse(status: number, payload: unknown) {
  const record = asRecord(payload);
  if (record.jsonrpc !== "2.0") return false;
  if (status >= 200 && status < 300) return "result" in record || "error" in record;
  if (status !== 400 && status !== 422) return false;

  const error = asRecord(record.error);
  const message = payloadText(error.message || record.message || payload).toLowerCase();
  return /method|unknown|not found|invalid|jsonrpc|params/.test(message);
}

function assertA2aCardChain(card: A2aCard, chainId: number) {
  const declaredChains = (card.registrations || [])
    .map((registration) => registration.agentRegistry?.match(/^eip155:(\d+):/i)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .filter(Number.isSafeInteger);
  if (declaredChains.length > 0 && !declaredChains.includes(chainId)) {
    throw new Error("This agent is not available on the selected BNB network.");
  }
}

async function assertPublicA2aService(serviceUrl: string, card: A2aCard, chainId: number) {
  assertA2aCardChain(card, chainId);
  if (cardRequiresAuth(card, serviceUrl)) throw new Error("This agent requires external sign-in.");

  const { response, payload } = await safeFetchJson(serviceUrl, {
    method: "POST",
    headers: endpointAuthHeaders(serviceUrl),
    body: jsonRpc(A2A_PREFLIGHT_METHOD, {}),
    timeoutMs: 7_000,
    maxBytes: 64 * 1024,
  });
  const protectedReason = protectedA2aReason(response.status, payload);
  if (protectedReason) throw new Error(protectedReason);
  if (!isJsonRpcProbeResponse(response.status, payload)) {
    throw new Error("This agent is not available for jobs.");
  }
}

function jsonRpc(method: string, params: unknown) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: `hive-${Date.now()}`,
    method,
    params,
  });
}

function messageParams(task: string) {
  return {
    message: {
      role: "user",
      messageId: `hive-${Date.now()}`,
      parts: [{ kind: "text", text: task }],
    },
  };
}

function stringifyA2aOutput(payload: unknown) {
  const payloadRecord = asRecord(payload);
  const resultValue = "result" in payloadRecord ? payloadRecord.result : payload;
  if (typeof resultValue === "string" && resultValue.trim()) return resultValue.trim();

  const result = asRecord(resultValue);
  const status = asRecord(result.status);
  const text = [
    messageText(status.message),
    messageText(result.message),
    partsText(result.parts),
    artifactsText(result.artifacts),
    typeof result.text === "string" ? result.text : "",
    typeof result.output === "string" ? result.output : "",
    typeof result.response === "string" ? result.response : "",
    typeof result.answer === "string" ? result.answer : "",
  ].map((item) => item.trim()).filter(Boolean).join("\n\n");

  if (text) return text;
  if (isA2aTransportOnlyPayload(resultValue) || isEmptyA2aPayload(result)) throw new Error("This agent returned no result.");
  return JSON.stringify(resultValue, null, 2);
}

function messageText(value: unknown) {
  const message = asRecord(value);
  return partsText(message.parts);
}

function artifactsText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((artifact) => {
      const record = asRecord(artifact);
      return [
        typeof record.text === "string" ? record.text : "",
        partsText(record.parts),
      ].filter(Boolean).join("\n\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function partsText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      const record = asRecord(part);
      return typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function isA2aTransportOnlyPayload(value: unknown) {
  if (typeof value === "string") return isTransportStatusText(value);
  if (Array.isArray(value) || typeof value !== "object" || value === null) return false;

  const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => !isEmptyA2aPayload(item));
  if (entries.length === 0) return true;

  const transportKeys = new Set(["id", "jsonrpc", "kind", "metadata", "messageid", "contextid", "taskid", "status", "state"]);
  const textEntries = entries.filter(([key]) => ["message", "detail", "description"].includes(key.toLowerCase()));
  const nonTransportKeys = entries.filter(([key]) => !transportKeys.has(key.toLowerCase()) && !textEntries.some(([textKey]) => textKey === key));
  if (nonTransportKeys.length > 0) return false;

  const texts = [
    ...textEntries.map(([, item]) => typeof item === "string" ? item : ""),
    ...entries.filter(([key]) => ["status", "state"].includes(key.toLowerCase())).map(([, item]) => transportStatusText(item)),
  ].map((item) => item.trim()).filter(Boolean);

  return texts.length === 0 || texts.every(isTransportStatusText);
}

function transportStatusText(value: unknown): string {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return [
    typeof record.status === "string" ? record.status : "",
    typeof record.state === "string" ? record.state : "",
    typeof record.message === "string" ? record.message : "",
  ].filter(Boolean).join(" ");
}

function isTransportStatusText(value: string) {
  return /^(ok|success|successful|succeeded|complete|completed|accepted|submitted|queued|running|done|200)$/i.test(value.trim());
}

function isEmptyA2aPayload(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.every(isEmptyA2aPayload);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isEmptyA2aPayload);
  return false;
}

function matchingSkills(card: A2aCard, capability: string, taskType: string) {
  const skills = card.skills || [];
  const selectedSkill = skills.filter((skill) => (
    normalizedEndpointCapabilityName(skill.name || skill.id || "") === normalizedEndpointCapabilityName(taskType)
  ));
  if (selectedSkill.length > 0) return selectedSkill;
  if (capability === "custom") return skills;

  return skills.filter((skill) => {
    const text = [
      skill.id,
      skill.name,
      skill.description,
      ...(skill.tags || []),
    ].filter(Boolean).join(" ").toLowerCase();
    return capabilitySkillScore(capability, taskType, text) > 0;
  });
}

function capabilitySkillScore(capability: string, taskType: string, text: string) {
  const compact = text.replace(/[^a-z0-9]+/g, "");
  if (capability === "yield_optimisation") {
    return /yield|apy|apr|vault|farm|staking|deposit|earn|stablecoin|usdd/.test(text) ? 10 : 0;
  }
  if (capability === "health_factor") {
    return /health\s*factor|liquidation|borrow|loan|collateral|account\s*liquidity|risk/.test(text) ? 10 : 0;
  }
  if (capability === "grid_trading") {
    return /grid|bounds|trading\s*range|market\s*making|strategy/.test(text) ? 10 : 0;
  }
  if (capability === "concentrated_liquidity") {
    const task = taskType.toLowerCase();
    if (/dex\s*support|dex\s*info|supported\s*v3|supported\s*dex|fee\s*support/.test(task) && /v3|dex|fee|pool|liquidity/.test(text)) return 10;
    return /v3|concentrated|liquidity|tick|range|position|pool/.test(text) ? 10 : 0;
  }
  if (capability === "rebalancing") {
    return /rebalance|position|allocation|range|liquidity|lp/.test(text) ? 10 : 0;
  }
  return /job|task|request|agent/.test(compact) ? 1 : 0;
}

function capabilityLabel(capability: string) {
  if (capability === "health_factor") return "health factor";
  if (capability === "concentrated_liquidity") return "liquidity";
  if (capability === "yield_optimisation") return "yield";
  if (capability === "grid_trading") return "grid trading";
  if (capability === "rebalancing") return "rebalancing";
  return "job";
}

export const a2aAdapter: BnbAgentExecutionAdapter = {
  id: "a2a",

  canHandle(agent: BnbAgentProfile) {
    return Boolean(a2aEndpoint(agent));
  },

  async preflight(agent: BnbAgentProfile, selected?: BnbExecutionEndpoint): Promise<BnbAdapterPreflightResult> {
    const endpoint = a2aEndpoint(agent, selected);
    if (!endpoint) return { ok: false, adapter: "a2a", reason: "This agent is not available for jobs." };

    try {
      const { card, serviceUrl } = await fetchCard(endpoint);
      await assertPublicA2aService(serviceUrl, card, agent.chainId);
      return {
        ok: true,
        adapter: "a2a",
        endpoint,
        capabilities: (card.skills || []).map((skill) => skill.name || skill.id || "").filter(Boolean).slice(0, 20),
        capabilityContracts: a2aCapabilityContracts(card.skills || []),
      };
    } catch (error) {
      return {
        ok: false,
        adapter: "a2a",
        endpoint,
        reason: error instanceof Error ? error.message : "Agent check failed.",
      };
    }
  },

  async preflightJob({ agent, record, endpoint: selected }: BnbAdapterRunInput): Promise<BnbAdapterPreflightResult> {
    const endpoint = a2aEndpoint(agent, selected);
    if (!endpoint) return { ok: false, adapter: "a2a", reason: "This agent is not available for jobs." };

    try {
      const { card, serviceUrl } = await fetchCard(endpoint);
      await assertPublicA2aService(serviceUrl, card, agent.chainId);
      const capability = record.jobSpec?.capability || "custom";
      const taskType = record.jobSpec?.taskType || record.limits.task;
      const skills = matchingSkills(card, capability, taskType);
      if (capability !== "custom" && skills.length === 0) {
        return {
          ok: false,
          adapter: "a2a",
          endpoint,
          reason: `This agent cannot run this ${capabilityLabel(capability)} job. Choose another agent.`,
          capabilities: (card.skills || []).map((skill) => skill.name || skill.id || "").filter(Boolean).slice(0, 20),
          capabilityContracts: a2aCapabilityContracts(card.skills || []),
        };
      }

      return {
        ok: true,
        adapter: "a2a",
        endpoint,
        capabilities: (skills.length > 0 ? skills : card.skills || []).map((skill) => skill.name || skill.id || "").filter(Boolean).slice(0, 20),
        capabilityContracts: a2aCapabilityContracts(skills.length > 0 ? skills : card.skills || []),
      };
    } catch (error) {
      return {
        ok: false,
        adapter: "a2a",
        endpoint,
        reason: error instanceof Error ? error.message : "Agent check failed.",
      };
    }
  },

  async run({ agent, record, endpoint: selected }: BnbAdapterRunInput) {
    const endpoint = a2aEndpoint(agent, selected);
    if (!endpoint) throw new Error("This agent is not available for jobs.");
    const startedAt = new Date().toISOString();
    const { serviceUrl } = await fetchCard(endpoint);
    const { response, payload } = await safeFetchJson(serviceUrl, {
      method: "POST",
      headers: endpointAuthHeaders(serviceUrl),
      body: jsonRpc("message/send", messageParams(record.limits.task)),
      timeoutMs: 15_000,
      maxBytes: 384 * 1024,
    });
    if (!response.ok) {
      const protectedReason = protectedA2aReason(response.status, payload);
      throw new Error(protectedReason || `Agent request failed with HTTP ${response.status}.`);
    }
    const error = asRecord(payload).error;
    if (error) {
      const message = asRecord(error).message;
      throw new Error(typeof message === "string" ? message : "Agent run failed.");
    }

    return completedAdapterWork(
      stringifyA2aOutput(payload),
      [`A2A:${serviceUrl}`],
      startedAt,
      `a2a:${agent.chainId}:${agent.tokenId}`,
      "a2a",
    );
  },
};
