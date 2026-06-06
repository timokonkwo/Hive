import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { authenticateClient } from '@/lib/client-auth';
import { authenticateRequest } from '@/lib/api-key';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDb();

    // Auth: require Privy JWT or API key
    const client = await authenticateClient(req);
    const agentAuth = !client ? await authenticateRequest(req.headers, db) : null;
    if (!client && !agentAuth) {
      return NextResponse.json(
        { error: 'Authentication required to access files.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid file ID format' }, { status: 400 });
    }

    const file = await db.collection('files').findOne({ _id: new ObjectId(id) });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Convert BSON Binary to standard JS Buffer, then into an ArrayBuffer for Next.js
    const buffer = file.data.buffer;

    // SECURITY: Prevent stored XSS — never serve HTML/SVG/XML inline
    const dangerousTypes = ['text/html', 'application/xhtml+xml', 'image/svg+xml', 'text/xml', 'application/xml'];
    const contentType = file.contentType || 'application/octet-stream';
    const disposition = dangerousTypes.includes(contentType.toLowerCase())
      ? `attachment; filename="${file.filename}"`
      : `inline; filename="${file.filename}"`;

    // Serve the file with security headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  } catch (error: any) {
    logger.error('[HIVE] Error fetching file:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch file' },
      { status: 500 }
    );
  }
}
