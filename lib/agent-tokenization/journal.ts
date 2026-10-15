import { createHash } from 'node:crypto';
import type { prepareReviewedLaunch } from './transaction';

export type PreparedLaunch = Awaited<ReturnType<typeof prepareReviewedLaunch>>;
export interface PreparedEnvelope { version: 1; payload: string; digest: string }

/** BSON cannot store JS bigint directly. Preserve wei values without number coercion. */
export function packPrepared(value: PreparedLaunch): PreparedEnvelope {
  const payload = JSON.stringify(value, (_, item) => typeof item === 'bigint' ? { $uint: item.toString() } : item);
  return { version: 1, payload, digest: createHash('sha256').update(payload).digest('hex') };
}
export function unpackPrepared(envelope: PreparedEnvelope): PreparedLaunch {
  if (envelope.version !== 1 || createHash('sha256').update(envelope.payload).digest('hex') !== envelope.digest) {
    throw Error('The saved launch is damaged. Operator review is required.');
  }
  return JSON.parse(envelope.payload, (_, item) => {
    if (item && typeof item === 'object' && '$uint' in item) {
      if (Object.keys(item).length !== 1 || typeof item.$uint !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(item.$uint)) throw Error('Invalid saved launch amount.');
      const value = BigInt(item.$uint);
      if (value >= 2n ** 256n) throw Error('Saved launch amount exceeds uint256.');
      return value;
    }
    return item;
  }) as PreparedLaunch;
}
