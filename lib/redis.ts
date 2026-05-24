import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL environment variable is not set");
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
    tls: {},
  });
  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err);
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export async function acquireLock(
  key: string,
  ttlSeconds: number = 10
): Promise<string | null> {
  try {
    const token = `${Date.now()}-${Math.random()}`;
    const result = await redis.set(`lock:${key}`, token, "EX", ttlSeconds, "NX");
    return result === "OK" ? token : null;
  } catch (err) {
    console.error("[Redis] acquireLock failed:", err);
    return "fallback-no-lock";
  }
}

export async function releaseLock(
  key: string,
  token: string
): Promise<boolean> {
  if (token === "fallback-no-lock") return true;
  try {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await redis.eval(script, 1, `lock:${key}`, token);
    return result === 1;
  } catch (err) {
    console.error("[Redis] releaseLock failed:", err);
    return true;
  }
}
