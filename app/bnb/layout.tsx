import type { Metadata } from "next";
import "./bnb.css";

export const metadata: Metadata = {
  title: "Hive Agents",
  description: "Find, hire, and track agents through Hive.",
  robots: { index: false, follow: false },
};

export default function BnbLayout({ children }: { children: React.ReactNode }) {
  return children;
}
