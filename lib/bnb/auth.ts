import { NextRequest, NextResponse } from "next/server";
import {
  authenticateClientDetailed,
  type ClientAuthFailureReason,
  type VerifiedClient,
} from "@/lib/client-auth";
import { authenticateBnbWalletSession } from "@/lib/bnb/wallet-auth";

export type BnbClientAuth =
  | { client: VerifiedClient; response?: never }
  | { client?: never; response: NextResponse };

export async function requireBnbClient(request: NextRequest, action: string): Promise<BnbClientAuth> {
  const auth = await authenticateClientDetailed(request);
  if (auth.ok) return { client: auth.client };

  const walletAuth = await authenticateBnbWalletSession(request);
  if (walletAuth.ok) return { client: walletAuth.client };

  return {
    response: NextResponse.json(
      {
        error: bnbAuthMessage(auth.reason, action, walletAuth.reason),
        authReason: auth.reason,
        walletAuthReason: walletAuth.reason,
      },
      { status: auth.status },
    ),
  };
}

function bnbAuthMessage(reason: ClientAuthFailureReason, action: string, walletReason?: string) {
  if (reason === "missing_app_id") {
    return "Hive authentication is not configured for this environment.";
  }
  if (reason === "missing_token") {
    if (walletReason === "expired") {
      return "Your wallet session expired. Sign the wallet message again, then retry.";
    }
    return `Sign in with your wallet before you ${action}.`;
  }
  if (reason === "expired") {
    return "Your sign-in expired. Sign in with your wallet again, then retry.";
  }
  if (reason === "jwks_failed") {
    return "Hive could not verify Privy authentication right now. Try again in a moment.";
  }
  return "Your sign-in token was rejected. Sign in with your wallet again, then retry.";
}
