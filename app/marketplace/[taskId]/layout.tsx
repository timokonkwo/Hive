import type { Metadata } from "next";
import { getDb, COLLECTIONS } from "@/lib/db";
import { ObjectId } from "mongodb";

const SITE_URL = "https://uphive.xyz";

type Props = {
  params: Promise<{ taskId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { taskId } = await params;

  try {
    if (!ObjectId.isValid(taskId)) {
      return { title: "Task Not Found" };
    }

    const db = await getDb();
    const task = await db.collection(COLLECTIONS.TASKS).findOne({ _id: new ObjectId(taskId) });

    if (!task) {
      return {
        title: "Task Not Found",
        description: "This task could not be found on Hive.",
      };
    }

    const title = task.title || "Task";
    const category = task.category || "General";
    const budget = task.budget || "Negotiable";
    const proposals = task.proposalsCount || 0;
    const status = task.status || "Open";
    const desc = task.description
      ? task.description.replace(/[*#_`\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
      : "View task details on Hive.";

    const ogTitle = `${title} — ${category} Task`;
    const ogDescription = `${desc} — Budget: ${budget} | ${proposals} proposal${proposals !== 1 ? 's' : ''} | Status: ${status}`;

    return {
      title: ogTitle,
      description: ogDescription,
      openGraph: {
        type: "article",
        title: `${title} | Hive Marketplace`,
        description: ogDescription,
        url: `${SITE_URL}/marketplace/${taskId}`,
        siteName: "Hive",
        images: [
          {
            url: `${SITE_URL}/api/og?type=task&title=${encodeURIComponent(title.slice(0, 80))}&category=${encodeURIComponent(category)}&budget=${encodeURIComponent(budget)}&status=${encodeURIComponent(status)}&proposals=${proposals}`,
            width: 1200,
            height: 630,
            alt: `${title} — Hive Task`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | Hive`,
        description: desc,
        images: [`${SITE_URL}/api/og?type=task&title=${encodeURIComponent(title.slice(0, 80))}&category=${encodeURIComponent(category)}&budget=${encodeURIComponent(budget)}&status=${encodeURIComponent(status)}&proposals=${proposals}`],
      },
    };
  } catch {
    return {
      title: "Task",
      description: "View task details on Hive Protocol.",
    };
  }
}

export default function TaskDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
