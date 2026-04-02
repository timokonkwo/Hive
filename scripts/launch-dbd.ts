/**
 * Standalone token launch script: DownBadDog ($DBD)
 * NOT affiliated with Hive Protocol.
 *
 * Usage: npx tsx scripts/launch-dbd.ts
 */

import { BagsSDK } from '@bagsfm/bags-sdk';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { config } from 'dotenv';
config({ path: '.env.local' });

// ── Config ──

const PARTNER_KEY = '8NPLPSuPgQduPFN7EESsLvPzbE8xaDewqgrf4JR5B6Tv';
const BAGS_CONFIG_TYPE = 'fa29606e-5e48-4c37-827f-4b03d58ee23d';
const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

const TOKEN = {
  name: 'DGAF Dog',
  symbol: 'DGAF',
  description: 'The cutest dog on Solana that doesn\'t give a single f***. Double middle paws up, zero cares given. $DGAF',
  website: 'https://x.com/animalesaprieto/status/2038995328309797012',
  twitter: 'https://x.com/animalesaprieto/status/2038995328309797012',
};

const INITIAL_BUY_SOL = 1.0;
const IMAGE_PATH = path.resolve('/Users/tim/Desktop/animal dgaf.png');

// ── Helpers ──

function parseKeypair(raw: string): Keypair {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed)));
  }
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

async function main() {
  console.log('\n🐕 DownBadDog ($DBD) Token Launch');
  console.log('='.repeat(40));

  // Validate env
  const apiKey = process.env.BAGS_API_KEY;
  const keypairRaw = process.env.HIVE_LAUNCH_KEYPAIR;

  if (!apiKey) throw new Error('BAGS_API_KEY not set in env');
  if (!keypairRaw) throw new Error('HIVE_LAUNCH_KEYPAIR not set in env');

  const keypair = parseKeypair(keypairRaw);
  const wallet = keypair.publicKey.toBase58();
  console.log(`Wallet: ${wallet}`);
  console.log(`Partner key: ${PARTNER_KEY}`);

  // Verify wallet matches expected
  if (wallet !== '4hCugSjpD1uUdDaSMLcRstSgRJVrbgLWDwQZxMHyg78n') {
    console.warn(`⚠ WARNING: Wallet ${wallet} does not match expected 4hCugSjpD1uUdDaSMLcRstSgRJVrbgLWDwQZxMHyg78n`);
    console.warn('Continuing anyway...');
  }

  // Check image
  if (!fs.existsSync(IMAGE_PATH)) throw new Error(`Image not found: ${IMAGE_PATH}`);
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  console.log(`Image: ${IMAGE_PATH} (${(imageBuffer.length / 1024).toFixed(0)}KB)`);

  // Check SOL balance
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(keypair.publicKey);
  const balanceSol = balance / 1e9;
  console.log(`Balance: ${balanceSol.toFixed(4)} SOL`);

  if (balanceSol < INITIAL_BUY_SOL + 0.02) {
    throw new Error(`Insufficient balance. Need ~${(INITIAL_BUY_SOL + 0.02).toFixed(2)} SOL, have ${balanceSol.toFixed(4)} SOL`);
  }

  // Init SDK
  const sdk = new BagsSDK(apiKey, connection, 'confirmed');

  // Step 1: Create token info + upload image
  console.log('\n📝 Step 1: Creating token info & uploading image...');
  const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
    name: TOKEN.name,
    symbol: TOKEN.symbol,
    description: TOKEN.description,
    image: imageBuffer,
    twitter: TOKEN.twitter,
    website: TOKEN.website,
  });

  console.log(`  Mint: ${tokenInfo.tokenMint}`);
  console.log(`  Metadata: ${tokenInfo.tokenMetadata}`);
  if (tokenInfo.tokenLaunch?.image) {
    console.log(`  Image URL: ${tokenInfo.tokenLaunch.image}`);
  }

  // ── VERIFICATION PAUSE ──
  console.log('\n' + '='.repeat(40));
  console.log('🔍 PRE-LAUNCH VERIFICATION');
  console.log(`  Token:    ${TOKEN.name} ($${TOKEN.symbol})`);
  console.log(`  Mint:     ${tokenInfo.tokenMint}`);
  console.log(`  Image:    ${tokenInfo.tokenLaunch?.image || 'CHECK METADATA URL'}`);
  console.log(`  Buy:      ${INITIAL_BUY_SOL} SOL`);
  console.log(`  Wallet:   ${wallet}`);
  console.log(`  Balance:  ${balanceSol.toFixed(4)} SOL`);
  console.log('='.repeat(40));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => {
    rl.question('\n⚡ Proceed with launch? (yes/no): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Launch cancelled.');
    process.exit(0);
  }

  console.log('\n🚀 Launching...');

  const initialBuyLamports = Math.floor(INITIAL_BUY_SOL * 1e9);

  // Step 2: Create fee share config
  console.log('\n💰 Step 2: Creating fee share config...');
  const configRes = await fetch(`${BAGS_API_BASE}/fee-share/config`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payer: wallet,
      baseMint: tokenInfo.tokenMint,
      claimersArray: [wallet],
      basisPointsArray: [10000],
      bagsConfigType: BAGS_CONFIG_TYPE,
      partner: wallet,
      partnerConfig: PARTNER_KEY,
    }),
  });

  if (!configRes.ok) {
    const err = await configRes.json().catch(() => ({}));
    throw new Error(`Fee share config failed: ${JSON.stringify(err)}`);
  }

  const configData = await configRes.json();
  const meteoraConfigKey = configData.response?.meteoraConfigKey;
  if (!meteoraConfigKey) throw new Error('No meteoraConfigKey returned');
  console.log(`  meteoraConfigKey: ${meteoraConfigKey}`);

  // Sign config txs if needed
  if (configData.response.needsCreation && configData.response.transactions?.length > 0) {
    console.log(`  Signing ${configData.response.transactions.length} config tx(s)...`);
    for (const txData of configData.response.transactions) {
      const txStr = typeof txData === 'string' ? txData : txData.transaction;
      const tx = VersionedTransaction.deserialize(bs58.decode(txStr));
      tx.sign([keypair]);
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 5 });
      console.log(`  Config tx: ${sig}`);
    }
    console.log('  Waiting for config confirmation...');
    await new Promise(r => setTimeout(r, 5000));
  }

  // Step 3: Create launch transaction
  console.log('\n🚀 Step 3: Creating launch transaction...');
  const launchRes = await fetch(`${BAGS_API_BASE}/token-launch/create-launch-transaction`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ipfs: tokenInfo.tokenMetadata,
      tokenMint: tokenInfo.tokenMint,
      wallet,
      initialBuyLamports,
      configKey: meteoraConfigKey,
    }),
  });

  if (!launchRes.ok) {
    const err = await launchRes.json().catch(() => ({}));
    throw new Error(`Launch tx creation failed: ${JSON.stringify(err)}`);
  }

  const launchData = await launchRes.json();
  const launchTx = VersionedTransaction.deserialize(bs58.decode(launchData.response));

  // Step 4: Sign + broadcast + confirm
  console.log('\n✍️  Step 4: Signing and broadcasting...');
  launchTx.sign([keypair]);
  const txSignature = await connection.sendRawTransaction(launchTx.serialize(), {
    skipPreflight: false,
    maxRetries: 5,
  });
  console.log(`  Tx: ${txSignature}`);

  console.log('  Confirming...');
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({
    signature: txSignature,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }, 'confirmed');

  // Done!
  console.log('\n' + '='.repeat(40));
  console.log('✅ TOKEN LAUNCHED SUCCESSFULLY!');
  console.log(`  Name:     ${TOKEN.name}`);
  console.log(`  Symbol:   $${TOKEN.symbol}`);
  console.log(`  Mint:     ${tokenInfo.tokenMint}`);
  console.log(`  Tx:       ${txSignature}`);
  console.log(`  Bags URL: https://bags.fm/${tokenInfo.tokenMint}`);
  console.log(`  Solscan:  https://solscan.io/tx/${txSignature}`);
  console.log(`  Buy:      ${INITIAL_BUY_SOL} SOL`);
  console.log('='.repeat(40) + '\n');
}

main().catch(err => {
  console.error('\n❌ Launch failed:', err.message);
  process.exit(1);
});
