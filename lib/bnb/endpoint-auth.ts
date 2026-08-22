type EndpointAuthConfig = Record<string, Record<string, string>>;

const FORBIDDEN_HEADER_NAMES = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "cookie",
  "host",
  "origin",
  "referer",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-dest",
  "transfer-encoding",
]);

export function endpointAuthHeaders(endpoint: string) {
  const match = endpointAuthEntry(endpoint);
  if (!match) return {};

  return Object.fromEntries(
    Object.entries(match.headers)
      .filter(([key, value]) => isAllowedHeader(key) && typeof value === "string" && value.trim())
      .map(([key, value]) => [key, value.trim()]),
  );
}

export function hasEndpointAuthHeaders(endpoint: string) {
  return Object.keys(endpointAuthHeaders(endpoint)).length > 0;
}

function endpointAuthEntry(endpoint: string) {
  const config = endpointAuthConfig();
  const entries = Object.entries(config).sort((a, b) => b[0].length - a[0].length);

  for (const [scope, headers] of entries) {
    if (scopeMatchesEndpoint(scope, endpoint)) return { scope, headers };
  }

  return null;
}

function endpointAuthConfig(): EndpointAuthConfig {
  const raw = process.env.BNB_AGENT_ENDPOINT_AUTH_JSON?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([scope, value]) => [scope, headerRecord(value)] as const)
        .filter(([, headers]) => Object.keys(headers).length > 0),
    );
  } catch {
    return {};
  }
}

function headerRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => isAllowedHeader(key) && typeof item === "string" && item.trim())
      .map(([key, item]) => [key, String(item).trim()]),
  );
}

function scopeMatchesEndpoint(scope: string, endpoint: string) {
  const normalizedScope = scope.trim();
  if (!normalizedScope) return false;

  try {
    const endpointUrl = new URL(endpoint);
    const scopeUrl = normalizedScope.includes("://")
      ? new URL(normalizedScope)
      : null;

    if (scopeUrl) {
      if (scopeUrl.protocol !== "https:" || endpointUrl.protocol !== "https:") return false;
      if (scopeUrl.hostname.toLowerCase() !== endpointUrl.hostname.toLowerCase()) return false;
      const scopePath = scopeUrl.pathname.replace(/\/$/, "");
      if (!scopePath) return true;
      return endpointUrl.pathname === scopeUrl.pathname || endpointUrl.pathname.startsWith(`${scopePath}/`);
    }

    return endpointUrl.hostname.toLowerCase() === normalizedScope.toLowerCase();
  } catch {
    return false;
  }
}

function isAllowedHeader(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized || FORBIDDEN_HEADER_NAMES.has(normalized)) return false;
  return /^[a-z0-9!#$%&'*+.^_`|~-]+$/.test(normalized);
}
