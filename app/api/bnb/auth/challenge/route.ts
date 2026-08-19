import { NextRequest, NextResponse } from "next/server";
import { createBnbWalletChallenge } from "@/lib/bnb/wallet-auth";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const limited = enforceBnbRateLimit(request, "auth:challenge", "write");
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const address = readString(body.address);
  const chainId = Number(body.chainId || 0);
  const origin = request.headers.get("origin") || new URL(request.url).origin;

  try {
    const challenge = await createBnbWalletChallenge({ address, chainId, origin });
    return NextResponse.json(challenge);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create wallet sign-in challenge." },
      { status: 400 },
    );
  }
}
