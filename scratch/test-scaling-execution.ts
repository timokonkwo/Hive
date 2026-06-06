import { getDb, COLLECTIONS } from '../lib/db';
import { depositSessionBudget, chargeToolInvocation, getSessionBudget } from '../lib/session-wallet';
import { createDispute, castDisputeVote } from '../lib/disputes';
import { ObjectId } from 'mongodb';

// Mock connection details for testing
const TEST_CLIENT_ID = 'test-client-' + Math.random().toString(36).substring(4);
const TEST_SOLANA_ADDRESS = '7uxbJ1U91m1e9gJ9gHn99hPnJ1U91m1e9gJ9gHn99hPn'; // Dummy Sol Address
const TEST_PROVIDER_ADDRESS = '8uxbJ1U91m1e9gJ9gHn99hPnJ1U91m1e9gJ9gHn99hPn'; // Dummy Sol Address
const TEST_TOOL_ID = 'web_search';

async function runTests() {
  console.log('=== STARTING SCALE EXECUTION INTEGRATION TESTS ===');
  const db = await getDb();

  try {
    // ----------------------------------------------------
    // TEST 1: Retrieve Initial Empty/Suspended Session Budget
    // ----------------------------------------------------
    console.log('\n[TEST 1] Retrieving initial session budget...');
    const initialBudget = await getSessionBudget(TEST_CLIENT_ID);
    console.log('Initial Budget retrieved:', initialBudget);
    if (initialBudget.status !== 'suspended' || initialBudget.depositBalance !== 0) {
      throw new Error('Initial budget should be suspended with 0 balance.');
    }
    console.log('✓ TEST 1 passed.');

    // ----------------------------------------------------
    // TEST 2: Seed Deposit Manually (bypass live Solana verify for unit testing)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Seeding session budget deposit directly...');
    await db.collection(COLLECTIONS.SESSION_BUDGETS).updateOne(
      { userId: TEST_CLIENT_ID },
      {
        $set: {
          solanaAddress: TEST_SOLANA_ADDRESS,
          status: 'active',
          updatedAt: new Date(),
          lastSettledAt: new Date(),
          createdAt: new Date()
        },
        $inc: {
          depositBalance: 15.00, // Seed $15 USDC
          reservedBalance: 0
        }
      },
      { upsert: true }
    );

    const seededBudget = await getSessionBudget(TEST_CLIENT_ID);
    console.log('Seeded budget:', seededBudget);
    if (seededBudget.status !== 'active' || seededBudget.depositBalance !== 15.00) {
      throw new Error('Budget seeding failed.');
    }
    console.log('✓ TEST 2 passed.');

    // ----------------------------------------------------
    // TEST 3: Charge Tool Invocations
    // ----------------------------------------------------
    console.log('\n[TEST 3] Charging successive tool invocations...');
    
    // Charge 1: $0.50
    const charge1 = await chargeToolInvocation(TEST_CLIENT_ID, TEST_TOOL_ID, TEST_PROVIDER_ADDRESS, 0.50);
    console.log('Charge 1 result:', charge1);
    if (!charge1.success || Math.abs((charge1.remainingBalance ?? 0) - 14.50) > 1e-9) {
      throw new Error(`Charge 1 failed. Remaining: ${charge1.remainingBalance}`);
    }

    // Charge 2: $14.46 (should drop balance to $0.04, auto-suspending session)
    const charge2 = await chargeToolInvocation(TEST_CLIENT_ID, TEST_TOOL_ID, TEST_PROVIDER_ADDRESS, 14.46);
    console.log('Charge 2 result:', charge2);
    if (!charge2.success || Math.abs((charge2.remainingBalance ?? 0) - 0.04) > 1e-9) {
      throw new Error(`Charge 2 failed. Remaining: ${charge2.remainingBalance}`);
    }

    // Verify session budget status is now suspended
    const postChargeBudget = await getSessionBudget(TEST_CLIENT_ID);
    console.log('Budget post-charging:', postChargeBudget);
    if (postChargeBudget.status !== 'suspended') {
      throw new Error('Session wallet should be suspended (balance < $0.05).');
    }

    // Charge 3: Should fail since budget is suspended
    const charge3 = await chargeToolInvocation(TEST_CLIENT_ID, TEST_TOOL_ID, TEST_PROVIDER_ADDRESS, 0.01);
    console.log('Charge 3 result (expect fail):', charge3);
    if (charge3.success) {
      throw new Error('Charge 3 should have failed due to suspended budget.');
    }
    console.log('✓ TEST 3 passed.');

    // ----------------------------------------------------
    // TEST 4: Create Slashing Dispute
    // ----------------------------------------------------
    console.log('\n[TEST 4] Creating staker dispute...');
    // Seed agent profile first
    await db.collection(COLLECTIONS.AGENTS).updateOne(
      { solanaAddress: TEST_PROVIDER_ADDRESS },
      {
        $set: {
          id: 'agent-' + Math.random().toString(36).substring(4),
          name: 'Test Node Provider',
          capabilities: [TEST_TOOL_ID],
          reputation: 100,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    const disputeRes = await createDispute(
      TEST_PROVIDER_ADDRESS,
      TEST_TOOL_ID,
      'Test dispute logic against provider tool failing audits.',
      'https://ipfs.io/ipfs/QmTestEvidence',
      10000 // staked HIVE at risk
    );
    console.log('Dispute creation result:', disputeRes);
    if (!disputeRes.success || !disputeRes.disputeId) {
      throw new Error('Dispute creation failed: ' + disputeRes.error);
    }

    // Verify agent is flagged
    const agentProfile = await db.collection(COLLECTIONS.AGENTS).findOne({ solanaAddress: TEST_PROVIDER_ADDRESS });
    console.log('Agent status post-dispute:', agentProfile?.disputeStatus);
    if (agentProfile?.disputeStatus !== 'flagged') {
      throw new Error('Agent profile should be flagged.');
    }
    console.log('✓ TEST 4 passed.');

    // ----------------------------------------------------
    // TEST 5: Vote on Dispute (Expected to fail if no balance)
    // ----------------------------------------------------
    console.log('\n[TEST 5] Voting on dispute (expect fail without HIVE balance)...');
    const voteRes = await castDisputeVote(
      TEST_CLIENT_ID,
      disputeRes.disputeId,
      'slash',
      TEST_SOLANA_ADDRESS
    );
    console.log('Vote result (without HIVE tokens):', voteRes);
    if (voteRes.success) {
      throw new Error('Vote should have failed since test address does not hold $HIVE tokens.');
    }
    console.log('✓ TEST 5 passed.');

  } catch (err: any) {
    console.error('❌ Integration Tests Failed:', err.message);
    process.exit(1);
  } finally {
    console.log('\nCleaning up test collections records...');
    await db.collection(COLLECTIONS.SESSION_BUDGETS).deleteMany({ userId: TEST_CLIENT_ID });
    await db.collection(COLLECTIONS.SESSION_LEDGER).deleteMany({ userId: TEST_CLIENT_ID });
    await db.collection(COLLECTIONS.DISPUTES).deleteMany({ providerAddress: TEST_PROVIDER_ADDRESS });
    await db.collection(COLLECTIONS.DISPUTE_VOTES).deleteMany({ userId: TEST_CLIENT_ID });
    await db.collection(COLLECTIONS.AGENTS).deleteMany({ solanaAddress: TEST_PROVIDER_ADDRESS });
    console.log('=== INTEGRATION TESTS COMPLETED ===');
    process.exit(0);
  }
}

runTests();
