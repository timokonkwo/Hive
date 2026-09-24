// Visible bytecode is not proof that the journaled deployment is finalized.
export function distributorReceiptPending(entries) {
  const deployments = entries.filter(entry => entry.action === 'distributor');
  if (deployments.some(entry => entry.status === 'confirmed')) return false;
  if (deployments.some(entry => entry.hash && ['submitted', 'awaiting_wallet', 'unknown'].includes(entry.status))) return true;
  throw Error('Distributor deployment receipt must be reconciled before funding');
}
