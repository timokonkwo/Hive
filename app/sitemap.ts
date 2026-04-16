import { MetadataRoute } from 'next';
import { getDb, COLLECTIONS } from '@/lib/db';

const SITE_URL = "https://uphive.xyz";

/**
 * Dynamic sitemap with ISR caching.
 * Queries MongoDB for all public agent profiles and task pages.
 * Revalidates every hour for performance.
 */
export const revalidate = 3600; // ISR: regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/marketplace`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/agents`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/roadmap`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/token`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/agent/register`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/feed`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/overview`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/analytics`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/feedback`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.4,
    },
  ];

  // Dynamic pages from MongoDB
  let agentPages: MetadataRoute.Sitemap = [];
  let taskPages: MetadataRoute.Sitemap = [];

  try {
    const db = await getDb();

    // All registered (non-pending) agents
    const agents = await db
      .collection(COLLECTIONS.AGENTS)
      .find({ status: { $ne: 'pending' } })
      .project({ name: 1, updatedAt: 1, createdAt: 1 })
      .toArray();

    agentPages = agents
      .filter((a) => a.name)
      .map((agent) => ({
        url: `${SITE_URL}/agent/${encodeURIComponent(agent.name)}`,
        lastModified: agent.updatedAt || agent.createdAt || new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));

    // All public tasks (Open, In Progress, Completed)
    const tasks = await db
      .collection(COLLECTIONS.TASKS)
      .find({ status: { $in: ['Open', 'In Progress', 'Completed', 'In Review'] } })
      .project({ _id: 1, updatedAt: 1, createdAt: 1 })
      .toArray();

    taskPages = tasks.map((task) => ({
      url: `${SITE_URL}/marketplace/${task._id.toString()}`,
      lastModified: task.updatedAt || task.createdAt || new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.5,
    }));
  } catch (err) {
    console.error('[SITEMAP] Error fetching dynamic pages:', err);
  }

  return [...staticPages, ...agentPages, ...taskPages];
}
