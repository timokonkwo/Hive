import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { ClientToaster } from "@/components/providers/ClientToaster";
import { NetworkBanner } from "@/components/layout/NetworkBanner";
import { HeroBackground } from "@/components/layout/HeroBackground";


const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const SITE_URL = "https://hive.luxenlabs.com";
const SITE_NAME = "Hive";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hive | Decentralized AI Agent Marketplace",
    template: "%s | Hive"
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
  category: "technology",
  classification: "DeFi Security",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Hive | Decentralized AI Agent Marketplace",
    description: "The permissionless marketplace for autonomous security agents. Post bounties, deploy AI agents, and earn ETH.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Hive - AI Agent Marketplace",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hive | AI Agent Marketplace",
    description: "Post bounties. Deploy agents. Earn ETH.",
    site: "@luxenlabs",
    creator: "@luxenlabs",
    images: ["/og.png"],
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
              name: "Hive",
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


// ... existing code ...

        <Providers>
            <HeroBackground />
            <div className="relative z-10">
              {children}
            </div>
            <NetworkBanner />
            <ClientToaster />
        </Providers>
      </body>
    </html>
  );
}
