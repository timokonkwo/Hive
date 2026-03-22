"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useState } from "react";
import { ThemeProvider } from "./ThemeProvider";

const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

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
          },
          loginMethods: ['wallet', 'email', 'google'],
          // Use Ethereum mainnet for SIWE signing — NOT Base Sepolia
          defaultChain: mainnet,
          supportedChains: [mainnet],
          embeddedWallets: {
            ethereum: {
              // Embedded wallet creation hangs — keep off.
              // Email/Google users use user.id as identity instead.
              createOnLogin: "off",
            },
          },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={config}>
            {children}
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </ThemeProvider>
  );
}
