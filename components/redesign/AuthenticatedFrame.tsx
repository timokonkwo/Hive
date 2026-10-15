"use client";
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { robinhoodChain } from '@/lib/robinhood-chain';
import { AdminAccessProvider } from './AdminAccess';
import { useState } from 'react';
import { useHiveTheme } from './theme';
const config = createConfig({ chains: [robinhoodChain, mainnet], transports: { [robinhoodChain.id]: http(), [mainnet.id]: http() } });
const connectors = toSolanaWalletConnectors();
/** Existing authentication contract without legacy presentation or unrelated balance requests. */
export default function AuthenticatedFrame({ children }: { children: React.ReactNode }) {
  const [query] = useState(() => new QueryClient());
  const { theme } = useHiveTheme();
  return <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''} clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined} config={{
    appearance: { theme, accentColor: theme === 'dark' ? '#ccff00' : '#4a6200', logo: '/brand/hive-icon.svg', walletChainType: 'ethereum-and-solana', showWalletLoginFirst: true, walletList: ['metamask', 'coinbase_wallet', 'rainbow', 'wallet_connect', 'phantom', 'solflare', 'detected_wallets'] },
    loginMethods: ['wallet', 'email', 'google'], defaultChain: robinhoodChain, supportedChains: [robinhoodChain, mainnet],
    externalWallets: { solana: { connectors } }, embeddedWallets: { ethereum: { createOnLogin: 'off' }, solana: { createOnLogin: 'off' } },
  }}><QueryClientProvider client={query}><WagmiProvider config={config}><AdminAccessProvider>{children}</AdminAccessProvider></WagmiProvider></QueryClientProvider></PrivyProvider>;
}
