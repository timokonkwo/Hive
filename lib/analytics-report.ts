export const DAY = 86400000;
export function reportWindow(raw: string | null, now = new Date()) {
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;
  const end = now.toISOString(), today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { days, start: new Date(today - (days - 1) * DAY).toISOString(), end, timezone: 'UTC' };
}
export function taskPipeline(window: ReturnType<typeof reportWindow>) {
  const start = new Date(window.start), end = new Date(window.end);
  const series = (field: string) => [{ $match: { [field]: { $gte: start, $lte: end } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$' + field, timezone: 'UTC' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }];
  return [
    { $project: { state: { $replaceAll: { input: { $toLower: { $convert: { input: '$status', to: 'string', onError: '', onNull: '' } } }, find: '_', replacement: ' ' } }, created: { $convert: { input: '$createdAt', to: 'date', onError: null, onNull: null } }, completed: { $convert: { input: '$completedAt', to: 'date', onError: null, onNull: null } }, paidAmount: 1, paymentChain: 1, paymentToken: 1, paymentTxSignature: 1 } },
    { $facet: {
      statuses: [{ $group: { _id: '$state', count: { $sum: 1 } } }], posted: series('created'), completed: [{ $match: { state: 'completed' } }, ...series('completed')],
      undatedPosted: [{ $match: { $or: [{ created: null }, { created: { $gt: end } }] } }, { $count: 'count' }],
      undatedCompleted: [{ $match: { state: 'completed', $or: [{ completed: null }, { completed: { $gt: end } }] } }, { $count: 'count' }],
      payments: [{ $match: { state: 'completed', paymentChain: 'solana', paymentToken: 'USDC', paymentTxSignature: { $regex: '^[1-9A-HJ-NP-Za-km-z]{87,88}$' }, paidAmount: { $type: 'number', $gte: 0, $lte: 1000000000000 } } }, { $group: { _id: null, amount: { $sum: { $convert: { input: '$paidAmount', to: 'decimal' } } }, count: { $sum: 1 } } }, { $project: { _id: 0, amount: { $toString: '$amount' }, count: 1 } }],
    } },
  ];
}
export const states = ['open', 'in progress', 'in review', 'completed', 'cancelled', 'disputed', 'other'] as const;
type Row = { _id?: string; count?: number; amount?: string };
export function reportFromRows(window: ReturnType<typeof reportWindow>, facets: Record<string, Row[]>, agents: number, proposals: number) {
  const statuses = Object.fromEntries(states.map(s => [s, 0]));
  for (const row of facets.statuses || []) { const s = states.includes(row._id as typeof states[number]) ? row._id! : 'other'; statuses[s] += row.count || 0; }
  const posted = new Map((facets.posted || []).map(r => [r._id, r.count || 0]));
  const completed = new Map((facets.completed || []).map(r => [r._id, r.count || 0]));
  const daily = Array.from({ length: window.days }, (_, i) => { const date = new Date(Date.parse(window.start) + i * DAY).toISOString().slice(0, 10); return { date, posted: posted.get(date) || 0, completed: completed.get(date) || 0 }; });
  const payment = facets.payments?.[0];
  return { window, asOf: window.end, daily, totals: { tasks: Object.values(statuses).reduce((a, b) => a + b, 0), agents, proposals }, statuses, undated: { posted: facets.undatedPosted?.[0]?.count || 0, completed: facets.undatedCompleted?.[0]?.count || 0 }, payments: { amount: payment?.amount ?? null, count: payment?.count || 0, currency: 'USDC', chain: 'solana' } };
}
