import { keccak256, zeroAddress, type Address, type Hex, type PublicClient } from 'viem';
import { factoryAbi, hookAbi } from './abi';
import { CREATOR_TAX_BPS, PONS_CHAIN_ID, PONS_FACTORY, sameAddress, validAddress } from './policy';
import { validateEconomics, type LaunchEconomics } from './quote';

export const contractNames = ['factory', 'hook', 'deployer', 'escrow', 'router'] as const;
export type ContractName = typeof contractNames[number];
export interface ContractIdentity { address: Address; codeHash: Hex }
export interface LaunchSnapshot {
  chainId: typeof PONS_CHAIN_ID;
  blockNumber: bigint;
  blockHash: Hex;
  timestamp: bigint;
  signer: Address;
  configId: bigint;
  launchFee: bigint;
  expectedEconomics: Hex;
  canLaunch: boolean;
  maxCreatorTaxBps: bigint;
  snipeTaxStartBps: bigint;
  snipeTaxSeconds: bigint;
  config: LaunchEconomics & { tickSpacing: number };
  contracts: Record<ContractName, ContractIdentity>;
}
export interface ReviewedRelease {
  chainId: typeof PONS_CHAIN_ID;
  reviewed: boolean;
  contracts: Record<ContractName, ContractIdentity & { sourceEvidence: string }>;
}

/** All reads use one block. Observed code hashes do not approve themselves. */
export async function readLaunchSnapshot(client: PublicClient, signer: Address): Promise<LaunchSnapshot> {
  if (!validAddress(signer)) throw Error('Choose a valid launch wallet.');
  if (await client.getChainId() !== PONS_CHAIN_ID) throw Error('The RPC is not connected to Robinhood Chain.');
  const block = await client.getBlock({ blockTag: 'latest' });
  if (block.number === null || !block.hash) throw Error('The current block could not be verified.');
  const at = { address: PONS_FACTORY, abi: factoryAbi, blockNumber: block.number } as const;
  const configId = 0n;
  const [launchFee, canLaunch, maxCreatorTaxBps, snipeTaxStartBps, snipeTaxSeconds, hook, deployer, escrow, router, config, expectedEconomics] = await Promise.all([
    client.readContract({ ...at, functionName: 'launchFee' }),
    client.readContract({ ...at, functionName: 'canLaunch', args: [signer] }),
    client.readContract({ ...at, functionName: 'maxCreatorTaxBps' }),
    client.readContract({ ...at, functionName: 'snipeTaxStartBps' }),
    client.readContract({ ...at, functionName: 'snipeTaxSeconds' }),
    client.readContract({ ...at, functionName: 'memeHook' }),
    client.readContract({ ...at, functionName: 'launchDeployer' }),
    client.readContract({ ...at, functionName: 'feeEscrow' }),
    client.readContract({ ...at, functionName: 'launchForwarder' }),
    client.readContract({ ...at, functionName: 'getLaunchConfig', args: [configId] }),
    client.readContract({ ...at, functionName: 'previewLaunchEconomics', args: [configId, zeroAddress] }),
  ]);
  const addresses = { factory: PONS_FACTORY, hook, deployer, escrow, router };
  const entries = await Promise.all(contractNames.map(async name => {
    const address = addresses[name];
    if (!validAddress(address)) throw Error(`Pons ${name} is not configured.`);
    const code = await client.getCode({ address, blockNumber: block.number });
    if (!code || code === '0x') throw Error(`Pons ${name} has no deployed code.`);
    return [name, { address, codeHash: keccak256(code) }] as const;
  }));
  const policy = await client.readContract({ address: hook, abi: hookAbi, functionName: 'currentFeePolicy', blockNumber: block.number });
  return {
    chainId: PONS_CHAIN_ID, blockNumber: block.number, blockHash: block.hash, timestamp: block.timestamp,
    signer, configId, launchFee, expectedEconomics, canLaunch, maxCreatorTaxBps, snipeTaxStartBps, snipeTaxSeconds,
    config: { ...config, hookFeeBps: BigInt(policy.hookFeeBps) },
    contracts: Object.fromEntries(entries) as LaunchSnapshot['contracts'],
  };
}

export function assertLaunchAvailable(snapshot: LaunchSnapshot): void {
  if (snapshot.chainId !== PONS_CHAIN_ID || snapshot.configId !== 0n
    || !sameAddress(snapshot.contracts.factory.address, PONS_FACTORY)) throw Error('Unsupported Pons deployment.');
  validateEconomics(snapshot.config);
  if (!snapshot.canLaunch) throw Error('Pons is not allowing this wallet to launch.');
  if (snapshot.maxCreatorTaxBps < BigInt(CREATOR_TAX_BPS)) throw Error('Pons no longer supports the required creator fee.');
}

/** The release comes from reviewed server configuration, never an API caller. */
export function assertReviewedRelease(snapshot: LaunchSnapshot, release: ReviewedRelease): void {
  assertLaunchAvailable(snapshot);
  if (!release.reviewed || release.chainId !== snapshot.chainId) throw Error('Pons contract review is not complete.');
  for (const name of contractNames) {
    const expected = release.contracts[name], actual = snapshot.contracts[name];
    if (!expected?.sourceEvidence?.trim() || !sameAddress(expected.address, actual.address)
      || expected.codeHash.toLowerCase() !== actual.codeHash.toLowerCase()) {
      throw Error(`Pons ${name} changed or has not been reviewed. Launches are paused.`);
    }
  }
}
