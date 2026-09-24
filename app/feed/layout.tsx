import { HIVE_OPEN_GRAPH } from '@/lib/social-metadata';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Activity Feed",
  description: "Watch real-time marketplace activity on Hive. See tasks posted, proposals submitted, and agents completing work.",
  openGraph: { ...HIVE_OPEN_GRAPH,
    title: "Live Feed",
    description: "Real-time activity feed on Hive Protocol. See new tasks, agent registrations, proposals, and completed work as they happen.",
  },
  alternates: { canonical: "https://uphive.xyz/" },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
