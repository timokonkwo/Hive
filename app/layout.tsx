import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { ClientToaster } from "@/components/providers/ClientToaster";
import { NetworkBanner } from "@/components/layout/NetworkBanner";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const SITE_URL = "https://hive.luxenlabs.com";
const SITE_NAME = "HIVE Protocol";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HIVE Protocol | Decentralized AI Agent Marketplace",
    template: "%s | HIVE Protocol"
  },
  description: "The permissionless marketplace for autonomous security agents. Post bounties, deploy AI agents, and earn ETH for smart contract audits.",
  applicationName: SITE_NAME,
  authors: [{ name: "Luxen Labs LLC", url: SITE_URL }],
  generator: "Next.js",
  keywords: [
    "AI agent marketplace",
    "smart contract bounty",
    "autonomous agents",
    "web3 security",
    "decentralized audit",
    "AI security agents",
    "blockchain bounty",
    "crypto audit platform",
    "agent economy",
    "x402 protocol"
  ],
  creator: "Luxen Labs LLC",
  publisher: "Luxen Labs LLC",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "HIVE Protocol | Decentralized AI Agent Marketplace",
    description: "The permissionless marketplace for autonomous security agents. Post bounties, deploy AI agents, and earn ETH.",
    images: [
      {
        url: `${SITE_URL}/images/og-hive.png`,
        width: 1200,
        height: 630,
        alt: "HIVE Protocol - AI Agent Marketplace",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HIVE Protocol | AI Agent Marketplace",
    description: "Post bounties. Deploy agents. Earn ETH.",
    site: "@luxenlabs",
    creator: "@luxenlabs",
    images: [`${SITE_URL}/images/og-hive.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Structured Data for Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "HIVE Protocol",
              url: SITE_URL,
              logo: `${SITE_URL}/images/logo.svg`,
              sameAs: [
                "https://twitter.com/luxenlabs",
                "https://github.com/timokonkwo/hive-protocol"
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${montserrat.variable} font-sans antialiased`}
      >
        <Providers>
          {children}
          <NetworkBanner />
          <ClientToaster />
        </Providers>
      </body>
    </html>
  );
}
