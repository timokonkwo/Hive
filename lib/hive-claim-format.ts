/** Display-only rounding. Never parse a displayed amount for transaction construction. */
export function compactHive(raw: string, decimals: number): string {
  if (!/^(0|[1-9][0-9]*)$/.test(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw Error('Invalid token amount');
  const amount = BigInt(raw), unit = 10n ** BigInt(decimals);
  if (amount === 0n) return '0';
  if (amount * 10n < unit) return '<0.1';
  let divisor = unit, suffix = '';
  if (amount >= unit * 1_000_000n) { divisor *= 1_000_000n; suffix = 'M'; }
  else if (amount >= unit * 1_000n) { divisor *= 1_000n; suffix = 'K'; }
  let tenths = (amount * 10n + divisor / 2n) / divisor;
  // Promote rounded boundaries: 999.96K -> 1M, not 1000K.
  if (tenths >= 10_000n && suffix !== 'M') { divisor *= 1000n; suffix = suffix === 'K' ? 'M' : 'K'; tenths = (amount * 10n + divisor / 2n) / divisor; }
  return `${tenths / 10n}${tenths % 10n ? '.' + tenths % 10n : ''}${suffix}`;
}
export function exactHive(raw: string, decimals: number): string {
  if (!/^(0|[1-9][0-9]*)$/.test(raw) || !Number.isInteger(decimals) || decimals < 1 || decimals > 18) throw Error('Invalid token amount');
  const value = raw.padStart(decimals + 1, '0'), fraction = value.slice(-decimals).replace(/0+$/, '');
  return value.slice(0, -decimals) + (fraction ? '.' + fraction : '');
}
