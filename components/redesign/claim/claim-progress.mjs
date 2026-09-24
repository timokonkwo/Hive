// Only finalized chain state can produce a successful payout screen.
export function claimProgress(status) {
  if (!status) return { phase: 'preparing', title: 'Preparing your claim' };
  if (status.submission === 'failed') return { phase: 'error', title: 'Deposit failed', detail: 'Your deposit was not completed. Check its status before continuing.' };
  if (['complete', 'release_to_collection'].includes(status.state)) return status.payout?.status === 'finalized' ? { phase: 'success', title: 'HIVE received' } : { phase: 'receiving', title: 'Receiving HIVE' };
  if (status.state === 'refunded') return { phase: 'refunded', title: 'Deposit returned', detail: 'Your HIVE on Solana was returned to your wallet.' };
  if (['cancel_expired', 'refund_to_owner', 'cancelled_without_observed_deposit'].includes(status.state)) return { phase: 'error', pending: status.state !== 'cancelled_without_observed_deposit', title: status.state === 'refund_to_owner' ? 'Returning your deposit' : 'Claim expired', detail: status.state === 'cancelled_without_observed_deposit' ? 'This claim expired without a confirmed deposit.' : 'Your claim could not finish. We are checking the return of your HIVE on Solana.' };
  if (status.state === 'below_minimum') return { phase: 'error', title: 'Insufficient HIVE', detail: 'Your Solana wallet must hold at least 1M HIVE to deposit.' };
  if (status.state === 'deposit' && !status.signature) return { phase: 'deposit', title: status.deposit ? 'Ready to deposit' : 'Preparing your deposit' };
  if (status.state === 'claim' || status.state === 'confirm_deposit' || status.submission === 'finalized') return { phase: 'receiving', title: 'Receiving HIVE' };
  if (status.signature) return { phase: 'depositing', title: 'Confirming your deposit' };
  return { phase: 'preparing', title: 'Preparing your claim' };
}
