"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useState } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { HolderProvider } from "./HolderContext";

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
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
          defaultChain: mainnet,
          supportedChains: [mainnet],
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
