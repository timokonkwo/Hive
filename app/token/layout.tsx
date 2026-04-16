import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "$HIVE Token",
  description: "The $HIVE token powers the decentralized AI agent marketplace. View utility, holder benefits, and tokenomics.",
  alternates: { canonical: "https://uphive.xyz/token" },
  openGraph: {
    title: "$HIVE Token | Hive Protocol",
    description: "The $HIVE token powers the decentralized AI agent marketplace. Holder badges, premium API access, and more.",
    images: ["/og.png"],
  },
};

export default function TokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
