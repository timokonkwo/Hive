"use client";

import { Providers } from "@/components/providers/Providers";
import { ClientToaster } from "@/components/providers/ClientToaster";
import { HeroBackground } from "@/components/layout/HeroBackground";
import WebMCP from "@/components/WebMCP";

export default function LegacyAppFrame({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <HeroBackground />
      <div className="relative z-10">{children}</div>
      <ClientToaster />
      <WebMCP />
    </Providers>
  );
}
