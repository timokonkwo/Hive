import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";

/**
 * Extended auth hook that provides a stable identity for ALL login methods.
 *
 * Priority order for wallet address:
 *  1. Solana wallet (if connected via Solana wallet like Phantom)
 *  2. Ethereum wallet (if connected via MetaMask, etc.)
 *  3. Privy user ID (for email/Google users without a wallet)
 *
 * All consuming code should use `user.wallet.address` which this hook
 * guarantees to exist.
 */
export function useAuth() {
  const privy = usePrivy();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  const [prevAddress, setPrevAddress] = useState<string | null>(null);
  const [authStabilized, setAuthStabilized] = useState(false);

  // Stabilization delay: after Privy authenticates, wait for wallet to sync
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

  // Detect MetaMask wallet switches via wagmi (EVM users only)
  useEffect(() => {
    if (!privy.authenticated || !wagmiAddress || !authStabilized) return;

    const hasExternalEthWallet = privy.user?.linkedAccounts?.some(
      (account: any) => account.type === 'wallet' && account.chainType === 'ethereum' && account.walletClientType !== 'privy'
    );
    if (!hasExternalEthWallet) return;

    const currentPrivyAddress = privy.user?.wallet?.address?.toLowerCase();
    const currentWagmiAddress = wagmiAddress?.toLowerCase();

    if (!prevAddress) {
      setPrevAddress(currentWagmiAddress || null);
      return;
    }

    if (currentWagmiAddress && currentPrivyAddress && currentWagmiAddress !== currentPrivyAddress) {
      toast.info("Wallet changed", {
        description: "Reconnecting with the new wallet..."
      });
      privy.logout().then(() => {
        setPrevAddress(null);
      });
    }
  }, [wagmiAddress, privy.authenticated, privy.user?.wallet?.address, authStabilized, prevAddress, privy]);

  // Handle disconnect from wagmi side (EVM users only)
  useEffect(() => {
    if (!authStabilized) return;
    const hasExternalEthWallet = privy.user?.linkedAccounts?.some(
      (account: any) => account.type === 'wallet' && account.chainType === 'ethereum' && account.walletClientType !== 'privy'
    );
    if (!hasExternalEthWallet) return;
    if (privy.authenticated && prevAddress && !wagmiConnected) {
      privy.logout().then(() => {
        setPrevAddress(null);
      });
    }
  }, [wagmiConnected, privy.authenticated, prevAddress, authStabilized, privy]);

  // Build a stable user object that ALWAYS has an address
  const userWithAddress = useMemo(() => {
    if (!privy.user) return privy.user;

    // 1. Check for Solana wallet (prioritized for Hive)
    const solanaWallet = privy.user.linkedAccounts?.find(
      (account: any) => account.type === 'wallet' && account.chainType === 'solana'
    ) as any;

    if (solanaWallet?.address) {
      return {
        ...privy.user,
        wallet: {
          address: solanaWallet.address,
          chainType: 'solana' as const,
          chainId: 'mainnet',
          walletClientType: solanaWallet.walletClientType || 'unknown',
        },
      };
    }

    // 2. Check for Ethereum wallet (backward compat)
    const ethWalletAddress = privy.user.wallet?.address;
    if (ethWalletAddress) return privy.user;

    // 3. For email/Google users without a wallet, use Privy user ID
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

  return {
    ...privy,
    user: userWithAddress,
  };
}
