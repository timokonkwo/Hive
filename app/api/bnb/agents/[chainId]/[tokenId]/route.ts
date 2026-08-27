import { NextRequest, NextResponse } from "next/server";
import { recordBnbAnalyticsEvent } from "@/lib/bnb/analytics";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string; tokenId: string }> }
) {
  const limited = await enforceBnbRateLimit(request, "agents:detail", "read");
  if (limited) return limited;

  const { chainId, tokenId } = await params;
  const agent = await getBnbAgent(chainId, tokenId);

  if (!agent) {
    return NextResponse.json({ error: "BNB agent not found" }, { status: 404 });
  }

  recordBnbAnalyticsEvent({
    name: "profile.view",
    route: "api.bnb.agents.detail",
    agent,
    metadata: {
      capabilityCount: agent.endpointCapabilities?.length || 0,
      endpointCount: agent.executionEndpoints?.length || 0,
      serviceCount: agent.services.length,
    },
  });

  return NextResponse.json({ agent });
}
