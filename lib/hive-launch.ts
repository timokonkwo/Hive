/** New-token launch switch. Keep the Solana asset out of this configuration.
 * At launch: supply the deployed token and reviewed trade/stake integrations,
 * then change status. See HIVE_TOKEN_BRIEF.md. No URL or local-storage override.
 */
export type HiveLaunch = { status: 'coming-soon' | 'launched'; message: string; tokenAddress: string | null; tradeUrl: string | null; stakeUrl: string | null };
export const hiveLaunch: HiveLaunch = {
  status: 'launched',
  message: '$HIVE is live on Robinhood',
  tokenAddress: '0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8',
  tradeUrl: 'https://www.ponsfamily.com/launchpad/0xc65e9630D8Af1eA278cbE359f78931684b4ff9f8',
  stakeUrl: null,
};
export function launchReady(config: HiveLaunch, action: 'trade' | 'stake') {
  if (config.status !== 'launched' || !config.tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(config.tokenAddress) || /^0x0{40}$/.test(config.tokenAddress)) return false;
  try { const url = new URL(action === 'trade' ? config.tradeUrl || '' : config.stakeUrl || ''); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
export const solanaHive = { mint: '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS', decimals: 9, tradeUrl: 'https://bags.fm/6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS' } as const;
