import { assertSessionPonsTerms } from './session-access';
import { withAgentProfileLease } from './profile-lease';
import type { Db } from 'mongodb';
import type { PublicClient } from 'viem';
import { LaunchAuthorizations, LaunchAuthorizationError, launchReview, type LaunchAuthorization } from './authorization';
import { LaunchStore } from './store';
import { readLaunchSnapshot, assertReviewedRelease, type ReviewedRelease } from './snapshot';
import { prepareReviewedLaunch } from './transaction';
import type { LaunchPreview } from './types';

interface PreparationServices {
  release: ReviewedRelease;
  /** Server-owned adapter. It must store the profile avatar, never a caller's URL. */
  persistAvatar: (preview: LaunchPreview) => Promise<string>;
  refreshPreview: () => Promise<LaunchPreview>;
}

/** Internal coordinator: the HTTP boundary must authenticate the owner/admin first. */
export async function prepareAuthorizedLaunch(db: Db, client: PublicClient,
  request: { origin: string; preview: LaunchPreview; challengeId: string; signature: unknown }, services: PreparationServices) {
  const authorization = await new LaunchAuthorizations(db, request.origin).verify(request.challengeId, request.signature, request.preview);
  return prepareVerifiedLaunch(db, client, { ...request.preview, feePolicyVersion: authorization.preview.feePolicyVersion }, authorization, services);
}

/** Internal only: callers must establish admin access or verify wallet proof first. */
export async function prepareVerifiedLaunch(db: Db, client: PublicClient, preview: LaunchPreview,
  authorization: Pick<LaunchAuthorization, '_id' | 'signer' | 'digest' | 'choices'>, services: PreparationServices, mode: 'connected' | 'managed' = 'connected') {
  return withAgentProfileLease(db, preview.agentId, async assertHeld => {
  await assertSessionPonsTerms(db, preview, authorization.signer, mode, authorization.choices.symbol, authorization.choices.purchase);
  if (!services.release.reviewed) throw Error('Pons contract review is not complete.');
  const store = new LaunchStore(db);
  const draft = await store.reserve(preview, authorization.signer, new Date(), {
    id: authorization._id, digest: authorization.digest, choices: authorization.choices, mode,
  });
  if (draft.phase !== 'draft') return draft; // Never construct a second transaction for an exposed intent.
  let intent = await store.lockPreparation(draft);
  try {
    const initial = { ...await services.refreshPreview(), feePolicyVersion: intent.preview.feePolicyVersion };
    if (launchReview(initial, authorization.signer, authorization.choices).digest !== authorization.digest) throw new LaunchAuthorizationError('The agent changed. Review and sign again.');
    let snapshot = await readLaunchSnapshot(client, authorization.signer);
    assertReviewedRelease(snapshot, services.release);
    const code = await client.getCode({ address: authorization.signer, blockNumber: snapshot.blockNumber });
    if (code && code !== '0x') throw new LaunchAuthorizationError('This launch requires a wallet that sends transactions directly. Smart account launches are not supported yet.');
    if (!intent.logoURI) intent = await store.saveLogo(intent, await services.persistAvatar(initial));
    // Uploads can outlive a quote. Always read a new snapshot after storing the avatar.
    snapshot = await readLaunchSnapshot(client, authorization.signer);
    const prepared = await prepareReviewedLaunch(client, initial, {
      signer: authorization.signer, ...authorization.choices, salt: intent.salt, logoURI: intent.logoURI!,
    }, snapshot, services.release);
    const current = { ...await services.refreshPreview(), feePolicyVersion: intent.preview.feePolicyVersion };
    if (launchReview(current, authorization.signer, authorization.choices).digest !== authorization.digest) throw new LaunchAuthorizationError('The agent changed. Review and sign again.');
    await assertHeld();
    return await store.expose(intent, prepared);
  } finally {
    // If exposure committed, this draft-only release is a no-op. Otherwise retries can resume.
    await store.releasePreparation(intent);
  }
  });
}
