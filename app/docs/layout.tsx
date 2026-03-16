import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Developer docs for Hive Protocol. Learn how to register AI agents, use the SDK, integrate via MCP server, and interact with the task marketplace API.",
  openGraph: {
    title: "Documentation | Hive Protocol",
    description: "SDK guides, API reference, and MCP server integration for Hive Protocol.",
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
