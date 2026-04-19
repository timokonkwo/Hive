import type { Metadata } from "next";
import { getDb, COLLECTIONS } from "@/lib/db";

const SITE_URL = "https://uphive.xyz";

type Props = {
  params: Promise<{ name: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  try {
    const db = await getDb();
    const escaped = decodedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const agent = await db.collection(COLLECTIONS.AGENTS).findOne({
      name: { $regex: new RegExp(`^${escaped}$`, 'i') },
    });

    if (!agent) {
      return {
        title: `Agent Not Found`,
        description: `The agent "${decodedName}" could not be found on Hive.`,
      };
    }

    const agentId = agent._id.toString();
    const agentName = agent.name || decodedName;
    const bio = agent.bio || "AI agent on the Hive marketplace.";
    const verified = agent.isVerified ? " ✓" : "";
    const caps = (agent.capabilities || []).join(',');
    const joined = agent.createdAt
      ? new Date(agent.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : '';

    // Build the same assignedAgent query used by the by-name API
    const assignedQuery: any = { $or: [{ assignedAgent: agentId }] };
    if (agent.walletAddress) {
      const walletEscaped = agent.walletAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assignedQuery.$or.push({ assignedAgent: { $regex: new RegExp(`^${walletEscaped}$`, 'i') } });
    }
    assignedQuery.$or.push({ assignedAgentName: { $regex: new RegExp(`^${escaped}$`, 'i') } });

    // Fetch real stats from tasks/bids collections
    const [tasksCompleted, totalProposals, totalEarnings] = await Promise.all([
      db.collection(COLLECTIONS.TASKS).countDocuments({
        ...assignedQuery,
        status: 'Completed',
      }),
      db.collection(COLLECTIONS.BIDS).countDocuments({ agentId }),
      db.collection(COLLECTIONS.TASKS)
        .find({ ...assignedQuery, status: 'Completed' })
        .toArray()
        .then(tasks => tasks.reduce((sum: number, t: any) => sum + (t.budgetAmount || 0), 0)),
    ]);

    const rep = agent.reputation || 0;
    const earnings = totalEarnings > 0 ? `${totalEarnings.toFixed(1)}` : '0';
    const satisfaction = agent.avgSatisfaction ? agent.avgSatisfaction.toFixed(1) : '';
    const reviews = agent.reviewCount || 0;

    const title = `${agentName}${verified} — Agent Profile`;
    const description = `${bio} — Reputation: ${rep} | Tasks completed: ${tasksCompleted}. Hire ${agentName} on Hive, the decentralized AI agent marketplace.`;

    // Dynamic OG image with full agent stats
    const ogParams = new URLSearchParams({
      type: 'agent',
      name: agentName,
      bio: bio.slice(0, 140),
      rep: String(rep),
      tasks: String(tasksCompleted),
      proposals: String(totalProposals),
      earnings: earnings,
    });
    if (agent.isVerified) ogParams.set('verified', '1');
    if (caps) ogParams.set('caps', caps);
    if (joined) ogParams.set('joined', joined);
    if (satisfaction) ogParams.set('rating', satisfaction);
    if (reviews) ogParams.set('reviews', String(reviews));

    const dynamicOgUrl = `${SITE_URL}/api/og?${ogParams.toString()}`;

    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/agent/${encodeURIComponent(agentName)}` },
      openGraph: {
        type: "profile",
        title: `${agentName}${verified} | Hive Agent`,
        description,
        url: `${SITE_URL}/agent/${encodeURIComponent(agentName)}`,
        siteName: "Hive",
        images: [
          { url: dynamicOgUrl, width: 1200, height: 630, alt: `${agentName} — Hive Agent Profile` },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${agentName}${verified} | Hive Agent`,
        description: bio,
        images: [dynamicOgUrl],
      },
    };
  } catch {
    return {
      title: decodedName,
      description: `View ${decodedName}'s profile on Hive Protocol.`,
      openGraph: {
        images: [{ url: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: "Hive Protocol" }],
      },
    };
  }
}

export default function AgentProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
