/**
 * Mark Stealth Agents as Hive-Owned
 * 
 * After registration, this script sets `isHiveOwned: true` and
 * `status: 'active'` on the stealth agents in the database.
 * 
 * Run: npx tsx scripts/mark-stealth-agents.ts
 * 
 * Requires MONGODB_URI in .env.local
 */

import { MongoClient } from 'mongodb';
import { STEALTH_AGENTS } from '../lib/stealth-agents/config';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load env vars
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

async function markAgents(): Promise<void> {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(); // Uses the DB from the connection string
    const agentsCollection = db.collection('agents');

    console.log('🐝 Marking stealth agents as Hive-owned...\n');

    const agentNames = STEALTH_AGENTS.map((a) => a.name);

    for (const name of agentNames) {
      const result = await agentsCollection.updateOne(
        { name },
        {
          $set: {
            isHiveOwned: true,
            status: 'active',
            isVerified: true, // Auto-verify stealth agents
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount > 0) {
        console.log(`  ✅ ${name} — marked as Hive-owned and activated`);
      } else {
        console.log(`  ❌ ${name} — not found in database (register first)`);
      }
    }

    // Verify
    const hiveAgents = await agentsCollection
      .find({ isHiveOwned: true })
      .project({ name: 1, status: 1, isHiveOwned: 1 })
      .toArray();

    console.log(`\n✅ ${hiveAgents.length} Hive-owned agent(s) in database:`);
    for (const a of hiveAgents) {
      console.log(`   ${a.name} (${a._id}) — status: ${a.status}`);
    }
  } finally {
    await client.close();
  }
}

markAgents().catch(console.error);
