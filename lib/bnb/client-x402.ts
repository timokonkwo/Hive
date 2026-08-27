"use client";

import { x402Client, x402HTTPClient } from "@x402/core/client";
import type { Network, PaymentRequired, PaymentRequirements } from "@x402/core/types";
import {
  createPermit2ApprovalTx,
  getPermit2AllowanceReadParams,
  type ClientEvmSigner,
} from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import type { Hex, WalletClient } from "viem";
import type { BnbPaymentRequest, BnbX402PaymentRequirement } from "@/lib/bnb/types";

export type BnbX402PaymentRequest = Extract<BnbPaymentRequest, { status: "ready"; mode: "x402" }>;

export function bnbX402ChainId(request: BnbX402PaymentRequest) {
  const match = request.network.match(/^eip155:(\d+)$/);
  if (!match) throw new Error("This payment network is not supported.");
  const chainId = Number(match[1]);
  if (chainId !== 56 && chainId !== 97) throw new Error("This payment network is not supported.");
  return chainId;
}

export function bnbX402Signer(walletClient: WalletClient, address: `0x${string}`): ClientEvmSigner {
  return {
    address,
    signTypedData: async (message) => {
      const sign = walletClient.signTypedData as unknown as (args: Record<string, unknown>) => Promise<Hex>;
      return sign({ ...message, account: address });
    },
  };
}

export async function getBnbX402Permit2Approval({
  request,
  ownerAddress,
  readContract,
}: {
  request: BnbX402PaymentRequest;
  ownerAddress: `0x${string}`;
  readContract: (args: ReturnType<typeof getPermit2AllowanceReadParams>) => Promise<unknown>;
}) {
  const requirement = request.selectedPaymentRequirement;
  if (requirement.extra?.assetTransferMethod !== "permit2") return null;
  if (!isEvmAddress(requirement.asset)) throw new Error("This payment token is not supported.");

  const allowance = await readContract(getPermit2AllowanceReadParams({
    tokenAddress: requirement.asset,
    ownerAddress,
  }));
  const requiredAmount = BigInt(requirement.amount || requirement.maxAmountRequired || "0");
  if (typeof allowance === "bigint" && allowance >= requiredAmount) return null;
  return createPermit2ApprovalTx(requirement.asset);
}

export async function createBnbX402PaymentConfirmation({
  request,
  signer,
}: {
  request: BnbX402PaymentRequest;
  signer: ClientEvmSigner;
}) {
  if (request.x402Version < 2) throw new Error("This payment version is not supported.");
  const accepted = toSdkRequirement(request.selectedPaymentRequirement);
  const client = new x402Client((_version, requirements) => {
    const selected = requirements.find((requirement) => matchesRequirement(requirement, accepted));
    if (!selected) throw new Error("Payment details changed. Review payment again.");
    return selected;
  });
  client.setSpendControls({
    maxAmountPerPayment: false,
    allowedAssets: [{
      network: accepted.network,
      asset: accepted.asset,
      maxAmountPerPayment: accepted.amount,
    }],
  });
  registerExactEvmScheme(client, {
    signer,
    networks: [accepted.network],
    policies: [(_version, requirements) => requirements.filter((requirement) => matchesRequirement(requirement, accepted))],
  });

  const httpClient = new x402HTTPClient(client);
  const paymentRequired: PaymentRequired = {
    x402Version: request.x402Version,
    resource: {
      url: request.resource,
      description: request.selectedPaymentRequirement.description,
      mimeType: request.selectedPaymentRequirement.mimeType,
    },
    accepts: [accepted],
    ...(request.extensions ? { extensions: request.extensions } : {}),
  };
  const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
  const headers = httpClient.encodePaymentSignatureHeader(paymentPayload);
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === "payment-signature");
  if (!entry?.[1]) throw new Error("Payment could not be prepared.");
  return {
    paymentHeader: entry[1],
    payer: signer.address,
  };
}

function toSdkRequirement(requirement: BnbX402PaymentRequirement): PaymentRequirements {
  return {
    scheme: requirement.scheme,
    network: requirement.network as Network,
    asset: requirement.asset,
    amount: requirement.amount || requirement.maxAmountRequired || "",
    payTo: requirement.payTo,
    maxTimeoutSeconds: requirement.maxTimeoutSeconds,
    extra: requirement.extra || {},
  };
}

function matchesRequirement(left: PaymentRequirements, right: PaymentRequirements) {
  return left.scheme === right.scheme
    && left.network === right.network
    && sameIdentifier(left.asset, right.asset)
    && left.amount === right.amount
    && sameIdentifier(left.payTo, right.payTo);
}

function sameIdentifier(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

function isEvmAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
