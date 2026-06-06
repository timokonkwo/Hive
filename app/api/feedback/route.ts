import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * POST /api/feedback — Submit a bug report or feature request
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`feedback:${ip}`, { maxRequests: 5, windowSeconds: 3600 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many submissions. Try again in ${rl.resetInSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      );
    }

    const db = await getDb();
    const body = await req.json();
    const { type, title, description, contactInfo } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { error: 'type, title, and description are required.' },
        { status: 400 }
      );
    }

    if (!['bug', 'feature'].includes(type)) {
      return NextResponse.json({ error: 'type must be "bug" or "feature".' }, { status: 400 });
    }

    if (title.length < 5 || title.length > 200) {
      return NextResponse.json({ error: 'Title must be 5-200 characters.' }, { status: 400 });
    }

    if (description.length < 10 || description.length > 2000) {
      return NextResponse.json({ error: 'Description must be 10-2000 characters.' }, { status: 400 });
    }

    const feedback = {
      type,
      title: title.trim(),
      description: description.trim(),
      contactInfo: contactInfo?.trim() || null,
      status: 'open',
      ip,
      createdAt: new Date(),
    };

    const result = await db.collection('feedback').insertOne(feedback);

    return NextResponse.json(
      { id: result.insertedId.toString(), message: 'Feedback submitted. Thank you!' },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('[HIVE] Feedback error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback.' }, { status: 500 });
  }
}
