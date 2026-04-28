import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

const ADMIN_ADDRESSES = [
  process.env.ADMIN_ADDRESS,
  process.env.ADMIN_WALLET_ADDRESS,
].filter(Boolean).map(a => a!.toLowerCase());

function isAdmin(address: string | null): boolean {
  if (!address) return false;
  return ADMIN_ADDRESSES.includes(address.toLowerCase());
}

const VALID_STATUSES = ['completed', 'in-progress', 'planned'];

/**
 * GET /api/roadmap — Public endpoint to fetch all roadmap items
 */
export async function GET() {
  try {
    const db = await getDb();
    const items = await db.collection('roadmap')
      .find({})
      .sort({ order: 1, createdAt: 1 })
      .toArray();

    const mapped = items.map(item => ({
      id: item._id.toString(),
      title: item.title,
      description: item.description,
      status: item.status,
      date: item.date || null,
      tag: item.tag || null,
      icon: item.icon || null,
      order: item.order || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return NextResponse.json({ success: true, items: mapped });
  } catch (error: any) {
    console.error('[ROADMAP] GET error:', error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * POST /api/roadmap — Admin-only: create a new roadmap item
 */
export async function POST(req: NextRequest) {
  try {
    const walletAddress = req.headers.get('x-wallet-address');
    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDb();
    const body = await req.json();
    const { title, description, status, date, tag, icon } = body;

    if (!title || !description || !status) {
      return NextResponse.json({ error: 'title, description, and status are required' }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    // Get next order position for this status
    const maxOrder = await db.collection('roadmap')
      .find({ status })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const nextOrder = (maxOrder[0]?.order || 0) + 1;

    const doc = {
      title,
      description,
      status,
      date: date || null,
      tag: tag || null,
      icon: icon || null,
      order: nextOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('roadmap').insertOne(doc);

    return NextResponse.json({
      success: true,
      item: { id: result.insertedId.toString(), ...doc },
    });
  } catch (error: any) {
    console.error('[ROADMAP] POST error:', error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * PUT /api/roadmap — Admin-only: update a roadmap item (edit, move category, mark complete)
 */
export async function PUT(req: NextRequest) {
  try {
    const walletAddress = req.headers.get('x-wallet-address');
    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDb();
    const body = await req.json();
    const { id, title, description, status, date, tag, icon } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    const update: any = { updatedAt: new Date() };
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (date !== undefined) update.date = date || null;
    if (tag !== undefined) update.tag = tag || null;
    if (icon !== undefined) update.icon = icon || null;

    // If status changed, update order to end of new category
    if (status) {
      const maxOrder = await db.collection('roadmap')
        .find({ status })
        .sort({ order: -1 })
        .limit(1)
        .toArray();
      update.status = status;
      update.order = (maxOrder[0]?.order || 0) + 1;
      // If moving to completed, set completion date
      if (status === 'completed') {
        update.date = update.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short' }).replace(' ', ' ');
      }
    }

    const result = await db.collection('roadmap').updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ROADMAP] PUT error:', error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

/**
 * DELETE /api/roadmap — Admin-only: delete a roadmap item
 */
export async function DELETE(req: NextRequest) {
  try {
    const walletAddress = req.headers.get('x-wallet-address');
    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection('roadmap').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ROADMAP] DELETE error:', error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
