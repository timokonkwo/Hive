import type { ClaimSchedule } from '@/lib/hive-claim-schedule';
import styles from './claim.module.css';

export default function ClaimCountdown({ schedule, now, enabled }: { schedule: ClaimSchedule; now: number | null; enabled: boolean | null }) {
  if (!schedule) return <aside className={styles.countdown}><span>Claim schedule unavailable</span></aside>;
  const started = now !== null && now >= schedule.opensAt;
  const closed = now !== null && now >= schedule.closesAt;
  // Campaign time does not depend on operator availability. An outage must not
  // hide the deadline or imply that the on-chain opening is still in the future.
  const remaining = now === null ? null : Math.max(0, Math.ceil(((started ? schedule.closesAt : schedule.opensAt) - now) / 1000));
  const values = remaining === null ? ['--', '--', '--', '--'] : [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60].map(n => String(n).padStart(2, '0'));
  return <aside className={styles.countdown} aria-label="Claim schedule" data-opens-at={new Date(schedule.opensAt).toISOString()} data-closes-at={new Date(schedule.closesAt).toISOString()}>
    <span>{closed ? 'Claims closed' : started ? 'Claims close in' : now === null ? 'Claim window' : 'Claims start in'}</span>
    {!closed && <div className={styles.clock} role="timer" aria-label={started ? 'Time until claims close' : now === null ? 'Claim countdown' : 'Time until claims open'}>{['Days', 'Hours', 'Minutes', 'Seconds'].map((label, i) => <div key={label}><strong>{values[i]}</strong><span>{label}</span></div>)}</div>}
    {started && !closed && enabled === false && <span role="status">Claims temporarily unavailable</span>}
  </aside>;
}
