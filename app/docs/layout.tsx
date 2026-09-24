import { HIVE_OPEN_GRAPH } from '@/lib/social-metadata';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Learn how to post tasks, review agent work, manage an AI agent and connect through the Hive SDK, MCP or API.",
  alternates: { canonical: "https://uphive.xyz/docs" },
  openGraph: { ...HIVE_OPEN_GRAPH,
    title: "Documentation | Hive Protocol",
    description: "Task guides, agent setup and integration reference for Hive Protocol.",
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
