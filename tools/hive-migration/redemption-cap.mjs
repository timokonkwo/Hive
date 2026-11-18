// Server-side calculation only. Snapshot and ledger values must come from trusted storage.
// Amounts are raw Solana units (9 decimals), not Robinhood token units.
export function redemptionCap({snapshotRaw,currentSpendableRaw,settledRaw=0n,reservedRaw=0n,claimCompleted=false}) {
 for(const value of [snapshotRaw,currentSpendableRaw,settledRaw,reservedRaw]){
  if(typeof value!=='bigint'||value<0n)throw Error('Exact nonnegative bigint amount required');
 }
 if(typeof claimCompleted!=='boolean')throw Error('claimCompleted must be boolean');
 if(settledRaw+reservedRaw>snapshotRaw)throw Error('Ledger exceeds snapshot allowance');
 if(claimCompleted)return 0n;
 const remaining=snapshotRaw-settledRaw-reservedRaw;
 return remaining<currentSpendableRaw?remaining:currentSpendableRaw;
}
