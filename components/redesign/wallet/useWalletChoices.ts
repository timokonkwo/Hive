"use client";
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignMessage } from '@privy-io/react-auth/solana';
import { stringToHex } from 'viem';
import { base58 } from '../task/payment';
import { robinhoodChain } from '@/lib/robinhood-chain';
import type { WalletNetwork } from '@/lib/agent-wallet-message';
export type WalletChoice = { address: string; label: string; sign(message: string): Promise<string> };
export function useWalletChoices() {
  const { ready, connectWallet } = usePrivy(), evm = useWallets(), solana = useSolanaWallets(), { signMessage } = useSignMessage();
  const choices: Record<WalletNetwork, WalletChoice[]> = {
    robinhood: evm.wallets.map(w => ({ address: w.address.toLowerCase(), label: w.walletClientType || 'Wallet', async sign(message) {
      await w.switchChain(robinhoodChain.id);
      const provider = await w.getEthereumProvider();
      const [chain, accounts] = await Promise.all([provider.request({ method: 'eth_chainId' }), provider.request({ method: 'eth_accounts' })]);
      if (Number(chain) !== robinhoodChain.id) throw Error('Switch your wallet to Robinhood Chain and try again.');
      if (!Array.isArray(accounts) || !accounts.some(a => String(a).toLowerCase() === w.address.toLowerCase())) throw Error('The connected wallet changed. Select it again.');
      const sig = await provider.request({ method: 'personal_sign', params: [stringToHex(message), w.address] });
      if (typeof sig !== 'string' || !/^0x[a-f0-9]{130}$/i.test(sig)) throw Error('The wallet did not return an ownership signature.');
      return sig;
    } })),
    solana: solana.wallets.map(w => ({ address: w.address, label: 'Solana wallet', async sign(message) {
      const { signature } = await signMessage({ wallet: w, message: new TextEncoder().encode(message) });
      if (signature.length !== 64) throw Error('The wallet did not return an ownership signature.');
      return base58(signature);
    } })),
  };
  return { ready, choices, connect(network: WalletNetwork) { connectWallet({ walletChainType: network === 'robinhood' ? 'ethereum-only' : 'solana-only' }); } };
}
