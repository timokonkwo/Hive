import type { BnbAgentProfile } from "@/lib/bnb/types";

export function bnb8004AgentImageUrl(chainId: string | number, tokenId: string | number) {
  return `https://api.8004scan.io/api/v1/media/agents/${encodeURIComponent(String(chainId))}/${encodeURIComponent(String(tokenId))}/image`;
}

export function withBnbAgentImage(agent: BnbAgentProfile): BnbAgentProfile {
  if (agent.imageUrl || agent.sourceFreshness.source !== "8004scan") return agent;
  return {
    ...agent,
    imageUrl: bnb8004AgentImageUrl(agent.chainId, agent.tokenId),
  };
}
