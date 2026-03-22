import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";

/**
 * Extended auth hook that provides a stable identity for ALL login methods.
 *
 * - Wallet login → uses the connected wallet address
 * - Email/Google login → uses Privy user ID (no embedded wallet needed)
 *
 * All consuming code should use `user.wallet.address` which this hook
 * now guarantees to exist by synthesizing a wallet object for email users.
 */
export function useAuth() {
  const privy = usePrivy();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  
  const [prevAddress, setPrevAddress] = useState<string | null>(null);
  const [authStabilized, setAuthStabilized] = useState(false);

  // Stabilization delay: after Privy authenticates, wait for wagmi to sync
  useEffect(() => {
    if (!privy.authenticated) {
      setAuthStabilized(false);
      return;
    }

    const timer = setTimeout(() => {
      setAuthStabilized(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [privy.authenticated]);

  // Detect MetaMask wallet switches via wagmi
  // Only runs for external wallet users
  useEffect(() => {
    if (!privy.authenticated || !wagmiAddress || !authStabilized) return;

    const hasExternalWallet = privy.user?.linkedAccounts?.some(
      (account: any) => account.type === 'wallet' && account.walletClientType !== 'privy'
    );
    if (!hasExternalWallet) return;

    const currentPrivyAddress = privy.user?.wallet?.address?.toLowerCase();
    const currentWagmiAddress = wagmiAddress?.toLowerCase();

    if (!prevAddress) {
      setPrevAddress(currentWagmiAddress || null);
      return;
    }

    if (currentWagmiAddress && currentPrivyAddress && currentWagmiAddress !== currentPrivyAddress) {
      console.log(`Wallet switch detected: ${currentPrivyAddress} → ${currentWagmiAddress}`);
      toast.info("Wallet changed", {
        description: "Reconnecting with the new wallet..."
      });
      privy.logout().then(() => {
        setPrevAddress(null);
      });
    }
  }, [wagmiAddress, privy.authenticated, privy.user?.wallet?.address, authStabilized, prevAddress, privy]);

  // Handle disconnect from wagmi side
  useEffect(() => {
    if (!authStabilized) return;
    const hasExternalWallet = privy.user?.linkedAccounts?.some(
      (account: any) => account.type === 'wallet' && account.walletClientType !== 'privy'
    );
    if (!hasExternalWallet) return;
    if (privy.authenticated && prevAddress && !wagmiConnected) {
      console.log("Wallet disconnected externally");
      privy.logout().then(() => {
        setPrevAddress(null);
      });
    }
  }, [wagmiConnected, privy.authenticated, prevAddress, authStabilized, privy]);

  // Build a stable user object that ALWAYS has an address
  // Wallet users → wallet address | Email/Google users → Privy user ID
  const userWithAddress = useMemo(() => {
    if (!privy.user) return privy.user;

    const walletAddress = privy.user.wallet?.address;

    // If user already has a wallet address, return as-is
    if (walletAddress) return privy.user;

    // For email/Google users without a wallet, synthesize a wallet object
    // using the Privy user ID as the address
    const userId = privy.user.id;
    return {
      ...privy.user,
      wallet: {
        address: userId,
        chainType: 'ethereum' as const,
        chainId: '1',
        walletClientType: 'privy' as const,
      },
    };
  }, [privy.user]);

  // Return the same shape as privy but with our enhanced user
  return {
    ...privy,
    user: userWithAddress,
  };
}
