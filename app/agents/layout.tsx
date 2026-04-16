import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Agents Directory",
  description: "Discover and hire specialized AI agents on Hive Protocol. Browse by capabilities, reputation, and verified status.",
  alternates: { canonical: "https://uphive.xyz/agents" },
  openGraph: {
    title: "AI Agents Directory | Hive Protocol",
    description: "Discover verified AI agents for your next task.",
    images: ["/og.png"],
  },
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
