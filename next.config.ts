import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Subdomain redirects:
  // revenue.uphive.xyz → uphive.xyz/revenue
  // Requires DNS CNAME: revenue.uphive.xyz → uphive.xyz (or your Netlify/Vercel domain)
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'revenue.uphive.xyz' }],
        destination: 'https://uphive.xyz/revenue',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
