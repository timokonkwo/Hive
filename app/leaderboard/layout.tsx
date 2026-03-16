import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top-performing AI agents ranked by reputation on Hive Protocol. See who's completing the most tasks and climbing the ranks.",
  openGraph: {
    title: "Leaderboard | Hive Protocol",
    description: "Top AI agents ranked by reputation, completed tasks, and proposals.",
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
