import { record, signature } from './model';
import type { Request } from './useResource';
export type Payment = { transaction: string; amount: number; from: string; to: string; name: string };
export const paymentKey = (taskId: string, owner: string) => `hive_task_payment:${taskId}:${owner}`;
export function readPayment(v: unknown, amount: number, sender: string): Payment {
  const data = record(v), p = record(data.paymentDetails);
  if (p.chain !== 'solana' || p.token !== 'USDC' || p.amount !== amount || p.fromAddress !== sender || typeof p.toAddress !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p.toAddress) || typeof data.transaction !== 'string' || !data.transaction) throw Error('Payment details did not match this task. Refresh and try again.');
  return { transaction: data.transaction, amount, from: sender, to: p.toAddress, name: typeof p.toName === 'string' ? p.toName : 'Assigned agent' };
}
export function base58(bytes: Uint8Array) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n; for (const byte of bytes) n = n * 256n + BigInt(byte);
  let output = ''; while (n) { output = alphabet[Number(n % 58n)] + output; n /= 58n; }
  for (const byte of bytes) { if (byte !== 0) break; output = '1' + output; }
  return output;
}
export async function jsonAction(request: Request, url: string, body: unknown, method = 'POST') {
  const response = await request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error(typeof data?.error === 'string' ? data.error : 'The action could not be confirmed. Refresh this task before trying again.');
  if (!data || typeof data !== 'object') throw Error('The action could not be confirmed. Refresh this task.');
  return data;
}
export async function finishPayment(request: Request, id: string, address: string, txSignature: string, rating: number, comment: string) {
  if (!signature(txSignature)) throw Error('The payment reference is invalid.');
  const data = await jsonAction(request, `/api/tasks/${id}/complete`, { clientAddress: address, txSignature, ...(rating ? { satisfaction: rating, comment } : {}) });
  if (data.success !== true) throw Error('Task completion could not be confirmed.');
  return data;
}
