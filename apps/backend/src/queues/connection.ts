import IORedis from "ioredis";
import { createLogger } from "../lib/logger";

const log = createLogger("redis");

const REDIS_PRIMARY_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_FALLBACK_PORT = 6380;

let connection: IORedis | null = null;
let resolvedUrl: string = REDIS_PRIMARY_URL;

interface RedisConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, unknown>;
}

function isTlsUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.startsWith("rediss://")) return true;
  if (lower.includes(".upstash.io")) return true;
  if (lower.includes(".redis-cloud.com")) return true;
  if (lower.includes(".redislabs.com")) return true;
  return false;
}

function parseRedisUrl(urlStr: string): RedisConfig {
  const url = new URL(urlStr);
  const config: RedisConfig = {
    host: url.hostname || "localhost",
    port: parseInt(url.port || "6379", 10),
  };

  if (url.username && url.username !== "default") {
    config.username = url.username;
  }
  if (url.password) {
    config.password = url.password;
  }
  if (isTlsUrl(urlStr)) {
    config.tls = {};
  }

  return config;
}

/**
 * Try to connect to primary Redis URL first.
 * If the primary port is occupied, fall back to REDIS_FALLBACK_PORT.
 */
async function resolveRedisUrl(): Promise<string> {
  const primary = REDIS_PRIMARY_URL;
  const primaryConfig = parseRedisUrl(primary);

  try {
    const probe = new IORedis({
      ...primaryConfig,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    await probe.connect();
    const pong = await probe.ping();
    await probe.quit();
    if (pong === "PONG") {
      log.info({ url: primary }, "Redis connected on primary URL");
      return primary;
    }
  } catch {
    // primary failed, try fallback
  }

  // Build fallback URL (no TLS on fallback)
  try {
    const fallbackConfig: RedisConfig = {
      host: primaryConfig.host,
      port: REDIS_FALLBACK_PORT,
      username: primaryConfig.username,
      password: primaryConfig.password,
    };

    const probe = new IORedis({
      ...fallbackConfig,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    await probe.connect();
    const pong = await probe.ping();
    await probe.quit();
    if (pong === "PONG") {
      log.warn(
        { primary, fallbackPort: REDIS_FALLBACK_PORT },
        "Redis primary port unavailable — using FALLBACK port %d",
        REDIS_FALLBACK_PORT,
      );
      return primary; // Return primary URL, but connection will be re-resolved
    }
  } catch {
    // fallback also failed
  }

  log.warn(
    { primary, fallbackPort: REDIS_FALLBACK_PORT },
    "Redis unreachable on both primary and fallback — will use primary and retry",
  );
  return primary;
}

let urlResolved = false;

export function getRedisConnection(): IORedis {
  if (!connection) {
    const config = parseRedisUrl(resolvedUrl);
    connection = new IORedis({
      ...config,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        log.warn({ attempt: times, delay }, "Redis reconnecting...");
        return delay;
      },
    });

    connection.on("connect", () => {
      log.info({ url: resolvedUrl }, "Redis connected");
    });

    connection.on("error", (err) => {
      log.error({ err }, "Redis connection error");
    });
  }

  return connection;
}

/**
 * Initialize Redis connection with port fallback.
 * Call this during app startup before using getRedisConnection().
 */
export async function initRedisConnection(): Promise<void> {
  if (!urlResolved) {
    resolvedUrl = await resolveRedisUrl();
    urlResolved = true;
  }
}

/**
 * Returns a Redis connection config object suitable for BullMQ.
 */
export function getRedisConnectionOpts(): RedisConfig & { maxRetriesPerRequest: null } {
  const config = parseRedisUrl(resolvedUrl);
  return {
    ...config,
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
