import type { BnbAgentProfile } from "@/lib/bnb/types";

type BnbAgentRouteIdentity = Pick<BnbAgentProfile, "chainId" | "tokenId">;

export function bnbAgentProfilePath(agent: BnbAgentRouteIdentity) {
  return `/agents/${agent.chainId}/${encodeURIComponent(agent.tokenId)}`;
}

export function bnbAgentHirePath(agent: BnbAgentRouteIdentity) {
  return `/activate?chainId=${agent.chainId}&tokenId=${encodeURIComponent(agent.tokenId)}`;
}

