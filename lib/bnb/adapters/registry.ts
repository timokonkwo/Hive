import type { BnbActivationRecord, BnbAgentProfile, BnbAgentWork } from "@/lib/bnb/types";
import { a2aAdapter } from "@/lib/bnb/adapters/a2a";
import { mcpAdapter } from "@/lib/bnb/adapters/mcp";
import type { BnbAdapterPreflightResult, BnbAgentExecutionAdapter } from "@/lib/bnb/adapters/types";

const adapters: BnbAgentExecutionAdapter[] = [
  mcpAdapter,
  a2aAdapter,
];

export async function preflightBnbAgentAdapters(agent: BnbAgentProfile): Promise<BnbAdapterPreflightResult[]> {
  const candidates = adapters.filter((adapter) => adapter.canHandle(agent));
  if (candidates.length === 0) {
    return [{
      ok: false,
      adapter: "http",
      reason: "No supported execution endpoint is listed for this agent.",
    }];
  }

  return Promise.all(candidates.map((adapter) => adapter.preflight(agent)));
}

export async function hasRunnableBnbAdapter(agent: BnbAgentProfile) {
  const results = await preflightBnbAgentAdapters(agent);
  return results.some((result) => result.ok);
}

export async function runBnbAgentAdapter(agent: BnbAgentProfile, record: BnbActivationRecord): Promise<BnbAgentWork | null> {
  for (const adapter of adapters) {
    if (!adapter.canHandle(agent)) continue;
    const preflight = await adapter.preflight(agent);
    if (!preflight.ok) continue;
    return adapter.run({ agent, record });
  }

  return null;
}
