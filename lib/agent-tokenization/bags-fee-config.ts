import { BorshAccountsCoder, BorshInstructionCoder, type Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, type TransactionInstruction } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import feeIdl from './idl/bags-fee-share-v2.json';
import { HIVE_SOLANA_FEE_WALLET, SessionConflict } from './session';

export const BAGS_FEE_PROGRAM = new PublicKey(feeIdl.address);
const accountCoder = new BorshAccountsCoder(feeIdl as Idl);
const instructionCoder = new BorshInstructionCoder(feeIdl as Idl);
const pda = (seed: string, ...keys: PublicKey[]) => PublicKey.findProgramAddressSync([Buffer.from(seed), ...keys.map(k=>k.toBuffer())], BAGS_FEE_PROGRAM)[0];
export const bagsAuthority = (mint: string) => pda('fee_share_authority', new PublicKey(mint), NATIVE_MINT);
export const bagsConfigAddress = (mint: string) => pda('fee_share_config', new PublicKey(mint), NATIVE_MINT);
export const bagsDeployerConfig = (mint: string) => pda('deployer_config', new PublicKey(mint), NATIVE_MINT);
export const bagsDeployerVault = (payer: string) => pda('deployer_vault', new PublicKey(payer));
const fail = () => { throw new SessionConflict('Bags fee recipients or deployer terms differ from this review.'); };
const same = (key: PublicKey | undefined, expected: PublicKey) => !!key?.equals(expected);

type FeeHeader = { base_mint:PublicKey; quote_mint:PublicKey; partner:PublicKey; partner_config:PublicKey; manager:PublicKey;
  custom_platform_bps:number; is_init_finalized:number; is_update_locked:number; is_separate_deployer:number };
/** Official fixed header followed by Borsh Vec<Pubkey>, Vec<u16>. Public chain fixtures cover both lengths. */
export function decodeBagsFeeConfig(data: Buffer) {
  const header = accountCoder.decode('FeeShareConfigHeader', data) as FeeHeader;
  let offset = accountCoder.size('FeeShareConfigHeader');
  if (data.length < offset + 4) fail();
  const count = data.readUInt32LE(offset); offset += 4;
  if (!count || count > 100 || data.length !== offset + count * 32 + 4 + count * 2) fail();
  const claimers = Array.from({length:count},()=>{ const key=new PublicKey(data.subarray(offset,offset+32)); offset+=32; return key; });
  if (data.readUInt32LE(offset) !== count) fail(); offset += 4;
  const bps = Array.from({length:count},()=>{ const value=data.readUInt16LE(offset); offset+=2; return value; });
  if (bps.some(value=>value>10000) || bps.reduce((sum,value)=>sum+value,0)!==10000) fail();
  return { header, claimers, bps };
}

export async function validateBagsFeeInstruction(connection: Connection, ix: TransactionInstruction, mint: string, payer: string) {
  const decoded = instructionCoder.decode(ix.data);
  if (!decoded || !['create_fee_config_with_deployer','update_fee_config_manager'].includes(decoded.name)) fail();
  const params = (decoded!.data as {params:Record<string,unknown>}).params;
  if (decoded!.name === 'create_fee_config_with_deployer' && (JSON.stringify(params.bps) !== '[10000]' || params.finalize_init !== true || params.deployer_fee_collection_mode !== 1
    || params.deployer_fee_collection_platform_bps !== 0 || params.deployer_fee_collection_claimers_bps !== 2500)) fail();
  // Reject extra trailing instruction bytes, not only a valid prefix.
  if (!instructionCoder.encode(decoded!.name, decoded!.data).equals(ix.data)) fail();
  const programConfig = pda('program_config');
  const info = await connection.getAccountInfo(programConfig, 'finalized');
  if (!info?.owner.equals(BAGS_FEE_PROGRAM)) fail();
  const admin = (accountCoder.decode('ProgramConfig', info!.data) as {admin:PublicKey}).admin;
  const authority = bagsAuthority(mint), vault = bagsDeployerVault(payer);
  const expected = decoded!.name === 'update_fee_config_manager'
    ? [new PublicKey(payer),admin,programConfig,bagsConfigAddress(mint),authority,new PublicKey(payer),new PublicKey(mint),NATIVE_MINT,SystemProgram.programId,pda('__event_authority'),BAGS_FEE_PROGRAM]
    : [new PublicKey(payer), admin, programConfig, bagsConfigAddress(mint), authority,
    getAssociatedTokenAddressSync(NATIVE_MINT,authority,true), BAGS_FEE_PROGRAM, BAGS_FEE_PROGRAM, new PublicKey(payer),
    bagsDeployerConfig(mint), vault, getAssociatedTokenAddressSync(NATIVE_MINT,vault,true), new PublicKey(mint), NATIVE_MINT,
    SystemProgram.programId, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, pda('__event_authority'), BAGS_FEE_PROGRAM, new PublicKey(HIVE_SOLANA_FEE_WALLET)];
  if (ix.keys.length !== expected.length || expected.some((key,index)=>!same(ix.keys[index]?.pubkey,key))) fail();
  const definition = feeIdl.instructions.find(i=>i.name === decoded!.name)!;
  definition.accounts.forEach((account,index)=>{
    if (('signer' in account && account.signer && !ix.keys[index].isSigner)
      || ('writable' in account && account.writable && !ix.keys[index].isWritable)) fail();
  });
  return { kind:decoded!.name === 'create_fee_config_with_deployer' ? 'fee-config' as const : 'manager' as const, admin };
}

export async function verifyBagsFeeState(connection: Connection, mint: string, payer: string) {
  const addresses = [bagsConfigAddress(mint), bagsDeployerConfig(mint), bagsDeployerVault(payer), bagsAuthority(mint)];
  const infos = await connection.getMultipleAccountsInfo(addresses, 'finalized');
  if (infos.length !== addresses.length || infos.some(info=>!info?.owner.equals(BAGS_FEE_PROGRAM))) fail();
  const {header,claimers,bps} = decodeBagsFeeConfig(infos[0]!.data);
  if (!same(header.base_mint,new PublicKey(mint)) || !same(header.quote_mint,NATIVE_MINT)
    || !same(header.partner,PublicKey.default) || !same(header.partner_config,PublicKey.default)
    || !(same(header.manager,PublicKey.default) || same(header.manager,new PublicKey(payer)))
    || header.custom_platform_bps !== 0 || header.is_init_finalized !== 1 || header.is_update_locked !== 0 || header.is_separate_deployer !== 1
    || claimers.length !== 1 || !same(claimers[0],new PublicKey(HIVE_SOLANA_FEE_WALLET)) || bps[0] !== 10000) fail();
  const deployer = accountCoder.decode('DeployerConfig',infos[1]!.data) as {deployer:PublicKey;fee_collection_mode:number;fee_collection_platform_bps:number;fee_collection_claimers_bps:number};
  const vault = accountCoder.decode('DeployerVault',infos[2]!.data) as {deployer:PublicKey};
  const authority = accountCoder.decode('FeeShareAuthorityHeader',infos[3]!.data) as {config:PublicKey};
  if (!same(deployer.deployer,new PublicKey(payer)) || !same(vault.deployer,new PublicKey(payer))
    || deployer.fee_collection_mode !== 1 || deployer.fee_collection_platform_bps !== 0 || deployer.fee_collection_claimers_bps !== 2500
    || !same(authority.config,addresses[0])) fail();
}
