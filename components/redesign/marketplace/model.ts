export const categories = ['Development', 'Analysis', 'Security', 'Token Launch', 'Research', 'Content', 'Design', 'Social', 'Legal', 'Translation', 'Other'] as const;
export const statuses = ['Open', 'In Progress', 'In Review', 'Completed', 'Disputed', 'Cancelled'] as const;
export const sorts = ['newest', 'oldest', 'proposals'] as const;
export const pageSize = 12;

export interface Filters {
  search: string;
  category: string;
  status: string;
  sort: typeof sorts[number];
  page: number;
  task: string;
}

export function readFilters(params: URLSearchParams): Filters {
  const page = Number(params.get('page') || 1);
  const sort = params.get('sort');
  const category = params.get('category');
  const status = params.get('status');
  const task = params.get('task') || '';
  return {
    search: (params.get('search') || '').trim().slice(0, 160),
    category: categories.some(value => value === category) ? category! : 'All',
    status: status === 'All' || statuses.some(value => value === status) ? status! : 'All',
    sort: sorts.some(value => value === sort) ? sort as Filters['sort'] : 'newest',
    page: Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1,
    task: /^[a-f0-9]{24}$/i.test(task) ? task : '',
  };
}

export function pageUrl(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.category !== 'All') params.set('category', filters.category);
  if (filters.status !== 'All') params.set('status', filters.status);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.page !== 1) params.set('page', String(filters.page));
  if (filters.task) params.set('task', filters.task);
  return '/tasks' + (params.size ? `?${params}` : '');
}

export function tasksUrl(filters: Filters): string {
  const params = new URLSearchParams({ limit: String(pageSize), page: String(filters.page) });
  if (filters.search) params.set('search', filters.search);
  if (filters.category !== 'All') params.set('category', filters.category);
  if (filters.status !== 'All') params.set('status', filters.status);
  params.set('sort', filters.sort === 'proposals' ? 'proposalsCount' : 'createdAt');
  params.set('order', filters.sort === 'oldest' ? 'asc' : 'desc');
  return `/api/tasks?${params}`;
}

export interface TaskListing {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  budget: string;
  proposals: number | null;
  createdAt: string | null;
  deadline: string | null;
  requirements: string;
  tags: string[];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const date = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

export function readTaskResponse(value: unknown): { tasks: TaskListing[]; total: number } {
  if (!record(value) || !Array.isArray(value.tasks) || !Number.isSafeInteger(value.total) || Number(value.total) < 0) {
    throw new Error('Invalid task response');
  }
  const seen = new Set<string>();
  const tasks = value.tasks.map((item: unknown): TaskListing => {
    if (!record(item) || !/^[a-f0-9]{24}$/i.test(text(item.id)) || !text(item.title) || seen.has(text(item.id))) {
      throw new Error('Invalid task listing');
    }
    seen.add(text(item.id));
    return {
      id: text(item.id), title: text(item.title), description: text(item.description),
      category: text(item.category) || 'Other', status: text(item.status) || 'Status not listed',
      budget: text(item.budget) || 'Not listed',
      proposals: Number.isSafeInteger(item.proposalsCount) && Number(item.proposalsCount) >= 0 ? Number(item.proposalsCount) : null,
      createdAt: date(item.createdAt), deadline: date(item.deadline), requirements: text(item.requirements),
      tags: Array.isArray(item.tags) ? [...new Set(item.tags.map(text).filter(Boolean))].slice(0, 10) : [],
    };
  });
  if (tasks.length > pageSize || tasks.length > Number(value.total)) throw new Error('Invalid task count');
  return { tasks, total: Number(value.total) };
}

export function dateLabel(value: string | null): string {
  return value ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Not listed';
}
