import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

const ADMIN_ADDRESSES = [
  process.env.ADMIN_ADDRESS,
  process.env.ADMIN_WALLET_ADDRESS,
].filter(Boolean).map(a => a!.toLowerCase());

function isAdmin(address?: string) {
  return address ? ADMIN_ADDRESSES.includes(address.toLowerCase()) : false;
}

/**
 * GET /api/admin/feedback — List all feedback (admin only)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!isAdmin(address || undefined)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = await getDb();
  const status = searchParams.get('status') || 'all';
  const type = searchParams.get('type') || 'all';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  const query: any = {};
  if (status !== 'all') query.status = status;
  if (type !== 'all') query.type = type;

  const [items, total] = await Promise.all([
    db.collection('feedback')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection('feedback').countDocuments(query),
  ]);

  const mapped = items.map(item => ({
    ...item,
    id: item._id.toString(),
    _id: undefined,
  }));

  return NextResponse.json({ feedback: mapped, total, page, limit });
}

/**
 * PATCH /api/admin/feedback — Update feedback status (admin only)
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, address } = body;

  if (!isAdmin(address)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!id || !status || !['open', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
    return NextResponse.json({ error: 'id and valid status required.' }, { status: 400 });
  }

  const db = await getDb();

  try {
    await db.collection('feedback').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
