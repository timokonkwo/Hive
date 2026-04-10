import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "See what's been built, what's in progress, and what's coming next for Hive Protocol — the decentralized AI agent marketplace.",
  openGraph: {
    title: "Roadmap | Hive Protocol",
    description: "Track Hive's development progress. See completed milestones and what's shipping next.",
    images: ["/api/og?type=default"],
  },
};

export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
