// Draft fixed grants. Unit amounts are integers; no proportional scaling or payment code.
export const bands=[
 {id:'under-1k',minimumRaw:1n,maximumExclusiveRaw:1000n*10n**9n,grantTokens:60n,label:'More than 0, below 1,000'},
 {id:'1k-10k',minimumRaw:1000n*10n**9n,maximumExclusiveRaw:10000n*10n**9n,grantTokens:600n,label:'1,000 to below 10,000'},
 {id:'10k-100k',minimumRaw:10000n*10n**9n,maximumExclusiveRaw:100000n*10n**9n,grantTokens:3000n,label:'10,000 to below 100,000'},
 {id:'100k-1m',minimumRaw:100000n*10n**9n,maximumExclusiveRaw:1000000n*10n**9n,grantTokens:15000n,label:'100,000 to below 1 million'},
 {id:'1m-10m',minimumRaw:1000000n*10n**9n,maximumExclusiveRaw:10000000n*10n**9n,grantTokens:60000n,label:'1 million to below 10 million'},
 {id:'10m-plus',minimumRaw:10000000n*10n**9n,maximumExclusiveRaw:null,grantTokens:150000n,label:'10 million or more'},
];
export function tierFor(amountRaw){
 if(typeof amountRaw!=='bigint'||amountRaw<0n)throw Error('Exact nonnegative bigint balance required');
 return bands.find(b=>amountRaw>=b.minimumRaw&&(b.maximumExclusiveRaw===null||amountRaw<b.maximumExclusiveRaw))??null;
}
