import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const DB_NAME = "hive";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

// Cache the connection across hot-reloads in development
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;

  const client = await MongoClient.connect(MONGODB_URI);
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
} as const;
