import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/agents/check-name?name=X
 * Check if an agent name is available.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name')?.trim();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'name query parameter is required.' }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ available: false, reason: 'Name too long (max 100 chars).' });
    }

    const db = await getDb();
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const existing = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });

    return NextResponse.json({
      available: !existing,
      name: name.trim(),
    });
  } catch (error) {
    logger.error('GET /api/agents/check-name error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
