// Pure binding checks for the read-only coordinator. RPC finality is checked by its caller.
export function nextAction(source, destination, destinationTimestamp) {
  const s = Number(destination.status);
  if (![0,1,2,3,4].includes(s)) throw Error('Unknown destination state');
  if (!source) {
    if (s===0) return 'reserve';
    if (s===1) {
      if(destinationTimestamp!==undefined && BigInt(destinationTimestamp)>BigInt(destination.quote.claimDeadline))return 'cancel_expired';
      if(destinationTimestamp!==undefined && BigInt(destinationTimestamp)>=BigInt(destination.quote.depositDeadline))return 'deposit_window_closed_reconcile_inflight';
      return 'deposit';
    }
    if (s===4) return 'cancelled_without_observed_deposit';
    throw Error('Destination payout enabled without a finalized source deposit');
  }
  if(s===0)throw Error('Source deposit has no destination reservation');
  const q=destination.quote;
  const matches = source.recipient.toLowerCase()===q.recipient.toLowerCase() &&
    ['snapshotAmount','depositDeadline','claimDeadline'].every(k=>BigInt(source[k])===BigInt(q[k])) &&
    BigInt(source.amount)===BigInt(q.depositAmount) && BigInt(source.grant)===BigInt(destination.grant);
  if(!matches)throw Error('Cross-chain claim terms do not match');
  if(source.status===2 && s===3)return 'complete';
  if(source.status===3 && s===4)return 'refunded';
  if(source.status!==1)throw Error('Conflicting terminal states; stop and investigate');
  if((s===1||s===2)&&destinationTimestamp!==undefined&&BigInt(destinationTimestamp)>BigInt(q.claimDeadline))return 'cancel_expired';
  return ({1:'confirm_deposit',2:'claim',3:'release_to_collection',4:'refund_to_owner'})[s];
}
