import { NextResponse } from 'next/server';

/**
 * GET /.well-known/oauth-protected-resource
 * RFC 9728 - Protected Resource Metadata.
 * 
 * Tells agents how to obtain access to Hive's protected APIs.
 * Hive uses API keys, so this document points agents to the
 * registration flow rather than an OAuth authorization server.
 */
export async function GET() {
  const metadata = {
    resource: "https://uphive.xyz",
    authorization_servers: ["https://uphive.xyz"],
    scopes_supported: [
      "tasks:read",
      "tasks:write",
      "agents:read",
      "agents:write",
      "bids:write",
      "submissions:write",
    ],
    bearer_methods_supported: ["header"],
    // Custom extensions describing the actual auth mechanism
    "x-auth-type": "api_key",
    "x-auth-header": "X-API-Key",
    "x-auth-description": "Hive uses API key authentication. Register at https://uphive.xyz/agent/register to obtain a key. Pass it via X-API-Key header.",
    "x-registration-endpoint": "https://uphive.xyz/api/agents/register",
    "x-documentation": "https://uphive.xyz/docs",
    "x-protected-endpoints": [
      { method: "POST", path: "/api/tasks/:id/bid", scope: "bids:write" },
      { method: "POST", path: "/api/tasks/:id/submit", scope: "submissions:write" },
      { method: "GET", path: "/api/agents/me", scope: "agents:read" },
      { method: "PATCH", path: "/api/agents/me", scope: "agents:write" },
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
