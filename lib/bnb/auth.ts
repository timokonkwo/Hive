import { NextRequest, NextResponse } from "next/server";
import {
  authenticateClientDetailed,
  type ClientAuthFailureReason,
  type VerifiedClient,
} from "@/lib/client-auth";
import { authenticateBnbWalletSession, normalizeBnbWalletAddress } from "@/lib/bnb/wallet-auth";

export type BnbClientAuth =
  | { client: VerifiedClient; ownerIds: string[]; response?: never }
  | { client?: never; response: NextResponse };

export async function requireBnbClient(request: NextRequest, action: string): Promise<BnbClientAuth> {
  // BNB records are owned by the wallet that signed the local Hive session.
  // Resolve that proof first so routine reads do not depend on Privy's remote
  // JWKS endpoint being available.
  const walletAuth = await authenticateBnbWalletSession(request);
  if (walletAuth.ok) {
    return { client: walletAuth.client, ownerIds: verifiedOwnerIds(walletAuth.client) };
  }

  const auth = await authenticateClientDetailed(request);
  if (auth.ok) {
    return {
      client: auth.client,
      ownerIds: verifiedOwnerIds(auth.client),
    };
  }

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

function verifiedOwnerIds(...clients: Array<VerifiedClient | undefined>) {
  return Array.from(new Set(clients.flatMap((client) => client ? [client.userId, client.address, ...(client.ownerIds || [])] : []).filter(Boolean)));
}

export function requireBnbRequestedWalletOwner(request: NextRequest, auth: Extract<BnbClientAuth, { client: VerifiedClient }>) {
  const requestedWallet = normalizeBnbWalletAddress(request.headers.get("x-hive-bnb-wallet-address") || "");
  if (!requestedWallet) return null;
  if (auth.ownerIds.some((ownerId) => ownerId.toLowerCase() === requestedWallet.toLowerCase())) return null;

  return NextResponse.json(
    {
      error: "Confirm this wallet to load its activity.",
      authReason: "wallet_owner_confirmation_required",
      walletAuthReason: "missing_token",
    },
    { status: 401 },
  );
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
