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
