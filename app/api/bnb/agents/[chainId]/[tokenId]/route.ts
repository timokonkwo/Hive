import { NextRequest, NextResponse } from "next/server";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string; tokenId: string }> }
) {
  const limited = enforceBnbRateLimit(request, "agents:detail", "read");
  if (limited) return limited;

  const { chainId, tokenId } = await params;
  const agent = await getBnbAgent(chainId, tokenId);

  if (!agent) {
    return NextResponse.json({ error: "BNB agent not found" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}
