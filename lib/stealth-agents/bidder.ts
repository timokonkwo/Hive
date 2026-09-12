/**
 * Stealth Agent Bidder
 * 
 * Generates intelligent cover letters using Gemini and submits bids
 * to the Hive API via direct DB operations (same-server, no HTTP overhead).
 */

import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { type StealthAgentConfig } from './config';
import { generateWithGemini } from './gemini';

interface BidContext {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  taskRequirements: string;
  taskCategory: string;
  taskBudget: string;
  agentId: string;
  agent: StealthAgentConfig;
}

/**
 * Generate a cover letter and submit a bid for a task.
 */
export async function submitBid(ctx: BidContext): Promise<{ success: boolean; bidId?: string; error?: string }> {
  try {

    // Generate cover letter
    const coverLetter = await generateCoverLetter(ctx);
    
    // Determine bid amount (slightly under budget if known, or "Negotiable")
    const amount = deriveBidAmount(ctx.taskBudget);

    const db = await getDb();

    // Validate ObjectId format
    if (!ObjectId.isValid(ctx.taskId) || !ObjectId.isValid(ctx.agentId)) {
      return { success: false, error: 'Invalid task or agent ID format' };
    }

    // Double-check we haven't already bid (race condition protection)
    const existingBid = await db.collection(COLLECTIONS.BIDS).findOne({
      taskId: ctx.taskId,
      agentId: ctx.agentId,
    });
    if (existingBid) {
      return { success: false, error: 'Already bid on this task' };
    }

    // Verify the task is still open
    const task = await db.collection(COLLECTIONS.TASKS).findOne({
      _id: new ObjectId(ctx.taskId),
      status: 'Open',
      assignmentMode: { $ne: 'direct' },
    });
    if (!task) {
      return { success: false, error: 'Task is no longer open' };
    }

    // Insert the bid directly into the DB (same server, no HTTP call needed)
    const bid = {
      taskId: ctx.taskId,
      agentId: ctx.agentId,
      agentName: ctx.agent.name,
      agentAddress: null, // Stealth agents use API key auth, not wallet
      amount,
      timeEstimate: estimateTime(ctx.taskCategory),
      coverLetter,
      status: 'Pending',
      createdAt: new Date(),
    };

    const result = await db.collection(COLLECTIONS.BIDS).insertOne(bid);

    // Update proposals count on the task
    await db.collection(COLLECTIONS.TASKS).updateOne(
      { _id: new ObjectId(ctx.taskId) },
      { $inc: { proposalsCount: 1 } }
    );

    // Log activity
    await db.collection(COLLECTIONS.ACTIVITY).insertOne({
      type: 'BidSubmitted',
      taskId: new ObjectId(ctx.taskId),
      actorName: ctx.agent.name,
      metadata: {
        amount,
        timeEstimate: estimateTime(ctx.taskCategory),
        taskTitle: ctx.taskTitle,
      },
      createdAt: new Date(),
    });

    console.log(`[STEALTH] ${ctx.agent.name} bid on "${ctx.taskTitle}" (${ctx.taskId})`);

    return { success: true, bidId: result.insertedId.toString() };
  } catch (error: any) {
    console.error(`[STEALTH] Bid error (${ctx.agent.name}):`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a cover letter using Gemini.
 */
async function generateCoverLetter(ctx: BidContext): Promise<string> {
  const prompt = `You are bidding on a task on a freelance marketplace for AI agents.

TASK DETAILS:
Title: ${ctx.taskTitle}
Category: ${ctx.taskCategory}
Description: ${ctx.taskDescription}
Requirements: ${ctx.taskRequirements || 'None specified'}
Budget: ${ctx.taskBudget}

Write a brief, professional cover letter for this task. Explain:
1. Why you're a good fit
2. Your approach to completing this task
3. Estimated delivery timeline

Keep it under 200 words. Be specific to this task — no generic filler. Write in first person.`;

  const coverLetter = await generateWithGemini(ctx.agent.bidPersonality, prompt);
  return coverLetter.trim();
}

/**
 * Derive a competitive bid amount from the task budget string.
 */
function deriveBidAmount(budget: string): string {
  if (!budget || budget === 'Negotiable') return 'Negotiable';

  // Extract numeric value from budget string (e.g., "$500 USDC" → 500)
  const match = budget.match(/([\d.]+)/);
  if (!match) return budget;

  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return budget;

  // Bid slightly below budget (90-98% — competitive but not suspicious)
  const discount = 0.90 + Math.random() * 0.08;
  const bidAmount = Math.round(amount * discount);

  // Return in the same format
  if (budget.toLowerCase().includes('usdc')) return `$${bidAmount} USDC`;
  if (budget.includes('$')) return `$${bidAmount}`;
  return String(bidAmount);
}

/**
 * Estimate delivery time based on category.
 */
function estimateTime(category: string): string {
  const estimates: Record<string, string[]> = {
    'Development': ['2-3 days', '3-5 days', '1 week'],
    'Security': ['2-4 days', '3-5 days'],
    'Token Launch': ['1-2 days', '24-48 hours'],
    'Research': ['2-3 days', '3-5 days'],
    'Analysis': ['1-3 days', '2-4 days'],
    'Content': ['1-2 days', '24-48 hours'],
    'Legal': ['3-5 days', '1 week'],
    'Translation': ['1-2 days', '24-48 hours'],
    'Social': ['1-2 days', '24 hours'],
    'Design': ['2-4 days', '3-5 days'],
    'Other': ['2-4 days', '3-5 days'],
  };

  const options = estimates[category] || estimates['Other'];
  return options[Math.floor(Math.random() * options.length)];
}
