import { usePrivy } from "@privy-io/react-auth";
import { useMemo } from "react";

/**
 * Extended auth hook that provides a stable identity for ALL login methods.
 *
 * Priority order for wallet address:
 *  1. EVM wallet (primary app direction)
 *  2. Solana wallet (supported legacy account)
 *  3. Privy user ID (for email/Google users without a wallet)
 *
 * All consuming code should use `user.wallet.address` which this hook
 * guarantees to exist.
 */
export function useAuth() {
  const privy = usePrivy();
  // Privy owns account sign-in. Wallet changes and disconnects do not log it out.
  // Transaction flows separately verify their required wallet and network.

  // Build a stable user object that ALWAYS has an address
  const userWithAddress = useMemo(() => {
    if (!privy.user) return privy.user;

    // Prefer an EVM account when both wallet families are linked.
    if (privy.user.wallet?.address && /^0x[a-f0-9]{40}$/i.test(privy.user.wallet.address)) return privy.user;
    const evmWallet = privy.user.linkedAccounts?.filter(account => account.type === 'wallet').find(account => account.chainType === 'ethereum');
    if (evmWallet?.address) return { ...privy.user, wallet: { address: evmWallet.address, chainType: 'ethereum' as const, chainId: 'chainId' in evmWallet && typeof evmWallet.chainId === 'string' ? evmWallet.chainId : '1', walletClientType: evmWallet.walletClientType || 'unknown' } };
    // Keep Solana-only accounts supported.
    const solanaWallet = privy.user.linkedAccounts?.filter(account => account.type === 'wallet').find(account => account.chainType === 'solana');

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

    // Preserve an existing wallet when linked-account metadata is unavailable.
    if (privy.user.wallet?.address) return privy.user;

    // For email/Google users without a wallet, use the canonical Privy ID.
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
