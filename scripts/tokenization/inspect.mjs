// Read-only: no wallet client, signatures, transactions or keys.
import { createPublicClient, http } from 'viem';
import { writeFile } from 'node:fs/promises';
import { snapshots, policy } from './modules.mjs';
const signer = process.argv[2];
if (!policy.validAddress(signer)) throw Error('Usage: node scripts/tokenization/inspect.mjs <public-wallet-address> [output.json]');
const url = process.env.HIVE_PONS_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const client = createPublicClient({ transport: http(url, { timeout: 20000, retryCount: 1 }) });
const snapshot = await snapshots.readLaunchSnapshot(client, signer);
const finalized = await client.getBlock({ blockTag: 'finalized' });
const report = {
  inspectedAt: new Date().toISOString(), source: 'https://docs.ponsfamily.com/v2',
  reviewed: false, snapshot,
  finalized: { number: finalized.number, hash: finalized.hash, timestamp: finalized.timestamp },
};
const json = JSON.stringify(report, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
if (process.argv[3]) await writeFile(process.argv[3], json + '\n');
console.log(json);
