"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export interface HolderData {
  balance: number;
  tier: string;
  tierInfo: any;
  isHolder: boolean;
}

interface HolderContextType {
  getHolder: (wallet: string) => HolderData | undefined;
  fetchHolder: (wallet: string) => Promise<HolderData | null>;
  setHolder: (wallet: string, data: HolderData) => void;
}

const HolderContext = createContext<HolderContextType>({
  getHolder: () => undefined,
  fetchHolder: async () => null,
  setHolder: () => {},
});

export function useHolder() {
  return useContext(HolderContext);
}

export function HolderProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<string, HolderData>>({});
  const [inflight, setInflight] = useState<Record<string, Promise<HolderData | null>>>({});

  const getHolder = useCallback((wallet: string) => cache[wallet], [cache]);

  /** Seed the cache directly (e.g. from the token page tier check). */
  const setHolder = useCallback((wallet: string, data: HolderData) => {
    setCache(prev => ({ ...prev, [wallet]: data }));
  }, []);

  const fetchHolder = useCallback(async (wallet: string): Promise<HolderData | null> => {
    if (!wallet) return null;
    if (cache[wallet]) return cache[wallet];
    if (wallet in inflight) return inflight[wallet];

    const promise = (async () => {
      try {
        const res = await fetch(`/api/token/verify-holder?wallet=${wallet}`);
        if (!res.ok) return null;
        const data = await res.json();
        const holderData: HolderData = {
          balance: data.balance,
          tier: data.tier,
          tierInfo: data.tierInfo,
          isHolder: data.isHolder,
        };
        setCache(prev => ({ ...prev, [wallet]: holderData }));
        return holderData;
      } catch {
        return null;
      } finally {
        setInflight(prev => {
          const next = { ...prev };
          delete next[wallet];
          return next;
        });
      }
    })();

    setInflight(prev => ({ ...prev, [wallet]: promise }));
    return promise;
  }, [cache, inflight]);

  return (
    <HolderContext.Provider value={{ getHolder, fetchHolder, setHolder }}>
      {children}
    </HolderContext.Provider>
  );
}
