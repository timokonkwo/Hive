// Loader-v3 instructions following the Solana SDK's bincode layout.
import {PublicKey,SystemProgram,TransactionInstruction,SYSVAR_RENT_PUBKEY,SYSVAR_CLOCK_PUBKEY} from '@solana/web3.js';
export const LOADER=new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const meta=(pubkey,isWritable=false,isSigner=false)=>({pubkey,isWritable,isSigner});
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
export const programDataAddress=program=>PublicKey.findProgramAddressSync([program.toBuffer()],LOADER)[0];
export function createBuffer(admin,buffer,bytes,rent){return [SystemProgram.createAccount({fromPubkey:admin,newAccountPubkey:buffer,lamports:rent,space:bytes+37,programId:LOADER}),new TransactionInstruction({programId:LOADER,keys:[meta(buffer,true),meta(admin)],data:u32(0)})];}
export function writeBuffer(admin,buffer,offset,data){if(!Number.isSafeInteger(offset)||offset<0||data.length<1||data.length>900)throw Error('Invalid loader write');return new TransactionInstruction({programId:LOADER,keys:[meta(buffer,true),meta(admin,false,true)],data:Buffer.concat([u32(1),u32(offset),u64(data.length),data])});}
export function deployProgram(admin,program,buffer,bytes,rent){return [SystemProgram.createAccount({fromPubkey:admin,newAccountPubkey:program,lamports:rent,space:36,programId:LOADER}),new TransactionInstruction({programId:LOADER,keys:[meta(admin,true,true),meta(programDataAddress(program),true),meta(program,true),meta(buffer,true),meta(SYSVAR_RENT_PUBKEY),meta(SYSVAR_CLOCK_PUBKEY),meta(SystemProgram.programId),meta(admin,false,true)],data:Buffer.concat([u32(2),u64(bytes)])})];}
