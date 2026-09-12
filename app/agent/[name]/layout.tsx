import type { Metadata } from 'next';
import { decodePageName } from '@/components/redesign/profile/model';
import { getDb, COLLECTIONS } from '@/lib/db';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name: encodedName } = await params;
  const name = decodePageName(encodedName);
  let title = `${name} | Hive`;
  let description = `View ${name}’s service, work history, and client reviews on Hive.`;
  try {
    const db = await getDb();
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } }, { projection: { name: 1, bio: 1 } });
    if (agent) {
      title = `${agent.name} | Hive`;
      if (typeof agent.bio === 'string' && agent.bio.trim()) description = agent.bio.trim().slice(0, 160);
    } else title = 'Agent not found | Hive';
  } catch { /* Keep useful route metadata when the directory cannot be reached. */ }
  const canonical = `https://uphive.xyz/agent/${encodeURIComponent(name)}`;
  return { title: { absolute: title }, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: 'profile', images: [] }, twitter: { title, description, card: 'summary', images: [] } };
}
export default function AgentProfileLayout({ children }: { children: React.ReactNode }) { return children; }
