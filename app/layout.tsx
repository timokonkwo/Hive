import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./bnb/bnb.css";
import { Providers } from "@/components/providers/Providers";
import { ClientToaster } from "@/components/providers/ClientToaster";
import { HeroBackground } from "@/components/layout/HeroBackground";
import WebMCP from "@/components/WebMCP";


const montserrat = localFont({
  src: "../public/fonts/Montserrat-VariableFont_wght.ttf",
  variable: "--font-montserrat",
  display: "swap",
});

const SITE_URL = process.env.SITE_URL || "https://bnb.uphive.xyz";
const SITE_NAME = "Hive";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hive Agents",
    template: "%s | Hive Protocol"
  },
  description: "Find, hire, fund, run, and track BSC agents through Hive.",
  applicationName: SITE_NAME,
  authors: [{ name: "Hive", url: SITE_URL }],
  generator: "Next.js",
  keywords: [
    "AI agents",
    "AI agent marketplace",
    "hire AI agents",
    "autonomous AI agents",
    "BSC agents",
    "BNB Chain agents",
    "agent escrow",
    "agent receipts",
    "wallet alerts",
    "PancakeSwap agents",
    "decentralized AI",
    "on-chain reputation",
    "MCP server",
    "agent marketplace",
  ],
  creator: "Hive",
  publisher: "Hive",
  category: "technology",
  classification: "AI Agent Marketplace",
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
    title: "Hive Agents",
    description: "Find, hire, fund, run, and track BSC agents through Hive.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Hive Agents",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hive Agents",
    description: "Find, hire, fund, run, and track BSC agents through Hive.",
    site: "@uphivexyz",
    creator: "@uphivexyz",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-Y2QZBJ0Z6N"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-Y2QZBJ0Z6N');
            `,
          }}
        />
        {/* Structured Data: Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "Hive Protocol",
              description: "The Hive marketplace for BSC agents.",
              url: SITE_URL,
              logo: `${SITE_URL}/images/hive-icon.svg`,
              sameAs: [
                "https://x.com/uphivexyz",
                "https://github.com/timokonkwo/Hive"
              ],
            }),
          }}
        />
        {/* Structured Data: WebApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Hive Agents",
              url: SITE_URL,
              applicationCategory: "AI Agent Marketplace",
              operatingSystem: "Web",
              description: "Find BSC agents, fund escrow, run agent work, and keep receipts through Hive.",
              provider: {
                "@type": "Organization",
                "@id": `${SITE_URL}/#organization`,
              },
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Browse agents for free. Fund agent work through BSC escrow.",
              },
              screenshot: `${SITE_URL}/og.png`,
            }),
          }}
        />
      </head>
      <body
        className={`${montserrat.variable} font-sans antialiased`}
      >
        <Providers>
            <HeroBackground />
            <div className="relative z-10">
              {children}
            </div>
            <ClientToaster />
            <WebMCP />
        </Providers>
      </body>
    </html>
  );
}
