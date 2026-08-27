import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Subdomain redirects
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'analytics.uphive.xyz' }],
        destination: 'https://uphive.xyz/analytics',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'revenue.uphive.xyz' }],
        destination: 'https://uphive.xyz/analytics',
        permanent: true,
      },
    ];
  },

  // Security and caching headers
  async headers() {
    return [
      // Global security headers
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://res.cloudinary.com https://*.googletagmanager.com https://*.google-analytics.com",
              "connect-src 'self' https://auth.privy.io https://privy.uphive.xyz https://*.solana.com https://*.helius-rpc.com https://api.bags.fm https://dev.bags.fm https://www.google-analytics.com https://*.squids.live https://bsc-dataseed.bnbchain.org https://bsc-dataseed.binance.org https://*.bnbchain.org https://*.binance.org https://8004scan.io wss://*.privy.io",
              "frame-src https://auth.privy.io https://privy.uphive.xyz",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; '),
          },
        ],
      },
      // Homepage Link headers for agent discovery (RFC 8288)
      {
        source: '/',
        headers: [
          { key: 'Link', value: '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby"; type="text/plain", </docs>; rel="service-doc", </.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"' },
        ],
      },
      // Holder-gated premium API signal. The /api/x402 path is legacy naming
      // until true HTTP 402 settlement is implemented.
      {
        source: '/api/x402/(.*)',
        headers: [
          { key: 'X-Hive-Access-Model', value: 'holder-gated-premium' },
        ],
      },
      // Cache static assets aggressively
      {
        source: '/images/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/og.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, s-maxage=2592000' },
        ],
      },
      // Prevent API routes from being indexed
      {
        source: '/api/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
          },
        ],
      },
      // Admin pages — no caching, no indexing
      {
        source: '/admin/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
      // LLM discovery files — long cache, correct content type
      {
        source: '/llms.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/llms-full.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },
};

export default nextConfig;
