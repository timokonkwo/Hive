/** Public opening time approved by the campaign owner. */
export const CLAIM_OPENING_TIME = '2026-09-25T09:00:00Z';
/** Explicit claim opening time. Publishing the checker does not start the claim clock. */
export function claimSchedule(openingTime: string | undefined) {
  if (!openingTime) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(openingTime)) return null;
  const opensAt = Date.parse(openingTime);
  if (!Number.isFinite(opensAt)) return null;
  return { opensAt, closesAt: opensAt + 604_800_000 };
}
export type ClaimSchedule = ReturnType<typeof claimSchedule>;
export function claimCountdown(schedule: ClaimSchedule, now: number) {
  if (!schedule) return null;
  const target = now < schedule.opensAt ? schedule.opensAt : schedule.closesAt;
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
