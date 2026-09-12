export const DAY = 86400000;
export const labels = { open: 'Open', 'in progress': 'In progress', 'in review': 'In review', completed: 'Completed', cancelled: 'Cancelled', disputed: 'Disputed', other: 'Other' };
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const count = (v: unknown) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw Error('Invalid count'); return v; };
const date = (v: unknown) => { if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) throw Error('Invalid timestamp'); return new Date(v).toISOString(); };
export const readDays = (s: string | null) => s === '7' ? 7 : s === '90' ? 90 : 30;
export function readReport(value: unknown, days: number) {
  const d = record(value), w = record(d.window), totals = record(d.totals), s = record(d.statuses), p = record(d.payments), u = record(d.undated);
  if (w.days !== days || w.timezone !== 'UTC' || !Array.isArray(d.daily) || d.daily.length !== days) throw Error('Invalid reporting period');
  const start = date(w.start), end = date(w.end), asOf = date(d.asOf);
  if (!start.endsWith('T00:00:00.000Z') || asOf !== end || Date.parse(end) < Date.parse(start) + (days - 1) * DAY || Date.parse(end) >= Date.parse(start) + days * DAY) throw Error('Invalid reporting dates');
  const daily = d.daily.map((v, i) => { const r = record(v), expected = new Date(Date.parse(start) + i * DAY).toISOString().slice(0, 10); if (r.date !== expected) throw Error('Invalid chart date'); return { date: expected, posted: count(r.posted), completed: count(r.completed) }; });
  const statuses = Object.fromEntries(Object.keys(labels).map(k => [k, count(s[k])])) as Record<keyof typeof labels, number>;
  const total = { tasks: count(totals.tasks), agents: count(totals.agents), proposals: count(totals.proposals) };
  if (Object.values(statuses).reduce((a, b) => a + b, 0) !== total.tasks || daily.reduce((a, r) => a + r.posted, 0) > total.tasks || daily.reduce((a, r) => a + r.completed, 0) > statuses.completed) throw Error('Inconsistent totals');
  const payments = { amount: p.amount === null ? null : typeof p.amount === 'string' && /^\d+(\.\d+)?([Ee][+-]?\d+)?$/.test(p.amount) && Number.isFinite(Number(p.amount)) ? Number(p.amount) : NaN, count: count(p.count) };
  const undated = { posted: count(u.posted), completed: count(u.completed) };
  if (p.currency !== 'USDC' || p.chain !== 'solana' || Number.isNaN(payments.amount) || payments.count > statuses.completed || (payments.amount === null) !== (payments.count === 0) || undated.posted > total.tasks || undated.completed > statuses.completed || undated.posted + daily.reduce((a, r) => a + r.posted, 0) > total.tasks || undated.completed + daily.reduce((a, r) => a + r.completed, 0) > statuses.completed) throw Error('Invalid payment coverage');
  return { start, end, asOf, days, daily, statuses, totals: total, payments, undated };
}
export type Report = ReturnType<typeof readReport>;
export type Person = { wallet: string; name: string; shareBps: number | null };
type Part<T> = { data: T; asOf: string; stale: boolean };
export function readFees(value: unknown) {
  const d = record(value);
  if (d.token !== '6JfonM6a24xngXh5yJ1imZzbMhpfvEsiafkb4syHBAGS' || d.chain !== 'solana') throw Error('Wrong fee token');
  function part<T>(v: unknown, parse: (v: unknown) => T): Part<T> | null { if (v === null) return null; const p = record(v); if (typeof p.stale !== 'boolean') throw Error('Invalid freshness'); return { data: parse(p.data), asOf: date(p.asOf), stale: p.stale }; }
  function people(v: unknown): Person[] { if (!Array.isArray(v)) throw Error('Invalid people'); return v.map(v => { const p = record(v); if (typeof p.wallet !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.wallet) || typeof p.name !== 'string' || p.shareBps !== null && (typeof p.shareBps !== 'number' || !Number.isFinite(p.shareBps) || p.shareBps < 0 || p.shareBps > 10000)) throw Error('Invalid recipient'); return { wallet: p.wallet, name: p.name, shareBps: p.shareBps as number | null }; }); }
  return { token: d.token, fees: part(d.fees, v => { if (typeof v !== 'string' || !/^\d{1,40}$/.test(v)) throw Error('Invalid fees'); return v; }), usd: part(d.usd, v => { if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw Error('Invalid price'); return v; }), recipients: part(d.recipients, people), creators: part(d.creators, people) };
}
export function sol(lamports: string) { const n = BigInt(lamports); return (n / 1000000000n).toLocaleString('en') + '.' + (n % 1000000000n).toString().padStart(9, '0').replace(/0+$/, '').padEnd(1, '0'); }
export const number = (v: number) => v.toLocaleString('en', { maximumFractionDigits: 6 });
export const amount = (v: number | null) => v === null ? 'Not recorded' : v > 0 && v < .000001 ? '<0.000001 USDC' : number(v) + ' USDC';
export const dayLabel = (s: string) => new Date(s).toLocaleDateString('en', { timeZone: 'UTC', month: 'short', day: 'numeric' });
export const stamp = (s: string) => new Date(s).toLocaleString('en', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' UTC';
export const csv = (r: Report) => 'Date (UTC),Tasks posted,Tasks completed\n' + r.daily.map(d => `${d.date},${d.posted},${d.completed}`).join('\n') + '\n';
