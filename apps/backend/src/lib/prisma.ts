import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PG_PRIMARY_URL = process.env.DATABASE_URL || "postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo";
const PG_FALLBACK_PORT = 5433;

function resolveDatabaseUrl(): string {
  const primary = PG_PRIMARY_URL;

  // If it's a SQLite URL (legacy), override to PostgreSQL default
  if (primary.startsWith("file:")) {
    const fallback = "postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo";
    console.warn(
      `[prisma] DATABASE_URL is SQLite ("${primary}") — overriding to PostgreSQL: ${fallback}`,
    );
    return fallback;
  }

  return primary;
}

const databaseUrl = resolveDatabaseUrl();

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "production"
        ? [{ emit: "event", level: "error" }]
        : [
            { emit: "event", level: "warn" },
            { emit: "event", level: "error" },
          ],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Try connecting to primary PostgreSQL, fall back to PG_FALLBACK_PORT if needed.
 * Call during app startup.
 */
export async function initDatabaseConnection(): Promise<void> {
  try {
    await prisma.$connect();
    console.log(`[prisma] PostgreSQL connected: ${databaseUrl.replace(/\/\/.*@/, "//***@")}`);
  } catch (err) {
    // Try fallback port
    try {
      const url = new URL(databaseUrl);
      url.port = String(PG_FALLBACK_PORT);
      const fallbackUrl = url.toString();

      console.warn(
        `[prisma] PostgreSQL primary port failed — trying FALLBACK port ${PG_FALLBACK_PORT}`,
      );

      const fallbackAdapter = new PrismaPg({ connectionString: fallbackUrl });
      const fallbackClient = new PrismaClient({
        adapter: fallbackAdapter,
        log: [{ emit: "event", level: "error" }],
      });
      await fallbackClient.$connect();

      console.warn(
        `[prisma] PostgreSQL FALLBACK port ${PG_FALLBACK_PORT} connected: ${fallbackUrl.replace(/\/\/.*@/, "//***@")}`,
      );

      // Replace the global instance
      globalForPrisma.prisma = fallbackClient;
      return;
    } catch {
      // fallback also failed, rethrow original
    }

    console.error(
      `[prisma] PostgreSQL connection failed on both primary and fallback port ${PG_FALLBACK_PORT}`,
    );
    throw err;
  }
}

// Tipos úteis para uso na aplicação
export type { User, UserRole, UserStatus } from "@prisma/client";
export type { ServiceOrder } from "@prisma/client";
export type { Payment } from "@prisma/client";
export type { ServiceCategory, ServiceListing } from "@prisma/client";
export type {
  Review,
  Notification,
  Message,
  Address,
  Transaction,
} from "@prisma/client";

export default prisma;
