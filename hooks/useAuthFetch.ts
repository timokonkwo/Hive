import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';

/**
 * Hook that returns a fetch wrapper which automatically includes
 * the Privy access token in the Authorization header.
 *
 * If the user is authenticated but the token cannot be retrieved
 * (expired session, refresh failure), this will retry once after
 * a short delay before proceeding without it.
 *
 * Usage:
 *   const authFetch = useAuthFetch();
 *   const res = await authFetch('/api/admin/stats?address=0x...');
 */
export function useAuthFetch() {
  const { getAccessToken, authenticated } = usePrivy();

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      let token: string | null = null;

      try {
        token = await getAccessToken();
      } catch {
        // First attempt failed — ignore
      }

      // If authenticated but token is null, retry once after a brief delay.
      // This handles the case where Privy's internal refresh is still in-flight.
      if (!token && authenticated) {
        try {
          await new Promise((r) => setTimeout(r, 500));
          token = await getAccessToken();
        } catch {
          // Still failed — proceed without token (endpoint will 401)
        }
      }

      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Ensure cookies (privy-token) are sent as fallback
      });
    },
    [getAccessToken, authenticated]
  );
}
