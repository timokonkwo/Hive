import { NextRequest, NextResponse } from "next/server";
import { createBnbWalletSession, setBnbWalletSessionCookie } from "@/lib/bnb/wallet-auth";
import { enforceBnbRateLimit } from "@/lib/bnb/rate-limit";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const limited = await enforceBnbRateLimit(request, "auth:session", "write");
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const challengeToken = readString(body.challengeToken);
  const signature = readString(body.signature);

  if (!challengeToken || !signature) {
    return NextResponse.json({ error: "Wallet sign-in challenge and signature are required." }, { status: 400 });
  }

  try {
    const session = await createBnbWalletSession({
      challengeToken,
      signature: signature as `0x${string}`,
    });
    const response = NextResponse.json(session);
    setBnbWalletSessionCookie(response, session.token);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet sign-in failed." },
      { status: 401 },
    );
  }
}
