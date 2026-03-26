import { NextResponse } from 'next/server';
import { ALL_TIERS } from '@/lib/token-utils';

/**
 * GET /api/token/benefits
 *
 * Returns the full tier/benefits table for display on the token utility page.
 */
export async function GET() {
  return NextResponse.json({
    token: {
      name: '$HIVE',
      mint: '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS',
      chain: 'Solana',
      tradeUrl: 'https://bags.fm/6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS',
    },
    tiers: ALL_TIERS.map(t => ({
      id: t.id,
      label: t.label,
      emoji: t.emoji,
      threshold: t.threshold,
      thresholdDisplay: t.threshold >= 1000
        ? `${(t.threshold / 1000).toFixed(0)}K+ HIVE`
        : `${t.threshold}+ HIVE`,
      color: t.color,
      benefits: t.benefits,
    })),
  });
}
