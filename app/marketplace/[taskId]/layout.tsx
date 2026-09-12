import type { Metadata } from 'next';
import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '@/lib/db';
export async function generateMetadata({ params }: { params: Promise<{ taskId: string }> }): Promise<Metadata> {
  const { taskId } = await params;
  if (!/^[a-f0-9]{24}$/i.test(taskId)) return { title: 'Task not found | Hive' };
  try {
    const db = await getDb();
    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) }, { projection: { title: 1, description: 1 } });
    return { title: task ? `${task.title || 'Task'} | Hive` : 'Task not found | Hive', description: typeof task?.description === 'string' ? task.description.slice(0, 160) : 'View the task brief and proposals on Hive.', alternates: { canonical: `https://uphive.xyz/marketplace/${taskId}` } };
  } catch { return { title: 'Task | Hive' }; }
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
