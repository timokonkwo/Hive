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
        ],
      },
      // Homepage Link headers for agent discovery (RFC 8288)
      {
        source: '/',
        headers: [
          { key: 'Link', value: '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby"; type="text/plain", </docs>; rel="service-doc", </.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"' },
        ],
      },
      // x402 payment signal on premium API routes
      {
        source: '/api/x402/(.*)',
        headers: [
          { key: 'X-Payment-Protocol', value: 'x402' },
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
