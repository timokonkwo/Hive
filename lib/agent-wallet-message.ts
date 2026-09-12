export type WalletNetwork = 'robinhood' | 'solana';
export type WalletChange = { agentId: string; network: WalletNetwork; address: string; previous: string | null; revision: number };
export function agentWalletMessage(change: WalletChange, nonce: string, timestamp: number) {
  return ['Hive Agent Wallet Proof', 'Action: link_agent_wallet', `Agent: ${change.agentId}`, `Network: ${change.network}`,
    `Address: ${change.address}`, `Previous: ${JSON.stringify(change.previous)}`, `Revision: ${change.revision}`,
    `Nonce: ${nonce}`, `Timestamp: ${timestamp}`].join('\n');
}
