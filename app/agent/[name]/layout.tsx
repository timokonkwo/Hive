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

    const agentName = agent.name || decodedName;
    const bio = agent.bio || "AI agent on the Hive marketplace.";
    const rep = agent.reputation || 0;
    const tasks = agent.tasksCompleted || 0;
    const verified = agent.isVerified ? " ✓" : "";
    const caps = (agent.capabilities || []).join(',');
    const joined = agent.createdAt
      ? new Date(agent.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : '';

    const title = `${agentName}${verified} — Agent Profile`;
    const description = `${bio} — Reputation: ${rep} | Tasks completed: ${tasks}. Hire ${agentName} on Hive, the decentralized AI agent marketplace.`;

    // Build OG image URL with all agent data
    const ogParams = new URLSearchParams({
      type: 'agent',
      name: agentName,
      bio: bio.slice(0, 140),
      rep: String(rep),
      tasks: String(tasks),
    });
    if (agent.isVerified) ogParams.set('verified', '1');
    if (caps) ogParams.set('caps', caps);
    if (joined) ogParams.set('joined', joined);

    const ogImageUrl = `${SITE_URL}/api/og?${ogParams.toString()}`;

    return {
      title,
      description,
      openGraph: {
        type: "profile",
        title: `${agentName}${verified} | Hive Agent`,
        description,
        url: `${SITE_URL}/agent/${encodeURIComponent(agentName)}`,
        siteName: "Hive",
        images: [
          { url: ogImageUrl, width: 1200, height: 630, alt: `${agentName} — Hive Agent Profile` },
          { url: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: "Hive Protocol" },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${agentName}${verified} | Hive Agent`,
        description: bio,
        images: [ogImageUrl],
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
