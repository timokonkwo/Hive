/** Public dispute fields. Never serialize authentication IDs or whole Mongo documents. */
export const caseStatuses = ['active', 'slashed', 'dismissed', 'failed_quorum', 'execution_failed'] as const;
export const reportCategories = { failed_execution: 'Task failed', malicious_output: 'Harmful output', billing: 'Billing', uptime: 'Service unavailable', policy: 'Policy issue', other: 'Other' };
export function positivePage(value: string | null, fallback = 1, max = 10000) { return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Math.min(max, Math.max(1, Number(value))) : fallback; }
export function evidenceUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 500 || /[\s\u0000-\u001f]/.test(value)) return false;
  try { const u = new URL(value); return !!u.hostname && !u.username && !u.password && ['https:', 'ipfs:', 'ar:'].includes(u.protocol); } catch { return false; }
}
export function dateValue(value: unknown): string | null { if (!(value instanceof Date) && (typeof value !== 'string' || !value)) return null; const n = new Date(value).getTime(); return Number.isFinite(n) ? new Date(n).toISOString() : null; }
function n(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }
function s(value: unknown) { return typeof value === 'string' ? value : ''; }
export function publicCase(d: Record<string, any>) { return {
  id: String(d._id || d.id), providerAddress: s(d.providerAddress), toolId: s(d.toolId), reason: s(d.reason), evidenceUri: s(d.evidenceUri), status: s(d.status),
  stakedAmount: n(d.stakedAmount), votesForSlash: n(d.votesForSlash), votesAgainstSlash: n(d.votesAgainstSlash), voteCount: n(d.voteCount), quorumRequired: n(d.quorumRequired), slashThresholdBps: n(d.slashThresholdBps),
  createdAt: dateValue(d.createdAt), evidenceOpenUntil: dateValue(d.evidenceOpenUntil), votingStartsAt: dateValue(d.votingStartsAt), votingEndsAt: dateValue(d.votingEndsAt || d.deadline), resolvedAt: dateValue(d.resolvedAt),
  resolutionTx: typeof d.resolutionTx === 'string' && /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(d.resolutionTx) ? d.resolutionTx : null,
}; }
export type Case = ReturnType<typeof publicCase>;
export function publicEvidence(d: Record<string, any>) { return { id: String(d._id || d.id), disputeId: s(d.disputeId), uri: s(d.uri), summary: s(d.summary), submittedByRole: ['reporter', 'provider', 'voter'].includes(d.submittedByRole) ? d.submittedByRole as string : 'contributor', createdAt: dateValue(d.createdAt) }; }
export type Evidence = ReturnType<typeof publicEvidence>;
export function privateReport(d: Record<string, any>) { return { id: String(d._id || d.id), providerAddress: s(d.providerAddress), toolId: s(d.toolId), category: s(d.category), reason: s(d.reason), evidenceUri: s(d.evidenceUri), status: s(d.status), triageReason: s(d.triageReason), disputeId: s(d.disputeId), createdAt: dateValue(d.createdAt) }; }
export type Report = ReturnType<typeof privateReport>;
export function casePhase(d: Pick<Case, 'status' | 'votingStartsAt' | 'votingEndsAt' | 'evidenceOpenUntil'>, now = Date.now()) {
  if (d.status !== 'active') return d.status;
  const end = d.votingEndsAt ? Date.parse(d.votingEndsAt) : NaN;
  const start = d.votingStartsAt ? Date.parse(d.votingStartsAt) : NaN;
  if (!Number.isFinite(end) || !Number.isFinite(start) || end <= start) return 'unavailable';
  if (now >= end) return 'awaiting_result';
  if (now < start) return d.evidenceOpenUntil && now < Date.parse(d.evidenceOpenUntil) ? 'evidence' : 'scheduled';
  return 'voting';
}
export function evidenceOpen(d: Pick<Case, 'status' | 'evidenceOpenUntil'>, now = Date.now()) { return d.status === 'active' && !!d.evidenceOpenUntil && now < Date.parse(d.evidenceOpenUntil); }
export function voteWindow(d: Record<string, any>, now = Date.now()) { return casePhase(publicCase(d), now) === 'voting'; }
