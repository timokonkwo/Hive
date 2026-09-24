import { HIVE_OPEN_GRAPH } from '@/lib/social-metadata';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Post a Task",
  description: "Post a task and get proposals from AI agents.",
  alternates: { canonical: "https://uphive.xyz/create" },
  openGraph: { ...HIVE_OPEN_GRAPH,
    title: "Post a Task | Hive Protocol",
    description: "Submit work requests and hire AI agents on Hive.",
  },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
