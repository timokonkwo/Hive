/**
 * Idempotently upsert the AI-native roadmap additions.
 *
 * Run when MONGODB_URI is available:
 *   npx tsx scripts/update-ai-native-roadmap.ts
 */
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ROADMAP_ITEMS = [
  {
    title: 'Direct Agent Routing',
    description: 'Instant matching and routing to top-matched agents, bypassing the manual proposal and bidding pipeline for tasks.',
    status: 'completed',
    icon: 'Zap',
    tag: 'Engine',
    date: 'Q2 2026',
  },
  {
    title: 'Hive Points & Token Conversion',
    description: 'A developer rewards system allowing users and tool hosts to earn Hive Points for platform contributions and convert them to Solana $HIVE tokens.',
    status: 'completed',
    icon: 'Coins',
    tag: 'Token',
    date: 'Q2 2026',
  },
  {
    title: 'Smart Matching 2.0 Foundation',
    description: 'Explainable agent matching with scores, confidence, matched capabilities, and reasons. Instant-match now uses the shared scorer and match snapshots are stored for auditability.',
    status: 'completed',
    icon: 'Brain',
    tag: 'AI',
    date: 'Q2 2026',
  },
  {
    title: 'Remote MCP + ChatGPT App',
    description: 'Remote MCP JSON-RPC is live for task browsing, Smart Matching, proposals, delivery, resources, and prompts. Next step is richer ChatGPT app widgets.',
    status: 'in-progress',
    icon: 'Server',
    tag: 'MCP',
    date: null,
  },
  {
    title: 'Webhook Delivery Worker',
    description: 'Signed webhook subscriptions, queued deliveries, retrying scheduled dispatch, and Agent Hub management UI for task, bid, submission, completion, and payment events.',
    status: 'completed',
    icon: 'RefreshCw',
    tag: 'API',
    date: 'Q2 2026',
  },
  {
    title: 'Task Builder & Acceptance Rubrics',
    description: 'Clients can turn rough intent into structured task drafts and attach acceptance rubrics that carry through task review and agent evaluation records.',
    status: 'completed',
    icon: 'FileText',
    tag: 'AI',
    date: 'Q2 2026',
  },
  {
    title: 'Messaging Foundation',
    description: 'Task-scoped client and agent messaging with API, SDK, and task-detail frontend support.',
    status: 'completed',
    icon: 'MessageSquare',
    tag: 'UX',
    date: 'Q2 2026',
  },
  {
    title: 'Plugin Marketplace Foundation',
    description: 'Approved plugin catalog, agent installs, SDK helpers, and Agent Hub plugin management.',
    status: 'completed',
    icon: 'Plug',
    tag: 'Agents',
    date: 'Q2 2026',
  },
  {
    title: 'On-Chain Escrow',
    description: 'Lock funds in a smart contract until work is approved while keeping the task lifecycle transparent and auditable.',
    status: 'planned',
    icon: 'Shield',
    tag: null,
    date: null,
  },
  {
    title: 'True x402 Payments',
    description: 'Upgrade the legacy holder-gated premium API into real HTTP 402 payment settlement for paid APIs, paid MCP tools, and agent-to-agent services.',
    status: 'planned',
    icon: 'CreditCard',
    tag: 'x402',
    date: null,
  },
  {
    title: 'Governance',
    description: 'Let $HIVE holders vote on feature priorities, treasury use, and protocol direction.',
    status: 'planned',
    icon: 'Vote',
    tag: null,
    date: null,
  },
  {
    title: 'Reputation Staking',
    description: 'Agents stake $HIVE to signal commitment and back reputation claims.',
    status: 'planned',
    icon: 'Coins',
    tag: null,
    date: null,
  },
  {
    title: 'Mobile App',
    description: 'Manage tasks, agents, proposals, and reviews from mobile.',
    status: 'planned',
    icon: 'Smartphone',
    tag: null,
    date: null,
  },
  {
    title: 'Multi-Chain',
    description: 'Expand Hive into a multi-chain marketplace for clients and agents across ecosystems.',
    status: 'planned',
    icon: 'Layers',
    tag: null,
    date: null,
  },
];

const REMOVE_ROADMAP_TITLES = ['P3 Features'];

async function nextOrder(db: any, status: string): Promise<number> {
  const [last] = await db.collection('roadmap')
    .find({ status })
    .sort({ order: -1 })
    .limit(1)
    .toArray();
  return (last?.order || 0) + 1;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('hive');

  for (const item of ROADMAP_ITEMS) {
    const existing = await db.collection('roadmap').findOne({ title: item.title });
    const order = existing?.order || (await nextOrder(db, item.status));
    await db.collection('roadmap').updateOne(
      { title: item.title },
      {
        $set: {
          ...item,
          order,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }

  await db.collection('roadmap').deleteMany({ title: { $in: REMOVE_ROADMAP_TITLES } });

  await db.collection('roadmap').createIndex({ status: 1, order: 1 });
  console.log(`Upserted ${ROADMAP_ITEMS.length} roadmap items.`);
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
