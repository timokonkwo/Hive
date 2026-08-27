"use client";

import { bsc, bscTestnet } from "wagmi/chains";

function publicChainId() {
  const raw = process.env.NEXT_PUBLIC_BNB_BSC_CHAIN_ID?.trim();
  const parsed = raw ? Number(raw) : NaN;
  if (parsed === 97 || parsed === 56) return parsed;

  const network = process.env.NEXT_PUBLIC_BNB_NETWORK?.trim().toLowerCase();
  return network === "mainnet" ? 56 : 97;
}

export function getClientBnbChain() {
  return publicChainId() === 97 ? bscTestnet : bsc;
}

export function getClientBnbChainId() {
  return getClientBnbChain().id;
}

export function getClientBnbNativeSymbol() {
  return getClientBnbChainId() === 97 ? "tBNB" : "BNB";
}

export function getClientBnbExplorerTxUrl(hash: string, chainId: number = getClientBnbChainId()) {
  const base = chainId === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com";
  return `${base}/tx/${hash}`;
}

export function getClientBnbExplorerAddressUrl(address: string, chainId: number = getClientBnbChainId()) {
  const base = chainId === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com";
  return `${base}/address/${address}`;
}
