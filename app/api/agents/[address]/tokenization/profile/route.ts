import { managedDeployerStatus } from '@/lib/agent-tokenization/managed-signer';
import { NextRequest } from 'next/server';
import { withLaunchAccess, readLaunchBody, launchReply, LaunchHttpError } from '@/lib/agent-tokenization/http';
import { saveAgentProfile, ProfileEditError } from '@/lib/agent-tokenization/profile-edit';
import { persistUploadedAvatar, uploadedImage } from '@/lib/agent-tokenization/avatar';
import { LaunchConflict } from '@/lib/agent-tokenization/store';
import { launchesEnabled } from '@/lib/agent-tokenization/release';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  return withLaunchAccess(req, params, async ({ db, preview }) => {
    if (preview.role !== 'admin') throw new LaunchHttpError(403, 'Only an admin can edit these details here.');
    const body = await readLaunchBody(req, ['name', 'bio', 'image', 'revision'], 3 * 1024 * 1024);
    if (body.image !== undefined) {
      try { uploadedImage(body.image); }
      catch (error) { throw new LaunchHttpError(400, (error as Error).message); }
    }
    try {
      const updated = await saveAgentProfile(db, preview.agentId, body, persistUploadedAvatar);
      return launchReply({ ...updated, signingEnabled: launchesEnabled(), managedDeployer: managedDeployerStatus() });
    } catch (error) {
      if (error instanceof ProfileEditError) throw new LaunchHttpError(error.status, error.message);
      if (error instanceof LaunchConflict) throw error;
      return launchReply({ error: 'Agent changes could not be saved. Try again.' }, 503);
    }
  });
}
