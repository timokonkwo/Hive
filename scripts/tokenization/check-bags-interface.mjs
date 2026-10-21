// Public chain evidence only. No signing or transaction broadcast.
import env from '@next/env';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { Connection, PublicKey } = require('@solana/web3.js');
const { BorshAccountsCoder, BorshInstructionCoder } = require('@coral-xyz/anchor');
const idl = require('../../lib/agent-tokenization/idl/bags-fee-share-v2.json');
env.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'finalized');
const signature = process.argv[2] || '4gAEL7BHJ5WxJKSDk4iJy81vHyAY52U37umTwANkRdgj9N1rnJx9DShNvu8KS75P9f88GLP4cAeFBagwuCCeVTA6';
const receipt = await connection.getTransaction(signature, { commitment:'finalized', maxSupportedTransactionVersion:0 });
if (!receipt || receipt.meta?.err) throw Error('A successful finalized receipt is required.');
const keys = receipt.transaction.message.getAccountKeys({ accountKeysFromLookups: receipt.meta.loadedAddresses });
const ix = receipt.transaction.message.compiledInstructions.find(ix => keys.get(ix.programIdIndex).toBase58() === idl.address && new BorshInstructionCoder(idl).decode(Buffer.from(ix.data))?.name === 'create_fee_config_with_deployer');
if (!ix) throw Error('Receipt has no current fee configuration.');
const definition = idl.instructions.find(i => i.name === 'create_fee_config_with_deployer');
const addresses = Object.fromEntries(definition.accounts.map((a,i) => [a.name, keys.get(ix.accountKeyIndexes[i]).toBase58()]));
const accountData = {};
const coder = new BorshAccountsCoder(idl);
for (const [name,type] of [['fee_share_config','FeeShareConfigHeader'],['deployer_config','DeployerConfig'],['deployer_vault','DeployerVault'],['program_config','ProgramConfig']]) {
  const info = await connection.getAccountInfo(new PublicKey(addresses[name]), 'finalized');
  if (!info || info.owner.toBase58() !== idl.address) throw Error('Unexpected account owner.');
  accountData[name] = { address:addresses[name], owner:info.owner.toBase58(), data:info.data.toString('base64') };
  console.log(JSON.stringify({ name, bytes:info.data.length, decoded:coder.decode(type, info.data), ...(name === 'fee_share_config' ? { tail:info.data.subarray(coder.size(type)).toString('hex') } : {}) }));
}
const fixture = { signature, slot:receipt.slot, message:Buffer.from(receipt.transaction.message.serialize()).toString('base64'), signatures:receipt.transaction.signatures,
  loadedAddresses: { writable:receipt.meta.loadedAddresses.writable.map(k=>k.toBase58()), readonly:receipt.meta.loadedAddresses.readonly.map(k=>k.toBase58()) },
  addresses, params:new BorshInstructionCoder(idl).decode(Buffer.from(ix.data)).data, claimers:ix.accountKeyIndexes.slice(definition.accounts.length).map(i=>keys.get(i).toBase58()), accounts:accountData };
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(fixture, null, 2) + '\n');
console.log(JSON.stringify({ signature, slot:receipt.slot, claimers:fixture.claimers, params:fixture.params }));
