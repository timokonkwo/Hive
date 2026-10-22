import { previewFeeRecipient, managedOwnerPreview } from './policy';
import { decodeFunctionResult, encodeFunctionData, zeroAddress, type Address, type Hex, type PublicClient } from 'viem';
import { factoryAbi, routerAbi } from './abi';
import { creatorTaxBps, PONS_CHAIN_ID, normalizeSymbol, purchaseWei, sameAddress, validAddress, validHash, validTokenLogo } from './policy';
import { quoteOpeningBuy } from './quote';
import { profileUrl } from './platforms';
import { assertLaunchAvailable, assertReviewedRelease, type LaunchSnapshot, type ReviewedRelease } from './snapshot';
import type { LaunchPreview } from './types';

export interface LaunchChoices {
  signer: Address;
  symbol: string;
  purchase: string;
  /** Versioned avatar uploaded by Hive, captured in the durable intent. */
  logoURI: string;
  /** Generated once for the durable intent; retries must reuse it. */
  salt: Hex;
}

/** A candidate is only calldata for review/simulation. It does not authorize signing. */
export function buildLaunchCandidate(preview: LaunchPreview, choices: LaunchChoices, snapshot: LaunchSnapshot) {
  assertLaunchAvailable(snapshot);
  if (preview.issues.length || preview.existingToken) throw Error('Resolve the agent token review before launching.');
  if (!validAddress(choices.signer) || !sameAddress(choices.signer, snapshot.signer)) throw Error('The launch wallet changed. Refresh the review.');
  if (preview.role !== 'owner' && preview.role !== 'admin') throw Error('Invalid launch role.');
  const recipient = previewFeeRecipient(preview);
  if (!recipient || !sameAddress(preview.recipient || '', recipient)) throw Error('The creator fee recipient changed. Refresh the review.');
  if (preview.role === 'owner' && !sameAddress(choices.signer, managedOwnerPreview(preview) ? preview.requiredSigner || '' : recipient)) throw Error('Select the verified agent wallet.');
  if (!validHash(choices.salt) || /^0x0{64}$/.test(choices.salt)) throw Error('A unique launch salt is required.');
  if (!validHash(snapshot.expectedEconomics) || /^0x0{64}$/.test(snapshot.expectedEconomics)) throw Error('Launch economics could not be pinned.');
  if (!validTokenLogo(choices.logoURI)) {
    throw Error('The agent avatar must be stored before preparing a launch.');
  }
  const website = preview.metadata.socials.website;
  if (![profileUrl(preview.agentId), `https://uphive.xyz/agent/${encodeURIComponent(preview.metadata.name)}`].includes(website) || preview.metadata.socials.twitter !== '' || preview.metadata.socials.telegram !== '') {
    throw Error('The token profile links changed. Refresh the review.');
  }
  const budget = purchaseWei(choices.purchase);
  const tax = creatorTaxBps(preview.feePolicyVersion);
  if (snapshot.maxCreatorTaxBps < BigInt(tax)) throw Error('Pons no longer supports the reviewed creator fee.');
  const quote = quoteOpeningBuy(snapshot.config, budget, tax);
  const params = {
    name: preview.metadata.name, symbol: normalizeSymbol(choices.symbol), logo: choices.logoURI,
    description: preview.metadata.description,
    socials: { twitter: '', telegram: '', discord: '', website, farcaster: '' },
    creatorFeeRecipient: recipient as Address, creatorTaxBps: tax, buybackEnabled: false,
    expectedEconomics: snapshot.expectedEconomics, salt: choices.salt,
  } as const;
  const kind = budget === 0n ? 'launch' : 'launch-and-buy';
  const to = budget === 0n ? snapshot.contracts.factory.address : snapshot.contracts.router.address;
  const data = budget === 0n
    ? encodeFunctionData({ abi: factoryAbi, functionName: 'launchToken', args: [params, snapshot.configId, zeroAddress] })
    : encodeFunctionData({ abi: routerAbi, functionName: 'launchAndBuy', args: [params, snapshot.configId, zeroAddress, budget, quote.minimumTokens, choices.signer, []] });
  return {
    kind, chainId: PONS_CHAIN_ID, from: choices.signer, to, data,
    value: snapshot.launchFee + budget, params, quote, budget, configId: snapshot.configId,
    blockNumber: snapshot.blockNumber, blockHash: snapshot.blockHash,
  } as const;
}
export type LaunchCandidate = ReturnType<typeof buildLaunchCandidate>;

export async function simulateLaunchCandidate(client: PublicClient, candidate: LaunchCandidate) {
  if (await client.getChainId() !== PONS_CHAIN_ID) throw Error('Simulation is on the wrong chain.');
  const result = await client.call({ account: candidate.from, to: candidate.to, data: candidate.data, value: candidate.value, blockNumber: candidate.blockNumber });
  if (!result.data) throw Error('Pons did not return a launch result.');
  const decoded = candidate.kind === 'launch'
    ? decodeFunctionResult({ abi: factoryAbi, functionName: 'launchToken', data: result.data })
    : decodeFunctionResult({ abi: routerAbi, functionName: 'launchAndBuy', data: result.data });
  const [token, curve] = decoded;
  if (!validAddress(token) || !validAddress(curve) || sameAddress(token, curve)) throw Error('Pons returned invalid launch addresses.');
  const tokensOut = decoded.length === 3 ? decoded[2] : 0n;
  if (tokensOut !== candidate.quote.tokens) throw Error('The Pons simulation differs from the opening-buy quote.');
  return { token, curve, tokensOut };
}

/** Called only after wallet authorization and a durable intent exist. */
export async function prepareReviewedLaunch(client: PublicClient, preview: LaunchPreview, choices: LaunchChoices, snapshot: LaunchSnapshot, release: ReviewedRelease) {
  assertReviewedRelease(snapshot, release);
  const block = await client.getBlock({ blockTag: 'latest' });
  if (block.timestamp < snapshot.timestamp || block.timestamp - snapshot.timestamp > 120n) throw Error('The launch quote expired. Refresh the review.');
  const pinned = await client.getBlock({ blockNumber: snapshot.blockNumber });
  if (pinned.hash !== snapshot.blockHash) throw Error('The quoted block changed. Refresh the review.');
  const candidate = buildLaunchCandidate(preview, choices, snapshot);
  const prediction = await simulateLaunchCandidate(client, candidate);
  const [nonce, latestNonce] = await Promise.all([
    client.getTransactionCount({ address: choices.signer, blockTag: 'pending' }),
    client.getTransactionCount({ address: choices.signer, blockTag: 'latest' }),
  ]);
  if (nonce !== latestNonce) throw Error('Wait for pending wallet transactions before launching.');
  const [gasEstimate, fees, balance] = await Promise.all([
    client.estimateGas({ account: candidate.from, to: candidate.to, data: candidate.data, value: candidate.value }),
    client.estimateFeesPerGas(),
    client.getBalance({ address: choices.signer, blockTag: 'pending' }),
  ]);
  const gas = (gasEstimate * 120n + 99n) / 100n;
  if (fees.maxFeePerGas === undefined || fees.maxPriorityFeePerGas === undefined
    || fees.maxFeePerGas < fees.maxPriorityFeePerGas || gas <= 0n) throw Error('Network fees could not be estimated. Try again.');
  const maximumNetworkFee = gas * fees.maxFeePerGas;
  if (balance < candidate.value + maximumNetworkFee) throw Error('This wallet needs more ETH for the launch and network fee.');
  return {
    candidate, prediction, expiresAt: snapshot.timestamp + 120n, maximumNetworkFee, maximumTotal: candidate.value + maximumNetworkFee,
    transaction: { chainId: PONS_CHAIN_ID, from: candidate.from, to: candidate.to, data: candidate.data,
      value: candidate.value, nonce, gas, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas },
  };
}
