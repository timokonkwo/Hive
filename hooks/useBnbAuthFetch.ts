"use client";

import { useIdentityToken, usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";

const retryDelays = [0, 300, 800, 1600, 2600] as const;

export function useBnbAuthFetch() {
  const { authenticated, getAccessToken, login, ready } = usePrivy();
  const { identityToken } = useIdentityToken();

  const resolveToken = useCallback(async () => {
    for (const delay of retryDelays) {
      if (delay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }

      try {
        const token = await getAccessToken();
        if (token) return token;
      } catch {
        // Privy can still be refreshing immediately after login.
      }
    }

    return null;
  }, [getAccessToken]);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!ready) {
        return jsonResponse("Authentication is still loading.", 425);
      }

      if (!authenticated) {
        return jsonResponse("Sign in to continue.", 401);
      }

      const response = await fetchWithOptionalToken(url, options, await resolveToken(), identityToken);

      if (response.status === 401 && authenticated) {
        await delay(900);
        const retryResponse = await fetchWithOptionalToken(url, options, await resolveToken(), identityToken);
        if (retryResponse.status !== 401) return retryResponse;
      }

      if (response.status === 401 && authenticated) {
        return jsonResponse("We could not verify your account. Try again.", 401);
      }

      return response;
    },
    [authenticated, identityToken, ready, resolveToken],
  );

  return { authFetch, login, accountReady: ready && authenticated };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function fetchWithOptionalToken(url: string, options: RequestInit, token: string | null, identityToken: string | null) {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (identityToken) {
    headers.set("x-privy-identity-token", identityToken);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

function jsonResponse(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
