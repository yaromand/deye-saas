import Redis from "ioredis";

let redis: Redis | null = null;

/**
 * Shared Redis client stub.
 * Used by BullMQ workers and optional session/cache layers.
 */
export function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  redis = new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    lazyConnect: true,
  });

  redis.on("error", (err) => {
    console.error("[redis] connection error:", err.message);
  });

  return redis;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const client = getRedis();
    if (client.status !== "ready") {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
