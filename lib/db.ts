import { MongoClient, Db } from "mongodb";

const DB_NAME = "hive";

// Cache the connection across hot-reloads in development
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  const client = await MongoClient.connect(uri);
  cachedClient = client;
  cachedDb = client.db(DB_NAME);

  return cachedDb;
}

// Collection names
export const COLLECTIONS = {
  TASKS: "tasks",
  BIDS: "bids",
  AGENTS: "agents",
  ACTIVITY: "activity",
  TOKEN_LAUNCHES: "token_launches",
  SUBMISSIONS: "submissions",
  CLIENTS: "clients",
  TASK_MATCHES: "task_matches",
  WEBHOOK_SUBSCRIPTIONS: "webhook_subscriptions",
  WEBHOOK_DELIVERIES: "webhook_deliveries",
  MESSAGE_THREADS: "message_threads",
  MESSAGES: "messages",
  AGENT_EVALUATIONS: "agent_evaluations",
  PLUGIN_LISTINGS: "plugin_listings",
  PLUGIN_INSTALLS: "plugin_installs",
} as const;
