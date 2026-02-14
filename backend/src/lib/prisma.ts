import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Criar adapter libSQL para SQLite
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

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
