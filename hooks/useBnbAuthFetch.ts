"use client";

import {
  getAccessToken as getStoredPrivyAccessToken,
  getIdentityToken as getStoredPrivyIdentityToken,
  useIdentityToken,
  usePrivy,
} from "@privy-io/react-auth";
import { useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";

const retryDelays = [0, 400, 900, 1600] as const;
const walletSessionRefreshSkewSeconds = 60;

type BnbTokenResult =
  | { status: "ready"; accessToken: string | null; identityToken: string | null }
  | { status: "loading"; accessToken: null; identityToken: null }
  | { status: "signed_out"; accessToken: null; identityToken: null };

type BnbWalletSession = {
  address: string;
  token: string;
  expiresAt: number;
};

let cachedWalletSession: BnbWalletSession | null = null;
let pendingWalletSession: Promise<BnbWalletSession> | null = null;

export function useBnbAuthFetch() {
  const { authenticated, getAccessToken, login, ready } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const latestAddressRef = useRef<string | undefined>(address);
  latestAddressRef.current = address;

  const loginWithBnbWallet = useCallback(() => {
    if (authenticated) return;
    login({
      loginMethods: ["wallet"],
      walletChainType: "ethereum-only",
    });
  }, [authenticated, login]);

  const resolveTokens = useCallback(async (): Promise<BnbTokenResult> => {
    if (!ready && !address) {
      return { status: "loading", accessToken: null, identityToken: null };
    }

    if (!authenticated && !address) {
      return { status: "signed_out", accessToken: null, identityToken: null };
    }

    for (const delay of retryDelays) {
      if (delay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }

      let accessToken: string | null = null;
      let nextIdentityToken = identityToken;

      if (authenticated) {
        try {
          accessToken = await getAccessToken();
        } catch {
          // Privy can still be refreshing immediately after login.
        }

        if (!accessToken) {
          accessToken = await getStoredPrivyAccessToken().catch(() => null);
        }
        if (!nextIdentityToken) {
          nextIdentityToken = await getStoredPrivyIdentityToken().catch(() => null);
        }
      }

      if (accessToken || nextIdentityToken) {
        return {
          status: "ready",
          accessToken,
          identityToken: nextIdentityToken,
        };
      }
    }

    // Do not block here. Privy may be using server cookies, or the connected
    // wallet can create a Hive BNB session after the protected API returns 401.
    return { status: "ready", accessToken: null, identityToken: null };
  }, [address, authenticated, getAccessToken, identityToken, ready]);

  const ensureWalletSession = useCallback(async () => {
    const walletAddress = latestAddressRef.current;
    if (!walletAddress) {
      throw new Error("Connect an EVM wallet to continue.");
    }

    const cached = getCachedWalletSession(walletAddress);
    if (cached) return cached;
    if (pendingWalletSession) {
      const pending = await pendingWalletSession;
      if (sameAddress(pending.address, walletAddress)) return pending;
    }

    const sessionPromise = createWalletSession({
      address: walletAddress,
      chainId: chainId || 0,
      signMessage: (message) => signMessageAsync({ message }),
    });
    pendingWalletSession = sessionPromise;

    try {
      const session = await sessionPromise;
      cachedWalletSession = session;
      return session;
    } finally {
      if (pendingWalletSession === sessionPromise) {
        pendingWalletSession = null;
      }
    }
  }, [chainId, signMessageAsync]);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const tokens = await resolveTokens();
      if (tokens.status === "loading") {
        return jsonResponse("Authentication is still loading.", 425);
      }
      if (tokens.status === "signed_out") {
        return jsonResponse("Sign in with your wallet to continue.", 401);
      }

      const walletSession = getCachedWalletSession(address);
      let response = await fetchWithOptionalToken(url, options, tokens, walletSession?.token, address);

      if (response.status === 401 && authenticated && (tokens.accessToken || tokens.identityToken)) {
        await delay(900);
        const retryTokens = await resolveTokens();
        if (retryTokens.status !== "ready") {
          return response;
        }
        const retryResponse = await fetchWithOptionalToken(url, options, retryTokens, walletSession?.token, address);
        if (retryResponse.status !== 401) return retryResponse;
        response = retryResponse;
      }

      if ((response.status === 401 || response.status === 503) && address && shouldTryWalletSession(await readJsonClone(response))) {
        try {
          const session = await ensureWalletSession();
          return fetchWithOptionalToken(url, options, tokens, session.token, address);
        } catch (walletAuthError) {
          return jsonResponse(
            walletAuthError instanceof Error ? walletAuthError.message : "Wallet sign-in failed.",
            401,
          );
        }
      }

      return response;
    },
    [address, authenticated, ensureWalletSession, resolveTokens],
  );

  return { authFetch, login: loginWithBnbWallet, accountReady: ready && (authenticated || Boolean(address)) };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function fetchWithOptionalToken(
  url: string,
  options: RequestInit,
  tokens: Extract<BnbTokenResult, { status: "ready" }>,
  walletSessionToken?: string,
  walletAddress?: string,
) {
  const headers = new Headers(options.headers || {});
  if (tokens.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }
  if (tokens.identityToken) {
    headers.set("x-privy-identity-token", tokens.identityToken);
  }
  if (walletSessionToken) {
    headers.set("x-hive-bnb-session", walletSessionToken);
  }
  if (walletAddress) {
    headers.set("x-hive-bnb-wallet-address", walletAddress);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

async function createWalletSession({
  address,
  chainId,
  signMessage,
}: {
  address: string;
  chainId: number;
  signMessage: (message: string) => Promise<string>;
}) {
  const challengeResponse = await fetch("/api/bnb/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ address, chainId }),
  });
  const challenge = await challengeResponse.json().catch(() => ({}));
  if (!challengeResponse.ok || typeof challenge.message !== "string" || typeof challenge.token !== "string") {
    throw new Error(challenge.error || "Could not prepare wallet sign-in.");
  }

  const signature = await signMessage(challenge.message);
  const sessionResponse = await fetch("/api/bnb/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ challengeToken: challenge.token, signature }),
  });
  const session = await sessionResponse.json().catch(() => ({}));
  if (!sessionResponse.ok || typeof session.token !== "string") {
    throw new Error(session.error || "Wallet sign-in failed.");
  }

  return {
    address: session.address || address,
    token: session.token,
    expiresAt: Number(session.expiresAt || 0),
  };
}

function getCachedWalletSession(address?: string) {
  if (!address || !cachedWalletSession || !sameAddress(cachedWalletSession.address, address)) return null;
  const now = Math.floor(Date.now() / 1000);
  return cachedWalletSession.expiresAt - walletSessionRefreshSkewSeconds > now ? cachedWalletSession : null;
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

async function readJsonClone(response: Response) {
  return response.clone().json().catch(() => null) as Promise<any>;
}

function shouldTryWalletSession(payload: any) {
  if (!payload || typeof payload !== "object") return true;
  return Boolean(payload.authReason || payload.walletAuthReason);
}

function jsonResponse(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
