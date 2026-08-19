import type { BnbActivationRecord, BnbAgentProfile, BnbAgentWork, BnbExecutionEndpoint } from "@/lib/bnb/types";

export type BnbAdapterId = "mcp" | "a2a" | "x402" | "http";

export type BnbAdapterPreflightResult = {
  ok: boolean;
  adapter: BnbAdapterId;
  endpoint?: BnbExecutionEndpoint;
  reason?: string;
  capabilities?: string[];
};

export type BnbAdapterRunInput = {
  agent: BnbAgentProfile;
  record: BnbActivationRecord;
};

export type BnbAgentExecutionAdapter = {
  id: BnbAdapterId;
  canHandle(agent: BnbAgentProfile): boolean;
  preflight(agent: BnbAgentProfile): Promise<BnbAdapterPreflightResult>;
  preflightJob?(input: BnbAdapterRunInput): Promise<BnbAdapterPreflightResult>;
  run(input: BnbAdapterRunInput): Promise<BnbAgentWork>;
};

export function completedAdapterWork(output: string, dataSources: string[], startedAt: string, runId?: string, adapter?: string): BnbAgentWork {
  return {
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    output,
    dataSources,
    ...(adapter ? { adapter } : {}),
    ...(runId ? { runId } : {}),
  };
}
