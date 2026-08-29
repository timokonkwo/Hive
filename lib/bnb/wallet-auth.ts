import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { getAddress, isAddress, verifyMessage } from "viem";
import type { VerifiedClient } from "@/lib/client-auth";

export const BNB_WALLET_SESSION_COOKIE = "hive-bnb-session";
export const BNB_WALLET_SESSION_HEADER = "x-hive-bnb-session";

const CHALLENGE_ISSUER = "hive-bnb-auth";
const CHALLENGE_AUDIENCE = "hive-bnb-auth-challenge";
const SESSION_ISSUER = "hive-bnb-auth";
const SESSION_AUDIENCE = "hive-bnb-api";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

type BnbWalletChallengePayload = {
  type: "challenge";
  address: string;
  chainId: number;
  origin: string;
  nonce: string;
  message: string;
};

type BnbWalletSessionPayload = {
  type: "session";
  address: string;
  chainId: number;
  sid: string;
};

export type BnbWalletAuthResult =
  | { ok: true; client: VerifiedClient }
  | { ok: false; reason: "missing_token" | "invalid" | "expired" | "missing_secret"; status: 401 | 503; message: string };

export function normalizeBnbWalletAddress(address: string) {
  const trimmed = address.trim();
  return isAddress(trimmed) ? getAddress(trimmed) : null;
}

export async function createBnbWalletChallenge({
  address,
  chainId,
  origin,
}: {
  address: string;
  chainId: number;
  origin: string;
}) {
  const normalized = normalizeBnbWalletAddress(address);
  if (!normalized) {
    throw new Error("Enter a valid EVM wallet address.");
  }

  const issuedAt = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const message = [
    "Hive BNB Wallet Sign-In",
    "",
    "Sign this message to create a Hive BNB session.",
    "This does not cost gas or authorize a transaction.",
    "",
    `Wallet: ${normalized}`,
    `Chain ID: ${Number.isFinite(chainId) ? Math.trunc(chainId) : 0}`,
    `Origin: ${origin || "unknown"}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");

  const token = await new SignJWT({
    type: "challenge",
    address: normalized,
    chainId: Number.isFinite(chainId) ? Math.trunc(chainId) : 0,
    origin: origin || "unknown",
    nonce,
    message,
  } satisfies BnbWalletChallengePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(CHALLENGE_ISSUER)
    .setAudience(CHALLENGE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getBnbWalletAuthSecret());

  return { address: normalized, chainId: Number.isFinite(chainId) ? Math.trunc(chainId) : 0, message, token };
}

export async function createBnbWalletSession({
  challengeToken,
  signature,
}: {
  challengeToken: string;
  signature: `0x${string}`;
}) {
  const { payload } = await jwtVerify(challengeToken, getBnbWalletAuthSecret(), {
    issuer: CHALLENGE_ISSUER,
    audience: CHALLENGE_AUDIENCE,
  });

  const challenge = payload as unknown as BnbWalletChallengePayload;
  if (challenge.type !== "challenge" || !challenge.message || !normalizeBnbWalletAddress(challenge.address)) {
    throw new Error("Invalid wallet sign-in challenge.");
  }

  const verified = await verifyMessage({
    address: challenge.address as `0x${string}`,
    message: challenge.message,
    signature,
  });
  if (!verified) {
    throw new Error("Wallet signature did not match the connected address.");
  }

  const sid = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const token = await new SignJWT({
    type: "session",
    address: challenge.address,
    chainId: challenge.chainId,
    sid,
  } satisfies BnbWalletSessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(`bnb-wallet:${challenge.address.toLowerCase()}`)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getBnbWalletAuthSecret());

  return { token, address: challenge.address, chainId: challenge.chainId, expiresAt };
}

export async function authenticateBnbWalletSession(request: NextRequest): Promise<BnbWalletAuthResult> {
  const token = readBnbWalletSessionToken(request);
  if (!token) {
    return {
      ok: false,
      reason: "missing_token",
      status: 401,
      message: "No Hive BNB wallet session was sent.",
    };
  }

  if (!hasBnbWalletAuthSecret()) {
    return {
      ok: false,
      reason: "missing_secret",
      status: 503,
      message: "Hive BNB wallet authentication is not configured.",
    };
  }

  try {
    const { payload } = await jwtVerify(token, getBnbWalletAuthSecret(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    const session = payload as unknown as BnbWalletSessionPayload & { exp?: number; sub?: string };
    const address = normalizeBnbWalletAddress(session.address);
    if (session.type !== "session" || !address) {
      throw new Error("Invalid Hive BNB wallet session.");
    }

    return {
      ok: true,
      client: {
        userId: address.toLowerCase(),
        address,
        sessionId: session.sid || "",
        expiresAt: session.exp || 0,
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      reason: error?.code === "ERR_JWT_EXPIRED" ? "expired" : "invalid",
      status: 401,
      message: error?.code === "ERR_JWT_EXPIRED"
        ? "Hive BNB wallet session expired."
        : "Hive BNB wallet session was rejected.",
    };
  }
}

export function setBnbWalletSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(BNB_WALLET_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearBnbWalletSessionCookie(response: NextResponse) {
  response.cookies.set(BNB_WALLET_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function readBnbWalletSessionToken(request: NextRequest) {
  return request.headers.get(BNB_WALLET_SESSION_HEADER)
    || request.cookies.get(BNB_WALLET_SESSION_COOKIE)?.value
    || "";
}

function hasBnbWalletAuthSecret() {
  return Boolean(process.env.BNB_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.NODE_ENV !== "production");
}

function getBnbWalletAuthSecret() {
  const secret = process.env.BNB_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("BNB_AUTH_SECRET, NEXTAUTH_SECRET, or AUTH_SECRET must be set.");
  }

  return new TextEncoder().encode(secret || `hive-bnb-local-wallet-auth:${process.env.NEXT_PUBLIC_PRIVY_APP_ID || "dev"}`);
}
