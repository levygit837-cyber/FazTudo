import IORedis from "ioredis";
import { createLogger } from "../lib/logger";

const log = createLogger("redis");

const REDIS_PRIMARY_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_FALLBACK_PORT = 6380;

let connection: IORedis | null = null;
let resolvedUrl: string = REDIS_PRIMARY_URL;

function isTlsUrl(url: string): boolean {
  // Upstash (and other managed Redis providers) require TLS even when
  // the URL starts with redis:// — redis-cli needs --tls flag.
  // We force TLS for known cloud providers to avoid connection issues.
  const lower = url.toLowerCase();
  if (lower.startsWith("rediss://")) return true;
  if (lower.includes(".upstash.io")) return true;
  if (lower.includes(".redis-cloud.com")) return true;
  if (lower.includes(".redislabs.com")) return true;
  return false;
}

function getTlsOptions(url: string): { tls?: Record<string, unknown> } {
  return isTlsUrl(url) ? { tls: {} } : {};
}

/**
 * Try to connect to primary Redis URL first.
 * If the primary port is occupied, fall back to REDIS_FALLBACK_PORT.
 */
async function resolveRedisUrl(): Promise<string> {
  const primary = REDIS_PRIMARY_URL;
  try {
    const probe = new IORedis(primary, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 5000,
      lazyConnect: true,
      ...getTlsOptions(primary),
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

  // Build fallback URL
  try {
    const url = new URL(primary);
    url.port = String(REDIS_FALLBACK_PORT);
    url.protocol = "redis:";
    const fallback = url.toString();

    const probe = new IORedis(fallback, {
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
        { primary, fallback },
        "Redis primary port unavailable — using FALLBACK port %d",
        REDIS_FALLBACK_PORT,
      );
      return fallback;
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
    connection = new IORedis(resolvedUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times: number) {
        const delay = Math.min(times * 200, 5000);
        log.warn({ attempt: times, delay }, "Redis reconnecting...");
        return delay;
      },
      ...getTlsOptions(resolvedUrl),
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
export function getRedisConnectionOpts(): { host: string; port: number; maxRetriesPerRequest: null; tls?: Record<string, unknown> } {
  const url = new URL(resolvedUrl);
  return {
    host: url.hostname || "localhost",
    port: parseInt(url.port || "6379", 10),
    maxRetriesPerRequest: null,
    ...getTlsOptions(resolvedUrl),
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
