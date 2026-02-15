import { usePrivy } from "@privy-io/react-auth";
import { useReadContract } from "wagmi";
import { useState, useEffect } from "react";

// Hardcoded mock user for development when network is blocked
const MOCK_USER = {
  wallet: {
    address: "0x054e47c8DEF7Efa65Bf9F5bA4e3476c013482298", // Admin/Deployer mock
    chainId: "84532"
  },
  id: "did:privy:mock-user-id",
  email: { address: "dev@luxenlabs.com" }
};

import { toast } from "sonner";

// ... existing imports ...

// ... MOCK_USER definition ...

export function useAuth() {
  const privy = usePrivy();
  const mockAuthEnabled = process.env.NEXT_PUBLIC_MOCK_AUTH === "true";
  
  // States for fallback mechanism
  const [isReady, setIsReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [mockAuthenticated, setMockAuthenticated] = useState(false);

  useEffect(() => {
    // 1. If explicitly enabled via Env
    if (mockAuthEnabled) {
      setIsReady(true);
      setMockAuthenticated(true); // Auto-login for dev
      return;
    }

    // 2. If Privy is ready, we are good
    if (privy.ready) {
      setIsReady(true);
      return;
    }

    // 3. Timeout fallback
    const timer = setTimeout(() => {
      if (!privy.ready) {
        console.warn("Privy initialization timed out. Falling back to mock auth.");
        setUseFallback(true);
        setIsReady(true);
        toast.warning("Wallet service unreachable. Enabled Demo Mode.", {
             description: "You can now explore the app with a mock wallet."
        });
      }
    }, 4000); // 4 seconds timeout

    return () => clearTimeout(timer);
  }, [privy.ready, mockAuthEnabled]);

  // Combined Mock/Fallback Logic
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

  // Normal Privy Behavior
  return { 
    ...privy, 
    isMock: false,
    ready: privy.ready // Strict ready check for normal mode (prevent broken calls)
  };
}
