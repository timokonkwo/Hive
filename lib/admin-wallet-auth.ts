import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
let keys:ReturnType<typeof createRemoteJWKSet>|undefined;
/** Wallet authority comes only from a signed identity for the authenticated account. */
export async function verifyAdminWallet(identityToken:string,userId:string,adminAddress:string,appId:string,key?:JWTVerifyGetKey):Promise<boolean>{
 if(!identityToken||!userId||!adminAddress||!appId)return false;
 try{
  const verifier=key||(keys??=createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`)));
  const {payload}=await jwtVerify(identityToken,verifier,{issuer:'privy.io',audience:appId,algorithms:['ES256'],requiredClaims:['sub','exp','iat']});
  if(payload.sub!==userId||typeof payload.linked_accounts!=='string')return false;
  const linked:unknown=JSON.parse(payload.linked_accounts);
  if(!Array.isArray(linked))return false;
  const evm=/^0x[a-fA-F0-9]{40}$/.test(adminAddress);
  return linked.some(account=>account&&account.type==='wallet'&&typeof account.address==='string'&&
   (evm?account.chain_type==='ethereum'&&account.address.toLowerCase()===adminAddress.toLowerCase():account.chain_type==='solana'&&account.address===adminAddress));
 }catch{return false;}
}
