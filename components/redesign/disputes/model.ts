import { publicCase, publicEvidence, privateReport, evidenceUri, reportCategories } from '@/lib/dispute-view';
export { casePhase, evidenceOpen, reportCategories } from '@/lib/dispute-view';
export type { Case, Evidence, Report } from '@/lib/dispute-view';
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{24}$/.test(v);
export const object = (v: unknown): Record<string, any> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {};
export const labels: Record<string, string> = { evidence: 'Evidence open', voting: 'Voting open', scheduled: 'Voting scheduled', awaiting_result: 'Awaiting result', unavailable: 'Dates unavailable', slashed: 'Stake removed', dismissed: 'Dismissed', failed_quorum: 'Minimum vote weight not met', execution_failed: 'Execution failed', submitted: 'Under review', needs_evidence: 'More evidence requested', escalated: 'Case opened', rejected: 'Not accepted', closed: 'Closed' };
export const label = (v: string) => labels[v] || 'Status unavailable';
export const stamp = (v: string | null) => v && Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(v)) + ' UTC' : 'Not recorded';
export const count = (n: number | null) => n === null ? 'Not recorded' : new Intl.NumberFormat('en', { maximumFractionDigits: 9 }).format(n);
export const short = (v: string) => v.length > 16 ? v.slice(0, 6) + '…' + v.slice(-6) : v;
export function readCase(v: unknown) { const d = object(v); if (!isId(d.id) || typeof d.toolId !== 'string' || typeof d.status !== 'string') throw Error('The case could not be read.'); return publicCase(d); }
export function readList<T>(v: unknown, key: string, parse: (v: unknown) => T) { const d = object(v); if (!Array.isArray(d[key]) || !Number.isSafeInteger(d.total) || d.total < 0 || !Number.isSafeInteger(d.page) || d.page < 1 || !Number.isSafeInteger(d.limit) || d.limit < 1) throw Error('The list could not be read.'); return { rows: d[key].map(parse) as T[], total: d.total as number, page: d.page as number, limit: d.limit as number }; }
export const readEvidence = (v: unknown) => { const d = object(v); if (!isId(d.id)) throw Error('Evidence could not be read.'); return publicEvidence(d); };
export const readReport = (v: unknown) => { const d = object(v); if (!isId(d.id)) throw Error('Report could not be read.'); return privateReport(d); };
export const blankReport = { providerAddress: '', toolId: '', category: 'failed_execution', reason: '', evidenceUri: '', sessionLedgerId: '' };
export function reportPayload(d: typeof blankReport) {
  const p = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim()])) as typeof blankReport;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.providerAddress)) throw Error('Enter the provider’s Solana address.');
  if (!/^[a-zA-Z0-9._:-]{1,80}$/.test(p.toolId)) throw Error('Enter a tool name of 1–80 letters, numbers, dots, underscores, colons or hyphens.');
  if (!(p.category in reportCategories)) throw Error('Choose a category.');
  if (p.reason.length < 20 || p.reason.length > 2000) throw Error('Use 20–2,000 characters to describe the problem.');
  if (!evidenceUri(p.evidenceUri)) throw Error('Enter an HTTPS, IPFS or Arweave evidence link without spaces.');
  if (p.sessionLedgerId && !isId(p.sessionLedgerId)) throw Error('Enter a valid usage reference or leave it blank.');
  return p;
}
export function evidencePayload(uri: string, summary: string) { if (!evidenceUri(uri.trim())) throw Error('Enter an HTTPS, IPFS or Arweave evidence link without spaces.'); if (summary.trim().length < 10 || summary.trim().length > 1000) throw Error('Use 10–1,000 characters for the evidence summary.'); return { uri: uri.trim(), summary: summary.trim() }; }
export function newRequestId() { return Array.from(crypto.getRandomValues(new Uint8Array(12)), n => n.toString(16).padStart(2, '0')).join(''); }
export type Receipt = { kind: 'report' | 'evidence' | 'vote'; id: string; caseId?: string; address?: string; choice?: string };
export function readReceipt(v: unknown): Receipt | null { const d = object(v); if (!isId(d.id) || !['report', 'evidence', 'vote'].includes(d.kind)) return null; if (d.kind !== 'report' && !isId(d.caseId)) return null; if (d.kind === 'vote' && (typeof d.address !== 'string' || !['slash', 'dismiss'].includes(d.choice))) return null; return { kind: d.kind, id: d.id, caseId: d.caseId, address: d.address, choice: d.choice }; }
export function voteMessage(id: string, choice: string, address: string) { return ['Hive Solana Wallet Proof', `Action: dao_vote:${id}:${choice}`, `Address: ${address}`, `Nonce: ${newRequestId()}`, `Timestamp: ${Date.now()}`].join('\n'); }
