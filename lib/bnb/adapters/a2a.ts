import { safeFetchJson, validatePublicHttpsUrl } from "@/lib/bnb/endpoint-security";
import type { BnbAgentProfile, BnbExecutionEndpoint } from "@/lib/bnb/types";
import type { BnbAgentExecutionAdapter, BnbAdapterPreflightResult, BnbAdapterRunInput } from "@/lib/bnb/adapters/types";
import { completedAdapterWork } from "@/lib/bnb/adapters/types";

type A2aCard = {
  name?: string;
  description?: string;
  url?: string;
  skills?: Array<{ id?: string; name?: string; description?: string }>;
  capabilities?: {
    streaming?: boolean;
  };
};

function a2aEndpoint(agent: BnbAgentProfile) {
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
    }))
    : [];
  return {
    name: typeof record.name === "string" ? record.name : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    url: typeof record.url === "string" ? record.url : undefined,
    skills,
    capabilities: asRecord(record.capabilities) as A2aCard["capabilities"],
  };
}

async function fetchCard(endpoint: BnbExecutionEndpoint) {
  const { response, payload } = await safeFetchJson(endpoint.url, {
    method: "GET",
    timeoutMs: 7_000,
    maxBytes: 192 * 1024,
  });
  if (!response.ok) throw new Error(`A2A Agent Card failed with HTTP ${response.status}.`);
  const card = parseCard(payload);
  const serviceUrl = card.url || endpoint.url;
  const checked = validatePublicHttpsUrl(serviceUrl);
  if (!checked.ok) throw new Error(checked.reason);
  return { card, serviceUrl: checked.url.toString() };
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
  const result = asRecord(asRecord(payload).result || payload);
  const status = asRecord(result.status);
  const message = asRecord(status.message || result.message);
  const parts = Array.isArray(message.parts) ? message.parts : Array.isArray(result.parts) ? result.parts : [];
  const text = parts
    .map((part) => {
      const record = asRecord(part);
      return typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n\n");
  if (text) return text;
  if (typeof result.text === "string") return result.text;
  return JSON.stringify(result || payload, null, 2);
}

export const a2aAdapter: BnbAgentExecutionAdapter = {
  id: "a2a",

  canHandle(agent: BnbAgentProfile) {
    return Boolean(a2aEndpoint(agent));
  },

  async preflight(agent: BnbAgentProfile): Promise<BnbAdapterPreflightResult> {
    const endpoint = a2aEndpoint(agent);
    if (!endpoint) return { ok: false, adapter: "a2a", reason: "No A2A endpoint is listed." };

    try {
      const { card } = await fetchCard(endpoint);
      return {
        ok: true,
        adapter: "a2a",
        endpoint,
        capabilities: (card.skills || []).map((skill) => skill.name || skill.id || "").filter(Boolean).slice(0, 20),
      };
    } catch (error) {
      return {
        ok: false,
        adapter: "a2a",
        endpoint,
        reason: error instanceof Error ? error.message : "A2A preflight failed.",
      };
    }
  },

  async run({ agent, record }: BnbAdapterRunInput) {
    const endpoint = a2aEndpoint(agent);
    if (!endpoint) throw new Error("No A2A endpoint is listed for this agent.");
    const startedAt = new Date().toISOString();
    const { serviceUrl } = await fetchCard(endpoint);
    const { response, payload } = await safeFetchJson(serviceUrl, {
      method: "POST",
      body: jsonRpc("message/send", messageParams(record.limits.task)),
      timeoutMs: 15_000,
      maxBytes: 384 * 1024,
    });
    if (!response.ok) throw new Error(`A2A message/send failed with HTTP ${response.status}.`);
    const error = asRecord(payload).error;
    if (error) {
      const message = asRecord(error).message;
      throw new Error(typeof message === "string" ? message : "A2A task failed.");
    }

    return completedAdapterWork(
      stringifyA2aOutput(payload),
      [`A2A:${serviceUrl}`],
      startedAt,
      `a2a:${agent.chainId}:${agent.tokenId}`,
    );
  },
};
