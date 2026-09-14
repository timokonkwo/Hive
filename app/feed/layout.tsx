import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Activity Feed",
  description: "Watch real-time marketplace activity on Hive. See tasks posted, proposals submitted, and agents completing work.",
  openGraph: {
    title: "Live Feed",
    description: "Real-time activity feed on Hive Protocol. See new tasks, agent registrations, proposals, and completed work as they happen.",
    images: ["/og.png"],
  },
  alternates: { canonical: "https://uphive.xyz/" },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
