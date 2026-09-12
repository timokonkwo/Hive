/** Canonical IDs win over historical assignment fields. Names are not ownership proof. */
export function agentWorkQuery(agent: { id: string; walletAddress?: string | null; solanaAddress?: string | null; walletAddressVerifiedAt?: unknown; solanaAddressVerifiedAt?: unknown }) {
  const addresses = [agent.id, agent.solanaAddressVerifiedAt ? agent.solanaAddress : null].filter((v): v is string => !!v);
  const legacy: Record<string, unknown>[] = [{ assignedAgent: { $in: addresses } }];
  if (agent.walletAddress && agent.walletAddressVerifiedAt) {
    if (/^0x[a-f0-9]{40}$/i.test(agent.walletAddress)) legacy.push({ assignedAgent: { $regex: new RegExp(`^${agent.walletAddress}$`, 'i') } });
    else legacy.push({ assignedAgent: agent.walletAddress });
  }
  return { $or: [{ assignedAgentId: agent.id }, { $and: [{ assignedAgentId: { $in: [null, ''] } }, { $or: legacy }] }] };
}
export const workStates = ['In Progress', 'In Review', 'Completed', 'Cancelled', 'Disputed'] as const;
export function workQuery(params: URLSearchParams) {
  const raw = params.get('page') || '1';
  return { page: /^\d+$/.test(raw) ? Math.max(1, Math.min(10000, Number(raw))) : 1, q: (params.get('q') || '').trim().slice(0,120), status: workStates.includes(params.get('status') as typeof workStates[number]) ? params.get('status')! : '' };
}
export function paymentRecord(task: Record<string, unknown> & { _id: { toString(): string } }) {
  const sig = typeof task.paymentTxSignature === 'string' ? task.paymentTxSignature : '';
  const solana = (!task.paymentChain || task.paymentChain === 'solana') && /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(sig);
  const hasPaidAmount = typeof task.paidAmount === 'number' && Number.isFinite(task.paidAmount) && task.paidAmount >= 0 && task.paymentChain === 'solana' && task.paymentToken === 'USDC';
  const amount = hasPaidAmount ? `${task.paidAmount} USDC` : task.budget ?? task.bountyAmount ?? null;
  return { taskId: task._id.toString(), title: task.title || 'Untitled task', amount, amountType: hasPaidAmount ? 'paid' : 'budget', txSignature: sig || null, solscanUrl: solana ? `https://solscan.io/tx/${sig}` : null, paymentStatus: sig ? 'recorded' : 'unconfirmed', chain: task.paymentChain || (solana ? 'solana' : null), clientAddress: task.clientAddress || null, completedAt: task.completedAt || task.updatedAt || null };
}
