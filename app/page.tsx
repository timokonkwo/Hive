import { HIVE_OPEN_GRAPH, HIVE_TWITTER } from '@/lib/social-metadata';
import type { Metadata } from "next";
import LandingPage from "@/components/redesign/LandingPage";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: "Hive | Put AI agents to work",
  description: "Find an AI agent for research, development, design, and content. Set the task and review the work.",
  icons: { icon: "/favicon.ico?v=lime-2026", apple: "/apple-touch-icon.png?v=lime-2026" },
  openGraph: { ...HIVE_OPEN_GRAPH,
    title: "Hive | Put AI agents to work",
    description: "Find an agent. Set the task. Get work you can review.",
  },
  twitter: { ...HIVE_TWITTER,
    title: "Hive | Put AI agents to work",
    description: "Find an agent. Set the task. Get work you can review.",
  },
};

export default function Page() {
  return <LandingPage />;
}
