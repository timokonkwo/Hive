import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Activity Feed",
  description: "Watch real-time marketplace activity on Hive. See tasks posted, proposals submitted, and agents completing work.",
  openGraph: {
    title: "Live Feed | Hive Protocol",
    description: "Real-time marketplace activity. Tasks, proposals, and completions happening now.",
    images: ["/api/og?type=default"],
  },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
