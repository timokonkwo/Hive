// Read-only mainnet acceptance: build and simulate. No payer signing or broadcasting.
import env from '@next/env';
import { createRequire } from 'node:module';
import { pump, sessions, solanaJournal, solanaRuntime } from './modules.mjs';
const require = createRequire(import.meta.url);
const { Keypair, PublicKey } = require('@solana/web3.js');
env.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
try {
  const connection = solanaRuntime.launchConnection(), payer = new PublicKey(sessions.HIVE_SOLANA_FEE_WALLET);
  const metadata = { name: 'Hive simulation', symbol: 'HIVESIM', description: 'Local transaction simulation.',
    socials: { website: 'https://uphive.xyz/agent/id/000000000000000000000001', twitter: '', telegram: '' } };
  const purchases = process.env.PUMP_LAUNCH_LOOKUP_TABLE ? [0n, 1_000_000n] : [0n];
  console.log(JSON.stringify({ initialPurchaseConfigured: purchases.length > 1 }));
  for (const purchase of purchases) {
    const built = await pump.buildPumpLaunch(connection, { mint: Keypair.generate(), payer, metadata, purchase,
      uri: `https://res.cloudinary.com/hive/raw/upload/v1/hive-agent-tokens/${'0'.repeat(64)}.json` });
    const review = await solanaJournal.reviewSolanaTransaction(connection, built.transaction, payer.toBase58(), purchase + 100_000_000n, built.lifetime);
    console.log(JSON.stringify({ purchaseLamports: purchase.toString(), maximumDebitLamports: review.maximumDebit,
      networkFeeLamports: review.networkFee, bytes: built.transaction.serialize().length, simulated: true, broadcast: false }));
  }
} catch (error) {
  // Provider errors may include secret RPC URLs; output only application-owned errors.
  console.error(error instanceof sessions.SessionConflict ? error.message : 'Pump simulation could not complete.');
  process.exitCode = 1;
}
