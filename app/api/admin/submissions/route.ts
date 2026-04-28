import { verifyAdmin } from '@/lib/admin-auth';
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
    // Admin auth
    const admin = await verifyAdmin(request);
    if (admin.error) return admin.error;

    const { searchParams } = new URL(request.url);

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
 * Try to parse a string as JSON. Returns null on failure.
 */
function safeParse(str: string): any | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Clean up content: fix escaped newlines, trim whitespace.
 */
function cleanContent(str: string): string {
  if (!str) return '';
  // Replace literal \n (two-char sequences) with real newlines
  return str.replace(/\\n/g, '\n').trim();
}

/**
 * Extract actual text content from a deliverable's content field.
 * Agents send content in many broken formats:
 *  - A plain string (correct)
 *  - A stringified JSON of the entire submission body { summary, deliverables: [] }
 *  - An object with nested content/summary
 *  - undefined/null
 */
function extractContent(raw: any): string {
  if (raw == null) return '';

  if (typeof raw === 'string') {
    const trimmed = raw.trim();

    // Try JSON parse if it looks like an object or array
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = safeParse(trimmed);
      if (parsed) {
        // Case: agent sent entire submission body as content
        // { summary: "...", deliverables: [{ content: "actual work" }] }
        if (parsed.deliverables && Array.isArray(parsed.deliverables)) {
          const nested = parsed.deliverables
            .map((d: any) => extractContent(d.content))
            .filter((c: string) => c.length > 0)
            .join('\n\n');
          return cleanContent(nested || parsed.summary || trimmed);
        }
        // Case: nested object with a content field
        if (typeof parsed.content === 'string') {
          return cleanContent(parsed.content);
        }
        // Case: nested object with summary only
        if (typeof parsed.summary === 'string') {
          return cleanContent(parsed.summary);
        }
        // Case: it parsed into something but doesn't match known patterns
        // Return cleaned original string rather than the JSON structure
        if (parsed.type && parsed.label) {
          // This looks like a single deliverable object - extract content
          if (typeof parsed.content === 'string') {
            return cleanContent(parsed.content);
          }
        }
      }
    }

    return cleanContent(trimmed);
  }

  // Object (not stringified)
  if (typeof raw === 'object') {
    if (typeof raw.content === 'string') return cleanContent(raw.content);
    if (raw.content) return extractContent(raw.content);
    if (raw.summary) return cleanContent(String(raw.summary));
    if (raw.text) return cleanContent(String(raw.text));
    // Last resort: stringify, but clean it
    return cleanContent(JSON.stringify(raw));
  }

  return cleanContent(String(raw));
}

/**
 * Normalize the deliverables array for display.
 * Handles cases where agents crammed the entire submission into one deliverable,
 * or where deliverables have malformed or missing content.
 */
function normalizeDeliverables(raw: any, fallbackSummary?: string): Array<{ type: string; label: string; content: string }> {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return fallbackSummary
      ? [{ type: 'text', label: 'Work Summary', content: cleanContent(fallbackSummary) }]
      : [];
  }

  const results: Array<{ type: string; label: string; content: string }> = [];

  for (const d of raw) {
    // Check if the content field contains nested deliverables (agent sent whole body as content)
    if (d.content && typeof d.content === 'string') {
      const trimmedContent = d.content.trim();
      if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
        const parsed = safeParse(trimmedContent);
        if (parsed?.deliverables && Array.isArray(parsed.deliverables) && parsed.deliverables.length > 0) {
          // Unpack nested deliverables - preserve their individual types
          for (const nested of parsed.deliverables) {
            const nestedContent = extractContent(nested.content);
            if (nestedContent) {
              results.push({
                type: nested.type || d.type || 'text',
                label: nested.label || d.label || 'Deliverable',
                content: nestedContent,
              });
            }
          }
          // If we successfully unpacked nested deliverables, skip the outer one
          if (results.length > 0) continue;
        }
      }
    }

    // Normal deliverable - extract and clean content
    const content = extractContent(d.content);
    results.push({
      type: d.type || 'text',
      label: d.label || 'Deliverable',
      content: content || '(No content provided)',
    });
  }

  return results;
}

