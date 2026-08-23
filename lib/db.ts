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
  USER_POINTS: "user_points",
  SESSION_BUDGETS: "session_budgets",
  SESSION_LEDGER: "session_ledger",
  STAKES: "stakes",
  STAKE_EVENTS: "stake_events",
  WALLET_PROOFS: "wallet_proofs",
  DISPUTE_REPORTS: "dispute_reports",
  DISPUTE_EVIDENCE: "dispute_evidence",
  DISPUTES: "disputes",
  DISPUTE_VOTES: "dispute_votes",
  BNB_ACTIVATIONS: "bnb_activations",
  BNB_ACCESS_REQUESTS: "bnb_access_requests",
  BNB_TERMIX_COMPARISONS: "bnb_termix_comparisons",
  BNB_ALTANA_SESSIONS: "bnb_altana_sessions",
  BNB_AGENT_CACHE: "bnb_agent_cache",
  BNB_AGENT_CACHE_RUNS: "bnb_agent_cache_runs",
} as const;
