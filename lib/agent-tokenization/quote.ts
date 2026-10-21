import { BASE_FEE_BPS, CREATOR_TAX_BPS, PURCHASE_SLIPPAGE_BPS } from './policy';

export interface LaunchEconomics {
  supply: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  curveFeeBps: bigint;
  hookFeeBps: bigint;
  poolFee: number;
  enabled: boolean;
}

export function validateEconomics(config: LaunchEconomics): void {
  if (!config.enabled) throw new Error('Pons has paused this launch configuration.');
  if (config.curveFeeBps !== BigInt(BASE_FEE_BPS) || config.hookFeeBps !== BigInt(BASE_FEE_BPS) || config.poolFee !== 0) {
    throw new Error('Pons trading fees changed. Launches are paused for review.');
  }
  if (config.supply <= 0n || config.phantomQuote <= 0n || config.graduationThreshold <= 0n) {
    throw new Error('The launch configuration could not be verified.');
  }
}

/** Native-ETH opening purchase for an exempt recipient, before any curve trade.
 * Simulated router output must match this estimate before a transaction is exposed.
 * This is not used for ordinary trades (which may include a temporary snipe tax).
 */
export function quoteOpeningBuy(config: LaunchEconomics, budget: bigint, creatorTax = CREATOR_TAX_BPS) {
  validateEconomics(config);
  if (budget < 0n) throw new Error('Purchase amount cannot be negative.');
  const bps = 10_000n;
  if (![200, 300].includes(creatorTax)) throw Error('Unrecognized Pons fee policy.');
  const baseFee = BigInt(BASE_FEE_BPS), creatorFee = BigInt(creatorTax);
  const net = budget - budget * baseFee / bps - budget * creatorFee / bps;
  const reserved = config.supply * config.phantomQuote / (config.phantomQuote + config.graduationThreshold);
  const sellable = config.supply - reserved;
  let tokens = net * config.supply / (config.phantomQuote + net);
  let spent = budget;
  if (tokens > sellable) {
    tokens = sellable;
    const needed = tokens * config.phantomQuote / (config.supply - tokens) + 1n;
    spent = (needed * bps + (bps - baseFee - creatorFee) - 1n) / (bps - baseFee - creatorFee);
    if (spent > budget) spent = budget;
  }
  if (budget > 0n && tokens === 0n) throw new Error('This purchase is too small to receive tokens.');
  // Router minimum is absolute, even where curve minimums use a clamped rate.
  const minimumTokens = tokens * BigInt(10_000 - PURCHASE_SLIPPAGE_BPS) / bps;
  return { tokens, minimumTokens, spent, refund: budget - spent };
}
