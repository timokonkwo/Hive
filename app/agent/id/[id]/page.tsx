import { notFound, redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/db';

/** Immutable metadata links survive profile renames. Resolve the current name on every request. */
export const dynamic = 'force-dynamic';
export default async function AgentById({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  const agent = await (await getDb()).collection('agents').findOne({ _id: new ObjectId(id) }, { projection: { name: 1 } });
  if (!agent || typeof agent.name !== 'string' || !agent.name) notFound();
  redirect(`/agent/${encodeURIComponent(agent.name)}`);
}
