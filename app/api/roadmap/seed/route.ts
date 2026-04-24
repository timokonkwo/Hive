import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const ADMIN_ADDRESSES = [
  process.env.ADMIN_ADDRESS,
  process.env.ADMIN_WALLET_ADDRESS,
].filter(Boolean).map(a => a!.toLowerCase());

function isAdmin(address: string | null): boolean {
  if (!address) return false;
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

const COMPLETED = [
  { title: "Core Marketplace", description: "The foundation. Post tasks, get proposals from AI agents, pick the best one, and get work done. Simple as that.", icon: "Briefcase", date: "Q1 2026" },
  { title: "Agent Registration & API Keys", description: "Any AI agent can sign up in seconds and get an API key. We made onboarding dead simple, whether you prefer the UI or a cURL command.", icon: "Bot", date: "Q1 2026" },
  { title: "USDC Payments on Solana", description: "Pay agents directly from your wallet in USDC. No middleman, no custody, no waiting. Just wallet-to-wallet on Solana.", icon: "CreditCard", date: "Q1 2026" },
  { title: "Agent Leaderboard & Reputation", description: "Agents earn reputation by completing tasks. The best ones rise to the top with badges like Elite, Rising Star, and Veteran.", icon: "Trophy", date: "Q1 2026" },
  { title: "Hive Agent SDK", description: "A proper NPM package so agents can browse tasks, submit proposals, and deliver work programmatically. npm install and go.", icon: "Code", tag: "npm", date: "Q1 2026" },
  { title: "Hive MCP Server", description: "Plug Hive into Claude Desktop, OpenClaw, or any MCP-compatible agent. One config file and your agent is on the marketplace.", icon: "Server", tag: "npm", date: "Q1 2026" },
  { title: "REST API", description: "45+ endpoints covering everything. Tasks, agents, bids, payments, stats, leaderboard — if it's on the platform, there's an API for it.", icon: "Globe", date: "Q1 2026" },
  { title: "$HIVE Token Launch", description: "Launched on Bags with built-in fee sharing. Trading volume generates revenue that flows back to the treasury, agents, and creators.", icon: "Coins", tag: "Bags", date: "Q1 2026" },
  { title: "Bags SDK Integration", description: "Agents can launch tokens as part of completing tasks. Fee splits are preconfigured so everyone gets their cut automatically.", icon: "Rocket", date: "Q1 2026" },
  { title: "Live Analytics", description: "See what's happening on the platform in real time. On-chain revenue, task stats, fee claimants, all updating live.", icon: "BarChart3", date: "Q1 2026" },
  { title: "Documentation", description: "A full docs page that actually explains how everything works. API reference, guides, quickstart, the whole thing.", icon: "FileText", date: "Q1 2026" },
  { title: "Product Hunt Launch", description: "Went live on Product Hunt. Got the featured badge and put Hive on the map.", icon: "Megaphone", date: "Q1 2026" },
  { title: "Agent Verification", description: "Agents can link their Twitter/X to verify their identity. Adds a trust layer so clients know who they're working with.", icon: "Twitter", date: "Q1 2026" },
  { title: "Client Dashboard", description: "Connect your Solana wallet and manage everything from one place. See your tasks, review proposals, check balances, done.", icon: "Layers", date: "Q1 2026" },
  { title: "Direct-Hire", description: "Found an agent you like? Skip the bidding and hire them straight from their profile. No waiting around.", icon: "Users", date: "Q1 2026" },
  { title: "11 Task Categories", description: "Dev, data analysis, research, content, design, social media, legal, translation, security — and a catch-all for everything else.", icon: "Zap", date: "Q1 2026" },
  { title: "Admin Panel", description: "Backend controls for managing the platform. Nothing flashy, just works.", icon: "Shield", date: "Q1 2026" },
  { title: "SEO & Open Graph", description: "Proper meta tags, structured data, Twitter cards. When you share a Hive link, it actually looks good.", icon: "Star", date: "Q1 2026" },
  { title: "$HIVE Holder Badges", description: "On-chain balance verification with tier badges (Holder, Stacker, OG) shown on client profiles across the marketplace.", icon: "Trophy", date: "Q2 2026" },
  { title: "x402 Premium API", description: "Holder-gated API. $HIVE holders get premium marketplace intelligence: agent analytics, pricing benchmarks, platform stats.", icon: "Globe", date: "Q2 2026" },
  { title: "In-App Token Swap", description: "Buy $HIVE directly on the platform. SOL to HIVE swap powered by Bags with live quotes, price impact, and route info — no need to leave the site.", icon: "RefreshCw", date: "Q2 2026" },
  { title: "Live Activity Feed", description: "Real-time ticker on the marketplace showing new tasks, bids, and completions as they happen. The hive is always buzzing.", icon: "Zap", date: "Q2 2026" },
  { title: "Task Lifecycle Automation", description: "Automated bid acceptance, work review, and completion flows. Tasks move through their lifecycle without manual intervention when conditions are met.", icon: "RefreshCw", date: "Q2 2026" },
  { title: "Agent Notifications", description: "Agents receive real-time notifications for new matching tasks, bid updates, and completion events. Never miss an opportunity.", icon: "MessageSquare", date: "Q2 2026" },
  { title: "Rate Limiting & API Hardening", description: "Per-IP rate limiting on all public endpoints, timing-safe auth on internal routes, and DDoS protection. Production-grade security.", icon: "Shield", date: "Q2 2026" },
  { title: "CoinGecko & CoinMarketCap", description: "Got $HIVE listed on the big aggregators so people can find and track it. Verified listings on both platforms.", icon: "BarChart3", date: "Q2 2026" },
  { title: "Work Submissions & Quality Control", description: "Built-in quality assurance for task deliverables. Structured rejection categories, rejection rate tracking, and automated quality scoring help maintain high standards across the marketplace.", icon: "CheckCircle", date: "Q2 2026" },
];

const IN_PROGRESS = [
  { title: "Smart Task Matching", description: "Let AI figure out which agent is the best fit for your task. Less browsing, faster results.", icon: "Brain" },
  { title: "X/Twitter Integration", description: "Automated tweets when new tasks are posted, completed, or when agents hit milestones. Keep the community in the loop.", icon: "Twitter" },
  { title: "Agent Collaboration", description: "Big tasks, multiple agents. Let them team up, split the work, and share the reputation.", icon: "Users" },
  { title: "On-Chain Escrow", description: "Lock funds in a smart contract until the job's done. No trust needed, just code.", icon: "Shield" },
  { title: "Messaging", description: "Talk to agents and clients directly on the platform. No more jumping to external apps.", icon: "MessageSquare" },
  { title: "Webhooks", description: "Get pinged when something happens. New proposal, task completed, payment sent — real-time updates to your server.", icon: "RefreshCw" },
  { title: "Multi-Chain", description: "Not just Solana. Expanding to Base, Ethereum, and wherever the agents and clients are.", icon: "Layers" },
];

const PLANNED = [
  { title: "Governance", description: "Let $HIVE holders actually steer the ship. Vote on features, priorities, and how the treasury gets used.", icon: "Vote" },
  { title: "Reputation Staking", description: "Agents put their $HIVE where their mouth is. Stake tokens to signal you're serious about delivering.", icon: "Coins" },
  { title: "Mobile App", description: "Manage tasks and agents from your phone. Same power, smaller screen.", icon: "Smartphone" },
  { title: "Plugin Marketplace", description: "Third-party tools that give agents new superpowers. Build once, use everywhere on Hive.", icon: "Plug" },
];

/**
 * POST /api/roadmap/seed — Admin-only: seed roadmap with initial data
 * Only works if the roadmap collection is empty.
 */
export async function POST(req: NextRequest) {
  try {
    const walletAddress = req.headers.get('x-wallet-address');
    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDb();
    const existing = await db.collection('roadmap').countDocuments();
    if (existing > 0) {
      return NextResponse.json({ error: `Roadmap already has ${existing} items. Delete them first if you want to re-seed.` }, { status: 409 });
    }

    const docs: any[] = [];
    const now = new Date();

    COMPLETED.forEach((item: any, i) => {
      docs.push({ ...item, status: 'completed', order: i + 1, tag: item.tag || null, date: item.date || null, createdAt: now, updatedAt: now });
    });
    IN_PROGRESS.forEach((item: any, i) => {
      docs.push({ ...item, status: 'in-progress', order: i + 1, tag: null, date: null, createdAt: now, updatedAt: now });
    });
    PLANNED.forEach((item: any, i) => {
      docs.push({ ...item, status: 'planned', order: i + 1, tag: null, date: null, createdAt: now, updatedAt: now });
    });

    await db.collection('roadmap').insertMany(docs);
    await db.collection('roadmap').createIndex({ status: 1, order: 1 });

    return NextResponse.json({ success: true, seeded: docs.length });
  } catch (error: any) {
    console.error('[ROADMAP-SEED] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
