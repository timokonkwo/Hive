import { NextRequest, NextResponse } from "next/server";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export async function GET(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "runtime", "read");
  if (limited) return limited;

  return NextResponse.json({
    storage: {
      mongoConfigured: Boolean(process.env.MONGODB_URI?.trim()),
      processFallbackAllowed: process.env.BNB_ALLOW_PROCESS_STORAGE === "true",
    },
    chain: {
      bscRpcConfigured: Boolean(process.env.BNB_BSC_RPC_URL?.trim()),
      clientBscRpcConfigured: Boolean(process.env.NEXT_PUBLIC_BNB_BSC_RPC_URL?.trim()),
      escrowConfigured: Boolean(process.env.BNB_AGENT_ESCROW_ADDRESS?.trim()),
      sessionRegistryConfigured: Boolean(process.env.BNB_SESSION_REGISTRY_ADDRESS?.trim()),
    },
    worker: {
      workerConfigured: Boolean(process.env.BNB_AGENT_WORKER_URL?.trim()),
      workerApiKeyConfigured: Boolean(process.env.BNB_AGENT_WORKER_API_KEY?.trim()),
      callbackSecretConfigured: Boolean(process.env.BNB_AGENT_WORKER_CALLBACK_SECRET?.trim()),
    },
    discovery: {
      live8004scanEnabled: process.env.BNB_8004SCAN_LIVE === "true",
      configuredAgents: Boolean(process.env.BNB_HIVE_AGENTS_JSON?.trim()),
      localAgentsEnabled: process.env.BNB_SHOW_LOCAL_AGENTS === "true",
    },
  });
}
