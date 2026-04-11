import { NextRequest, NextResponse } from 'next/server';
import { getDb, COLLECTIONS } from '@/lib/db';
import { ObjectId } from 'mongodb';

const SUBMISSIONS_PER_PAGE = 15;

// Allowed rejection categories — used for server-side validation
const REJECTION_CATEGORIES = [
  'incomplete', 'poor_quality', 'off_topic', 'incorrect', 'formatting', 'other',
] as const;

/**
 * GET /api/admin/submissions
 * Paginated, searchable, filterable submissions list for admin dashboard.
 *
 * Query params:
 *   ?page=1&limit=15&search=&status=all&address=<admin wallet>
 *
 * Status filter: all | Submitted | Rejected | Approved
 */
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get('x-admin-key');
    const expectedAdmin = process.env.ADMIN_API_KEY;
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const adminAddress = process.env.ADMIN_ADDRESS;

    const keyOk = expectedAdmin && adminKey === expectedAdmin;
    const addressOk = address && adminAddress && address.toLowerCase() === adminAddress.toLowerCase();

    if (!keyOk && !addressOk) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDb();

    // Parse query params with bounds checking
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || String(SUBMISSIONS_PER_PAGE))));
    const search = (searchParams.get('search') || '').trim();
    const statusFilter = searchParams.get('status') || 'all';

    // Build query — escape regex special chars to prevent ReDoS
    const query: any = {};

    if (statusFilter !== 'all') {
      query.status = statusFilter;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { agentName: { $regex: escaped, $options: 'i' } },
        { summary: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [submissions, total] = await Promise.all([
      db.collection(COLLECTIONS.SUBMISSIONS)
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments(query),
    ]);

    // Enrich with task titles in a single batch query
    const taskIds = [...new Set(submissions.map(s => s.taskId).filter(Boolean))];
    const taskMap: Record<string, string> = {};

    if (taskIds.length > 0) {
      const objectIds = taskIds
        .filter(id => ObjectId.isValid(id))
        .map(id => new ObjectId(id));
      if (objectIds.length > 0) {
        const tasks = await db.collection(COLLECTIONS.TASKS)
          .find({ _id: { $in: objectIds } })
          .project({ title: 1 })
          .toArray();
        for (const t of tasks) {
          taskMap[t._id.toString()] = t.title;
        }
      }
    }

    // Rejection category breakdown (all-time, cached per request)
    const rejectionBreakdown = await db.collection(COLLECTIONS.SUBMISSIONS).aggregate([
      { $match: { status: 'Rejected', rejectionCategory: { $exists: true, $ne: null } } },
      { $group: { _id: '$rejectionCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();

    const rejectionsByCategory: Record<string, number> = {};
    for (const r of rejectionBreakdown) {
      if (r._id && REJECTION_CATEGORIES.includes(r._id)) {
        rejectionsByCategory[r._id] = r.count;
      }
    }

    // Submission stats
    const [totalSubmissions, submittedCount, rejectedCount, approvedCount] = await Promise.all([
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments(),
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments({ status: 'Submitted' }),
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments({ status: 'Rejected' }),
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments({ status: 'Approved' }),
    ]);

    return NextResponse.json({
      submissions: submissions.map(s => {
        const deliverables = normalizeDeliverables(s.deliverables, s.summary);
        return {
          id: s._id.toString(),
          taskId: s.taskId,
          taskTitle: taskMap[s.taskId] || 'Unknown Task',
          agentId: s.agentId,
          agentName: s.agentName,
          summary: s.summary || '',
          deliverableCount: deliverables.length,
          deliverables,
          reportUri: s.reportUri || null,
          status: s.status,
          rejectionCategory: s.rejectionCategory || null,
          rejectionReason: s.rejectionReason || null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalSubmissions,
        submittedCount,
        rejectedCount,
        approvedCount,
        rejectionRate: totalSubmissions > 0 ? Math.round((rejectedCount / totalSubmissions) * 100) : 0,
        rejectionsByCategory,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/submissions error:', error);
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}

/**
 * Extract actual text content from a deliverable's content field.
 * Agents sometimes send:
 *  - A plain string (correct)
 *  - A stringified JSON of the entire submission body
 *  - An object with nested content/summary
 *  - undefined/null
 */
function extractContent(raw: any): string {
  if (raw == null) return '';

  // Already a clean string — check if it's JSON wrapping real content
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        // Agent sent the whole submission as content: { summary, deliverables }
        if (parsed.deliverables && Array.isArray(parsed.deliverables)) {
          // Extract the nested actual content
          const nested = parsed.deliverables
            .map((d: any) => d.content)
            .filter(Boolean)
            .join('\n\n');
          return (nested || parsed.summary || trimmed).slice(0, 2000);
        }
        // Object with a content field
        if (parsed.content && typeof parsed.content === 'string') {
          return parsed.content.slice(0, 2000);
        }
        // Object with a summary field
        if (parsed.summary && typeof parsed.summary === 'string') {
          return parsed.summary.slice(0, 2000);
        }
      } catch {
        // Not valid JSON — just a string that starts with {
      }
    }
    return trimmed.slice(0, 2000);
  }

  // Object (not stringified)
  if (typeof raw === 'object') {
    if (raw.content) return extractContent(raw.content);
    if (raw.summary) return String(raw.summary).slice(0, 2000);
    if (raw.text) return String(raw.text).slice(0, 2000);
    return JSON.stringify(raw).slice(0, 500);
  }

  return String(raw).slice(0, 2000);
}

/**
 * Normalize the deliverables array for admin display.
 * Handles cases where agents crammed the entire submission into one deliverable,
 * or where deliverables have no content.
 */
function normalizeDeliverables(raw: any, fallbackSummary?: string): Array<{ type: string; label: string; content: string }> {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    // No deliverables — use the summary as a single deliverable
    return fallbackSummary
      ? [{ type: 'text', label: 'Work Summary', content: fallbackSummary }]
      : [];
  }

  const results: Array<{ type: string; label: string; content: string }> = [];

  for (const d of raw) {
    const content = extractContent(d.content);

    // Check if this deliverable's content contains nested deliverables (agent sent whole body)
    if (typeof d.content === 'string' && d.content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(d.content);
        if (parsed.deliverables && Array.isArray(parsed.deliverables) && parsed.deliverables.length > 0) {
          // Unpack the nested deliverables
          for (const nested of parsed.deliverables) {
            results.push({
              type: nested.type || d.type || 'text',
              label: nested.label || d.label || 'Deliverable',
              content: extractContent(nested.content),
            });
          }
          continue;
        }
      } catch {
        // Not JSON, fall through
      }
    }

    results.push({
      type: d.type || 'text',
      label: d.label || 'Deliverable',
      content: content || '(No content provided)',
    });
  }

  return results;
}
