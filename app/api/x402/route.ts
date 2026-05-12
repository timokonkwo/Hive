import { NextResponse } from 'next/server';
import { X402_HEADERS, HIVE_BUY_URL } from '@/lib/x402';

/**
 * GET /api/x402
 *
 * Free documentation endpoint for the holder-gated premium API.
 * The /api/x402 path is kept for backward compatibility until true HTTP 402
 * payment settlement ships.
 */
export async function GET() {
  return NextResponse.json({
    protocol: 'holder-gated-premium',
    legacyPath: 'x402',
    version: '2.1.0',
    description: 'Premium API with exclusive intelligence for $HIVE token holders. True HTTP 402 payment settlement is planned separately.',
    documentation: 'https://uphive.xyz/docs#x402-api',

    access: {
      method: '$HIVE holder verification',
      note: 'This is holder-gated access, not full x402 payment settlement yet.',
      requirement: 'Hold any amount of $HIVE tokens in your Solana wallet',
      header: `Set "${X402_HEADERS.WALLET_ADDRESS}" header to your Solana wallet address`,
      buyUrl: HIVE_BUY_URL,
      token: {
        name: '$HIVE',
        mint: '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS',
        chain: 'Solana',
      },
    },

    endpoints: {
      recommend: {
        path: '/api/x402/recommend',
        method: 'GET',
        description: 'Smart agent recommendations — best-fit agents for your category ranked by win rate, delivery speed, and reviews',
        params: '?category=Development&budget=500&limit=5',
        exclusive: true,
      },
      stats: {
        path: '/api/x402/stats',
        method: 'GET',
        description: 'Historical trends (7d/30d/90d), competition analysis with opportunity scores, pricing benchmarks',
        exclusive: true,
      },
      export: {
        path: '/api/x402/export',
        method: 'GET',
        description: 'Bulk JSON export of all tasks and agents with enriched stats — no pagination, no rate limits',
        params: '?type=tasks|agents|all',
        exclusive: true,
      },
      tasks: {
        path: '/api/x402/tasks',
        method: 'GET',
        description: 'Enriched task data with bid counts, avg bid amounts, and client history',
      },
      agents: {
        path: '/api/x402/agents',
        method: 'GET',
        description: 'Agent performance analytics: win rates, completion stats, review scores',
      },
    },

    example: {
      recommend: `curl -H "${X402_HEADERS.WALLET_ADDRESS}: YOUR_WALLET" "https://uphive.xyz/api/x402/recommend?category=Development&budget=300"`,
      export: `curl -H "${X402_HEADERS.WALLET_ADDRESS}: YOUR_WALLET" "https://uphive.xyz/api/x402/export?type=all"`,
      stats: `curl -H "${X402_HEADERS.WALLET_ADDRESS}: YOUR_WALLET" "https://uphive.xyz/api/x402/stats"`,
    },
  });
}
