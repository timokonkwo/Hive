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
  email: { address: "dev@uphive.xyz" }
};

export function useAuth() {
  const privy = usePrivy();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const mockAuthEnabled = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";
  
  const [isReady, setIsReady] = useState(privy.ready || mockAuthEnabled);
  const [useFallback, setUseFallback] = useState(false);
  const [mockAuthenticated, setMockAuthenticated] = useState(mockAuthEnabled);
  const [prevAddress, setPrevAddress] = useState<string | null>(null);
  const [authStabilized, setAuthStabilized] = useState(false);

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

  // Stabilization delay: after Privy authenticates, wait for wagmi to sync
  // This prevents the wallet switch detection from firing too early
  // (especially for email sign-in where an embedded wallet is created)
  useEffect(() => {
    if (!privy.authenticated) {
      setAuthStabilized(false);
      return;
    }

    // Give wagmi 3 seconds to sync with the new Privy session
    const timer = setTimeout(() => {
      setAuthStabilized(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [privy.authenticated]);

  // Check if user has an embedded wallet (email/social sign-in)
  const hasEmbeddedWallet = privy.user?.linkedAccounts?.some(
    (account: any) => account.type === 'wallet' && account.walletClientType === 'privy'
  );

  // Detect MetaMask wallet switches via wagmi
  // Only runs for external wallet users (not email/social sign-in)
  // and only after auth has stabilized (wagmi has had time to sync)
  useEffect(() => {
    if (mockAuthEnabled || useFallback) return;
    if (!privy.authenticated || !wagmiAddress) return;
    if (!authStabilized) return;
    // Skip for embedded wallet users — they don't use MetaMask
    if (hasEmbeddedWallet) return;

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
  }, [wagmiAddress, privy.authenticated, privy.user?.wallet?.address, mockAuthEnabled, useFallback, authStabilized, hasEmbeddedWallet]);

  // Handle disconnect from wagmi side (user disconnected in MetaMask)
  // Skip for embedded wallet users — their wallet is managed by Privy, not wagmi
  useEffect(() => {
    if (mockAuthEnabled || useFallback) return;
    if (!authStabilized) return;
    if (hasEmbeddedWallet) return;
    if (privy.authenticated && prevAddress && !wagmiConnected) {
      console.log("Wallet disconnected externally");
      privy.logout().then(() => {
        setPrevAddress(null);
      });
    }
  }, [wagmiConnected, privy.authenticated, prevAddress, mockAuthEnabled, useFallback, authStabilized, hasEmbeddedWallet]);

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
