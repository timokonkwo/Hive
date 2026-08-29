import { NextRequest, NextResponse } from "next/server";
import { requireBnbClient } from "@/lib/bnb/auth";
import { getBnbAgent } from "@/lib/bnb/catalog";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";
import { BnbStorageError, createBnbAgentComparisonRecord } from "@/lib/bnb/records";

type AgentIdentity = {
  chainId: string | number;
  tokenId: string;
};

function readAgentIdentities(value: unknown): AgentIdentity[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, AgentIdentity>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const chainId = typeof candidate.chainId === "string" || typeof candidate.chainId === "number" ? candidate.chainId : "";
    const tokenId = typeof candidate.tokenId === "string" ? candidate.tokenId.trim() : "";
    if (!chainId || !tokenId) continue;
    unique.set(`${chainId}:${tokenId}`, { chainId, tokenId });
  }

  return Array.from(unique.values());
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "comparisons", "write");
  if (limited) return limited;

  const auth = await requireBnbClient(request, "save a comparison");
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const identities = readAgentIdentities(body.agents);
  if (identities.length < 2 || identities.length > 3) {
    return NextResponse.json({ error: "Select two or three agents to compare." }, { status: 400 });
  }

  const agents = await Promise.all(identities.map((identity) => getBnbAgent(identity.chainId, identity.tokenId)));
  if (agents.some((agent) => !agent)) {
    return NextResponse.json({ error: "One of the selected agents is no longer available." }, { status: 404 });
  }

  try {
    const record = await createBnbAgentComparisonRecord({
      agents: agents.filter((agent): agent is NonNullable<typeof agent> => Boolean(agent)),
      clientAddress: auth.client.userId,
    });
    return NextResponse.json({ status: "saved", record }, { status: 201 });
  } catch (error) {
    if (error instanceof BnbStorageError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save comparison." }, { status: 500 });
  }
}
