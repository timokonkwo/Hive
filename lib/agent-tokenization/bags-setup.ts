import { Connection, VersionedTransaction } from '@solana/web3.js';
import { BagsLaunchApi, prepareBagsConfiguration, type BagsPlanStep } from './bags';
import { validateBagsTransaction, bagsAuthority, type BagsTerms, type BagsSetupKind } from './bags-validation';
import { SessionConflict } from './session';

export interface BagsSetupPlan {
  config:string; authority:string;
  steps:Array<{kind:BagsSetupKind; transaction:string; lifetime?:BagsPlanStep['lifetime']}>;
}
export const bagsSetupStepId = (intentId:string, kind:BagsSetupKind) => `${intentId}:setup:${kind}`;
export const restoreBagsSetupStep = (step:BagsSetupPlan['steps'][number]):BagsPlanStep => ({
  transaction:VersionedTransaction.deserialize(Buffer.from(step.transaction,'base64')), lifetime:step.lifetime,
});
/** Keep the plan in order across requests. Refresh only transactions that have never been submitted. */
export async function refreshBagsSetupPlan(connection:Connection, api:BagsLaunchApi, terms:Omit<BagsTerms,'config'|'authority'>,
  saved?:BagsSetupPlan, confirmed:ReadonlySet<BagsSetupKind> = new Set()) {
  const response = await prepareBagsConfiguration(api,terms.mint,terms.payer);
  if (response.authority !== bagsAuthority(terms.mint).toBase58()) throw new SessionConflict('Bags changed the fee authority.');
  const checked = await Promise.all(response.steps.map(async step=>{
    const {setupKind} = await validateBagsTransaction(connection,step.transaction,{...terms,config:response.config,authority:response.authority},'setup');
    if (!setupKind) throw new SessionConflict('Bags returned an unsupported setup step.');
    return {kind:setupKind,transaction:Buffer.from(step.transaction.serialize()).toString('base64'),lifetime:step.lifetime};
  }));
  if (new Set(checked.map(step=>step.kind)).size !== checked.length) throw new SessionConflict('Bags returned duplicate setup steps.');
  const order:BagsSetupKind[] = ['fee-config','pool-config','manager'];
  if (checked.some((step,index)=>index>0 && order.indexOf(step.kind)<order.indexOf(checked[index-1].kind))) throw new SessionConflict('Bags changed the setup order.');
  if (!saved && order.some(kind=>!checked.some(step=>step.kind===kind))) throw new SessionConflict('The existing Bags setup has no saved launch review.');
  const config = confirmed.has('pool-config') ? saved!.config : response.config;
  const steps = order.map(kind=>{
    const previous = saved?.steps.find(step=>step.kind===kind);
    if (confirmed.has(kind) && previous) return previous;
    const next = checked.find(step=>step.kind===kind);
    if (!next) throw new SessionConflict('Bags could not refresh the remaining setup. Your completed steps are saved; check status and retry.');
    return next;
  });
  return {config,authority:response.authority,steps};
}
