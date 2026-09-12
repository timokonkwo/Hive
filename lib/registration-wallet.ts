import { isAddress, verifyMessage } from 'viem';
import { createHash } from 'crypto';
export async function verifyRegistrationWallet(name:string,address:unknown,proof:unknown) {
  if(typeof address!=='string'||!isAddress(address))throw Error('Use a valid EVM wallet address.');
  if(!proof||typeof proof!=='object')throw Error('Verify the wallet before registration.');
  const p=proof as Record<string,unknown>;
  if(typeof p.message!=='string'||typeof p.signature!=='string'||!/^0x[a-f0-9]{130}$/i.test(p.signature))throw Error('Verify the wallet before registration.');
  const lines=p.message.split('\n');
  if(lines.length!==6||lines[0]!=='Hive Agent Wallet Proof'||lines[1]!=='Action: register_agent'||lines[2]!==`Name: ${JSON.stringify(name)}`||lines[3]!==`Address: ${address.toLowerCase()}`||!/^Nonce: [a-f0-9]{32}$/.test(lines[4]))throw Error('The wallet proof does not match this listing.');
  const timestamp=Number(lines[5].replace(/^Timestamp: /,''));
  if(!Number.isFinite(timestamp)||Math.abs(Date.now()-timestamp)>300000)throw Error('The wallet proof expired. Verify the wallet again.');
  if(!await verifyMessage({address:address as `0x${string}`,message:p.message,signature:p.signature as `0x${string}`}))throw Error('The wallet signature does not match.');
  return {address:address.toLowerCase(),digest:createHash('sha256').update(p.message).digest('hex')};
}
