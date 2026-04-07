/**
 * Auto-Post Tasks
 * 
 * Creates realistic-looking tasks posted by fake "client" identities.
 * Budget range: $1–$3 USDC. Runs twice daily.
 * Stealth agents will automatically bid on these via the existing trigger.
 */

import { getDb, COLLECTIONS } from '@/lib/db';

// Fake client identities — these look like normal users, no Hive branding
const FAKE_CLIENTS = [
  { name: 'Alex_R', address: 'did:privy:auto_alex_r' },
  { name: 'CryptoSam', address: 'did:privy:auto_cryptosam' },
  { name: 'devJordan', address: 'did:privy:auto_devjordan' },
  { name: 'Maria_K', address: 'did:privy:auto_maria_k' },
  { name: 'BlockchainBen', address: 'did:privy:auto_ben' },
  { name: 'SolanaSteph', address: 'did:privy:auto_steph' },
  { name: 'web3_dan', address: 'did:privy:auto_web3dan' },
  { name: 'TokenTina', address: 'did:privy:auto_tokentina' },
  { name: 'DeFi_Mike', address: 'did:privy:auto_defimike' },
  { name: 'nft_sarah', address: 'did:privy:auto_nftsarah' },
  { name: 'CodeMonkey42', address: 'did:privy:auto_cm42' },
  { name: 'ChainLisa', address: 'did:privy:auto_chainlisa' },
];

// Task templates by category — realistic, low-effort tasks
const TASK_TEMPLATES: Array<{
  category: string;
  tasks: Array<{ title: string; description: string; tags: string[] }>;
}> = [
  {
    category: 'Research',
    tasks: [
      {
        title: 'Summarize top 5 DeFi trends this week',
        description: 'Research and provide a brief summary of the top 5 trending DeFi protocols or developments from the past week. Include key metrics, notable launches, and any significant governance proposals. Format as a numbered list with 2-3 sentences per item.',
        tags: ['DeFi', 'Research', 'Crypto'],
      },
      {
        title: 'Compare gas fees across Solana, Base, and Arbitrum',
        description: 'Provide a comparison of current average transaction costs across Solana, Base, and Arbitrum. Include typical swap fees, transfer costs, and any notable fee mechanisms. Present in a clear table format.',
        tags: ['L2', 'Gas Fees', 'Research'],
      },
      {
        title: 'List the top 10 AI crypto projects by market cap',
        description: 'Compile a list of the top 10 AI-related crypto tokens by market capitalization. For each, include: name, ticker, market cap, brief description (1 sentence), and what AI capability they provide.',
        tags: ['AI', 'Crypto', 'Market Research'],
      },
      {
        title: 'Analyze the latest Solana validator economics',
        description: 'Provide a brief analysis of current Solana validator economics including staking yields, hardware requirements, and profitability. Include any recent changes to the staking program.',
        tags: ['Solana', 'Staking', 'Analysis'],
      },
      {
        title: 'Research the latest NFT marketplace trends',
        description: 'Identify the top 3 NFT marketplace platforms by volume in the past 30 days. What types of NFTs are trending? Are there any emerging use cases beyond art? Provide data-backed insights.',
        tags: ['NFT', 'Research', 'Trends'],
      },
    ],
  },
  {
    category: 'Content',
    tasks: [
      {
        title: 'Write a short explainer on Account Abstraction',
        description: 'Write a beginner-friendly 300-word article explaining Account Abstraction in crypto. Cover: what it is, why it matters, and how it improves UX. Use simple language, no jargon. Include a practical example.',
        tags: ['Content', 'Writing', 'ERC-4337'],
      },
      {
        title: 'Draft 5 tweet ideas about Web3 developer tools',
        description: 'Create 5 engaging tweet drafts about useful Web3 developer tools and SDKs. Each tweet should be under 280 characters, use relevant hashtags, and be informative yet engaging. Mix educational and opinion-style tweets.',
        tags: ['Social Media', 'Content', 'Web3'],
      },
      {
        title: 'Write a comparison: Solana vs Ethereum for new devs',
        description: 'Write a 400-word comparison piece aimed at new blockchain developers choosing between Solana and Ethereum. Cover: language differences, dev tooling, deployment costs, and community resources. Be balanced and objective.',
        tags: ['Content', 'Development', 'Comparison'],
      },
      {
        title: 'Create a glossary of 10 DeFi terms',
        description: 'Write clear, concise definitions for 10 commonly used DeFi terms. Include: AMM, TVL, Impermanent Loss, Yield Farming, Liquidity Pool, Flash Loan, Governance Token, Slippage, APY vs APR, and Rug Pull. Each definition should be 1-2 sentences.',
        tags: ['DeFi', 'Education', 'Content'],
      },
    ],
  },
  {
    category: 'Analysis',
    tasks: [
      {
        title: 'Analyze SOL price action over the past 7 days',
        description: 'Provide a technical analysis of SOL token price movement over the past 7 days. Include: key support/resistance levels, volume trends, any notable on-chain metrics, and a brief outlook. Use data, not speculation.',
        tags: ['Solana', 'Technical Analysis', 'Price'],
      },
      {
        title: 'Break down the tokenomics of a top memecoin',
        description: 'Choose one of the current top 5 memecoins by market cap and analyze its tokenomics. Cover: supply distribution, burn mechanism (if any), holder concentration, and liquidity depth. Identify any red flags.',
        tags: ['Memecoin', 'Tokenomics', 'Analysis'],
      },
      {
        title: 'Compare staking rewards: SOL vs ETH vs AVAX',
        description: 'Create a data-driven comparison of current staking rewards for SOL, ETH, and AVAX. Include: annual yield, lock-up periods, minimum stake requirements, and validator counts. Present as a clear comparison table.',
        tags: ['Staking', 'Comparison', 'Data'],
      },
    ],
  },
  {
    category: 'Social',
    tasks: [
      {
        title: 'Draft a Discord announcement for a token airdrop',
        description: 'Write a professional Discord announcement template for a hypothetical token airdrop campaign. Include: eligibility criteria, claim process, timeline, and community engagement hooks. Make it exciting but not spammy.',
        tags: ['Discord', 'Community', 'Social'],
      },
      {
        title: 'Create a community engagement poll strategy',
        description: 'Design 5 Twitter/X poll questions that a crypto project could use to engage their community. Each poll should have 2-4 options and drive meaningful discussion. Include the poll text, options, and a brief rationale for each.',
        tags: ['Social Media', 'Engagement', 'Strategy'],
      },
    ],
  },
  {
    category: 'Development',
    tasks: [
      {
        title: 'Review this Solana program snippet for bugs',
        description: 'Review the following conceptual Solana program flow and identify potential bugs or security issues:\n- Program accepts SOL deposits into a PDA\n- Users can withdraw proportional to their deposit\n- No reentrancy guard\n- Uses u64 for amounts\nList all potential vulnerabilities and suggest fixes.',
        tags: ['Solana', 'Security', 'Code Review'],
      },
      {
        title: 'Explain how to set up a basic Anchor project',
        description: 'Write a step-by-step guide for setting up a new Solana Anchor project from scratch. Include: prerequisites, installation commands, project initialization, building, testing, and deploying to devnet. Target audience: developers new to Solana.',
        tags: ['Solana', 'Anchor', 'Tutorial'],
      },
    ],
  },
];

export interface AutoPostResult {
  tasksCreated: number;
  taskIds: string[];
  errors: string[];
}

export async function autoPostTasks(): Promise<AutoPostResult> {
  const db = await getDb();
  const result: AutoPostResult = { tasksCreated: 0, taskIds: [], errors: [] };

  // Pick 2-3 random tasks to post
  const taskCount = 2 + Math.floor(Math.random() * 2); // 2 or 3

  // Build a flat list of all templates
  const allTemplates: Array<{ category: string; title: string; description: string; tags: string[] }> = [];
  for (const cat of TASK_TEMPLATES) {
    for (const t of cat.tasks) {
      allTemplates.push({ category: cat.category, ...t });
    }
  }

  // Shuffle and pick
  const shuffled = allTemplates.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, taskCount);

  for (const template of selected) {
    try {
      // Pick a random fake client
      const client = FAKE_CLIENTS[Math.floor(Math.random() * FAKE_CLIENTS.length)];

      // Random budget between $1 and $3
      const budgetAmount = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
      const budget = `$${budgetAmount} USDC`;

      const task = {
        title: template.title,
        description: template.description,
        category: template.category,
        tags: template.tags,
        requirements: '',
        budget,
        budgetAmount,
        status: 'Open',
        clientAddress: client.address,
        clientName: client.name,
        proposalsCount: 0,
        tokenConfig: null,
        deliverableSpecs: [],
        autoPosted: true, // Internal flag — not exposed in UI
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insertResult = await db.collection(COLLECTIONS.TASKS).insertOne(task);
      const taskId = insertResult.insertedId.toString();
      result.taskIds.push(taskId);

      // Log activity
      await db.collection(COLLECTIONS.ACTIVITY).insertOne({
        type: 'TaskCreated',
        taskId: insertResult.insertedId,
        actorAddress: client.address,
        actorName: client.name,
        metadata: {
          title: template.title,
          category: template.category,
          budget,
        },
        createdAt: new Date(),
      });

      // Trigger stealth agents (same mechanism as real tasks)
      const stealthSecret = process.env.STEALTH_AGENT_SECRET;
      if (stealthSecret) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        fetch(`${siteUrl}/api/internal/agent-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-stealth-secret': stealthSecret,
          },
          body: JSON.stringify({
            taskId,
            title: template.title,
            description: template.description,
            category: template.category,
            requirements: '',
            budget,
          }),
        }).catch((err) => console.error('[AUTO-POST] Stealth trigger failed:', err.message));
      }

      result.tasksCreated++;
      console.log(`[AUTO-POST] Created "${template.title}" by ${client.name} ($${budgetAmount} USDC)`);
    } catch (error: any) {
      result.errors.push(`${template.title}: ${error.message}`);
      console.error(`[AUTO-POST] Error creating task:`, error.message);
    }
  }

  return result;
}
