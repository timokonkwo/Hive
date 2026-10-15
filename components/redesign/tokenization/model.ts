import type { LaunchPreview, LaunchRole, LaunchMode } from '@/lib/agent-tokenization/types';
import { validAddress, validHash, validTokenLogo } from '@/lib/agent-tokenization/policy';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Token details could not be read.');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw Error('Token details could not be read.');
  return value;
}

export function readPreview(value: unknown, agentId: string, role: LaunchRole): LaunchPreview {
  const data = record(value), metadata = record(data.metadata), socials = record(metadata.socials);
  if (data.agentId !== agentId || data.role !== role || typeof data.signingEnabled !== 'boolean') {
    throw Error('Token settings changed. Refresh before continuing.');
  }
  if (socials.twitter !== '' || socials.telegram !== ''
    || socials.website !== `https://uphive.xyz/agent/${encodeURIComponent(text(metadata.name))}`) {
    throw Error('Token profile links changed. Refresh before continuing.');
  }
  if (!Array.isArray(data.issues) || data.issues.some(i => typeof i !== 'string')
    || (data.recipient !== null && !validAddress(data.recipient))
    || (data.requiredSigner !== null && !validAddress(data.requiredSigner))) {
    throw Error('Token details could not be read.');
  }
  let existingToken: LaunchPreview['existingToken'] = null;
  if (data.existingToken !== null) {
    const token = record(data.existingToken);
    if (token.chainId !== 4663 || !validAddress(token.address) || !validHash(token.transactionHash)) {
      throw Error('The token address could not be verified.');
    }
    existingToken = { chainId: 4663, address: token.address, symbol: text(token.symbol), transactionHash: token.transactionHash };
  }
  let adminProfile: LaunchPreview['adminProfile'];
  if (role === 'admin' && data.adminProfile) {
    const profile = record(data.adminProfile);
    if (typeof profile.revision !== 'string' || !/^[a-f0-9]{64}$/.test(profile.revision)) throw Error('Refresh the agent details.');
    adminProfile = { name: text(profile.name), bio: text(profile.bio), imageUrl: text(profile.imageUrl), revision: profile.revision };
  }
  if (metadata.imageUrl !== undefined && !validTokenLogo(text(metadata.imageUrl))) throw Error('The agent image could not be verified.');
  let managedDeployer: LaunchPreview['managedDeployer'];
  if (role === 'admin' && data.managedDeployer) {
    const deployer = record(data.managedDeployer);
    if (!validAddress(deployer.address) || typeof deployer.available !== 'boolean') throw Error('Refresh the deployer status.');
    managedDeployer = { address: deployer.address, available: deployer.available, ...(typeof deployer.reason === 'string' ? { reason: deployer.reason } : {}) };
  }
  return {
    ...(managedDeployer ? { managedDeployer } : {}),
    ...(adminProfile ? { adminProfile } : {}),
    agentId, role, signingEnabled: data.signingEnabled, existingToken,
    recipient: data.recipient as string | null, requiredSigner: data.requiredSigner as string | null,
    issues: data.issues as string[],
    metadata: {
      name: text(metadata.name), symbol: text(metadata.symbol), description: text(metadata.description),
      avatarSeed: text(metadata.avatarSeed), ...(metadata.imageUrl ? { imageUrl: text(metadata.imageUrl) } : {}), socials: { website: text(socials.website), twitter: '', telegram: '' },
    },
  };
}


export interface SavedLaunch {
  mode?: LaunchMode;
  id: string;
  phase: 'draft'|'awaiting-signature'|'submitted'|'confirming'|'confirmed'|'reverted'|'cancelled';
  signer: string;
  transactionHash: string|null;
  cancellationHash: string|null;
  token: LaunchPreview['existingToken'];
}
export function readStatus(value: unknown): SavedLaunch|null {
  const data=record(value);
  if (data.launch === null) return null;
  const launch=record(data.launch);
  const phases=['draft','awaiting-signature','submitted','confirming','confirmed','reverted','cancelled'];
  if (typeof launch.id !== 'string' || !launch.id || !phases.includes(String(launch.phase)) || !validAddress(launch.signer)
    || (launch.transactionHash !== null && !validHash(launch.transactionHash))
    || (launch.cancellationHash != null && !validHash(launch.cancellationHash))) throw Error('Launch status could not be read.');
  let token:LaunchPreview['existingToken']=null;
  if (launch.phase === 'confirmed') {
    const item=record(launch.token);
    if(item.chainId!==4663 || !validAddress(item.address) || !validHash(item.transactionHash)) throw Error('The confirmed token could not be verified.');
    token={chainId:4663,address:item.address,transactionHash:item.transactionHash,symbol:text(item.symbol)};
  }
  if (launch.mode !== undefined && !['connected','managed'].includes(String(launch.mode))) throw Error('Invalid launch mode.');
  return {id:launch.id,mode:launch.mode === 'managed' ? 'managed' : 'connected',phase:launch.phase as SavedLaunch['phase'],signer:launch.signer,
    transactionHash:launch.transactionHash as string|null,cancellationHash:launch.cancellationHash as string|null||null,token};
}
export interface WalletTransaction { chainId:string;from:string;to:string;data:string;value:string;nonce:string;gas:string;maxFeePerGas:string;maxPriorityFeePerGas:string }
export interface LaunchQuote { mode?: LaunchMode; confirmation?: string; launchFee?: string; purchase?: string; id:string;action:'resume'|'cancel';expiresAt:number;maximumNetworkFee:string;maximumTotal:string;transaction:WalletTransaction }
export function readQuote(value:unknown, signer:string, action:'resume'|'cancel'='resume'):LaunchQuote|null {
  const data=record(value);
  if (data.transaction===null) return null;
  const tx=record(data.transaction);
  const quantity=(v:unknown) => typeof v==='string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(v) && BigInt(v)<2n**256n;
  const decimal=(v:unknown) => typeof v==='string' && /^(0|[1-9][0-9]{0,77})$/.test(v) && BigInt(v)<2n**256n;
  if (typeof data.id!=='string' || !validAddress(tx.from) || tx.from.toLowerCase()!==signer.toLowerCase() || !validAddress(tx.to)
    || tx.chainId!=='0x1237' || typeof tx.data!=='string' || !/^0x([a-f0-9]{2})*$/i.test(tx.data)
    || !['value','nonce','gas','maxFeePerGas','maxPriorityFeePerGas'].every(key=>quantity(tx[key]))
    || !decimal(data.expiresAt) || !decimal(data.maximumNetworkFee) || !decimal(data.maximumTotal)) throw Error('The wallet transaction could not be verified.');
  if (BigInt(tx.gas as string)===0n || BigInt(tx.maxPriorityFeePerGas as string)>BigInt(tx.maxFeePerGas as string)
    || BigInt(data.maximumNetworkFee as string)!==BigInt(tx.gas as string)*BigInt(tx.maxFeePerGas as string)
    || BigInt(data.maximumTotal as string)!==BigInt(tx.value as string)+BigInt(data.maximumNetworkFee as string)) throw Error('The transaction fee review is inconsistent.');
  if (action==='cancel' && (tx.to.toLowerCase()!==tx.from.toLowerCase() || tx.value!=='0x0' || tx.data!=='0x')) throw Error('Invalid cancellation transaction.');
  const expiresAt=Number(data.expiresAt)*1000;
  if (!Number.isSafeInteger(expiresAt)) throw Error('Invalid transaction expiry.');
  if (data.mode !== undefined && !['connected','managed'].includes(String(data.mode))) throw Error('Invalid launch mode.');
  if (data.mode === 'managed' && (typeof data.confirmation !== 'string' || !/^[a-f0-9]{64}$/.test(data.confirmation)
    || !decimal(data.launchFee) || !decimal(data.purchase) || BigInt(data.launchFee as string) + BigInt(data.purchase as string) !== BigInt(tx.value as string))) throw Error('The managed launch review is inconsistent.');
  return {id:data.id,mode:data.mode === 'managed' ? 'managed' : 'connected',
    ...(data.mode === 'managed' ? {confirmation:data.confirmation as string,launchFee:data.launchFee as string,purchase:data.purchase as string} : {}),action,expiresAt,maximumNetworkFee:data.maximumNetworkFee as string,maximumTotal:data.maximumTotal as string,transaction:tx as unknown as WalletTransaction};
}
