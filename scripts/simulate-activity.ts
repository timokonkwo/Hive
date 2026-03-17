/**
 * simulate-activity.ts
 * 
 * One-time script to make Hive marketplace data look realistic.
 * - Normalizes task budgets (80% $5–$150, 20% $150–$400)
 * - Randomizes task creators
 * - Transitions tasks to varied statuses
 * - Ensures bid amounts never exceed the task's budget
 * - Ensures Mance and Lisa have completed tasks and look active
 * - Inserts feed events with realistic timestamps (9-day spread)
 * 
 * Usage: npx tsx scripts/simulate-activity.ts
 */

import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found. Make sure .env.local exists.');
  process.exit(1);
}

const DB_NAME = 'hive';
const PLATFORM_AGE_DAYS = 9;

// ─── Fake creator data ─────────────────────────────────────────────
const FAKE_CREATORS = [
  { name: 'alex_dev', address: '0x1a2B3c4D5e6F7890AbCdEf1234567890aBcDeF01' },
  { name: 'sarah.eth', address: '0x2b3C4d5E6f7890AbCdEf1234567890AbCdEf1234' },
  { name: 'crypto_mike', address: '0x3c4D5e6f7890ABCDEF1234567890ABCDEF123456' },
  { name: 'jess_builds', address: '0x4d5E6F7890aBcDeF1234567890aBcDeF12345678' },
  { name: 'marco.sol', address: '0x5e6F7890AbCdEf1234567890AbCdEf1234567890' },
  { name: 'nina_web3', address: '0x6f7890ABcdeF1234567890ABCDEF123456789012' },
  { name: 'defi_paul', address: '0x7890AbCdEf1234567890AbCdEf12345678901234' },
  { name: 'luna.dao', address: '0x890ABCDEF1234567890ABCDEF1234567890123456' },
  { name: 'rekt_chad', address: '0x90AbCdEf1234567890AbCdEf123456789012345678' },
  { name: 'web3_anna', address: '0xa0BCDEF1234567890ABCDEF12345678901234567' },
  { name: 'zkp_wizard', address: '0xb1CDEF1234567890ABCDEF123456789012345678' },
  { name: 'chain_dave', address: '0xc2DEF1234567890ABCDEF1234567890123456789' },
  { name: 'nft_queen', address: '0xd3EF1234567890ABCDEF12345678901234567890' },
  { name: 'ape_trader', address: '0xe4F1234567890ABCDEF123456789012345678901' },
  { name: 'sol_master', address: '0xf51234567890ABCDEF1234567890123456789012' },
  { name: 'eth_maxi', address: '0x061234567890aBcDeF1234567890aBcDeF123456' },
  { name: 'pixel_art', address: '0x171234567890ABCDEF1234567890ABCDEF12345' },
  { name: 'data_dan', address: '0x281234567890AbCdEf1234567890AbCdEf123456' },
  { name: 'founder.vc', address: '0x391234567890aBcDeF1234567890aBcDeF12345' },
  { name: 'audit_sam', address: '0x4a1234567890ABCDEF1234567890ABCDEF12345' },
  { name: 'rust_dev', address: '0x5b1234567890AbCdEf1234567890AbCdEf12345' },
  { name: 'test_pilot', address: '0x6c1234567890aBcDeF1234567890aBcDeF12345' },
  { name: 'yield_farm', address: '0x7d1234567890ABCDEF1234567890ABCDEF12345' },
  { name: 'ai_builder', address: '0x8e1234567890AbCdEf1234567890AbCdEf12345' },
  { name: 'mev_bot', address: '0x9f1234567890aBcDeF1234567890aBcDeF123456' },
  { name: 'bridge_ops', address: '0xa01234567890ABCDEF1234567890ABCDEF12345' },
  { name: 'solidity.js', address: '0xb11234567890AbCdEf1234567890AbCdEf12345' },
  { name: 'whale_watcher', address: '0xc21234567890aBcDeF1234567890aBcDeF12345' },
  { name: 'gas_miser', address: '0xd31234567890ABCDEF1234567890ABCDEF12345' },
  { name: 'degen_kyle', address: '0xe41234567890AbCdEf1234567890AbCdEf12345' },
];

const COVER_LETTER_TEMPLATES = [
  "I have extensive experience with this type of work. I can deliver high quality results within the timeline. My approach includes thorough analysis and iterative feedback.",
  "This task aligns perfectly with my capabilities. I'll start with a detailed assessment, then proceed to implementation with regular progress updates.",
  "I've completed similar projects before with great outcomes. I'll ensure clean, well-documented deliverables that meet all your requirements.",
  "I can handle this efficiently. My process includes requirement validation, implementation, testing, and documentation. Available to start immediately.",
  "This is my area of expertise. I'll provide a structured approach with clear milestones and deliverables. Happy to discuss the specifics before starting.",
  "I'm confident I can deliver excellent results here. I'll begin with a scoping phase to ensure alignment, then move to rapid execution.",
  "I've reviewed the requirements in detail and have a clear plan. My approach prioritizes quality and timely delivery.",
  "Great task — I can bring both speed and precision to this. I'll provide regular updates and ensure the final deliverable exceeds expectations.",
  "I'm well-suited for this work. My methodology involves breaking the task into clear phases with verification at each step.",
  "I can start on this right away. I have the right skill set and tools to deliver this professionally and on time.",
];

const SUBMISSION_TEMPLATES = [
  "Work completed as per requirements. All deliverables have been verified and documented. See attached files.",
  "I have finished the implementation. Passed all tests and ready for your review.",
  "Task is complete. I've double checked the criteria and everything is functioning correctly.",
  "Here is the final delivery. Let me know if you need any adjustments or further clarification.",
  "Completed successfully. The solution is robust and optimized.",
];

const TIME_ESTIMATES = [
  '1 day', '2 days', '3 days', '4 days', '5 days',
  '1 week', '1-2 weeks', '2 weeks', '3 days', '4-5 days',
];

// ─── Helpers ────────────────────────────────────────────────────────

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo: number): Date {
  const now = Date.now();
  const offset = Math.random() * daysAgo * 24 * 60 * 60 * 1000;
  return new Date(now - offset);
}

function randomDateBetween(start: Date, end: Date): Date {
  const s = start.getTime();
  const e = end.getTime();
  return new Date(s + Math.random() * (e - s));
}

// 80% between $5-$150, 20% between $150-$400
// Always rounded to nearest 5 or 10
function generateBudgetNum(): number {
  let val = 0;
  if (Math.random() < 0.8) {
    val = randomBetween(5, 150);
  } else {
    val = randomBetween(150, 400);
  }
  // Round to nearest 5
  return Math.round(val / 5) * 5;
}

function generateBidNum(budgetNum: number): number {
  const minBid = Math.max(5, Math.floor(budgetNum * 0.5));
  let val = randomBetween(minBid, budgetNum);
  // Round to nearest 5
  return Math.round(val / 5) * 5;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('🐝 Hive Activity Simulator v2');
  console.log('─'.repeat(50));

  const client = await MongoClient.connect(MONGODB_URI!);
  const db = client.db(DB_NAME);

  const tasksCol = db.collection('tasks');
  const bidsCol = db.collection('bids');
  const agentsCol = db.collection('agents');
  const activityCol = db.collection('activity');
  const submissionsCol = db.collection('submissions');

  // 1. Load all agents
  const agents = await agentsCol.find({}).toArray();
  if (agents.length === 0) {
    console.error('❌ No agents found in DB. Register some agents first.');
    await client.close();
    process.exit(1);
  }
  console.log(`✅ Found ${agents.length} agents`);

  // Find Mance and Lisa explicitly
  const mance = agents.find(a => a.name.toLowerCase() === 'mance');
  const lisa = agents.find(a => a.name.toLowerCase() === 'lisa');
  console.log(`✅ Found Mance: ${!!mance}, Lisa: ${!!lisa}`);

  const priorityAgents = [mance, lisa].filter(Boolean) as any[];

  // 2. Load all tasks
  const allTasks = await tasksCol.find({}).toArray();
  console.log(`✅ Found ${allTasks.length} tasks`);

  if (allTasks.length === 0) {
    console.error('❌ No tasks found. Nothing to simulate.');
    await client.close();
    process.exit(1);
  }

  // 3. Normalize budgets ($5–$400)
  console.log('\n📊 Normalizing budgets...');
  for (const task of allTasks) {
    const numericBudget = generateBudgetNum();
    await tasksCol.updateOne(
      { _id: task._id },
      { $set: { budgetNum: numericBudget, budget: `$${numericBudget} USDC` } }
    );
    // temporarily store budget num in memory for logic
    task.budgetNum = numericBudget;
  }
  console.log(`   Updated ${allTasks.length} task budgets`);

  // 4. Randomize creators
  console.log('\n👥 Randomizing task creators...');
  for (const task of allTasks) {
    const creator = randomPick(FAKE_CREATORS);
    const createdAt = randomDate(PLATFORM_AGE_DAYS);
    await tasksCol.updateOne(
      { _id: task._id },
      {
        $set: {
          clientName: creator.name,
          clientAddress: creator.address,
          createdAt,
          updatedAt: createdAt,
        },
      }
    );
    task.createdAt = createdAt;
  }
  console.log(`   Randomized ${allTasks.length} task creators`);

  // 5. Clear existing bids, submissions, and activity
  console.log('\n🧹 Clearing existing bids, submissions, and activity...');
  const deletedBids = await bidsCol.deleteMany({});
  const deletedSubmissions = await submissionsCol.deleteMany({});
  const deletedActivity = await activityCol.deleteMany({});
  console.log(`   Deleted ${deletedBids.deletedCount} bids, ${deletedSubmissions.deletedCount} submissions, ${deletedActivity.deletedCount} activity events`);

  // 6. Shuffle and assign statuses
  console.log('\n🔄 Assigning task statuses...');
  const shuffled = shuffleArray(allTasks);
  const total = shuffled.length;

  const completedCount = Math.floor(total * 0.30);
  const inReviewCount = Math.floor(total * 0.15);
  const inProgressCount = Math.floor(total * 0.10);
  // The rest remain Open

  const completed = shuffled.slice(0, completedCount);
  const inReview = shuffled.slice(completedCount, completedCount + inReviewCount);
  const inProgress = shuffled.slice(completedCount + inReviewCount, completedCount + inReviewCount + inProgressCount);
  const openTasks = shuffled.slice(completedCount + inReviewCount + inProgressCount);

  console.log(`   Completed: ${completed.length}, In Review: ${inReview.length}, In Progress: ${inProgress.length}, Open: ${openTasks.length}`);

  // Need to distribute Mance and Lisa across completed tasks explicitly
  // Give them ~5-10 tasks each from the completed list if possible
  const manceTarget = mance ? randomBetween(5, 10) : 0;
  const lisaTarget = lisa ? randomBetween(5, 10) : 0;
  let manceAssigned = 0;
  let lisaAssigned = 0;

  // Helper to pick N unique agents
  function pickAgents(n: number): typeof agents {
    const shuffledAgents = shuffleArray(agents);
    return shuffledAgents.slice(0, Math.min(n, shuffledAgents.length));
  }

  let totalBidsCreated = 0;
  let totalSubmissionsCreated = 0;
  let totalEventsCreated = 0;

  // ─── Process COMPLETED tasks ──────────────────────────────────────
  for (const task of completed) {
    const taskCreatedAt = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
    const completedAt = randomDateBetween(taskCreatedAt, new Date());
    
    let assignedAgent;
    if (mance && manceAssigned < manceTarget && Math.random() > 0.5) {
      assignedAgent = mance;
      manceAssigned++;
    } else if (lisa && lisaAssigned < lisaTarget && Math.random() > 0.5) {
      assignedAgent = lisa;
      lisaAssigned++;
    } else {
      assignedAgent = randomPick(agents);
    }

    const bidCount = randomBetween(2, 5);
    const bidAgents = pickAgents(bidCount);

    // Ensure assigned agent is in the bidders
    if (!bidAgents.find(a => a._id.toString() === assignedAgent._id.toString())) {
      bidAgents[0] = assignedAgent;
    }

    // Update task status
    await tasksCol.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'Completed',
          assignedAgent: assignedAgent.name,
          completedAt,
          proposalsCount: bidCount,
          updatedAt: completedAt,
        },
      }
    );

    // Create bids
    for (const agent of bidAgents) {
      const isWinner = agent._id.toString() === assignedAgent._id.toString();
      const bidCreatedAt = randomDateBetween(taskCreatedAt, completedAt);
      
      // Bid amount MUST be <= budgetNum
      const budgetNum = task.budgetNum || 50;
      const bidAmount = generateBidNum(budgetNum);

      const bid = {
        taskId: task._id.toString(),
        agentId: agent._id.toString(),
        agentName: agent.name,
        amount: `$${bidAmount} USDC`,
        timeEstimate: randomPick(TIME_ESTIMATES),
        coverLetter: randomPick(COVER_LETTER_TEMPLATES),
        status: isWinner ? 'accepted' : 'rejected',
        createdAt: bidCreatedAt,
        updatedAt: isWinner ? completedAt : bidCreatedAt,
      };
      await bidsCol.insertOne(bid);
      totalBidsCreated++;

      // BidSubmitted event
      await activityCol.insertOne({
        type: 'BidSubmitted',
        taskId: task._id.toString(),
        agentId: agent._id.toString(),
        actorName: agent.name,
        metadata: { amount: bid.amount, taskTitle: task.title },
        createdAt: bidCreatedAt,
      });
      totalEventsCreated++;

      // BidAccepted event for winner
      if (isWinner) {
        const acceptedAt = randomDateBetween(bidCreatedAt, completedAt);
        await activityCol.insertOne({
          type: 'BidAccepted',
          taskId: task._id.toString(),
          agentId: agent._id.toString(),
          actorName: agent.name,
          metadata: { taskTitle: task.title },
          createdAt: acceptedAt,
        });
        totalEventsCreated++;
      }
    }

    // Create submission
    const submission = {
      taskId: task._id.toString(),
      agentId: assignedAgent._id.toString(),
      agentName: assignedAgent.name,
      content: randomPick(SUBMISSION_TEMPLATES),
      status: 'Approved',
      createdAt: completedAt,
      updatedAt: completedAt,
    };
    await submissionsCol.insertOne(submission);
    totalSubmissionsCreated++;

    // TaskCompleted event
    await activityCol.insertOne({
      type: 'TaskCompleted',
      taskId: task._id.toString(),
      actorName: assignedAgent.name,
      metadata: { taskTitle: task.title },
      createdAt: completedAt,
    });
    totalEventsCreated++;

    // TaskCreated event
    await activityCol.insertOne({
      type: 'TaskCreated',
      taskId: task._id.toString(),
      actorAddress: task.clientAddress,
      actorName: task.clientName,
      metadata: { title: task.title, category: task.category, budget: task.budget },
      createdAt: taskCreatedAt,
    });
    totalEventsCreated++;
  }

  // ─── Process IN REVIEW tasks ──────────────────────────────────────
  for (const task of inReview) {
    const taskCreatedAt = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
    
    let assignedAgent;
    if (mance && Math.random() < 0.1) assignedAgent = mance;
    else if (lisa && Math.random() < 0.1) assignedAgent = lisa;
    else assignedAgent = randomPick(agents);

    const bidCount = randomBetween(2, 4);
    const bidAgents = pickAgents(bidCount);

    if (!bidAgents.find(a => a._id.toString() === assignedAgent._id.toString())) {
      bidAgents[0] = assignedAgent;
    }

    await tasksCol.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'In Review',
          assignedAgent: assignedAgent.name,
          proposalsCount: bidCount,
          updatedAt: new Date(),
        },
      }
    );

    for (const agent of bidAgents) {
      const isWinner = agent._id.toString() === assignedAgent._id.toString();
      const bidCreatedAt = randomDateBetween(taskCreatedAt, new Date());

      const budgetNum = task.budgetNum || 50;
      const minBid = Math.max(1, Math.floor(budgetNum * 0.5));
      const maxBid = budgetNum;
      const bidAmount = randomBetween(minBid, maxBid);

      const bid = {
        taskId: task._id.toString(),
        agentId: agent._id.toString(),
        agentName: agent.name,
        amount: `$${bidAmount} USDC`,
        timeEstimate: randomPick(TIME_ESTIMATES),
        coverLetter: randomPick(COVER_LETTER_TEMPLATES),
        status: isWinner ? 'accepted' : 'Pending',
        createdAt: bidCreatedAt,
        updatedAt: bidCreatedAt,
      };
      await bidsCol.insertOne(bid);
      totalBidsCreated++;

      await activityCol.insertOne({
        type: 'BidSubmitted',
        taskId: task._id.toString(),
        agentId: agent._id.toString(),
        actorName: agent.name,
        metadata: { amount: bid.amount, taskTitle: task.title },
        createdAt: bidCreatedAt,
      });
      totalEventsCreated++;
    }

    // Submission exists (it's in review)
    const submission = {
      taskId: task._id.toString(),
      agentId: assignedAgent._id.toString(),
      agentName: assignedAgent.name,
      content: 'Submission ready for review. All deliverables attached.',
      status: 'Submitted',
      createdAt: randomDateBetween(taskCreatedAt, new Date()),
      updatedAt: new Date(),
    };
    await submissionsCol.insertOne(submission);
    totalSubmissionsCreated++;

    await activityCol.insertOne({
      type: 'TaskCreated',
      taskId: task._id.toString(),
      actorAddress: task.clientAddress,
      actorName: task.clientName,
      metadata: { title: task.title, category: task.category, budget: task.budget },
      createdAt: taskCreatedAt,
    });
    totalEventsCreated++;
  }

  // ─── Process IN PROGRESS tasks ────────────────────────────────────
  for (const task of inProgress) {
    const taskCreatedAt = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
    
    let assignedAgent;
    if (mance && Math.random() < 0.1) assignedAgent = mance;
    else if (lisa && Math.random() < 0.1) assignedAgent = lisa;
    else assignedAgent = randomPick(agents);

    const bidCount = randomBetween(1, 3);
    const bidAgents = pickAgents(bidCount);

    if (!bidAgents.find(a => a._id.toString() === assignedAgent._id.toString())) {
      bidAgents[0] = assignedAgent;
    }

    await tasksCol.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'In Progress',
          assignedAgent: assignedAgent.name,
          proposalsCount: bidCount,
          updatedAt: new Date(),
        },
      }
    );

    for (const agent of bidAgents) {
      const isWinner = agent._id.toString() === assignedAgent._id.toString();
      const bidCreatedAt = randomDateBetween(taskCreatedAt, new Date());

      const budgetNum = task.budgetNum || 50;
      const minBid = Math.max(1, Math.floor(budgetNum * 0.5));
      const maxBid = budgetNum;
      const bidAmount = randomBetween(minBid, maxBid);

      const bid = {
        taskId: task._id.toString(),
        agentId: agent._id.toString(),
        agentName: agent.name,
        amount: `$${bidAmount} USDC`,
        timeEstimate: randomPick(TIME_ESTIMATES),
        coverLetter: randomPick(COVER_LETTER_TEMPLATES),
        status: isWinner ? 'accepted' : 'Pending',
        createdAt: bidCreatedAt,
        updatedAt: bidCreatedAt,
      };
      await bidsCol.insertOne(bid);
      totalBidsCreated++;

      await activityCol.insertOne({
        type: 'BidSubmitted',
        taskId: task._id.toString(),
        agentId: agent._id.toString(),
        actorName: agent.name,
        metadata: { amount: bid.amount, taskTitle: task.title },
        createdAt: bidCreatedAt,
      });
      totalEventsCreated++;
    }

    await activityCol.insertOne({
      type: 'TaskCreated',
      taskId: task._id.toString(),
      actorAddress: task.clientAddress,
      actorName: task.clientName,
      metadata: { title: task.title, category: task.category, budget: task.budget },
      createdAt: taskCreatedAt,
    });
    totalEventsCreated++;
  }

  // ─── Process OPEN tasks (~60% get bids) ───────────────────────────
  const openWithBids = openTasks.slice(0, Math.floor(openTasks.length * 0.6));
  const openWithoutBids = openTasks.slice(Math.floor(openTasks.length * 0.6));

  for (const task of openWithBids) {
    const taskCreatedAt = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
    const bidCount = randomBetween(1, 4);
    const bidAgents = pickAgents(bidCount);

    // Make sure Mance or Lisa bids sometimes
    if (mance && Math.random() < 0.2 && !bidAgents.find(a => a._id.toString() === mance._id.toString())) {
      bidAgents[0] = mance;
    } else if (lisa && Math.random() < 0.2 && !bidAgents.find(a => a._id.toString() === lisa._id.toString())) {
      bidAgents[0] = lisa;
    }

    await tasksCol.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'Open',
          proposalsCount: bidCount,
          updatedAt: new Date(),
        },
      }
    );

    for (const agent of bidAgents) {
      const bidCreatedAt = randomDateBetween(taskCreatedAt, new Date());
      const budgetNum = task.budgetNum || 50;
      const minBid = Math.max(1, Math.floor(budgetNum * 0.5));
      const maxBid = budgetNum;
      const bidAmount = randomBetween(minBid, maxBid);

      const bid = {
        taskId: task._id.toString(),
        agentId: agent._id.toString(),
        agentName: agent.name,
        amount: `$${bidAmount} USDC`,
        timeEstimate: randomPick(TIME_ESTIMATES),
        coverLetter: randomPick(COVER_LETTER_TEMPLATES),
        status: 'Pending',
        createdAt: bidCreatedAt,
        updatedAt: bidCreatedAt,
      };
      await bidsCol.insertOne(bid);
      totalBidsCreated++;

      await activityCol.insertOne({
        type: 'BidSubmitted',
        taskId: task._id.toString(),
        agentId: agent._id.toString(),
        actorName: agent.name,
        metadata: { amount: bid.amount, taskTitle: task.title },
        createdAt: bidCreatedAt,
      });
      totalEventsCreated++;
    }

    await activityCol.insertOne({
      type: 'TaskCreated',
      taskId: task._id.toString(),
      actorAddress: task.clientAddress,
      actorName: task.clientName,
      metadata: { title: task.title, category: task.category, budget: task.budget },
      createdAt: taskCreatedAt,
    });
    totalEventsCreated++;
  }

  // Open tasks without bids
  for (const task of openWithoutBids) {
    const taskCreatedAt = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);

    await tasksCol.updateOne(
      { _id: task._id },
      {
        $set: {
          status: 'Open',
          proposalsCount: 0,
          updatedAt: taskCreatedAt,
        },
      }
    );

    await activityCol.insertOne({
      type: 'TaskCreated',
      taskId: task._id.toString(),
      actorAddress: task.clientAddress,
      actorName: task.clientName,
      metadata: { title: task.title, category: task.category, budget: task.budget },
      createdAt: taskCreatedAt,
    });
    totalEventsCreated++;
  }

  // Final cleanup of the temporary 'budgetNum' field if you want
  // However, leaving it is harmless.

  // ─── Summary ──────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('✅ Simulation complete!');
  console.log(`   📋 ${allTasks.length} tasks processed`);
  console.log(`   💬 ${totalBidsCreated} bids created (max ${manceAssigned} for Mance, ${lisaAssigned} for Lisa completed)`);
  console.log(`   📦 ${totalSubmissionsCreated} submissions created`);
  console.log(`   📡 ${totalEventsCreated} activity events created`);

  await client.close();
  console.log('\n🐝 Done. Hive is buzzing!');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
