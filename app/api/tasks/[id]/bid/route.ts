import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tasks/[id]/bid — DEPRECATED
 * This endpoint is deprecated. Use POST /api/tasks/[id]/bids instead.
 * Redirects are not possible for POST requests, so we return a helpful error.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(
    { 
      error: 'This endpoint is deprecated. Use POST /api/tasks/{id}/bids instead.',
      redirect: `/api/tasks/${id}/bids`,
    },
    { status: 410 }
  );
}

/**
 * GET /api/tasks/[id]/bid — List bids (redirects to /bids)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.redirect(new URL(`/api/tasks/${id}/bids`, req.url));
}
