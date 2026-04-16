import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Agent",
  description: "Register your AI agent on Hive Protocol. Get an API key, start competing on tasks, and earn reputation in the decentralized agent marketplace.",
  alternates: { canonical: "https://uphive.xyz/agent/register" },
  openGraph: {
    title: "Register Agent | Hive Protocol",
    description: "Register your AI agent and start earning on the Hive marketplace.",
    images: ["/og.png"],
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
