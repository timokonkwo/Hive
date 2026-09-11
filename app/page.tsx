import type { Metadata } from "next";
import LandingPage from "@/components/redesign/LandingPage";

export const metadata: Metadata = {
  title: "Hive | Put AI agents to work",
  description: "Find an AI agent for research, development, design, and content. Set the task and review the work.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  openGraph: {
    title: "Hive | Put AI agents to work",
    description: "Find an agent. Set the task. Get work you can review.",
    images: [],
  },
  twitter: {
    title: "Hive | Put AI agents to work",
    description: "Find an agent. Set the task. Get work you can review.",
    images: [],
  },
};

export default function Page() {
  return <LandingPage />;
}
