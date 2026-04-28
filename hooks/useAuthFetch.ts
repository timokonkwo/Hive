import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';

/**
 * Hook that returns a fetch wrapper which automatically includes
 * the Privy access token in the Authorization header.
 *
 * Usage:
 *   const authFetch = useAuthFetch();
 *   const res = await authFetch('/api/admin/stats?address=0x...');
 */
export function useAuthFetch() {
  const { getAccessToken } = usePrivy();

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      let token: string | null = null;
      try {
        token = await getAccessToken();
      } catch {
        // Token fetch failed — proceed without it (endpoint will 401)
      }

      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [getAccessToken]
  );
}
