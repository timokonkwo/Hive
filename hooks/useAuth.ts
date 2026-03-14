import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";

// Hardcoded mock user for development when network is blocked
const MOCK_USER = {
  wallet: {
    address: "0x054e47c8DEF7Efa65Bf9F5bA4e3476c013482298",
    chainId: "84532"
  },
  id: "did:privy:mock-user-id",
  email: { address: "dev@luxenlabs.com" }
};

export function useAuth() {
  const privy = usePrivy();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const mockAuthEnabled = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";
  
  const [isReady, setIsReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [mockAuthenticated, setMockAuthenticated] = useState(false);
  const [prevAddress, setPrevAddress] = useState<string | null>(null);

  // Privy readiness / fallback timer
  useEffect(() => {
    if (mockAuthEnabled) {
      setIsReady(true);
      setMockAuthenticated(true);
      return;
    }

    if (privy.ready) {
      setIsReady(true);
      return;
    }

    const timer = setTimeout(() => {
      if (!privy.ready) {
        console.warn("Privy initialization timed out. Falling back to mock auth.");
        setUseFallback(true);
        setIsReady(true);
        toast.warning("Wallet service unreachable. Enabled Demo Mode.", {
          description: "You can now explore the app with a mock wallet."
        });
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [privy.ready, mockAuthEnabled]);

  // Detect MetaMask wallet switches via wagmi
  // When the user switches wallets in MetaMask, wagmi picks it up immediately
  // but Privy's session still references the old wallet. We log them out
  // so they get a clean reconnect with the new wallet.
  useEffect(() => {
    if (mockAuthEnabled || useFallback) return;
    if (!privy.authenticated || !wagmiAddress) return;

    const currentPrivyAddress = privy.user?.wallet?.address?.toLowerCase();
    const currentWagmiAddress = wagmiAddress?.toLowerCase();

    // If this is the first time, store and skip
    if (!prevAddress) {
      setPrevAddress(currentWagmiAddress || null);
      return;
    }

    // If wagmi detects a different address than what Privy knows
    if (currentWagmiAddress && currentPrivyAddress && currentWagmiAddress !== currentPrivyAddress) {
      console.log(`Wallet switch detected: ${currentPrivyAddress} → ${currentWagmiAddress}`);
      toast.info("Wallet changed", {
        description: "Reconnecting with the new wallet..."
      });
      privy.logout().then(() => {
        setPrevAddress(null);
      });
    }
  }, [wagmiAddress, privy.authenticated, privy.user?.wallet?.address, mockAuthEnabled, useFallback]);

  // Handle disconnect from wagmi side (user disconnected in MetaMask)
  useEffect(() => {
    if (mockAuthEnabled || useFallback) return;
    if (privy.authenticated && prevAddress && !wagmiConnected) {
      console.log("Wallet disconnected externally");
      privy.logout().then(() => {
        setPrevAddress(null);
      });
    }
  }, [wagmiConnected, privy.authenticated, prevAddress, mockAuthEnabled, useFallback]);

  // Mock/Fallback mode
  if (mockAuthEnabled || useFallback) {
    return {
      ...privy, 
      ready: true,
      authenticated: mockAuthenticated,
      user: mockAuthenticated ? (MOCK_USER as any) : null,
      login: async () => { 
        console.log("Mock login"); 
        setMockAuthenticated(true);
        toast.success("Connected (Demo Mode)", { description: "Using mock wallet: 0x05...2298" });
      },
      logout: async () => { 
        console.log("Mock logout"); 
        setMockAuthenticated(false);
      },
      isMock: true
    };
  }

  // Normal Privy behavior
  return { 
    ...privy, 
    isMock: false,
    ready: privy.ready
  };
}
