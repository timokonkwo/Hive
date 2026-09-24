// Browser-only key handling. Never sends keys to the deployment server or storage.
import {Keypair,VersionedTransaction} from '@solana/web3.js';
import {getBase58Encoder} from '@solana/kit';
import {privateKeyToAccount} from 'viem/accounts';

export function localKeySigner(solanaText,evmText,expected) {
  let solana,evm,bytes;
  try {
    const value=solanaText.trim();
    if(value.startsWith('[')) {
      const parsed=JSON.parse(value);
      if(!Array.isArray(parsed)||parsed.length!==64||!parsed.every(x=>Number.isInteger(x)&&x>=0&&x<=255))throw Error();
      bytes=Uint8Array.from(parsed);parsed.fill(0);
    } else bytes=Uint8Array.from(getBase58Encoder().encode(value));
    if(bytes.length!==64)throw Error();
    solana=Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {throw Error('Enter a valid Solana private key: base58 or a 64-byte JSON array.');}
  finally {bytes?.fill(0);solanaText='';}
  if(solana.publicKey.toBase58()!==expected.solanaAdmin)throw Error('The Solana key does not match the reviewed admin wallet.');
  try {
    let key=evmText.trim();if(!key.startsWith('0x'))key='0x'+key;
    if(!/^0x[0-9a-f]{64}$/i.test(key))throw Error();
    evm=privateKeyToAccount(key);key='';
  }catch {throw Error('Enter a valid Robinhood private key: 64 hexadecimal characters.');}
  finally {evmText='';}
  if(evm.address.toLowerCase()!==expected.robinhoodAdmin.toLowerCase())throw Error('The Robinhood key does not match the reviewed admin wallet.');
  const active=()=>{if(!solana||!evm)throw Error('Keys are no longer loaded.');};
  return {
    solanaAddress:solana.publicKey.toBase58(),evmAddress:evm.address,
    signSolana(base64){active();const tx=VersionedTransaction.deserialize(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)));if(!tx.message.staticAccountKeys[0].equals(solana.publicKey))throw Error('Unexpected transaction fee payer.');tx.sign([solana]);return btoa(String.fromCharCode(...tx.serialize()));},
    async signEvm(t){active();if(t.from.toLowerCase()!==evm.address.toLowerCase()||BigInt(t.chainId)!==4663n||BigInt(t.value)!==0n)throw Error('Unexpected transaction account, chain or value.');return evm.signTransaction({chainId:4663,type:'eip1559',...(t.to?{to:t.to}:{}),data:t.data,value:0n,nonce:Number(BigInt(t.nonce)),gas:BigInt(t.gas),maxFeePerGas:BigInt(t.maxFeePerGas),maxPriorityFeePerGas:BigInt(t.maxPriorityFeePerGas)});},
    forget(){solana=null;evm=null;},
  };
}
