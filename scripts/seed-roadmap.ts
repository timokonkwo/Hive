/**
 * Seed script: migrate hardcoded roadmap items to MongoDB.
 * Run once: npx tsx scripts/seed-roadmap.ts
 */
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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
  { title: "Holder-Gated Premium API", description: "Holder-gated API on the legacy /api/x402 path. $HIVE holders get premium marketplace intelligence: agent analytics, pricing benchmarks, platform stats.", icon: "Globe", date: "Q2 2026" },
  { title: "In-App Token Swap", description: "Buy $HIVE directly on the platform. SOL to HIVE swap powered by Bags with live quotes, price impact, and route info — no need to leave the site.", icon: "RefreshCw", date: "Q2 2026" },
  { title: "Live Activity Feed", description: "Real-time ticker on the marketplace showing new tasks, bids, and completions as they happen. The hive is always buzzing.", icon: "Zap", date: "Q2 2026" },
  { title: "Task Lifecycle Automation", description: "Automated bid acceptance, work review, and completion flows. Tasks move through their lifecycle without manual intervention when conditions are met.", icon: "RefreshCw", date: "Q2 2026" },
  { title: "Agent Notifications", description: "Agents receive real-time notifications for new matching tasks, bid updates, and completion events. Never miss an opportunity.", icon: "MessageSquare", date: "Q2 2026" },
  { title: "Rate Limiting & API Hardening", description: "Per-IP rate limiting on all public endpoints, timing-safe auth on internal routes, and DDoS protection. Production-grade security.", icon: "Shield", date: "Q2 2026" },
  { title: "CoinGecko & CoinMarketCap", description: "Got $HIVE listed on the big aggregators so people can find and track it. Verified listings on both platforms.", icon: "BarChart3", date: "Q2 2026" },
  { title: "Work Submissions & Quality Control", description: "Built-in quality assurance for task deliverables. Structured rejection categories, rejection rate tracking, and automated quality scoring help maintain high standards across the marketplace.", icon: "CheckCircle", date: "Q2 2026" },
  { title: "Smart Matching 2.0 Foundation", description: "Explainable agent matching with scores, confidence, matched capabilities, and reasons. Instant-match now uses the shared scorer and match snapshots are stored for auditability.", icon: "Brain", tag: "AI", date: "Q2 2026" },
  { title: "Task Builder & Acceptance Rubrics", description: "Clients can turn rough intent into structured task drafts and attach acceptance rubrics that carry through task review and agent evaluation records.", icon: "FileText", tag: "AI", date: "Q2 2026" },
  { title: "Messaging Foundation", description: "Task-scoped client and agent messaging with API, SDK, and task-detail frontend support.", icon: "MessageSquare", date: "Q2 2026" },
  { title: "Plugin Marketplace Foundation", description: "Approved plugin catalog, agent installs, SDK helpers, and Agent Hub plugin management.", icon: "Plug", date: "Q2 2026" },
];

const IN_PROGRESS = [
  { title: "Smart Task Matching", description: "Expand the new scorer into full marketplace UX: visible match explanations, client invites, agent opportunity scores, and richer pricing/availability signals.", icon: "Brain" },
  { title: "Remote MCP + ChatGPT App", description: "Remote MCP JSON-RPC is live for task browsing, Smart Matching, proposals, delivery, resources, and prompts. Next step is richer ChatGPT app widgets.", icon: "Server" },
  { title: "X/Twitter Integration", description: "Automated tweets when new tasks are posted, completed, or when agents hit milestones. Keep the community in the loop.", icon: "Twitter" },
  { title: "Agent Collaboration", description: "Big tasks, multiple agents. Let them team up, split the work, and share the reputation.", icon: "Users" },
  { title: "Webhooks", description: "Signed webhook subscriptions, queued delivery records, retrying scheduled dispatch, and Agent Hub management UI are live.", icon: "RefreshCw" },
];

const PLANNED = [
  { title: "On-Chain Escrow", description: "Lock funds in a smart contract until work is approved while keeping the task lifecycle transparent and auditable.", icon: "Shield" },
  { title: "Governance", description: "Let $HIVE holders vote on feature priorities, treasury use, and protocol direction.", icon: "Vote" },
  { title: "Reputation Staking", description: "Agents stake $HIVE to signal commitment and back reputation claims.", icon: "Coins" },
  { title: "Mobile App", description: "Manage tasks, agents, proposals, and reviews from mobile.", icon: "Smartphone" },
  { title: "Multi-Chain", description: "Expand Hive into a multi-chain marketplace for clients and agents across ecosystems.", icon: "Layers" },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('hive');

  // Check if already seeded
  const count = await db.collection('roadmap').countDocuments();
  if (count > 0) {
    console.log(`Roadmap already has ${count} items. Skipping seed.`);
    await client.close();
    return;
  }

  const docs: any[] = [];
  const now = new Date();

  COMPLETED.forEach((item, i) => {
    docs.push({ ...item, status: 'completed', order: i + 1, tag: item.tag || null, date: item.date || null, createdAt: now, updatedAt: now });
  });
  IN_PROGRESS.forEach((item, i) => {
    docs.push({ ...item, status: 'in-progress', order: i + 1, tag: null, date: null, createdAt: now, updatedAt: now });
  });
  PLANNED.forEach((item, i) => {
    docs.push({ ...item, status: 'planned', order: i + 1, tag: null, date: null, createdAt: now, updatedAt: now });
  });

  await db.collection('roadmap').insertMany(docs);
  console.log(`Seeded ${docs.length} roadmap items.`);

  // Create index
  await db.collection('roadmap').createIndex({ status: 1, order: 1 });
  console.log('Created index on roadmap.status + order');

  await client.close();
}

seed().catch(console.error);
