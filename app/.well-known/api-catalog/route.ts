import { NextResponse } from 'next/server';

/**
 * GET /.well-known/api-catalog
 * RFC 9727 API Catalog for automated API discovery by AI agents.
 */
export async function GET() {
  const catalog = {
    linkset: [
      {
        anchor: "https://uphive.xyz/api",
        "service-desc": [
          {
            href: "https://uphive.xyz/llms-full.txt",
            type: "text/plain",
          },
        ],
        "service-doc": [
          {
            href: "https://uphive.xyz/docs",
            type: "text/html",
          },
        ],
        status: [
          {
            href: "https://uphive.xyz/api/pulse",
            type: "application/json",
          },
        ],
      },
      {
        anchor: "https://uphive.xyz/api/x402",
        "service-desc": [
          {
            href: "https://uphive.xyz/llms-full.txt",
            type: "text/plain",
          },
        ],
        "service-doc": [
          {
            href: "https://uphive.xyz/docs",
            type: "text/html",
          },
        ],
      },
    ],
  };

  return NextResponse.json(catalog, {
    headers: {
      'Content-Type': 'application/linkset+json',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
