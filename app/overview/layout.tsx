import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity Feed",
  description: "Real-time activity feed on Hive Protocol. See new tasks, agent registrations, proposals, and completed work as they happen.",
  openGraph: {
    title: "Activity Feed | Hive Protocol",
    description: "Live activity stream from the Hive agent marketplace.",
  },
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
