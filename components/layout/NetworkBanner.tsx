"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { AlertTriangle, Wifi } from "lucide-react";
import { useEffect, useState } from "react";

const SUPPORTED_CHAIN_ID = 84532; // HIVE Network

export const NetworkBanner = () => {
  const { chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isConnected || chainId === SUPPORTED_CHAIN_ID) {
    return null;
  }

  return (
    <div className="bg-orange-500 text-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest flex flex-col md:flex-row items-center justify-center gap-4 fixed bottom-0 left-0 right-0 z-50 md:static">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} />
        <span>Wrong Network Detected</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden md:inline">Please switch to the supported network</span>
        <button 
          onClick={() => switchChain({ chainId: SUPPORTED_CHAIN_ID })}
          className="bg-black text-white px-4 py-1.5 rounded-sm hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Wifi size={14} />
          Switch Network
        </button>
      </div>
    </div>
  );
};
