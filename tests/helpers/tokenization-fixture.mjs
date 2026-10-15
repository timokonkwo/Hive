import { encodeAbiParameters, encodeEventTopics, zeroAddress } from 'viem';
import { abi, policy, metadata, transactions, journal } from '../../scripts/tokenization/modules.mjs';

export const signer = `0x${'1'.repeat(40)}`;
export const token = `0x${'2'.repeat(40)}`;
export const curve = `0x${'3'.repeat(40)}`;
export const hash = `0x${'a'.repeat(64)}`;
export const replacementHash = `0x${'b'.repeat(64)}`;
export const agentId = '0123456789abcdef01234567';
export const agent = { name: 'Research agent', bio: 'Research with sources.', status: 'active', walletAddress: signer, walletAddressVerifiedAt: new Date() };
export const preview = metadata.profilePreview(agentId, agent, 'owner');

export function preparedFor(intent = { preview, signer, salt: hash }, nonce = 4) {
  const config = { supply: 10n ** 27n, phantomQuote: 168n * 10n ** 16n, graduationThreshold: 420n * 10n ** 16n, curveFeeBps: 100n, hookFeeBps: 100n, poolFee: 0, tickSpacing: 200, enabled: true };
  const candidate = transactions.buildLaunchCandidate(intent.preview, {
    signer: intent.signer, symbol: 'RESEARCH', purchase: '', salt: intent.salt,
    logoURI: 'ipfs://bafybeigdyrztabcdefghijklmnopqrstuv234567abcdefghijklmnop',
  }, { chainId: 4663, blockNumber: 10n, blockHash: hash, timestamp: 100n, signer: intent.signer, configId: 0n,
    launchFee: 500000000000000n, expectedEconomics: hash, canLaunch: true, maxCreatorTaxBps: 1000n, config,
    contracts: { factory: { address: policy.PONS_FACTORY }, router: { address: curve } },
  });
  return { candidate, prediction: { token, curve, tokensOut: 0n }, expiresAt: BigInt(Math.floor(Date.now()/1000)) + 120n,
    maximumNetworkFee: 2400000n, maximumTotal: candidate.value + 2400000n,
    transaction: { chainId: 4663, from: candidate.from, to: candidate.to, data: candidate.data, value: candidate.value,
      nonce, gas: 1200000n, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n } };
}
export function intentFixture() {
  const prepared = preparedFor();
  return { _id: 'test-intent', agentId, chainId: 4663, signer, preview, salt: hash, phase: 'awaiting-signature',
    active: true, revision: 1, createdAt: new Date(), updatedAt: new Date(), nonce: 4,
    prepared: journal.packPrepared(prepared), nextBlock: '10' };
}
export function chainFixture(intent = intentFixture(), txHash = hash) {
  const prepared = journal.unpackPrepared(intent.prepared);
  const { candidate: call } = prepared;
  const actual = { hash: txHash, from: signer, to: call.to, nonce: intent.nonce, value: call.value, input: call.data, blockHash: hash };
  const event = { address: policy.PONS_FACTORY, removed: false,
    topics: encodeEventTopics({ abi: abi.factoryAbi, eventName: 'TokenLaunched', args: { token, curve, deployer: signer } }),
    data: encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }], [zeroAddress, 0n, 420n * 10n ** 16n]) };
  const receipt = { transactionHash: txHash, blockNumber: 10n, blockHash: hash, status: 'success', logs: [event] };
  const values = { getLaunchedToken: { exists: true, token, curve, deployer: signer, creatorFeeRecipient: signer, pairToken: zeroAddress, creatorTaxBps: 200, buybackEnabled: false },
    getTokenInfo: [signer, call.params.logo, call.params.description, call.params.socials], name: call.params.name, symbol: call.params.symbol };
  const client = { getChainId: async () => 4663, getTransaction: async () => actual, getTransactionReceipt: async () => receipt,
    getBlock: async () => ({ number: 20n, hash }), readContract: async args => values[args.functionName],
    getLogs: async () => [{ transactionHash: txHash, removed: false }], getTransactionCount: async () => 4, getCode: async () => '0x' };
  return { prepared, actual, receipt, values, client };
}
