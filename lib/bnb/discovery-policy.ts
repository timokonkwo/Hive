import type { BnbAgentProfile } from "@/lib/bnb/types";

export const BNB_MAINNET_CHAIN_ID = 56;

export function isStrictBscAgentDiscoveryEnabled() {
  return process.env.BNB_STRICT_BSC_AGENTS !== "false";
}

export function isBnbAgentVisibleInDiscovery(
  agent: Pick<BnbAgentProfile, "chainId" | "sourceFreshness">,
) {
  if (!isStrictBscAgentDiscoveryEnabled()) return true;
  return agent.chainId === BNB_MAINNET_CHAIN_ID
    && agent.sourceFreshness.source === "8004scan";
}

