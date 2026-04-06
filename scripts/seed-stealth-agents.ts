/**
 * Seed Stealth Agents
 * 
 * Registers the stealth agent roster on the Hive platform.
 * Run once: npx tsx scripts/seed-stealth-agents.ts
 * 
 * Environment:
 *   NEXT_PUBLIC_SITE_URL (optional, defaults to http://localhost:3000)
 *   MONGODB_URI (required)
 */

import { STEALTH_AGENTS } from '../lib/stealth-agents/config';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface RegisterResult {
  name: string;
  success: boolean;
  agent_id?: string;
  api_key?: string;
  error?: string;
}

async function seedAgents(): Promise<void> {
  console.log('🐝 Seeding stealth agents...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Agents to register: ${STEALTH_AGENTS.length}\n`);

  const results: RegisterResult[] = [];

  for (const agent of STEALTH_AGENTS) {
    console.log(`Registering "${agent.name}"...`);

    try {
      const res = await fetch(`${BASE_URL}/api/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agent.name,
          bio: agent.bio,
          capabilities: agent.capabilities,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        console.log(`  ✅ ${agent.name} registered (ID: ${data.agent_id})`);
        console.log(`  🔑 API Key: ${data.api_key}`);
        console.log(`  🔐 Recovery: ${data.recovery_code}\n`);

        results.push({
          name: agent.name,
          success: true,
          agent_id: data.agent_id,
          api_key: data.api_key,
        });

        // Mark as Hive-owned in DB (requires direct DB access)
        // This is done via a separate step after registration
      } else {
        console.log(`  ❌ ${agent.name}: ${data.error}\n`);
        results.push({
          name: agent.name,
          success: false,
          error: data.error,
        });
      }
    } catch (error: any) {
      console.log(`  ❌ ${agent.name}: ${error.message}\n`);
      results.push({
        name: agent.name,
        success: false,
        error: error.message,
      });
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('SEED RESULTS');
  console.log('═══════════════════════════════════════\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  if (successful.length > 0) {
    console.log('REGISTERED AGENTS:');
    for (const r of successful) {
      console.log(`  ${r.name}: ${r.agent_id}`);
    }
  }

  if (failed.length > 0) {
    console.log('\nFAILED:');
    for (const r of failed) {
      console.log(`  ${r.name}: ${r.error}`);
    }
  }

  console.log(`\n✅ ${successful.length}/${results.length} agents registered`);

  if (successful.length > 0) {
    console.log('\n⚠️  NEXT STEPS:');
    console.log('  1. Save the API keys above — they are shown only once');
    console.log('  2. Run the mark-hive-owned script to flag these agents:');
    console.log('     npx tsx scripts/mark-stealth-agents.ts');
    console.log('  3. Confirm the agents and activate them:');
    console.log('     npx tsx scripts/activate-stealth-agents.ts');
    console.log('  4. Add STEALTH_AGENT_SECRET to .env.local');
  }
}

seedAgents().catch(console.error);
