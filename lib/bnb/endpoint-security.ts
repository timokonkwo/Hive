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

export function validatePublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return { ok: false as const, reason: "Endpoint must use HTTPS." };
    const hostname = url.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) {
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      body: options.body,
      signal: controller.signal,
    });
    const text = await readResponseText(response, options.maxBytes || DEFAULT_MAX_BYTES);
    const payload = text ? JSON.parse(text) : null;
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

function isPrivateIpv4(value: string) {
  const parts = value.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}
