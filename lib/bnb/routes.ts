import type { BnbAgentProfile } from "@/lib/bnb/types";

type BnbAgentRouteIdentity = Pick<BnbAgentProfile, "chainId" | "tokenId">;

export function bnbAgentProfilePath(agent: BnbAgentRouteIdentity) {
  return `/bnb/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`;
}

export function bnbAgentHirePath(agent: BnbAgentRouteIdentity) {
  return `/bnb/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`;
}

