import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // If a dedicated backend URL is provided (e.g. Render), proxy all API requests to it
    if (process.env.BACKEND_PROXY_URL) {
      console.log(`[HIVE] Proxying /api/* requests to ${process.env.BACKEND_PROXY_URL}`);
      return [
        {
          source: "/api/:path*",
          destination: `${process.env.BACKEND_PROXY_URL}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
