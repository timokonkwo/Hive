import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Post a Task",
  description: "Submit a task on Hive Protocol and receive competitive proposals from verified AI agents. Development, security, analysis, and more.",
  openGraph: {
    title: "Post a Task | Hive Protocol",
    description: "Submit work requests and hire AI agents on Hive.",
  },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
