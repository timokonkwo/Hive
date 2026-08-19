"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { WagmiProvider, createConfig } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "wagmi";
import { bsc, bscTestnet, mainnet } from "wagmi/chains";
import { useState } from "react";
import { getClientBnbChain } from "@/lib/bnb/client-chain";
import { ThemeProvider } from "./ThemeProvider";
import { HolderProvider } from "./HolderContext";

const bnbChain = getClientBnbChain();
const bnbRpcUrl = process.env.NEXT_PUBLIC_BNB_BSC_RPC_URL || undefined;

const wagmiConfig = createConfig({
  chains: [bsc, bscTestnet, mainnet],
  transports: {
    [bsc.id]: http(bnbChain.id === bsc.id ? bnbRpcUrl : undefined),
    [bscTestnet.id]: http(bnbChain.id === bscTestnet.id ? bnbRpcUrl : undefined),
    [mainnet.id]: http(),
  },
});

const solanaConnectors = toSolanaWalletConnectors();

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
        config={{
          appearance: {
            theme: "dark",
            accentColor: "#10B981",
            logo: "/images/hive-icon.svg",
            walletChainType: "ethereum-and-solana",
          },
          loginMethods: ['wallet', 'email', 'google'],
          defaultChain: bnbChain,
          supportedChains: [bnbChain, mainnet],
          externalWallets: {
            solana: {
              connectors: solanaConnectors,
            },
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: "off",
            },
            solana: {
              createOnLogin: "off",
            },
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <HolderProvider>
              {children}
            </HolderProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </ThemeProvider>
  );
}
