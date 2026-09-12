import type { Transaction } from '@solana/web3.js';
import { base58 } from '../task/payment';
import { signature } from '../task/model';
export type Wallet = { connect(): Promise<{ publicKey: { toString(): string } }>; signMessage?(bytes: Uint8Array, encoding: string): Promise<Uint8Array | { signature: Uint8Array }>; signTransaction?(transaction: Transaction): Promise<Transaction> };
export function provider(): Wallet { const w=window as unknown as { phantom?: {solana?:Wallet}; solana?:Wallet; solflare?:Wallet; backpack?:{solana?:Wallet} };const p=w.phantom?.solana||w.solana||w.solflare||w.backpack?.solana;if(!p)throw Error('Open Hive in your Solana wallet browser or connect a supported wallet extension.');return p; }
export async function walletProof(wallet: Wallet,address:string) { if(!wallet.signMessage)throw Error('This wallet cannot sign the ownership message.');const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16))).map(v=>v.toString(16).padStart(2,'0')).join('');const message=`Hive Solana Wallet Proof\nAction: link_wallet\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;const result=await wallet.signMessage(new TextEncoder().encode(message),'utf8');return {message,signature:base58(result instanceof Uint8Array?result:result.signature)}; }
export type DepositReference = { signature: string; amount: number; sender: string };
export async function transferDeposit(amount:number,sender:string,config:{treasury:string;mint:string},remember:(r:DepositReference)=>void,signal:AbortSignal) {
 const wallet=provider();const connected=await wallet.connect();signal.throwIfAborted();if(connected.publicKey.toString()!==sender)throw Error('Switch to your linked Solana wallet before depositing.');if(!wallet.signTransaction)throw Error('This wallet cannot sign the deposit.');
 const [{Connection,PublicKey,Transaction},spl]=await Promise.all([import('@solana/web3.js'),import('@solana/spl-token')]);signal.throwIfAborted();
 const connection=new Connection(`${location.origin}/api/solana/rpc`,{commitment:'confirmed',fetch:(url,options)=>fetch(url,{...options,signal})});const from=new PublicKey(sender),to=new PublicKey(config.treasury),mint=new PublicKey(config.mint);
 const [source,destination]=await Promise.all([spl.getAssociatedTokenAddress(mint,from),spl.getAssociatedTokenAddress(mint,to)]);const tx=new Transaction();const account=await connection.getAccountInfo(destination);if(!account)tx.add(spl.createAssociatedTokenAccountInstruction(from,destination,to,mint));
 tx.add(spl.createTransferCheckedInstruction(source,mint,destination,from,BigInt(Math.round(amount*1e6)),6));const block=await connection.getLatestBlockhash();tx.recentBlockhash=block.blockhash;tx.feePayer=from;
 signal.throwIfAborted();const signed=await wallet.signTransaction(tx);signal.throwIfAborted();const sig=signed.signature?base58(signed.signature):'';if(!signature(sig))throw Error('The wallet did not return a signed deposit.');remember({signature:sig,amount,sender});
 const sent=await connection.sendRawTransaction(signed.serialize(),{skipPreflight:false,maxRetries:3});if(sent!==sig)throw Error('Deposit confirmation did not match. Verify the saved deposit.');
 await connection.confirmTransaction({...block,signature:sig},'confirmed');return sig;
}
