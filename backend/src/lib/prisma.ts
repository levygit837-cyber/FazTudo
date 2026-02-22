import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || "postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo",
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
