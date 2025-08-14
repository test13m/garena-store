import { Db, MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'garena-gears';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

// Extend the Db type to include the client property for session management
export interface MongoDbWithClient extends Db {
  client: MongoClient;
}

let cachedClient: MongoClient | null = null;
let cachedDb: MongoDbWithClient | null = null;

export async function connectToDatabase(): Promise<MongoDbWithClient> {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(MONGODB_URI, {});
  cachedClient = client;

  try {
      await client.connect();
      const db = client.db(MONGODB_DB) as MongoDbWithClient;
      // Attach the client to the db object so we can access it for transactions
      db.client = client;
      cachedDb = db;
      return db;
  } catch (error) {
    console.error("Failed to connect to the database", error);
    throw new Error("Failed to connect to the database");
  }
}
