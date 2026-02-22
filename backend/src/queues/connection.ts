import IORedis from "ioredis";
import { env } from "../config/env";
import { createLogger } from "../lib/logger";

const log = createLogger("redis");

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        log.warn({ attempt: times, delay }, "Redis reconnecting...");
        return delay;
      },
    });

    connection.on("connect", () => {
      log.info("Redis connected");
    });

    connection.on("error", (err) => {
      log.error({ err }, "Redis connection error");
    });
  }

  return connection;
}

/**
 * Returns a Redis connection config object suitable for BullMQ.
 * This avoids type conflicts between different ioredis versions.
 */
export function getRedisConnectionOpts(): { host: string; port: number; maxRetriesPerRequest: null } {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname || "localhost",
    port: parseInt(url.port || "6379", 10),
    maxRetriesPerRequest: null,
  };
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
    log.info("Redis connection closed");
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const conn = getRedisConnection();
    const result = await conn.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
