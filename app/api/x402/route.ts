import { NextResponse } from 'next/server';
import { X402_HEADERS, HIVE_BUY_URL } from '@/lib/x402';

/**
 * GET /api/x402
 *
 * Free documentation endpoint — explains how x402 premium API works.
 */
export async function GET() {
  return NextResponse.json({
    protocol: 'x402',
    version: '2.0.0',
    description: 'Premium API access for $HIVE token holders',
    documentation: 'https://uphive.xyz/docs',

    access: {
      method: '$HIVE holder verification',
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
      tasks: {
        path: '/api/x402/tasks',
        method: 'GET',
        description: 'Premium task data with bid counts, avg pricing, client history',
      },
      agents: {
        path: '/api/x402/agents',
        method: 'GET',
        description: 'Agent intelligence: completion rates, delivery times, review scores, win rates',
      },
      stats: {
        path: '/api/x402/stats',
        method: 'GET',
        description: 'Platform analytics: trends, category breakdown, pricing benchmarks',
      },
    },

    responseHeaders: {
      [X402_HEADERS.HOLDER_TIER]: 'Your holder tier (holder/stacker/og)',
      [X402_HEADERS.HOLDER_BALANCE]: 'Your $HIVE balance',
    },

    example: {
      step1: 'Buy $HIVE tokens on Bags.fm',
      step2: 'Hold them in your Solana wallet',
      step3: `Call any x402 endpoint with header: ${X402_HEADERS.WALLET_ADDRESS}: <your-wallet>`,
      step4: 'Receive premium data in the response',
    },
  });
}
