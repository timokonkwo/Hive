import type { Db } from 'mongodb';
import { ComputeBudgetProgram, PublicKey, TransactionMessage, VersionedTransaction, type Connection } from '@solana/web3.js';
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PUMP_SDK, PUMP_PROGRAM_ID, OnlinePumpSdk, bondingCurvePda, creatorVaultPda, getPumpProgram } from '@pump-fun/pump-sdk';
import { PUMP_AMM_SDK, PUMP_AMM_PROGRAM_ID, OnlinePumpAmmSdk, canonicalPumpPoolPda, coinCreatorVaultAuthorityPda } from '@pump-fun/pump-swap-sdk';
import type { ManagedFeeClient } from '../agent-fees';
import { HIVE_SOLANA_FEE_WALLET, SessionConflict } from './session';
import { signManagedSolana } from './solana-signer';
import { SOLANA_MAINNET_GENESIS, verifySignedTransaction } from './solana-journal';

type Position = { kind:'curve'|'pool'|'curve-vault'|'pool-vault'; mint?:PublicKey; amount:bigint };
const wallet=new PublicKey(HIVE_SOLANA_FEE_WALLET);
const integer=(value:{toString():string})=>{
  if(!/^\d+$/.test(value.toString())) throw new SessionConflict('The creator fee balance is unavailable.');
  return BigInt(value.toString());
};
const native=(mint:PublicKey)=>mint.equals(PublicKey.default)||mint.equals(NATIVE_MINT);
// pump-sdk 4.2.0 onlineSdk.readPoolFields uses this append-only AMM layout;
// pump-swap-sdk 1.20.0 still omits the new fee bucket from its Pool type.
export const pumpPoolCreatorFees=(data:Buffer)=>data.length>=287?data.readBigUInt64LE(279):0n;

/** Creator fees already in vaults plus v3 curve/v2 pool fees still awaiting a sweep. */
export class PumpFeeClient implements ManagedFeeClient {
  readonly source='pump' as const;
  private positions=new Map<string,Position>();
  private online:OnlinePumpSdk;
  private amm:OnlinePumpAmmSdk;
  constructor(private db:Db, readonly connection:Connection) {
    this.online=new OnlinePumpSdk(connection);this.amm=new OnlinePumpAmmSdk(connection);
  }
  getWalletAddress(){return HIVE_SOLANA_FEE_WALLET;}
  async getClaimablePositions(){
    if(await this.connection.getGenesisHash()!==SOLANA_MAINNET_GENESIS) throw new SessionConflict('The RPC is not on Solana mainnet.');
    this.positions.clear();
    const [curveVault,poolVault,mints]=await Promise.all([
      this.online.getCreatorVaultBalance(wallet),this.amm.getCoinCreatorVaultBalance(wallet),
      this.db.collection('agent_token_catalog').distinct('token.address',{platform:'pump','token.network':'solana'}),
    ]);
    const unique=[...new Set(mints.map(value=>new PublicKey(value).toBase58()))];
    // Bound each RPC read; a failed batch is an unknown balance, never zero.
    for(let start=0;start<unique.length;start+=40){
      const batch=unique.slice(start,start+40).map(value=>new PublicKey(value));
      const addresses=batch.flatMap(mint=>[bondingCurvePda(mint),canonicalPumpPoolPda(mint)]);
      const infos=await this.connection.getMultipleAccountsInfo(addresses,'confirmed');
      batch.forEach((mint,index)=>{
        const curveInfo=infos[index*2],poolInfo=infos[index*2+1];
        if(curveInfo){
          if(!curveInfo.owner.equals(PUMP_PROGRAM_ID)) throw new SessionConflict('Unexpected bonding curve account.');
          const curve=PUMP_SDK.decodeBondingCurve(curveInfo);
          if(curve.creator.equals(wallet) && native(curve.quoteMint)) this.positions.set(addresses[index*2].toBase58(),{kind:'curve',mint,amount:integer(curve.creatorFee)});
        }
        if(poolInfo){
          if(!poolInfo.owner.equals(PUMP_AMM_PROGRAM_ID)) throw new SessionConflict('Unexpected trading pool account.');
          const pool=PUMP_AMM_SDK.decodePool(poolInfo);
          if(!pool.baseMint.equals(mint)) throw new SessionConflict('The trading pool mint differs.');
          if(pool.coinCreator.equals(wallet) && native(pool.quoteMint)) this.positions.set(addresses[index*2+1].toBase58(),{kind:'pool',mint,amount:pumpPoolCreatorFees(poolInfo.data)});
        }
      });
    }
    // Aggregate vault funds are counted once, independently from unswept token fees.
    this.positions.set(creatorVaultPda(wallet).toBase58(),{kind:'curve-vault',amount:integer(curveVault)});
    this.positions.set(coinCreatorVaultAuthorityPda(wallet).toBase58(),{kind:'pool-vault',amount:integer(poolVault)});
    return [...this.positions].map(([baseMint,position])=>({baseMint,totalClaimableLamportsUserShare:position.amount.toString()}));
  }
  async prepareClaimTransactions(id:string){
    const position=this.positions.get(id);
    if(!position) throw new SessionConflict('Refresh creator fee balances first.');
    const instructions=[];
    const curve=position.kind==='curve'||position.kind==='curve-vault';
    if(position.kind==='curve'){
      const latest=await this.online.fetchBondingCurve(position.mint!);
      if(!latest.creator.equals(wallet)||!native(latest.quoteMint)) throw new SessionConflict('The creator fee recipient changed.');
      if(integer(latest.creatorFee)===0n) return [];
      instructions.push(await PUMP_SDK.sweepCreatorFeeInstruction({payer:wallet,mint:position.mint!,creator:wallet,quoteMint:NATIVE_MINT,quoteTokenProgram:TOKEN_PROGRAM_ID}));
    } else if(position.kind==='pool'){
      const info=await this.connection.getAccountInfo(canonicalPumpPoolPda(position.mint!),'confirmed');
      if(!info?.owner.equals(PUMP_AMM_PROGRAM_ID)) throw new SessionConflict('The trading pool is unavailable.');
      const latest=PUMP_AMM_SDK.decodePool(info);
      if(!latest.coinCreator.equals(wallet)||!native(latest.quoteMint)||!latest.baseMint.equals(position.mint!)) throw new SessionConflict('The creator fee recipient changed.');
      if(pumpPoolCreatorFees(info.data)===0n) return [];
      instructions.push(await PUMP_SDK.sweepPoolCreatorFeeInstruction({payer:wallet,mint:position.mint!,coinCreator:wallet,quoteMint:NATIVE_MINT,quoteTokenProgram:TOKEN_PROGRAM_ID}));
    } else if(integer(curve?await this.online.getCreatorVaultBalance(wallet):await this.amm.getCoinCreatorVaultBalance(wallet))===0n) return [];
    if(curve) instructions.push(await getPumpProgram(this.connection).methods.collectCreatorFee().accountsPartial({creator:wallet}).instruction());
    else instructions.push(...await PUMP_AMM_SDK.collectCoinCreatorFee(await this.amm.collectCoinCreatorFeeSolanaState(wallet),wallet));
    const blockhash=await this.connection.getLatestBlockhash('confirmed');
    const transaction=new VersionedTransaction(new TransactionMessage({payerKey:wallet,recentBlockhash:blockhash.blockhash,
      instructions:[ComputeBudgetProgram.setComputeUnitLimit({units:400000}),...instructions]}).compileToV0Message());
    if(transaction.serialize().length>1232) throw new SessionConflict('The creator fee transaction is too large.');
    const [before,simulation]=await Promise.all([this.connection.getBalance(wallet,'confirmed'),this.connection.simulateTransaction(transaction,{sigVerify:false,commitment:'confirmed',accounts:{encoding:'base64',addresses:[HIVE_SOLANA_FEE_WALLET]}})]);
    const after=simulation.value.accounts?.[0]?.lamports;
    if(simulation.value.err||!Number.isSafeInteger(before)||!Number.isSafeInteger(after)||BigInt(before)-BigInt(after!)>10_000_000n) throw new SessionConflict('Creator fee collection could not be simulated within its cost limit.');
    return [{transaction,blockhash}];
  }
  signTransaction(transaction:VersionedTransaction){
    const original=VersionedTransaction.deserialize(transaction.serialize());
    const bytes=signManagedSolana(transaction);verifySignedTransaction(original,bytes);return bytes;
  }
}
