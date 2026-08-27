export type HiveBnbNetwork = "mainnet" | "testnet";

export type HiveBnbNetworkConfig = {
  network: HiveBnbNetwork;
  chainId: 56 | 97;
  chainName: string;
  nativeSymbol: "BNB" | "tBNB";
  rpcUrl: string;
  explorerUrl: string;
  testnet: boolean;
};

const MAINNET_RPC_URL = "https://bsc-dataseed.bnbchain.org";
const TESTNET_RPC_URL = "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

export const HIVE_BNB_MAINNET: HiveBnbNetworkConfig = {
  network: "mainnet",
  chainId: 56,
  chainName: "BNB Smart Chain",
  nativeSymbol: "BNB",
  rpcUrl: MAINNET_RPC_URL,
  explorerUrl: "https://bscscan.com",
  testnet: false,
};

export const HIVE_BNB_TESTNET: HiveBnbNetworkConfig = {
  network: "testnet",
  chainId: 97,
  chainName: "BNB Smart Chain Testnet",
  nativeSymbol: "tBNB",
  rpcUrl: TESTNET_RPC_URL,
  explorerUrl: "https://testnet.bscscan.com",
  testnet: true,
};

function configuredNetworkName() {
  const value = process.env.BNB_NETWORK?.trim().toLowerCase();
  if (value === "testnet" || value === "mainnet") return value;
  return "";
}

function configuredChainId() {
  const raw = process.env.BNB_BSC_CHAIN_ID?.trim();
  const parsed = raw ? Number(raw) : NaN;
  if (parsed === 97 || parsed === 56) return parsed;
  return null;
}

function configuredClientNetworkName() {
  const value = process.env.NEXT_PUBLIC_BNB_NETWORK?.trim().toLowerCase();
  if (value === "testnet" || value === "mainnet") return value;
  return "";
}

function configuredClientChainId() {
  const raw = process.env.NEXT_PUBLIC_BNB_BSC_CHAIN_ID?.trim();
  const parsed = raw ? Number(raw) : NaN;
  if (parsed === 97 || parsed === 56) return parsed;
  return null;
}

export function getHiveBnbNetworkEnvStatus() {
  const serverNetwork = configuredNetworkName();
  const serverChainId = configuredChainId();
  const clientNetwork = configuredClientNetworkName();
  const clientChainId = configuredClientChainId();
  const expectedServerChainId = serverNetwork === "mainnet" ? 56 : serverNetwork === "testnet" ? 97 : null;
  const expectedClientChainId = clientNetwork === "mainnet" ? 56 : clientNetwork === "testnet" ? 97 : null;
  const errors: string[] = [];

  if (!serverNetwork) errors.push("BNB_NETWORK must be mainnet or testnet.");
  if (!serverChainId) errors.push("BNB_BSC_CHAIN_ID must be 56 or 97.");
  if (serverNetwork && serverChainId && serverChainId !== expectedServerChainId) {
    errors.push("BNB_NETWORK and BNB_BSC_CHAIN_ID do not match.");
  }
  if (!clientNetwork) errors.push("NEXT_PUBLIC_BNB_NETWORK must be mainnet or testnet.");
  if (!clientChainId) errors.push("NEXT_PUBLIC_BNB_BSC_CHAIN_ID must be 56 or 97.");
  if (clientNetwork && clientChainId && clientChainId !== expectedClientChainId) {
    errors.push("NEXT_PUBLIC_BNB_NETWORK and NEXT_PUBLIC_BNB_BSC_CHAIN_ID do not match.");
  }
  if (serverNetwork && clientNetwork && serverNetwork !== clientNetwork) {
    errors.push("Server and client BNB networks do not match.");
  }
  if (serverChainId && clientChainId && serverChainId !== clientChainId) {
    errors.push("Server and client BNB chain IDs do not match.");
  }

  return {
    ready: errors.length === 0,
    serverNetwork: serverNetwork || null,
    serverChainId,
    clientNetwork: clientNetwork || null,
    clientChainId,
    errors,
  };
}

export function getHiveBnbNetworkConfig(): HiveBnbNetworkConfig {
  const chainId = configuredChainId();
  const network = configuredNetworkName();
  const base = chainId === 56 || network === "mainnet" ? HIVE_BNB_MAINNET : HIVE_BNB_TESTNET;
  const rpcUrl = process.env.BNB_BSC_RPC_URL?.trim() || base.rpcUrl;

  return {
    ...base,
    rpcUrl,
  };
}

export function getHiveBnbExplorerAddressUrl(address: string) {
  return `${getHiveBnbNetworkConfig().explorerUrl}/address/${address}`;
}

export function getHiveBnbExplorerTxUrl(hash: string) {
  return `${getHiveBnbNetworkConfig().explorerUrl}/tx/${hash}`;
}

export function formatHiveBnbNativeAmount(amount: string) {
  return `${amount} ${getHiveBnbNetworkConfig().nativeSymbol}`;
}
