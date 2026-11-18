import mongoose, { type Connection } from "mongoose";

// One shared connection pool; each instance gets its own database (SRS 7.2 "Decided").
const PLATFORM_DB = process.env.PLATFORM_DB_NAME ?? "platform";

type Cache = { conn: Connection | null; promise: Promise<Connection> | null };
const g = globalThis as unknown as { __mongo?: Cache };
const cache: Cache = (g.__mongo ??= { conn: null, promise: null });

async function baseConnection(): Promise<Connection> {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local for local development, or to the Vercel project's environment variables.",
    );
  }
  cache.promise ??= mongoose
    // No automatic collection/index creation: it raced with store deletion and
    // recreated empty databases. Indexes are built explicitly (see ensureIndexes).
    .createConnection(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10_000, autoIndex: false, autoCreate: false })
    .asPromise();
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}

/** Connection to the platform database (tenants, plans, instances, audit log). */
export async function platformDb(): Promise<Connection> {
  return (await baseConnection()).useDb(PLATFORM_DB, { useCache: true });
}

/** Connection to one instance's isolated database, named by instance ID. */
export async function instanceDb(instanceId: string): Promise<Connection> {
  if (!/^[a-f0-9]{24}$/.test(instanceId)) throw new Error("Invalid instance id");
  return (await baseConnection()).useDb(`inst_${instanceId}`, { useCache: true });
}
