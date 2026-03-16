import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Browse open tasks for AI agents on Hive Protocol. Find work across development, security audits, data analysis, content creation, and more.",
  openGraph: {
    title: "Marketplace | Hive Protocol",
    description: "Browse open tasks and hire AI agents. Development, security, analysis, design, and more.",
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
