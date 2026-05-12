import type { Db } from 'mongodb';
import { COLLECTIONS } from '@/lib/db';

export type PluginListing = {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  authType: 'api_key' | 'oauth' | 'none';
  status: 'approved' | 'pending' | 'disabled';
  verifiedPublisher: boolean;
  installCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export const DEFAULT_PLUGINS: PluginListing[] = [
  {
    id: 'web-research-pack',
    name: 'Web Research Pack',
    description: 'Research workflow template for source collection, synthesis, and citation-ready reporting.',
    category: 'Research',
    capabilities: ['research', 'source-analysis', 'summarization'],
    authType: 'none',
    status: 'approved',
    verifiedPublisher: true,
    installCount: 0,
  },
  {
    id: 'delivery-qa-checklist',
    name: 'Delivery QA Checklist',
    description: 'Reusable acceptance checklist for agents before submitting client deliverables.',
    category: 'Quality',
    capabilities: ['qa', 'rubric-review', 'deliverable-validation'],
    authType: 'none',
    status: 'approved',
    verifiedPublisher: true,
    installCount: 0,
  },
  {
    id: 'token-launch-ops',
    name: 'Token Launch Ops',
    description: 'Operational checklist for Bags-powered Solana token launch tasks and launch proof handoff.',
    category: 'Token Launch',
    capabilities: ['token-launch', 'solana', 'launch-ops'],
    authType: 'api_key',
    status: 'approved',
    verifiedPublisher: true,
    installCount: 0,
  },
];

export function mapPlugin(plugin: any): PluginListing {
  return {
    id: plugin.id || plugin.slug || plugin._id?.toString(),
    name: plugin.name,
    description: plugin.description,
    category: plugin.category || 'General',
    capabilities: Array.isArray(plugin.capabilities) ? plugin.capabilities : [],
    authType: plugin.authType || 'none',
    status: plugin.status || 'approved',
    verifiedPublisher: plugin.verifiedPublisher === true,
    installCount: plugin.installCount || 0,
    createdAt: plugin.createdAt,
    updatedAt: plugin.updatedAt,
  };
}

export async function listApprovedPlugins(db: Db): Promise<PluginListing[]> {
  const plugins = await db.collection(COLLECTIONS.PLUGIN_LISTINGS)
    .find({ status: 'approved' })
    .sort({ verifiedPublisher: -1, installCount: -1, name: 1 })
    .limit(100)
    .toArray();

  return plugins.length > 0 ? plugins.map(mapPlugin) : DEFAULT_PLUGINS;
}

export async function findApprovedPlugin(db: Db, pluginId: string): Promise<PluginListing | null> {
  const plugin = await db.collection(COLLECTIONS.PLUGIN_LISTINGS).findOne({
    $or: [{ id: pluginId }, { slug: pluginId }],
    status: 'approved',
  });
  if (plugin) return mapPlugin(plugin);
  return DEFAULT_PLUGINS.find((entry) => entry.id === pluginId) || null;
}
