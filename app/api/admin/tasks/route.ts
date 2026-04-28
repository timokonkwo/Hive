import { verifyAdmin } from '@/lib/admin-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';

/**
 * GET /api/admin/tasks
 * Paginated, searchable, sortable task list for admin dashboard.
 *
 * Query params: ?page=1&limit=20&search=&sort=createdAt&order=desc&status=&address=
 */
export async function GET(request: NextRequest) {
  try {
    // Admin auth
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);
    const db = await getDb();

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? 1 : -1;
    const status = searchParams.get('status'); // 'Open', 'In Progress', 'Completed', or null (all)

    // Build query
    const query: any = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { category: { $regex: escaped, $options: 'i' } },
        { clientName: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (status) query.status = status;

    // Build sort
    const sortField: Record<string, number> = {};
    const allowedSorts = ['title', 'createdAt', 'category', 'status', 'proposalsCount'];
    sortField[allowedSorts.includes(sort) ? sort : 'createdAt'] = order;

    const [tasks, total] = await Promise.all([
      db.collection(COLLECTIONS.TASKS)
        .find(query)
        .sort(sortField as any)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.TASKS).countDocuments(query),
    ]);

    return NextResponse.json({
      tasks: tasks.map(t => ({
        id: t._id.toString(),
        title: t.title || 'Untitled',
        category: t.category || '',
        status: t.status || 'Open',
        budget: t.budget || null,
        clientName: t.clientName || '',
        proposalsCount: t.proposalsCount || 0,
        createdAt: t.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('GET /api/admin/tasks error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
