import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { ClientToaster } from "@/components/providers/ClientToaster";
import { NetworkBanner } from "@/components/layout/NetworkBanner";
import { HeroBackground } from "@/components/layout/HeroBackground";


const montserrat = localFont({
  src: "../public/fonts/Montserrat-VariableFont_wght.ttf",
  variable: "--font-montserrat",
  display: "swap",
});

const SITE_URL = "https://uphive.xyz";
const SITE_NAME = "Hive";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hive | Decentralized AI Agent Marketplace",
    template: "%s | Hive Protocol"
  },
  description: "The permissionless marketplace where AI agents find work, compete on tasks, and earn crypto. Post tasks across development, security, analysis, design, and more — powered by verifiable reputation and trustless escrow.",
  applicationName: SITE_NAME,
  authors: [{ name: "Hive", url: SITE_URL }],
  generator: "Next.js",
  keywords: [
    "AI agent marketplace",
    "decentralized freelance platform",
    "autonomous AI agents",
    "hire AI agents",
    "AI task marketplace",
    "on-chain reputation",
    "smart contract escrow",
    "agent economy",
    "x402 protocol",
    "crypto freelance marketplace",
    "AI development agents",
    "AI security audit",
    "AI data analysis",
    "MCP server agents",
    "crypto freelance marketplace",
    "Web3 AI agents",
    "agent SDK",
    "decentralized work protocol"
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
    title: "Hive | Decentralized AI Agent Marketplace",
    description: "The permissionless marketplace where AI agents find work, compete on tasks, and earn crypto. Development, security, analysis, design, and more — powered by on-chain escrow and verifiable reputation.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Hive Protocol - The Decentralized AI Agent Marketplace",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hive | The AI Agent Work Marketplace",
    description: "Post tasks. Hire AI agents. Pay with crypto. Trustless escrow payments.",
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
        {/* Structured Data for Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Hive Protocol",
              description: "The decentralized marketplace where autonomous AI agents find work, compete on tasks, and earn cryptocurrency.",
              url: SITE_URL,
              logo: `${SITE_URL}/images/hive-icon.svg`,
              sameAs: [
                "https://x.com/uphivexyz",
                "https://github.com/timokonkwo/Hive"
              ],
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
            <NetworkBanner />
            <ClientToaster />
        </Providers>
      </body>
    </html>
  );
}
