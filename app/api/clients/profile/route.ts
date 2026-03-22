import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/profile?address=...
 * Fetch client profile by wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'address query parameter required' }, { status: 400 });
    }

    const db = await getDb();
    const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const profile = await db.collection(COLLECTIONS.CLIENTS).findOne({
      address: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });

    if (!profile) {
      return NextResponse.json({
        profile: null,
        message: 'No profile found. Create one with PATCH.',
      });
    }

    return NextResponse.json({
      profile: {
        id: profile._id.toString(),
        address: profile.address,
        name: profile.name || null,
        bio: profile.bio || null,
        company: profile.company || null,
        twitter: profile.twitter || null,
        website: profile.website || null,
        solanaAddress: profile.solanaAddress || null,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error) {
    console.error('GET /api/clients/profile error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PATCH /api/clients/profile
 * Create or update client profile (upsert)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, name, bio, company, twitter, website, solanaAddress } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }

    // Validate fields
    if (name !== undefined && (typeof name !== 'string' || name.length > 100)) {
      return NextResponse.json({ error: 'Name must be 100 chars or less' }, { status: 400 });
    }
    if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
      return NextResponse.json({ error: 'Bio must be 500 chars or less' }, { status: 400 });
    }
    if (company !== undefined && (typeof company !== 'string' || company.length > 100)) {
      return NextResponse.json({ error: 'Company must be 100 chars or less' }, { status: 400 });
    }
    if (twitter !== undefined && twitter !== null && (typeof twitter !== 'string' || twitter.length > 50)) {
      return NextResponse.json({ error: 'Twitter must be 50 chars or less' }, { status: 400 });
    }
    if (website !== undefined && website !== null && (typeof website !== 'string' || website.length > 200)) {
      return NextResponse.json({ error: 'Website must be 200 chars or less' }, { status: 400 });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (company !== undefined) updates.company = company.trim();
    if (twitter !== undefined) updates.twitter = twitter;
    if (website !== undefined) updates.website = website;
    if (solanaAddress !== undefined) {
      if (solanaAddress !== null && solanaAddress !== '') {
        // SECURITY: Validate Solana address format
        try {
          const { PublicKey } = await import('@solana/web3.js');
          new PublicKey(solanaAddress);
        } catch {
          return NextResponse.json({ error: 'Invalid Solana wallet address.' }, { status: 400 });
        }
        if (typeof solanaAddress !== 'string' || solanaAddress.length > 50) {
          return NextResponse.json({ error: 'Invalid Solana wallet address format.' }, { status: 400 });
        }
        updates.solanaAddress = solanaAddress.trim();
      } else {
        updates.solanaAddress = null;
      }
    }

    const db = await getDb();

    // Upsert: create if not exists, update if exists
    const result = await db.collection(COLLECTIONS.CLIENTS).updateOne(
      { address: { $regex: new RegExp(`^${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      {
        $set: updates,
        $setOnInsert: { address, createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      created: result.upsertedCount > 0,
      message: result.upsertedCount > 0 ? 'Profile created' : 'Profile updated',
    });
  } catch (error) {
    console.error('PATCH /api/clients/profile error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
