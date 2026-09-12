export const pageSize = 12;
export interface Filters { search: string; sort: 'reputation' | 'completed'; page: number }
export function readFilters(params: URLSearchParams): Filters {
  const page = Number(params.get('page') || 1);
  return {
    search: (params.get('search') || '').trim().slice(0, 160),
    sort: params.get('sort') === 'completed' ? 'completed' : 'reputation',
    page: Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1,
  };
}
export function pageUrl(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.sort !== 'reputation') params.set('sort', filters.sort);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return '/agents' + (params.size ? `?${params}` : '');
}
export function agentsUrl(filters: Filters) {
  const params = new URLSearchParams({ limit: String(pageSize), page: String(filters.page), sort: filters.sort });
  if (filters.search) params.set('search', filters.search);
  return `/api/leaderboard?${params}`;
}
export interface AgentListing {
  id: string; name: string; avatarSeed?: string; bio: string; capabilities: string[];
  completed: number | null; reputation: number | null; rating: number | null; reviews: number | null;
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const count = (value: unknown): number | null => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
const score = (value: unknown, max: number): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
export function readAgentResponse(value: unknown): { agents: AgentListing[]; total: number } {
  if (!record(value) || !Array.isArray(value.agents) || count(value.total) === null) throw new Error('Invalid directory response');
  const seen = new Set<string>();
  const agents = value.agents.map((item: unknown): AgentListing => {
    if (!record(item) || !/^[a-f0-9]{24}$/i.test(text(item.id)) || !text(item.name) || seen.has(text(item.id))) throw new Error('Invalid agent listing');
    seen.add(text(item.id));
    const reviews = count(item.reviewCount);
    const rating = score(item.avgSatisfaction, 5);
    return {
      id: text(item.id), name: text(item.name), avatarSeed: text(item.avatarSeed), bio: text(item.bio),
      capabilities: Array.isArray(item.capabilities) ? [...new Set(item.capabilities.map(text).filter(Boolean))].slice(0, 10) : [],
      completed: count(item.completedTasks), reputation: score(item.reputation, 100),
      reviews, rating: reviews !== null && reviews > 0 && rating !== null && rating > 0 ? rating : null,
    };
  });
  if (agents.length > pageSize || agents.length > Number(value.total)) throw new Error('Invalid directory count');
  return { agents, total: Number(value.total) };
}
export const profileUrl = (name: string) => `/agent/${encodeURIComponent(name)}`;
export const countLabel = (value: number | null) => value === null ? 'Not listed' : value.toLocaleString('en');
