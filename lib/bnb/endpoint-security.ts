import { lookup } from "node:dns/promises";
import net from "node:net";

export type SafeFetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;

export function validatePublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return { ok: false as const, reason: "Endpoint must use HTTPS." };
    if (url.username || url.password) return { ok: false as const, reason: "Endpoint URL must not include credentials." };
    const hostname = url.hostname.toLowerCase();
    if (!hostname || isInternalHostname(hostname)) {
      return { ok: false as const, reason: "Endpoint host is not public." };
    }
    if (isPrivateAddress(hostname)) {
      return { ok: false as const, reason: "Endpoint resolves to a private address." };
    }
    return { ok: true as const, url };
  } catch {
    return { ok: false as const, reason: "Endpoint URL is invalid." };
  }
}

export async function assertPublicHttpsUrl(value: string) {
  const checked = validatePublicHttpsUrl(value);
  if (!checked.ok) throw new Error(checked.reason);

  const records = await lookup(checked.url.hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error("Endpoint host could not be resolved.");
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Endpoint resolves to a private address.");
  }

  return checked.url;
}

export async function safeFetchJson(endpoint: string, options: SafeFetchOptions = {}) {
  const url = await assertPublicHttpsUrl(endpoint);
  return safeFetchJsonUrl(url, options, {
    redirectCount: 0,
    originalOrigin: url.origin,
    originalPathPrefix: normalizedPathPrefix(url.pathname),
  });
}

async function safeFetchJsonUrl(
  url: URL,
  options: SafeFetchOptions,
  context: {
    redirectCount: number;
    originalOrigin: string;
    originalPathPrefix: string;
  },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: requestHeaders(options, canForwardConfiguredHeaders(url, context)),
      body: options.body,
      redirect: "manual",
      signal: controller.signal,
    });

    if (isRedirect(response)) {
      const location = response.headers.get("location") || "";
      response.body?.cancel().catch(() => undefined);
      if (!location) throw new Error("Endpoint redirect did not include a target.");
      if (context.redirectCount >= MAX_REDIRECTS) throw new Error("Endpoint redirected too many times.");

      const nextUrl = await assertPublicHttpsUrl(new URL(location, url).href);
      return safeFetchJsonUrl(
        nextUrl,
        redirectedOptions(response.status, options),
        {
          ...context,
          redirectCount: context.redirectCount + 1,
        },
      );
    }

    const text = await readResponseText(response, options.maxBytes || DEFAULT_MAX_BYTES);
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    return { response, payload };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Endpoint timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requestHeaders(options: SafeFetchOptions, includeConfiguredHeaders: boolean) {
  return {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(includeConfiguredHeaders ? options.headers || {} : {}),
  };
}

function canForwardConfiguredHeaders(
  url: URL,
  context: {
    originalOrigin: string;
    originalPathPrefix: string;
  },
) {
  if (url.origin !== context.originalOrigin) return false;
  const prefix = context.originalPathPrefix;
  if (!prefix || prefix === "/") return true;
  return url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
}

function normalizedPathPrefix(pathname: string) {
  const prefix = pathname.replace(/\/+$/, "");
  return prefix || "/";
}

function isRedirect(response: Response) {
  return response.status >= 300 && response.status < 400;
}

function redirectedOptions(status: number, options: SafeFetchOptions): SafeFetchOptions {
  if (status === 303 || (options.method === "POST" && (status === 301 || status === 302))) {
    return {
      ...options,
      method: "GET",
      body: undefined,
    };
  }

  return options;
}

async function readResponseText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch(() => undefined);
      throw new Error("Endpoint response is too large.");
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(concat(chunks, size));
}

function concat(chunks: Uint8Array[], size: number) {
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function isPrivateAddress(value: string) {
  const ipVersion = net.isIP(value);
  if (ipVersion === 4) return isPrivateIpv4(value);
  if (ipVersion === 6) return isPrivateIpv6(value);
  return false;
}

function isInternalHostname(value: string) {
  const hostname = value.replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
  return (
    hostname === "localhost" ||
    hostname === "ip6-localhost" ||
    hostname === "ip6-loopback" ||
    hostname === "metadata.google.internal" ||
    hostname === "metadata.goog" ||
    hostname === "instance-data" ||
    hostname === "kubernetes.default.svc" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home.arpa") ||
    hostname.endsWith(".svc") ||
    hostname.endsWith(".cluster.local")
  );
}

function isPrivateIpv4(value: string) {
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPrivateIpv6(value: string) {
  const normalized = value.toLowerCase();
  const mappedIpv4 = ipv4FromMappedIpv6(normalized);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]:/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

function ipv4FromMappedIpv6(value: string) {
  const dotted = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];

  const hex = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return "";

  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return "";

  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255,
  ].join(".");
}
