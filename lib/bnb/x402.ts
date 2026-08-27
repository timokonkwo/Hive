import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getBscChainId } from "@/lib/bnb/chain";
import type {
  BnbPaymentRequest,
  BnbX402PaymentHeaderCipher,
  BnbX402PaymentRequirement,
  BnbX402PaymentSnapshot,
} from "@/lib/bnb/types";

const X402_PAYMENT_HEADER_MAX_BYTES = 64 * 1024;
const BASE64_REGEX = /^[A-Za-z0-9+/_-]*={0,2}$/;
const X402_V1_PAYMENT_HEADER = "X-PAYMENT";
const X402_V1_RESPONSE_HEADER = "X-PAYMENT-RESPONSE";
const X402_V2_PAYMENT_HEADER = "PAYMENT-SIGNATURE";
const X402_V2_RESPONSE_HEADER = "PAYMENT-RESPONSE";
const MAX_X402_AUTHORIZATION_SECONDS = 15 * 60;
const X402_CLOCK_SKEW_SECONDS = 30;

type X402Challenge = {
  x402Version: number;
  resource?: BnbX402PaymentSnapshot["resource"];
  accepts: BnbX402PaymentRequirement[];
  extensions?: Record<string, unknown>;
};

type BnbX402PaymentPayload = {
  x402Version: number;
  scheme?: string;
  network?: string;
  accepted?: Record<string, unknown>;
  payload?: unknown;
  [key: string]: unknown;
};

export type BnbX402VerifyResult = {
  paymentPayload: BnbX402PaymentPayload;
  payer: string;
  paymentHeaderHash: string;
};

export function isBnbX402Enabled() {
  return process.env.BNB_X402_ENABLED?.trim().toLowerCase() !== "false";
}

export function bnbX402PaymentHeaderName(x402Version: number) {
  return x402Version >= 2 ? X402_V2_PAYMENT_HEADER : X402_V1_PAYMENT_HEADER;
}

export function bnbX402PaymentHeaders(paymentHeader: string, x402Version: number) {
  return {
    [bnbX402PaymentHeaderName(x402Version)]: paymentHeader,
  };
}

export function bnbX402ResponseHeaderName(x402Version: number) {
  return x402Version >= 2 ? X402_V2_RESPONSE_HEADER : X402_V1_RESPONSE_HEADER;
}

export function isBnbX402SettlementConfigured() {
  return isBnbX402Enabled() && Boolean(paymentCipherSecret());
}

export function parseBnbX402Challenge(headers: Headers, payload: unknown) {
  const fromHeader = decodeBnbX402ChallengeHeader(headers.get("payment-required"));
  if (fromHeader) return fromHeader;
  return normalizeBnbX402Challenge(payload);
}

export function buildBnbX402PaymentRequest(snapshot: BnbX402PaymentSnapshot | undefined): BnbPaymentRequest {
  if (!snapshot?.selectedRequirement) {
    return {
      status: "not_ready",
      mode: "x402",
      reason: "Payment is not ready.",
    };
  }

  return {
    status: "ready",
    mode: "x402",
    x402Version: snapshot.x402Version,
    paymentRequirements: snapshot.paymentRequirements,
    selectedPaymentRequirement: snapshot.selectedRequirement,
    ...(snapshot.extensions ? { extensions: snapshot.extensions } : {}),
    amountLabel: formatBnbX402PaymentAmount(snapshot.selectedRequirement),
    network: snapshot.selectedRequirement.network,
    asset: snapshot.selectedRequirement.asset,
    payTo: snapshot.selectedRequirement.payTo,
    resource: snapshot.selectedRequirement.resource || snapshot.resource?.url || "",
  };
}

export function selectBnbX402PaymentRequirement(requirements: BnbX402PaymentRequirement[]) {
  const configuredNetwork = `eip155:${getBscChainId()}`;
  return requirements.find((requirement) => (
    requirement.scheme === "exact"
    && requirement.network === configuredNetwork
    && isEvmAddress(requirement.asset)
    && isEvmAddress(requirement.payTo)
    && isPositiveAtomicAmount(requirement.amount || requirement.maxAmountRequired)
    && requirement.maxTimeoutSeconds > 0
    && requirement.maxTimeoutSeconds <= MAX_X402_AUTHORIZATION_SECONDS
  ));
}

export function bnbX402NetworkChainId(network: string) {
  if (!isSupportedBnbX402Network(network)) return null;
  return Number(network.slice("eip155:".length));
}

export function decodeBnbX402PaymentHeader(paymentHeader: string): BnbX402PaymentPayload {
  const trimmed = paymentHeader.trim();
  if (!trimmed || trimmed.length > X402_PAYMENT_HEADER_MAX_BYTES || !BASE64_REGEX.test(trimmed)) {
    throw new BnbX402PaymentError("Payment confirmation is invalid.");
  }

  try {
    return normalizeBnbX402PaymentPayload(JSON.parse(decodeBase64(trimmed)));
  } catch {
    throw new BnbX402PaymentError("Payment confirmation is invalid.");
  }
}

export async function validateBnbX402PaymentHeader({
  paymentHeader,
  paymentRequirement,
  x402Version,
}: {
  paymentHeader: string;
  paymentRequirement: BnbX402PaymentRequirement;
  x402Version: number;
}): Promise<BnbX402VerifyResult> {
  const paymentPayload = decodeBnbX402PaymentHeader(paymentHeader);
  const payer = validateBnbX402PaymentPayload(paymentPayload, paymentRequirement, x402Version);
  return {
    paymentPayload,
    payer,
    paymentHeaderHash: hashPaymentHeader(paymentHeader),
  };
}

export function encryptBnbX402PaymentHeader(paymentHeader: string): BnbX402PaymentHeaderCipher {
  const key = paymentCipherKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(paymentHeader.trim(), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: "v1",
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    hash: hashPaymentHeader(paymentHeader),
    createdAt: new Date().toISOString(),
  };
}

export function decryptBnbX402PaymentHeader(ciphertext: BnbX402PaymentHeaderCipher | undefined) {
  if (!ciphertext) return "";
  if (ciphertext.version !== "v1" || ciphertext.algorithm !== "aes-256-gcm") {
    throw new BnbX402PaymentError("Payment confirmation is invalid.");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", paymentCipherKey(), Buffer.from(ciphertext.iv, "base64"));
    decipher.setAuthTag(Buffer.from(ciphertext.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    if (hashPaymentHeader(plaintext) !== ciphertext.hash) throw new Error("Payment header hash mismatch.");
    return plaintext;
  } catch {
    throw new BnbX402PaymentError("Payment confirmation is invalid.");
  }
}

export function hashPaymentHeader(paymentHeader: string) {
  return createHash("sha256").update(paymentHeader.trim()).digest("hex");
}

export function parseBnbX402SettlementHeader(header: string | null) {
  if (!header || header.length > X402_PAYMENT_HEADER_MAX_BYTES || !BASE64_REGEX.test(header)) return null;
  try {
    const decoded = JSON.parse(decodeBase64(header)) as Record<string, unknown>;
    return {
      success: decoded.success === true,
      transaction: readString(decoded.transaction),
      network: readString(decoded.network),
      payer: readString(decoded.payer),
    };
  } catch {
    return null;
  }
}

export function isBnbX402SettlementForPayment(
  settlement: ReturnType<typeof parseBnbX402SettlementHeader>,
  requirement: BnbX402PaymentRequirement | undefined,
  expectedPayer?: string,
) {
  if (!settlement?.success || !requirement) return false;
  if (settlement.network !== requirement.network) return false;
  if (!/^0x[a-fA-F0-9]{64}$/.test(settlement.transaction)) return false;
  if (settlement.payer && (!isEvmAddress(settlement.payer) || (expectedPayer && !sameIdentifier(settlement.payer, expectedPayer)))) return false;
  return true;
}

export function sanitizeBnbX402PaymentSnapshot(snapshot: BnbX402PaymentSnapshot | undefined): BnbX402PaymentSnapshot | undefined {
  if (!snapshot) return undefined;
  const { paymentHeader, ...safeSnapshot } = snapshot;
  return {
    ...safeSnapshot,
    paymentHeaderHash: safeSnapshot.paymentHeaderHash || paymentHeader?.hash,
  };
}

export class BnbX402PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BnbX402PaymentError";
  }
}

function decodeBnbX402ChallengeHeader(value: string | null) {
  if (!value || !BASE64_REGEX.test(value)) return null;
  try {
    return normalizeBnbX402Challenge(JSON.parse(decodeBase64(value)));
  } catch {
    return null;
  }
}

function normalizeBnbX402Challenge(value: unknown): X402Challenge | null {
  const record = asRecord(value);
  if (!record) return null;
  const resource = normalizeBnbX402Resource(record.resource);
  const accepts = Array.isArray(record.accepts)
    ? record.accepts
    : Array.isArray(record.paymentRequirements)
      ? record.paymentRequirements
      : [];
  const requirements = accepts
    .map((item) => normalizeBnbX402PaymentRequirement(item, resource))
    .filter((item): item is BnbX402PaymentRequirement => Boolean(item));
  if (requirements.length === 0) return null;

  const x402Version = typeof record.x402Version === "number" && Number.isFinite(record.x402Version)
    ? record.x402Version
    : 1;
  return {
    x402Version,
    ...(resource ? { resource } : {}),
    accepts: requirements,
    ...(asRecord(record.extensions) ? { extensions: asRecord(record.extensions) } : {}),
  };
}

function normalizeBnbX402Resource(value: unknown): BnbX402PaymentSnapshot["resource"] | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return compactObject({
    url: readString(record.url),
    description: readString(record.description),
    mimeType: readString(record.mimeType),
    serviceName: readString(record.serviceName || record.name),
  }) as BnbX402PaymentSnapshot["resource"];
}

function normalizeBnbX402PaymentRequirement(
  value: unknown,
  resource: BnbX402PaymentSnapshot["resource"] | undefined,
): BnbX402PaymentRequirement | null {
  const record = asRecord(value);
  if (!record) return null;
  const scheme = readString(record.scheme).toLowerCase();
  const network = readString(record.network || record.networkId);
  const amount = readIntegerString(record.amount);
  const maxAmountRequired = readIntegerString(record.maxAmountRequired) || amount;
  const payTo = readString(record.payTo || record.receiver || record.recipient);
  const asset = readString(record.asset || record.token);
  const timeout = readPositiveInteger(record.maxTimeoutSeconds, 300);
  if (scheme !== "exact" || !network || !payTo || !asset || !maxAmountRequired) return null;

  return compactObject({
    scheme: "exact",
    network,
    amount: amount || maxAmountRequired,
    maxAmountRequired,
    resource: readString(record.resource) || resource?.url || "",
    description: readString(record.description) || resource?.description || "",
    mimeType: readString(record.mimeType) || resource?.mimeType || "application/json",
    payTo,
    asset,
    maxTimeoutSeconds: timeout,
    outputSchema: asRecord(record.outputSchema),
    extra: asRecord(record.extra) || {},
  }) as BnbX402PaymentRequirement;
}

function normalizeBnbX402PaymentPayload(value: unknown): BnbX402PaymentPayload {
  const record = asRecord(value);
  if (!record) throw new Error("Invalid payment payload.");
  const version = typeof record.x402Version === "number" && Number.isFinite(record.x402Version)
    ? record.x402Version
    : 0;
  if (version <= 0) throw new Error("Invalid payment payload.");
  return record as BnbX402PaymentPayload;
}

function validateBnbX402PaymentPayload(
  paymentPayload: BnbX402PaymentPayload,
  requirement: BnbX402PaymentRequirement,
  expectedVersion: number,
) {
  if (paymentPayload.x402Version !== expectedVersion) throw new BnbX402PaymentError("Payment confirmation is invalid.");
  if (expectedVersion < 2) throw new BnbX402PaymentError("This payment version is not supported.");

  const accepted = asRecord(paymentPayload.accepted);
  const expectedAmount = requirement.amount || requirement.maxAmountRequired || "";
  if (
    !accepted
    || readString(accepted.scheme) !== requirement.scheme
    || readString(accepted.network) !== requirement.network
    || readIntegerString(accepted.amount) !== expectedAmount
    || !sameIdentifier(readString(accepted.asset), requirement.asset)
    || !sameIdentifier(readString(accepted.payTo), requirement.payTo)
  ) {
    throw new BnbX402PaymentError("Payment confirmation does not match this job.");
  }

  const payload = asRecord(paymentPayload.payload);
  const signature = readString(payload?.signature);
  if (!payload || !/^0x[a-fA-F0-9]+$/.test(signature)) {
    throw new BnbX402PaymentError("Payment confirmation is invalid.");
  }

  const authorization = asRecord(payload.authorization);
  if (authorization) {
    const payer = readString(authorization.from);
    if (
      !isEvmAddress(payer)
      || !sameIdentifier(readString(authorization.to), requirement.payTo)
      || readIntegerString(authorization.value) !== expectedAmount
      || !timestampWithinRequirement(authorization.validBefore, requirement.maxTimeoutSeconds)
    ) {
      throw new BnbX402PaymentError("Payment confirmation does not match this job.");
    }
    return payer;
  }

  const permit = asRecord(payload.permit2Authorization);
  const permitted = asRecord(permit?.permitted);
  const witness = asRecord(permit?.witness);
  const payer = readString(permit?.from);
  if (
    !permit
    || !permitted
    || !witness
    || !isEvmAddress(payer)
    || !sameIdentifier(readString(permitted.token), requirement.asset)
    || readIntegerString(permitted.amount) !== expectedAmount
    || !sameIdentifier(readString(witness.to), requirement.payTo)
    || !timestampWithinRequirement(permit.deadline, requirement.maxTimeoutSeconds)
  ) {
    throw new BnbX402PaymentError("Payment confirmation does not match this job.");
  }
  return payer;
}

function paymentCipherKey() {
  const secret = paymentCipherSecret();
  if (!secret) throw new BnbX402PaymentError("Payment is not configured.");
  return createHash("sha256").update(secret).digest();
}

function paymentCipherSecret() {
  return process.env.BNB_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
}

function formatBnbX402PaymentAmount(requirement: BnbX402PaymentRequirement) {
  const decimals = typeof requirement.extra?.decimals === "number"
    ? Math.min(Math.max(Math.trunc(requirement.extra.decimals), 0), 18)
    : 6;
  const amount = formatAtomicAmount(requirement.amount || requirement.maxAmountRequired || "", decimals);
  const symbol = typeof requirement.extra?.symbol === "string" && requirement.extra.symbol.trim()
    ? requirement.extra.symbol.trim()
    : typeof requirement.extra?.name === "string" && requirement.extra.name.trim()
      ? requirement.extra.name.trim()
      : "Token";
  return `${amount} ${symbol}`;
}

function formatAtomicAmount(value: string, decimals: number) {
  try {
    const atomic = BigInt(value);
    const scale = 10n ** BigInt(decimals);
    const whole = atomic / scale;
    const fraction = atomic % scale;
    if (decimals === 0 || fraction === 0n) return whole.toString();
    const padded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${whole}.${padded}`;
  } catch {
    return value;
  }
}

function timestampWithinRequirement(value: unknown, maxTimeoutSeconds: number) {
  const text = readIntegerString(value);
  if (!text) return false;
  try {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const expiresAt = BigInt(text);
    const upperBound = now + BigInt(Math.min(maxTimeoutSeconds, MAX_X402_AUTHORIZATION_SECONDS) + X402_CLOCK_SKEW_SECONDS);
    return expiresAt > now && expiresAt <= upperBound;
  } catch {
    return false;
  }
}

function isPositiveAtomicAmount(value: unknown) {
  const text = readIntegerString(value);
  if (!text) return false;
  try {
    return BigInt(text) > 0n;
  } catch {
    return false;
  }
}

function sameIdentifier(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function isEvmAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isSupportedBnbX402Network(network: string) {
  return network === "eip155:56" || network === "eip155:97";
}

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function readString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readIntegerString(value: unknown) {
  const text = readString(value);
  return /^\d+$/.test(text) ? text : "";
}

function readPositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(readString(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function compactObject(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => {
    if (item === undefined || item === null || item === "") return false;
    if (Array.isArray(item)) return item.length > 0;
    if (typeof item === "object") return Object.keys(item as Record<string, unknown>).length > 0;
    return true;
  }));
}
