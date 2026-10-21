import { ObjectId, type Db } from 'mongodb';
import { withAgentProfileLease } from './profile-lease';
import { agentTokenCatalog } from './catalog';
import { profileRevision } from './metadata';
import { sessionComplete, SessionConflict, type LaunchSession } from './session';
import { tokenKey, type AgentToken, type PlatformId } from './platforms';

interface AgentLaunchRecord {
  _id: string; projectionPending?: boolean; revision: number; session: LaunchSession; tokens: AgentToken[]; updatedAt: Date;
}

/** One document owns all three slots, so multi-target reservations are atomic without a Mongo transaction. */
export class SessionStore {
  private readonly records;
  constructor(private readonly db: Db) { this.records = db.collection<AgentLaunchRecord>('agent_launch_sessions'); }
  async current(agentId: string) { return this.records.findOne({ _id: agentId }); }

  async create(session: LaunchSession) {
    return withAgentProfileLease(this.db, session.agentId, async assertHeld => {
      let existing = await this.current(session.agentId);
      if (existing?.session.id === session.id) {
        if (existing.session.digest !== session.digest || existing.session.role !== session.role) throw new SessionConflict('This request already belongs to another review.');
        return existing.session;
      }
      if (existing && !sessionComplete(existing.session)) throw new SessionConflict('Resume the current launch before starting another.');
      if (existing) for (const target of existing.session.targets) {
        if (target.phase === 'confirmed') await this.publish(session.agentId, target.terms.platform);
      }
      if (existing) existing = await this.current(session.agentId);
      const agent = await this.db.collection('agents').findOne({ _id: new ObjectId(session.agentId) });
      if (!agent || profileRevision(agent) !== session.profileRevision) throw new SessionConflict('Agent details changed. Review the launch again.');
      const tokens = [...(existing?.tokens || [])];
      for (const token of agentTokenCatalog(agent)) {
        if (!tokens.some(t => t.platform === token.platform)) tokens.push(token);
      }
      const selected = new Set(session.targets.map(t => t.terms.platform));
      if (tokens.some(t => selected.has(t.platform))) throw new SessionConflict('A selected platform already has an agent token.');
      if (selected.has('pons') && (agent.ponsToken || await this.db.collection('pons_launch_intents').findOne({ agentId: session.agentId, active: true }))) {
        throw new SessionConflict('Resume the existing Pons launch.');
      }
      if (selected.has('bags') && (agent.tokenMintAddress || agent.isTokenized || ['launching', 'launched'].includes(agent.tokenLaunchStatus))) {
        throw new SessionConflict('This agent already has a Bags launch. Verify its existing token before continuing.');
      }
      await assertHeld();
      const next: AgentLaunchRecord = { _id: session.agentId, revision: (existing?.revision ?? -1) + 1, session, tokens, updatedAt: new Date() };
      if (existing) {
        const result = await this.records.replaceOne({ _id: existing._id, revision: existing.revision }, next);
        if (result.matchedCount !== 1) throw new SessionConflict('Another launch changed this agent. Refresh its status.');
      } else {
        try { await this.records.insertOne(next); } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 11000) throw new SessionConflict('Another launch reserved this agent. Refresh its status.');
          throw error;
        }
      }
      return session;
    });
  }

  /** CAS fences competing workers, tab retries and owner/admin requests. */
  async save(previous: LaunchSession, next: LaunchSession) {
    if (next.id !== previous.id || next.agentId !== previous.agentId || next.digest !== previous.digest || next.revision !== previous.revision + 1) {
      throw new SessionConflict('Invalid session update.');
    }
    const saved = await this.records.findOneAndUpdate({ _id: previous.agentId, 'session.id': previous.id, 'session.revision': previous.revision }, {
      $set: { session: next, updatedAt: new Date(), ...(next.targets.filter(t => t.phase === 'confirmed').length > previous.targets.filter(t => t.phase === 'confirmed').length ? { projectionPending: true } : {}) }, $inc: { revision: 1 },
    }, { returnDocument: 'after' });
    if (!saved) throw new SessionConflict('The launch changed. Refresh its status.');
    return saved.session;
  }

  async revise(previous: LaunchSession, next: LaunchSession) {
    if (!previous.editing || !previous.paused || previous.approval || next.approval || next.id !== previous.id || next.agentId !== previous.agentId || next.revision !== previous.revision + 1) throw new SessionConflict('Invalid launch edit.');
    await this.db.collection('agent_launch_session_history').updateOne({ sessionId: previous.id, revision: previous.revision }, { $setOnInsert: { session: previous, archivedAt: new Date() } }, { upsert: true });
    const saved = await this.records.findOneAndUpdate({ _id: previous.agentId, 'session.id': previous.id, 'session.revision': previous.revision }, {
      $set: { session: next, updatedAt: new Date() }, $inc: { revision: 1 },
    }, { returnDocument: 'after' });
    if (!saved) throw new SessionConflict('The launch changed. Refresh and try again.');
    return saved.session;
  }

  /** Durable unique network/address ownership before the public projection. Retried publication is harmless. */
  async publish(agentId: string, platform: PlatformId) {
    const record = await this.current(agentId);
    const target = record?.session.targets.find(t => t.terms.platform === platform);
    if (!record || target?.phase !== 'confirmed' || !target.token) throw new SessionConflict('The token is not verified.');
    const token = target.token, key = tokenKey(token);
    const catalog = this.db.collection<{ _id: string; agentId: string; platform: PlatformId; token: AgentToken }>('agent_token_catalog');
    await catalog.createIndex({ agentId: 1, platform: 1 }, { unique: true, name: 'one_agent_platform_token' });
    try {
      await catalog.updateOne({ _id: key, agentId, platform }, { $setOnInsert: { token } }, { upsert: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) throw new SessionConflict('This token or platform is already associated. Operator review is required.');
      throw error;
    }
    // Keep completion in the session until both projections succeed. No signing occurs during publication.
    await this.records.updateOne({ _id: agentId, 'session.id': record.session.id,
      'session.targets': { $elemMatch: { 'terms.platform': platform, phase: 'confirmed', 'token.address': token.address } },
      'tokens.platform': { $ne: platform } }, { $push: { tokens: token }, $inc: { revision: 1 } });
    const entries = await catalog.find({ agentId }).toArray();
    const agent = await this.db.collection('agents').findOne({ _id: new ObjectId(agentId) });
    if (!agent) throw new SessionConflict('Agent no longer exists.');
    const merged = agentTokenCatalog(agent);
    for (const entry of entries) {
      const prior = merged.find(t => t.platform === entry.platform);
      if (prior && tokenKey(prior) !== tokenKey(entry.token)) throw new SessionConflict('The public token catalog conflicts with this launch.');
      if (!prior) merged.push(entry.token);
    }
    const published = await this.db.collection('agents').updateOne({ _id: agent._id, agentTokens: agent.agentTokens ?? null }, {
      $set: { agentTokens: merged },
    });
    if (published.matchedCount !== 1) throw new SessionConflict('The public token catalog changed. Retry publication.');
    await this.records.updateOne({ _id: agentId, 'session.id': record.session.id, 'session.revision': record.session.revision }, { $set: { projectionPending: false } });
  }
}
