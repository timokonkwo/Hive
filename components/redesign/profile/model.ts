import { readAssociation } from '@/lib/agent-tokenization/association';
import type { TokenAssociation } from '@/lib/agent-tokenization/types';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const id = (value: unknown) => /^[a-f0-9]{24}$/i.test(text(value)) ? text(value) : '';
const count = (value: unknown): number | null => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
const score = (value: unknown, max: number): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
const texts = (value: unknown) => Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))].slice(0, 10) : [];
const date = (value: unknown): string | null => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
export function safeWebsite(value: unknown): string | null {
  try { const url = new URL(text(value)); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
const mint = (value: unknown) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text(value)) ? text(value) : '';
export interface HistoryItem { id: string; taskId: string; title: string; status: string; category: string; budget: string; createdAt: string | null }
export interface TokenRecord { id: string; name: string; symbol: string; mint: string; createdAt: string | null }
export interface AgentProfile {
  id: string; name: string; avatarSeed?: string; avatarUrl?: string; bio: string; capabilities: string[]; status: string | null;
  completed: number | null; reputation: number | null; rating: number | null; reviews: number | null;
  createdAt: string | null; website: string | null; wallet: string;
  tasks: HistoryItem[]; proposals: HistoryItem[]; tokens: TokenRecord[]; ownToken: { symbol: string; mint: string } | null;
  ponsToken: TokenAssociation | null;
}
function history(value: unknown, proposal: boolean): HistoryItem[] {
  if (!Array.isArray(value) || value.length > 10) throw new Error('Invalid history');
  const seen = new Set<string>();
  return value.map(item => {
    if (!record(item) || !id(item.id) || seen.has(id(item.id))) throw new Error('Invalid history item');
    seen.add(id(item.id));
    return { id: id(item.id), taskId: proposal ? id(item.taskId) : id(item.id), title: text(proposal ? item.taskTitle : item.title) || 'Task title not listed', status: text(item.status) || 'Status not listed', category: text(item.category), budget: text(proposal ? item.amount : item.budget) || 'Not listed', createdAt: date(item.createdAt) };
  });
}
export function readProfile(value: unknown): AgentProfile {
  if (!record(value) || !record(value.agent) || !record(value.stats)) throw new Error('Invalid profile');
  const a = value.agent;
  if (!id(a.id) || !text(a.name)) throw new Error('Invalid agent identity');
  const reviews = count(a.reviewCount), rating = score(a.avgSatisfaction, 5);
  if (!Array.isArray(value.tokenLaunches)) throw new Error('Invalid token history');
  return {
    id: id(a.id), name: text(a.name), avatarSeed: text(a.avatarSeed), avatarUrl: text(a.avatarUrl), bio: text(a.bio), capabilities: texts(a.capabilities), status: a.status == null ? null : text(a.status) || 'unknown',
    completed: count(value.stats.tasksCompleted), reputation: score(a.reputation, 100), reviews,
    rating: reviews !== null && reviews > 0 && rating !== null && rating > 0 ? rating : null,
    createdAt: date(a.createdAt), website: safeWebsite(a.website), wallet: text(a.walletAddress) || text(a.solanaAddress),
    tasks: history(value.taskHistory, false), proposals: history(value.recentBids, true),
    tokens: value.tokenLaunches.filter(record).filter(item => id(item.id) && mint(item.mintAddress)).slice(0, 10).map(item => ({ id: id(item.id), name: text(item.tokenName), symbol: text(item.tokenSymbol), mint: mint(item.mintAddress), createdAt: date(item.createdAt) })),
    ownToken: a.tokenLaunchStatus === 'launched' && mint(a.tokenMintAddress) ? { symbol: text(a.tokenSymbol), mint: mint(a.tokenMintAddress) } : null,
    ponsToken: readAssociation(a.ponsToken),
  };
}
export interface ClientReview { id: string; taskId: string; title: string; rating: number | null; comment: string; tags: string[]; createdAt: string | null }
export const reviewsPerPage = 5;
export function readReviews(value: unknown): { reviews: ClientReview[]; total: number } {
  if (!record(value) || !Array.isArray(value.reviews) || count(value.total) === null || value.reviews.length > reviewsPerPage || value.reviews.length > Number(value.total)) throw new Error('Invalid reviews');
  const seen = new Set<string>();
  const reviews = value.reviews.map((item: unknown): ClientReview => {
    if (!record(item) || !id(item.id) || seen.has(id(item.id))) throw new Error('Invalid review');
    seen.add(id(item.id));
    const rating = score(item.satisfaction, 5);
    return { id: id(item.id), taskId: id(item.taskId), title: text(item.taskTitle) || 'Task title not listed', rating: rating !== null && rating >= 1 ? rating : null, comment: text(item.comment), tags: texts(item.tags), createdAt: date(item.createdAt) };
  });
  return { reviews, total: Number(value.total) };
}
export function reviewPage(params: URLSearchParams) { const page = Number(params.get('reviewPage') || 1); return Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1; }
export const profileApi = (name: string) => `/api/agents/by-name/${encodeURIComponent(name)}`;
export const canStartTask = (status: string | null) => status === null || status === 'active';
export const taskEntry = (agentId: string) => id(agentId) ? `/create?agent=${encodeURIComponent(agentId)}` : null;
export function statusLabel(value: string) {
  return ({ WorkSubmitted: 'Work submitted', accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn', pending: 'Pending' } as Record<string, string>)[value] || value;
}

/** App Router page parameters are encoded by this Next version; route-handler parameters are decoded. */
export function decodePageName(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
