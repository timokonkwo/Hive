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
} as const;
