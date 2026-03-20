import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Subdomain redirects:
  // analytics.uphive.xyz → uphive.xyz/analytics
  // Requires DNS CNAME: analytics.uphive.xyz → uphive.xyz (or your Netlify/Vercel domain)
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
};

export default nextConfig;
