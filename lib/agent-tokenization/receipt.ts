import { decodeEventLog, TransactionNotFoundError, TransactionReceiptNotFoundError, zeroAddress, type Address, type Hex, type PublicClient } from 'viem';
import { curveAbi, factoryAbi, tokenAbi } from './abi';
import { CREATOR_TAX_BPS, PONS_CHAIN_ID, PONS_FACTORY, sameAddress, validAddress, validHash } from './policy';
import type { LaunchCandidate } from './transaction';
import type { TokenAssociation } from './types';

export interface LaunchExpectation {
  candidate: LaunchCandidate;
  nonce: number;
  prediction: { token: Address; curve: Address; tokensOut: bigint };
}
export type LaunchReceiptState =
  | { state: 'pending' | 'confirming' }
  | { state: 'reverted'; transactionHash: Hex }
  | { state: 'confirmed'; token: TokenAssociation };

/** Read-only. A submitted hash alone can never create an agent-token association. */
export async function reconcileLaunchReceipt(client: PublicClient, expected: LaunchExpectation, hash: Hex): Promise<LaunchReceiptState> {
  if (!validHash(hash)) throw Error('Invalid launch transaction hash.');
  if (await client.getChainId() !== PONS_CHAIN_ID) throw Error('Receipt verification is on the wrong chain.');
  let transaction, receipt;
  try {
    [transaction, receipt] = await Promise.all([client.getTransaction({ hash }), client.getTransactionReceipt({ hash })]);
  } catch (error) {
    if (error instanceof TransactionNotFoundError || error instanceof TransactionReceiptNotFoundError) return { state: 'pending' };
    throw error; // Outages are unresolved, never permission to launch again.
  }
  const { candidate, prediction } = expected;
  if (transaction.hash.toLowerCase() !== hash.toLowerCase() || receipt.transactionHash.toLowerCase() !== hash.toLowerCase()
    || !sameAddress(transaction.from, candidate.from) || !sameAddress(transaction.to || '', candidate.to)
    || transaction.nonce !== expected.nonce || transaction.value !== candidate.value
    || transaction.input.toLowerCase() !== candidate.data.toLowerCase()) {
    throw Error('This transaction does not match the saved launch.');
  }
  const [canonical, finalized] = await Promise.all([
    client.getBlock({ blockNumber: receipt.blockNumber }),
    client.getBlock({ blockTag: 'finalized' }),
  ]);
  if (canonical.hash !== receipt.blockHash || transaction.blockHash !== receipt.blockHash
    || finalized.number === null || finalized.number < receipt.blockNumber) return { state: 'confirming' };
  if (receipt.status === 'reverted') return { state: 'reverted', transactionHash: hash };
  if (receipt.status !== 'success') throw Error('The launch result could not be verified.');
  const events = receipt.logs.flatMap(log => {
    if (!sameAddress(log.address, PONS_FACTORY) || log.removed) return [];
    try {
      const decoded = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics, strict: true });
      return decoded.eventName === 'TokenLaunched' ? [decoded.args] : [];
    } catch { return []; }
  });
  if (events.length !== 1) throw Error('The transaction did not produce exactly one Pons launch.');
  const event = events[0];
  if (!validAddress(event.token) || !validAddress(event.curve)
    || !sameAddress(event.token, prediction.token) || !sameAddress(event.curve, prediction.curve)
    || !sameAddress(event.deployer, candidate.from) || event.pairToken !== zeroAddress || event.launchConfigId !== candidate.configId) {
    throw Error('The launched token differs from the saved launch.');
  }
  if (candidate.budget > 0n) {
    const buys = receipt.logs.flatMap(log => {
      if (!sameAddress(log.address, event.curve) || log.removed) return [];
      try {
        const decoded = decodeEventLog({ abi: curveAbi, data: log.data, topics: log.topics, strict: true });
        return decoded.eventName === 'CurveBuy' ? [decoded.args] : [];
      } catch { return []; }
    });
    if (buys.length !== 1 || !sameAddress(buys[0].recipient, candidate.from)
      || buys[0].tokensOut !== prediction.tokensOut || buys[0].tokensOut < candidate.quote.minimumTokens) {
      throw Error('The opening purchase could not be verified.');
    }
  }
  const at = { blockNumber: receipt.blockNumber };
  const [record, info, name, symbol] = await Promise.all([
    client.readContract({ ...at, address: PONS_FACTORY, abi: factoryAbi, functionName: 'getLaunchedToken', args: [event.token] }),
    client.readContract({ ...at, address: event.token, abi: tokenAbi, functionName: 'getTokenInfo' }),
    client.readContract({ ...at, address: event.token, abi: tokenAbi, functionName: 'name' }),
    client.readContract({ ...at, address: event.token, abi: tokenAbi, functionName: 'symbol' }),
  ]);
  if (!record.exists || !sameAddress(record.token, event.token) || !sameAddress(record.curve, event.curve)
    || !sameAddress(record.deployer, candidate.from) || !sameAddress(record.creatorFeeRecipient, candidate.params.creatorFeeRecipient)
    || record.pairToken !== zeroAddress || record.creatorTaxBps !== CREATOR_TAX_BPS || record.buybackEnabled
    || !sameAddress(info[0], candidate.from) || info[1] !== candidate.params.logo || info[2] !== candidate.params.description
    || name !== candidate.params.name || symbol !== candidate.params.symbol
    || (Object.keys(candidate.params.socials) as Array<keyof typeof candidate.params.socials>).some(key => info[3][key] !== candidate.params.socials[key])) {
    throw Error('The on-chain token metadata or fee recipient differs from the saved launch.');
  }
  // Recheck the block after the reads; never publish data from an observed reorg.
  if ((await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) return { state: 'confirming' };
  return { state: 'confirmed', token: { chainId: PONS_CHAIN_ID, address: event.token, symbol, transactionHash: hash } };
}
