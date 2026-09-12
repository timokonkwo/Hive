import { isId, record, text, date, price, safeLink } from '../task/model';
export const filters = ['all', 'attention', 'open', 'working', 'review', 'completed'] as const;
export type Filter = typeof filters[number];
export type Row = { id: string; title: string; category: string; status: string; budget: string; agent: string; created: string | null; pending: number; reviewed: boolean; direct: boolean };
export function readDashboard(value: unknown) {
  const data = record(value);
  if (typeof data.accountId !== 'string' || !data.accountId || !Array.isArray(data.postedTasks)) throw Error('Your task list could not be read.');
  const rows: Row[] = data.postedTasks.map(v => { const t = record(v); if (!isId(t.id)) throw Error('A task record could not be read.'); return {
    id: t.id, title: text(t.title) || 'Untitled task', category: text(t.category), status: text(t.status), budget: price(t.budget), agent: text(t.assignedAgentName) || (!isId(t.assignedAgent) ? text(t.assignedAgent) : ''), created: date(t.createdAt), pending: Number.isSafeInteger(t.pendingProposals) && Number(t.pendingProposals) >= 0 ? Number(t.pendingProposals) : 0, reviewed: t.hasReview === true, direct: t.assignmentMode === 'direct' && isId(t.requestedAgentId),
  }; });
  return { accountId: data.accountId, rows };
}
export function action(row: Row): { label: string; tab: string; rank: number } | null {
  if (row.status === 'In Review') return { label: 'Review work', tab: 'work', rank: 0 };
  if (row.status === 'Open' && row.direct) return { label: 'Assign agent', tab: 'brief', rank: 1 };
  if (row.status === 'Open' && row.pending) return { label: 'Review proposals', tab: 'proposals', rank: 2 };
  if (row.status === 'Completed' && !row.reviewed && row.agent) return { label: 'Review agent', tab: 'work', rank: 3 };
  return null;
}
export function readQuery(params: URLSearchParams) { return { view: params.get('view') === 'account' ? 'account' : 'tasks', filter: filters.includes(params.get('status') as Filter) ? params.get('status') as Filter : 'all' as Filter, q: (params.get('q') || '').slice(0, 120), sort: params.get('sort') === 'oldest' ? 'oldest' : 'newest', page: Math.max(1, Math.min(100000, /^\d+$/.test(params.get('page') || '') ? Number(params.get('page')) : 1)) }; }
export function selectRows(rows: Row[], filter: Filter, q: string, sort: string) {
  const status = { open: 'Open', working: 'In Progress', review: 'In Review', completed: 'Completed' }[filter as 'open'];
  return rows.filter(r => (filter === 'all' || filter === 'attention' ? filter === 'all' || !!action(r) : r.status === status) && `${r.title} ${r.agent} ${r.category}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a,b) => ((Date.parse(a.created || '') || 0) - (Date.parse(b.created || '') || 0)) * (sort === 'oldest' ? 1 : -1) || a.id.localeCompare(b.id));
}
export const profileFields = ['name','bio','company','twitter','website'] as const;
export type Profile = Record<typeof profileFields[number], string> & { wallet: string; verified: boolean };
export function readProfile(value: unknown): Profile { const d = record(value); if (!('profile' in d)) throw Error('Your profile could not be read.'); const p = record(d.profile); return { name: text(p.name), bio: text(p.bio), company: text(p.company), twitter: text(p.twitter), website: text(p.website), wallet: text(p.solanaAddress), verified: !!date(p.solanaAddressVerifiedAt) }; }
export function profileErrors(p: Profile) { const errors: Partial<Record<keyof Profile,string>> = {}; for (const k of profileFields) if (p[k].length > ({name:100,bio:500,company:100,twitter:50,website:200}[k])) errors[k] = 'Shorten this field.'; if (p.website.trim() && !safeLink(p.website.trim())) errors.website = 'Use a full http or https address.'; return errors; }
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
export const walletAddress = (v: unknown): v is string => typeof v === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
export function readSession(value: unknown) { const d=record(value); if (!('budget' in d) || !Array.isArray(d.history)) throw Error('Your funds could not be read.'); const b=record(d.budget), c=record(d.deposit); return { balance: d.budget === null ? 0 : amount(b.depositBalance), status: text(b.status), deposit: c.chain === 'solana' && c.token === 'USDC' && walletAddress(c.treasury) && c.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ? { treasury: c.treasury, mint: c.mint } : null, history: d.history.map(v => { const h=record(v); return { id:text(h.id), type:text(h.type), amount:amount(h.amount), status:text(h.status), date:date(h.timestamp), signature:text(h.settlementTxSignature) }; }) }; }
export function readPoints(value: unknown) { const d=record(value), c=record(d.conversion); if (amount(d.currentPointsBalance) === null) throw Error('Your points could not be read.'); return { balance: d.currentPointsBalance as number, rate: c.chain === 'solana' && c.token === 'HIVE' && Number(c.rate) > 0 ? amount(c.rate) : null, minimum: Number(c.minimum) > 0 ? amount(c.minimum) : null, history: Array.isArray(d.history) ? d.history.map(v=>{const h=record(v);return{action:text(h.action),points: typeof h.points === 'number' && Number.isFinite(h.points) ? h.points : null,date:date(h.timestamp)};}).slice(-30).reverse() : [] }; }
export function depositAmount(value: string) { return /^\d+(\.\d{1,6})?$/.test(value) && Number(value) > 0 && Number(value) <= 100000 ? Number(value) : null; }
