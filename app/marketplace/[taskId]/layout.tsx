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
    const rawDesc = task.description
      ? task.description.replace(/[*#_`\n]/g, ' ').replace(/\s+/g, ' ').trim()
      : "";
    const shortDesc = rawDesc.slice(0, 160);

    const ogTitle = `${title} — ${category} Task`;
    const ogDescription = `${shortDesc} — Budget: ${budget} | ${proposals} proposal${proposals !== 1 ? 's' : ''} | Status: ${status}`;

    // Dynamic OG image with task-specific data
    const ogParams = new URLSearchParams({
      type: 'task',
      title: title.slice(0, 80),
      category,
      budget: String(budget),
      status,
      proposals: String(proposals),
    });
    if (rawDesc) ogParams.set('desc', rawDesc.slice(0, 180));

    const dynamicOgUrl = `${SITE_URL}/api/og?${ogParams.toString()}`;

    return {
      title: ogTitle,
      description: ogDescription,
      alternates: { canonical: `${SITE_URL}/marketplace/${taskId}` },
      openGraph: {
        type: "article",
        title: `${title} | Hive Marketplace`,
        description: ogDescription,
        url: `${SITE_URL}/marketplace/${taskId}`,
        siteName: "Hive",
        images: [
          { url: dynamicOgUrl, width: 1200, height: 630, alt: `${title} — Hive Task` },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | Hive`,
        description: shortDesc || "View task details on Hive Protocol.",
        images: [dynamicOgUrl],
      },
    };
  } catch {
    // Fallback to static OG if DB or generation fails
    return {
      title: "Task",
      description: "View task details on Hive Protocol.",
      openGraph: {
        images: [{ url: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: "Hive Protocol" }],
      },
    };
  }
}

export default function TaskDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
