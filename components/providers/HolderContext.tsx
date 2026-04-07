"use client";

import React, { createContext, useContext, useRef, useState, useCallback } from "react";

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

const EMPTY_HOLDER: HolderData = { balance: 0, tier: 'none', tierInfo: null, isHolder: false };

export function HolderProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<string, HolderData>>({});
  const cacheRef = useRef<Record<string, HolderData>>({});
  const inflightRef = useRef<Record<string, Promise<HolderData | null>>>({});
  const failedRef = useRef<Set<string>>(new Set());

  const getHolder = useCallback((wallet: string) => cache[wallet], [cache]);

  const setHolder = useCallback((wallet: string, data: HolderData) => {
    cacheRef.current[wallet] = data;
    setCache(prev => ({ ...prev, [wallet]: data }));
  }, []);

  const fetchHolder = useCallback(async (wallet: string): Promise<HolderData | null> => {
    if (!wallet) return null;
    // Return cached result
    if (cacheRef.current[wallet]) return cacheRef.current[wallet];
    // Don't retry already-failed wallets for this session
    if (failedRef.current.has(wallet)) return EMPTY_HOLDER;
    // Deduplicate in-flight requests
    if (wallet in inflightRef.current) return inflightRef.current[wallet];

    const promise = (async () => {
      try {
        const res = await fetch(`/api/token/verify-holder?wallet=${encodeURIComponent(wallet)}`);
        if (res.status === 429) {
          // Rate limited — cache as failed, don't retry
          failedRef.current.add(wallet);
          return EMPTY_HOLDER;
        }
        if (!res.ok) {
          failedRef.current.add(wallet);
          return EMPTY_HOLDER;
        }
        const data = await res.json();
        const holderData: HolderData = {
          balance: data.balance,
          tier: data.tier,
          tierInfo: data.tierInfo,
          isHolder: data.isHolder,
        };
        cacheRef.current[wallet] = holderData;
        setCache(prev => ({ ...prev, [wallet]: holderData }));
        return holderData;
      } catch {
        failedRef.current.add(wallet);
        return EMPTY_HOLDER;
      } finally {
        delete inflightRef.current[wallet];
      }
    })();

    inflightRef.current[wallet] = promise;
    return promise;
  // Stable reference — no dependencies that change on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <HolderContext.Provider value={{ getHolder, fetchHolder, setHolder }}>
      {children}
    </HolderContext.Provider>
  );
}
