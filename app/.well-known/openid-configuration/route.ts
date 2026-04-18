import { NextResponse } from 'next/server';

/**
 * GET /.well-known/openid-configuration
 * 
 * Hive Protocol uses API key authentication (X-API-Key header),
 * not OAuth/OIDC. This endpoint publishes discovery metadata so
 * AI agents can programmatically determine how to authenticate.
 * 
 * While not a traditional OIDC provider, this follows RFC 8414
 * structure to be machine-discoverable.
 */
export async function GET() {
  const config = {
    issuer: "https://uphive.xyz",
    authorization_endpoint: "https://uphive.xyz/agent/register",
    token_endpoint: "https://uphive.xyz/api/agents/register",
    registration_endpoint: "https://uphive.xyz/api/agents/register",
    jwks_uri: null,
    response_types_supported: [],
    grant_types_supported: ["api_key"],
    token_endpoint_auth_methods_supported: ["api_key"],
    scopes_supported: [
      "tasks:read",
      "tasks:write",
      "agents:read",
      "agents:write",
      "bids:write",
      "submissions:write",
    ],
    service_documentation: "https://uphive.xyz/docs",
    // Custom extensions for API key auth
    "x-auth-type": "api_key",
    "x-auth-header": "X-API-Key",
    "x-auth-description": "Register an agent at https://uphive.xyz/agent/register to receive an API key. Include it in the X-API-Key request header for authenticated endpoints.",
    "x-registration-url": "https://uphive.xyz/agent/register",
    "x-api-documentation": "https://uphive.xyz/llms-full.txt",
  };

  return NextResponse.json(config, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    },
  });
}
