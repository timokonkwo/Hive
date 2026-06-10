import { lookup } from 'dns/promises';
import { isIP } from 'net';

type ValidateOutboundUrlOptions = {
  purpose?: string;
  allowLocalhostInDevelopment?: boolean;
  blockOwnHostnames?: boolean;
};

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'kubernetes.default.svc',
]);

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');
}

function ownHostnames(): Set<string> {
  const hosts = new Set(['uphive.xyz', 'www.uphive.xyz']);
  for (const value of [process.env.SITE_URL, process.env.URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    if (!value) continue;
    try {
      hosts.add(normalizeHostname(new URL(value).hostname));
    } catch {
      // Ignore malformed deployment config; it should not weaken URL validation.
    }
  }
  return hosts;
}

function isBlockedHostname(hostname: string, blockOwnHostnames: boolean): boolean {
  const host = normalizeHostname(hostname);
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) return true;
  if (
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home.arpa') ||
    host.endsWith('.svc') ||
    host.endsWith('.cluster.local')
  ) return true;
  if (blockOwnHostnames && ownHostnames().has(host)) return true;
  return false;
}

function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b, c, d] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 ||
    (a === 255 && b === 255 && c === 255 && d === 255)
  );
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase();
  const mappedV4 = normalized.match(/(?:::ffff:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedV4) return isPrivateIPv4(mappedV4[1]);

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]:/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  );
}

export function isPrivateOrInternalAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return isPrivateIPv4(address);
  if (kind === 6) return isPrivateIPv6(address);
  return true;
}

export async function validateOutboundUrl(
  rawUrl: string,
  options: ValidateOutboundUrlOptions = {}
): Promise<URL> {
  const purpose = options.purpose || 'Outbound URL';
  const blockOwnHostnames = options.blockOwnHostnames !== false;
  const allowLocalhost =
    options.allowLocalhostInDevelopment === true &&
    process.env.NODE_ENV !== 'production';

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`${purpose} must be a valid URL.`);
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) {
    throw new Error(`${purpose} must include a hostname.`);
  }

  const localhostAllowed = allowLocalhost && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1');
  if (url.protocol !== 'https:' && !localhostAllowed) {
    throw new Error(`${purpose} must use HTTPS.`);
  }

  if (url.username || url.password) {
    throw new Error(`${purpose} must not include credentials.`);
  }

  if (!localhostAllowed && url.port && url.port !== '443') {
    throw new Error(`${purpose} must use the default HTTPS port.`);
  }

  if (localhostAllowed) return url;

  if (isBlockedHostname(hostname, blockOwnHostnames)) {
    throw new Error(`${purpose} targets an internal or disallowed hostname.`);
  }

  const ipKind = isIP(hostname);
  if (ipKind) {
    if (isPrivateOrInternalAddress(hostname)) {
      throw new Error(`${purpose} targets a private or internal IP address.`);
    }
    return url;
  }

  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`${purpose} hostname could not be resolved.`);
  }

  if (records.length === 0) {
    throw new Error(`${purpose} hostname could not be resolved.`);
  }

  if (records.some((record) => isPrivateOrInternalAddress(record.address))) {
    throw new Error(`${purpose} resolves to a private or internal IP address.`);
  }

  return url;
}
