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
  run(input: BnbAdapterRunInput): Promise<BnbAgentWork>;
};

export function completedAdapterWork(output: string, dataSources: string[], startedAt: string, trace?: string): BnbAgentWork {
  return {
    status: "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    output: trace ? `${output}\n\nTrace: ${trace}` : output,
    dataSources,
  };
}
