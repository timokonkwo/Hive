import { ObjectId, type Db } from 'mongodb';
import { profilePreview, profileRevision } from './metadata';
import { validateAgentDetails } from './profile-fields';
import { withAgentProfileLease } from './profile-lease';
import { LaunchConflict } from './store';

export class ProfileEditError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/** Admin authorization belongs to the HTTP boundary. Wallet/fee fields are never editable here. */
export async function saveAgentProfile(db: Db, agentId: string, input: Record<string, unknown>,
  persistImage: (image: unknown) => Promise<string>) {
  let fields: { name: string; bio: string };
  try { fields = validateAgentDetails(input.name, input.bio); }
  catch (error) { throw new ProfileEditError(400, (error as Error).message); }
  if (typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision)) throw new ProfileEditError(400, 'Reload the agent details before saving.');
  return withAgentProfileLease(db, agentId, async assertHeld => {
    const agents = db.collection('agents'), id = new ObjectId(agentId);
    const agent = await agents.findOne({ _id: id });
    if (!agent) throw new ProfileEditError(404, 'Agent not found.');
    if (agent.ponsToken || await db.collection('pons_launch_intents').findOne({ agentId, active: true })) {
      throw new LaunchConflict('This agent already has a launch. Resolve it before editing these details.');
    }
    if (profileRevision(agent) !== input.revision) throw new LaunchConflict('Agent details changed. Close and reopen this review before saving.');
    const nameKey = fields.name.toLowerCase();
    const escaped = fields.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (await agents.findOne({ _id: { $ne: id }, name: { $regex: `^${escaped}$`, $options: 'i' } })) {
      throw new ProfileEditError(409, 'Another agent already uses that name.');
    }
    await agents.createIndex({ nameKey: 1 }, { unique: true, partialFilterExpression: { nameKey: { $type: 'string' } }, name: 'unique_agent_name_key' });
    const avatarUrl = input.image === undefined ? agent.avatarUrl : await persistImage(input.image);
    await assertHeld();
    // CAS also protects against older profile endpoints which do not share this lease.
    const result = await agents.findOneAndUpdate({ _id: id, name: agent.name, bio: agent.bio ?? null,
      avatarUrl: agent.avatarUrl ?? null, avatarSeed: agent.avatarSeed ?? null, ponsToken: null },
    { $set: { ...fields, nameKey, ...(avatarUrl ? { avatarUrl } : {}), updatedAt: new Date() } }, { returnDocument: 'after' }).catch(error => {
      if (error?.code === 11000) throw new ProfileEditError(409, 'Another agent already uses that name.');
      throw error;
    });
    if (!result) throw new LaunchConflict('Agent details changed. Close and reopen this review before saving.');
    return profilePreview(agentId, result, 'admin');
  });
}
