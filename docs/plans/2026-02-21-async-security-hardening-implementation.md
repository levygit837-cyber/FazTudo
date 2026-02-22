# Async Processing, Payment Safety & Security Hardening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate FazTudo from synchronous request processing to async BullMQ queues, add payment idempotency with event store, implement MFA TOTP, secrets management, SLOs, and migrate from SQLite to PostgreSQL.

**Architecture:** Three-process model (API Server, Worker Process, Scheduler Process) communicating via Redis/BullMQ. Payment events stored in append-only PostgreSQL table with state machine validation. TOTP MFA for critical actions. Cloud-portable secrets management.

**Tech Stack:** BullMQ 5.x, IORedis 5.x, PostgreSQL 16, Redis 7, otplib 12.x, qrcode 1.x, opossum 8.x, prom-client 15.x

---

## Phase 1: PostgreSQL Migration

### Task 1: Install PostgreSQL and Redis via Docker Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/.env`
- Modify: `backend/.env.example`

**Step 1: Update docker-compose.yml to add PostgreSQL and Redis services**

Replace the entire `docker-compose.yml` with:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: faztudo
      POSTGRES_USER: faztudo
      POSTGRES_PASSWORD: faztudo_dev_2026
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U faztudo"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --appendonly yes
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./backend/src:/app/src
      - ./backend/prisma:/app/prisma
      - ./backend/tests:/app/tests
      - backend_node_modules:/app/node_modules
    environment:
      - NODE_ENV=development
      - PORT=3001
      - DATABASE_URL=postgresql://faztudo:faztudo_dev_2026@postgres:5432/faztudo
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET:-dev-secret-key-change-in-production-minimum-32-chars}
      - JWT_EXPIRES_IN=7d
      - CORS_ORIGIN=http://localhost:5173,http://localhost:5174
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build: ./frontend
    restart: unless-stopped
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
      - frontend_node_modules:/app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3001
    depends_on:
      - backend

  admin:
    build: ./admin
    restart: unless-stopped
    ports:
      - "5174:5174"
    volumes:
      - ./admin/src:/app/src
      - ./admin/public:/app/public
      - admin_node_modules:/app/node_modules
    environment:
      - VITE_API_URL=http://localhost:3001
    depends_on:
      - backend

volumes:
  pgdata:
  redisdata:
  backend_node_modules:
  frontend_node_modules:
  admin_node_modules:
```

**Step 2: Start PostgreSQL and Redis containers**

Run: `cd /home/levybonito/faztudo-main && docker compose up -d postgres redis`
Expected: Both services healthy

**Step 3: Verify connectivity**

Run: `docker compose exec postgres psql -U faztudo -d faztudo -c "SELECT 1;"`
Expected: Returns 1

Run: `docker compose exec redis redis-cli ping`
Expected: PONG

**Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "infra: add PostgreSQL 16 and Redis 7 to docker-compose"
```

---

### Task 2: Migrate Prisma from SQLite to PostgreSQL

**Files:**
- Modify: `backend/prisma/schema.prisma` (line 1-10: datasource block)
- Modify: `backend/package.json` (remove libsql deps)
- Modify: `backend/src/lib/prisma.ts`
- Modify: `backend/src/config/env.ts` (add REDIS_URL)
- Modify: `backend/.env`

**Step 1: Update schema.prisma datasource**

In `backend/prisma/schema.prisma`, replace the datasource block (first ~15 lines) with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Remove any `previewFeatures = ["driverAdapters"]` line if present.

**Step 2: Update prisma.ts to remove libsql adapter**

Replace `backend/src/lib/prisma.ts` entirely with:

```typescript
import { PrismaClient } from "@prisma/client";
import { createLogger } from "./logger";

const log = createLogger("prisma");

const prisma = new PrismaClient({
  log: [
    { level: "error", emit: "event" },
    { level: "warn", emit: "event" },
  ],
});

prisma.$on("error" as never, (e: any) => {
  log.error({ err: e }, "Prisma error");
});

prisma.$on("warn" as never, (e: any) => {
  log.warn({ msg: e }, "Prisma warning");
});

export default prisma;
```

**Step 3: Remove libsql dependencies**

Run: `cd /home/levybonito/faztudo-main/backend && npm uninstall @libsql/client @prisma/adapter-libsql`

**Step 4: Update .env with PostgreSQL URL**

Add/update in `backend/.env`:
```
DATABASE_URL=postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo
REDIS_URL=redis://localhost:6379
```

**Step 5: Add REDIS_URL to env.ts**

In `backend/src/config/env.ts`, add to the `EnvConfig` interface after `DATABASE_URL`:
```typescript
  REDIS_URL: string;
```

And in the `getEnvConfig()` function, add after the DATABASE_URL line in the config object:
```typescript
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
```

**Step 6: Push schema to PostgreSQL**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`
Expected: Schema synced successfully

**Step 7: Seed database**

Run: `cd /home/levybonito/faztudo-main/backend && npm run db:seed`
Expected: Seed data created

**Step 8: Run existing tests**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: All existing tests pass (some may need DATABASE_URL adjustment for test env)

**Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/lib/prisma.ts backend/src/config/env.ts backend/package.json backend/package-lock.json backend/.env.example
git commit -m "feat: migrate from SQLite to PostgreSQL 16

Remove libsql adapter, update Prisma datasource to postgresql,
add REDIS_URL to env config."
```

---

## Phase 2: BullMQ Infrastructure

### Task 3: Install BullMQ dependencies and create Redis connection

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/queues/connection.ts`
- Create: `backend/src/queues/queues.ts`
- Create: `backend/src/queues/producers.ts`

**Step 1: Install BullMQ and IORedis**

Run: `cd /home/levybonito/faztudo-main/backend && npm install bullmq ioredis`

**Step 2: Create Redis connection module**

Create `backend/src/queues/connection.ts`:

```typescript
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
        log.warn({ attempt: times, delayMs: delay }, "Redis reconnecting...");
        return delay;
      },
    });

    connection.on("connect", () => log.info("Redis connected"));
    connection.on("error", (err) => log.error({ err }, "Redis error"));
    connection.on("close", () => log.warn("Redis connection closed"));
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
    log.info("Redis connection closed gracefully");
  }
}

/**
 * Check if Redis is available. Used for graceful degradation.
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const conn = getRedisConnection();
    const result = await conn.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
```

**Step 3: Create queue instances**

Create `backend/src/queues/queues.ts`:

```typescript
import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";
import { createLogger } from "../lib/logger";

const log = createLogger("queues");

const defaultOpts = {
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

let queues: Record<string, Queue> | null = null;

export function getQueues() {
  if (!queues) {
    const connection = getRedisConnection();
    queues = {
      notifications: new Queue("notifications", { connection, ...defaultOpts }),
      emails: new Queue("emails", {
        connection,
        ...defaultOpts,
        defaultJobOptions: {
          ...defaultOpts.defaultJobOptions,
          attempts: 5,
          backoff: { type: "custom" },
        },
      }),
      payments: new Queue("payments", {
        connection,
        ...defaultOpts,
        defaultJobOptions: {
          ...defaultOpts.defaultJobOptions,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        },
      }),
      reconciliation: new Queue("reconciliation", { connection, ...defaultOpts }),
      antiFraud: new Queue("anti-fraud", {
        connection,
        ...defaultOpts,
        defaultJobOptions: {
          ...defaultOpts.defaultJobOptions,
          attempts: 2,
          backoff: { type: "exponential", delay: 3000 },
        },
      }),
    };
    log.info("BullMQ queues initialized");
  }
  return queues;
}

export async function closeQueues(): Promise<void> {
  if (queues) {
    await Promise.all(Object.values(queues).map((q) => q.close()));
    queues = null;
    log.info("All queues closed");
  }
}
```

**Step 4: Create producer helpers**

Create `backend/src/queues/producers.ts`:

```typescript
import { getQueues } from "./queues";
import { isRedisAvailable } from "./connection";
import { createLogger } from "../lib/logger";

const log = createLogger("producers");

// ============== NOTIFICATION JOBS ==============

export interface NotificationJobData {
  userId: number;
  type: string;
  title: string;
  message: string;
  serviceOrderId?: number;
  metadata?: Record<string, any>;
}

export async function enqueueNotification(data: NotificationJobData): Promise<boolean> {
  try {
    if (!(await isRedisAvailable())) {
      log.warn("Redis unavailable, notification will be processed synchronously");
      return false; // Caller should fall back to sync
    }
    const { notifications } = getQueues();
    await notifications.add("send-notification", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
    return true;
  } catch (err) {
    log.error({ err }, "Failed to enqueue notification");
    return false;
  }
}

// ============== EMAIL JOBS ==============

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateType?: "verification" | "password-reset" | "welcome" | "notification";
  templateData?: Record<string, any>;
}

export async function enqueueEmail(data: EmailJobData): Promise<boolean> {
  try {
    if (!(await isRedisAvailable())) {
      log.warn("Redis unavailable, email will be sent synchronously");
      return false;
    }
    const { emails } = getQueues();
    await emails.add("send-email", data, {
      attempts: 5,
      backoff: { type: "exponential", delay: 30000 },
    });
    return true;
  } catch (err) {
    log.error({ err }, "Failed to enqueue email");
    return false;
  }
}

// ============== PAYMENT JOBS ==============

export interface PaymentWebhookJobData {
  mpPaymentId: string;
  mpStatus: string;
  externalReference: string;
  transactionAmount: number;
  paymentMethodId: string;
  webhookRawHeaders: Record<string, string>;
  idempotencyKey: string;
  receivedAt: string;
}

export async function enqueuePaymentWebhook(data: PaymentWebhookJobData): Promise<boolean> {
  try {
    if (!(await isRedisAvailable())) {
      log.warn("Redis unavailable, payment webhook will be processed synchronously");
      return false;
    }
    const { payments } = getQueues();
    await payments.add("process-webhook", data, {
      jobId: data.idempotencyKey, // BullMQ deduplicates by jobId
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
    return true;
  } catch (err) {
    log.error({ err }, "Failed to enqueue payment webhook");
    return false;
  }
}

export interface EscrowReleaseJobData {
  paymentId: number;
  forcedByAdmin: boolean;
  actorId?: number;
}

export async function enqueueEscrowRelease(data: EscrowReleaseJobData): Promise<boolean> {
  try {
    if (!(await isRedisAvailable())) return false;
    const { payments } = getQueues();
    await payments.add("release-escrow", data);
    return true;
  } catch (err) {
    log.error({ err }, "Failed to enqueue escrow release");
    return false;
  }
}

// ============== RECONCILIATION JOBS ==============

export interface ReconciliationJobData {
  type: "daily-mp-reconciliation" | "cleanup-notifications" | "cleanup-idempotency-keys";
  params?: Record<string, any>;
}

export async function enqueueReconciliation(data: ReconciliationJobData): Promise<boolean> {
  try {
    if (!(await isRedisAvailable())) return false;
    const { reconciliation } = getQueues();
    await reconciliation.add(data.type, data);
    return true;
  } catch (err) {
    log.error({ err }, "Failed to enqueue reconciliation");
    return false;
  }
}

// ============== ANTI-FRAUD JOBS ==============

export interface AntiFraudJobData {
  type: "withdrawal-velocity" | "login-anomaly" | "payment-pattern";
  userId: number;
  action: string;
  metadata: Record<string, any>;
}

export async function enqueueAntiFraudCheck(data: AntiFraudJobData): Promise<boolean> {
  try {
    if (!(await isRedisAvailable())) return false;
    const { antiFraud } = getQueues();
    await antiFraud.add(data.type, data);
    return true;
  } catch (err) {
    log.error({ err }, "Failed to enqueue anti-fraud check");
    return false;
  }
}
```

**Step 5: Verify Redis connection works**

Run: `cd /home/levybonito/faztudo-main/backend && npx ts-node -e "
const { getRedisConnection, closeRedisConnection } = require('./src/queues/connection');
(async () => {
  const conn = getRedisConnection();
  const pong = await conn.ping();
  console.log('Redis:', pong);
  await closeRedisConnection();
})();
"`
Expected: `Redis: PONG`

**Step 6: Commit**

```bash
git add backend/src/queues/ backend/package.json backend/package-lock.json
git commit -m "feat: add BullMQ queue infrastructure with Redis connection

Create connection.ts, queues.ts (5 named queues), and producers.ts
with graceful degradation fallback when Redis is unavailable."
```

---

### Task 4: Create Worker Process

**Files:**
- Create: `backend/src/workers/index.ts`
- Create: `backend/src/workers/notificationWorker.ts`
- Create: `backend/src/workers/emailWorker.ts`
- Create: `backend/src/workers/paymentWorker.ts`
- Create: `backend/src/workers/reconciliationWorker.ts`
- Create: `backend/src/workers/antiFraudWorker.ts`
- Modify: `backend/package.json` (add worker script)

**Step 1: Create notification worker**

Create `backend/src/workers/notificationWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../queues/connection";
import prisma from "../lib/prisma";
import { emitToUser } from "../lib/socket";
import { createLogger } from "../lib/logger";
import type { NotificationJobData } from "../queues/producers";

const log = createLogger("worker:notifications");

export function createNotificationWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker<NotificationJobData>(
    "notifications",
    async (job: Job<NotificationJobData>) => {
      const { userId, type, title, message, serviceOrderId, metadata } = job.data;

      log.info({ jobId: job.id, userId, type }, "Processing notification");

      // 1. Create DB record
      const notification = await prisma.notification.create({
        data: {
          type: type as any,
          title,
          message,
          status: "UNREAD",
          userId,
          serviceOrderId: serviceOrderId || null,
          metadata: metadata ?? undefined,
        },
      });

      // 2. Real-time Socket.io emission (best-effort)
      try {
        emitToUser(userId, "notification:new", {
          id: notification.id,
          type,
          title,
          message,
          serviceOrderId,
        });
      } catch (err) {
        log.warn({ err, userId }, "Socket.io emission failed (non-fatal)");
      }

      log.info({ jobId: job.id, notificationId: notification.id }, "Notification sent");
      return { notificationId: notification.id };
    },
    {
      connection,
      concurrency: 10,
      limiter: { max: 100, duration: 1000 }, // Max 100/sec
    }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Notification job failed");
  });

  worker.on("error", (err) => {
    log.error({ err }, "Notification worker error");
  });

  return worker;
}
```

**Step 2: Create email worker**

Create `backend/src/workers/emailWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../queues/connection";
import { sendEmail } from "../services/emailService";
import { createLogger } from "../lib/logger";
import type { EmailJobData } from "../queues/producers";

const log = createLogger("worker:emails");

// Custom backoff: 30s, 1m, 5m, 15m, 1h
const EMAIL_BACKOFF_DELAYS = [30_000, 60_000, 300_000, 900_000, 3_600_000];

export function createEmailWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker<EmailJobData>(
    "emails",
    async (job: Job<EmailJobData>) => {
      const { to, subject, html, text } = job.data;

      log.info({ jobId: job.id, to, subject }, "Sending email");

      const result = await sendEmail({ to, subject, html, text });

      if (!result.success) {
        throw new Error(result.error || "Email send failed");
      }

      log.info({ jobId: job.id, messageId: result.messageId }, "Email sent");
      return { messageId: result.messageId };
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 30, duration: 1000 }, // Max 30 emails/sec (SMTP limits)
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return EMAIL_BACKOFF_DELAYS[attemptsMade - 1] || 3_600_000;
        },
      },
    }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err, to: job?.data?.to }, "Email job failed");
  });

  return worker;
}
```

**Step 3: Create payment worker**

Create `backend/src/workers/paymentWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../queues/connection";
import prisma from "../lib/prisma";
import { getMPPaymentStatus } from "../services/mercadopagoService";
import { releasePaymentFromEscrow } from "../services/escrowService";
import { enqueueNotification } from "../queues/producers";
import { createLogger } from "../lib/logger";
import type { PaymentWebhookJobData, EscrowReleaseJobData } from "../queues/producers";

const log = createLogger("worker:payments");

async function processWebhook(job: Job<PaymentWebhookJobData>) {
  const { mpPaymentId, idempotencyKey, externalReference } = job.data;

  log.info({ jobId: job.id, mpPaymentId }, "Processing payment webhook");

  // 1. Check idempotency in DB (PaymentEvent unique constraint)
  const existing = await prisma.paymentEvent.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    log.info({ jobId: job.id, idempotencyKey }, "Duplicate webhook — skipping");
    return { skipped: true, reason: "duplicate" };
  }

  // 2. Fetch fresh status from MercadoPago
  const mpStatus = await getMPPaymentStatus(mpPaymentId);

  // 3. Find local payment
  let payment = await prisma.payment.findFirst({
    where: { transactionId: mpPaymentId },
    include: {
      serviceOrder: { include: { professional: true, client: true } },
    },
  });

  if (!payment) {
    // Try by external reference: format "order-{orderId}-{timestamp}"
    const match = externalReference?.match(/^order-(\d+)/);
    if (match) {
      payment = await prisma.payment.findFirst({
        where: { serviceOrderId: parseInt(match[1], 10) },
        include: {
          serviceOrder: { include: { professional: true, client: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }
  }

  if (!payment) {
    log.warn({ mpPaymentId, externalReference }, "Payment not found locally");
    return { skipped: true, reason: "payment_not_found" };
  }

  // 4. Process based on status
  if (mpStatus.status === "approved" && payment.status === "PENDING") {
    const now = new Date();
    const holdDays = parseInt(process.env.DEFAULT_ESCROW_HOLD_DAYS || "0", 10);
    const heldUntil = new Date(now);
    heldUntil.setDate(heldUntil.getDate() + holdDays);

    await prisma.$transaction([
      // Create payment event
      prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          eventType: "HELD",
          previousStatus: "PENDING",
          newStatus: "HELD",
          idempotencyKey,
          amount: payment.amount,
          metadata: { mpStatus: mpStatus.status, mpStatusDetail: mpStatus.statusDetail },
          source: "WEBHOOK",
        },
      }),
      // Update payment status
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "HELD",
          transactionId: mpPaymentId,
          paidAt: now,
          heldUntil,
        },
      }),
      // Update order status
      prisma.serviceOrder.update({
        where: { id: payment.serviceOrderId },
        data: { status: "IN_PROGRESS" },
      }),
      // Create transaction record
      prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: payment.amount,
          description: `Payment confirmed for order #${payment.serviceOrderId}`,
          balanceBefore: payment.serviceOrder.client?.balance || 0,
          balanceAfter: payment.serviceOrder.client?.balance || 0,
          userId: payment.clientId,
          paymentId: payment.id,
        },
      }),
    ]);

    // Notify professional
    if (payment.professionalId) {
      await enqueueNotification({
        userId: payment.professionalId,
        type: "PAYMENT_RECEIVED",
        title: "Pagamento confirmado",
        message: `Pagamento de R$${payment.amount.toFixed(2)} recebido para "${payment.serviceOrder.title}"`,
        serviceOrderId: payment.serviceOrderId,
        metadata: { amount: payment.amount, mpPaymentId },
      });
    }

    log.info({ paymentId: payment.id, mpPaymentId }, "Payment approved and held in escrow");
  } else if (
    (mpStatus.status === "rejected" || mpStatus.status === "cancelled") &&
    payment.status === "PENDING"
  ) {
    await prisma.$transaction([
      prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          eventType: "FAILED",
          previousStatus: "PENDING",
          newStatus: "FAILED",
          idempotencyKey,
          metadata: { mpStatus: mpStatus.status, reason: mpStatus.statusDetail },
          source: "WEBHOOK",
        },
      }),
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      }),
    ]);

    // Notify client
    await enqueueNotification({
      userId: payment.clientId,
      type: "SYSTEM_ALERT",
      title: "Pagamento não aprovado",
      message: `O pagamento para "${payment.serviceOrder.title}" não foi aprovado.`,
      serviceOrderId: payment.serviceOrderId,
    });

    log.info({ paymentId: payment.id, reason: mpStatus.statusDetail }, "Payment rejected/cancelled");
  }

  return { processed: true, paymentId: payment.id, mpStatus: mpStatus.status };
}

async function processEscrowRelease(job: Job<EscrowReleaseJobData>) {
  const { paymentId, forcedByAdmin, actorId } = job.data;

  log.info({ jobId: job.id, paymentId }, "Processing escrow release");

  const result = await releasePaymentFromEscrow(paymentId, forcedByAdmin);

  if (!result.success) {
    log.warn({ paymentId, error: result.error }, "Escrow release failed");
    throw new Error(result.error || "Release failed");
  }

  log.info({ paymentId, professionalAmount: result.professionalAmount }, "Escrow released");
  return result;
}

export function createPaymentWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker(
    "payments",
    async (job: Job) => {
      switch (job.name) {
        case "process-webhook":
          return processWebhook(job as Job<PaymentWebhookJobData>);
        case "release-escrow":
          return processEscrowRelease(job as Job<EscrowReleaseJobData>);
        default:
          log.warn({ jobName: job.name }, "Unknown payment job type");
      }
    },
    {
      connection,
      concurrency: 3, // Low concurrency for financial operations
    }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, jobName: job?.name, err }, "Payment job failed");
    // TODO: Alert admins on DLQ
  });

  return worker;
}
```

**Step 4: Create reconciliation worker**

Create `backend/src/workers/reconciliationWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../queues/connection";
import prisma from "../lib/prisma";
import { getMPPaymentStatus } from "../services/mercadopagoService";
import { checkAutoReleasablePayments, checkExpiredOrders, sendDeadlineWarnings } from "../services/escrowService";
import { enqueueNotification } from "../queues/producers";
import { createLogger } from "../lib/logger";
import type { ReconciliationJobData } from "../queues/producers";

const log = createLogger("worker:reconciliation");

async function dailyMPReconciliation() {
  log.info("Starting daily MercadoPago reconciliation");

  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);

  // Find payments that are HELD or PENDING and older than 24h
  const payments = await prisma.payment.findMany({
    where: {
      status: { in: ["HELD", "PENDING"] },
      createdAt: { lt: cutoff },
      transactionId: { not: null },
    },
    take: 100, // Process in batches
  });

  let synced = 0;
  let divergent = 0;
  let errors = 0;

  for (const payment of payments) {
    try {
      const mpStatus = await getMPPaymentStatus(payment.transactionId!);

      const statusMap: Record<string, string> = {
        approved: "HELD",
        pending: "PENDING",
        rejected: "FAILED",
        cancelled: "FAILED",
        refunded: "REFUNDED",
      };

      const expectedLocalStatus = statusMap[mpStatus.status] || payment.status;

      if (payment.status !== expectedLocalStatus) {
        divergent++;

        // Log divergence and create event
        log.warn({
          paymentId: payment.id,
          localStatus: payment.status,
          mpStatus: mpStatus.status,
          expectedLocalStatus,
        }, "Payment status divergence found");

        await prisma.paymentEvent.create({
          data: {
            paymentId: payment.id,
            eventType: "RECONCILED",
            previousStatus: payment.status as any,
            newStatus: expectedLocalStatus as any,
            idempotencyKey: `reconciliation:${payment.id}:${new Date().toISOString().split("T")[0]}`,
            metadata: { mpStatus: mpStatus.status, localStatus: payment.status },
            source: "SCHEDULER",
          },
        });

        // Update local status
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: expectedLocalStatus as any },
        });
      } else {
        synced++;
      }
    } catch (err) {
      errors++;
      log.error({ err, paymentId: payment.id }, "Reconciliation error for payment");
    }
  }

  const report = { total: payments.length, synced, divergent, errors };
  log.info(report, "Reconciliation complete");

  // Alert admins if divergences found
  if (divergent > 0) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const admin of admins) {
      await enqueueNotification({
        userId: admin.id,
        type: "SYSTEM_ALERT",
        title: "Reconciliacao: divergencias encontradas",
        message: `Reconciliacao diaria encontrou ${divergent} divergencia(s) entre pagamentos locais e MercadoPago. ${errors} erro(s).`,
        metadata: report,
      });
    }
  }

  return report;
}

export function createReconciliationWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker<ReconciliationJobData>(
    "reconciliation",
    async (job: Job<ReconciliationJobData>) => {
      switch (job.data.type) {
        case "daily-mp-reconciliation":
          return dailyMPReconciliation();
        case "cleanup-notifications":
          // Archive old read notifications
          const archived = await prisma.notification.updateMany({
            where: {
              status: "READ",
              createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
            data: { status: "ARCHIVED" },
          });
          return { archived: archived.count };
        default:
          log.warn({ type: job.data.type }, "Unknown reconciliation job type");
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Reconciliation job failed");
  });

  return worker;
}
```

**Step 5: Create anti-fraud worker**

Create `backend/src/workers/antiFraudWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../queues/connection";
import prisma from "../lib/prisma";
import { enqueueNotification } from "../queues/producers";
import { createLogger } from "../lib/logger";
import type { AntiFraudJobData } from "../queues/producers";

const log = createLogger("worker:antiFraud");

async function checkWithdrawalVelocity(data: AntiFraudJobData) {
  const { userId } = data;

  // Check number of withdrawals in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentWithdrawals = await prisma.transaction.count({
    where: {
      userId,
      type: "WITHDRAWAL",
      createdAt: { gte: oneDayAgo },
    },
  });

  if (recentWithdrawals >= 5) {
    log.warn({ userId, count: recentWithdrawals }, "High withdrawal velocity detected");

    // Alert admins
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const admin of admins) {
      await enqueueNotification({
        userId: admin.id,
        type: "SYSTEM_ALERT",
        title: "Alerta anti-fraude: saques frequentes",
        message: `Usuario #${userId} realizou ${recentWithdrawals} saques nas ultimas 24h.`,
        metadata: { suspectUserId: userId, withdrawalCount: recentWithdrawals },
      });
    }
  }

  return { userId, recentWithdrawals, flagged: recentWithdrawals >= 5 };
}

export function createAntiFraudWorker(): Worker {
  const connection = getRedisConnection();

  const worker = new Worker<AntiFraudJobData>(
    "anti-fraud",
    async (job: Job<AntiFraudJobData>) => {
      switch (job.data.type) {
        case "withdrawal-velocity":
          return checkWithdrawalVelocity(job.data);
        default:
          log.info({ type: job.data.type }, "Anti-fraud check type not yet implemented");
      }
    },
    { connection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Anti-fraud job failed");
  });

  return worker;
}
```

**Step 6: Create worker entry point**

Create `backend/src/workers/index.ts`:

```typescript
import "dotenv/config";
import { createLogger } from "../lib/logger";
import { closeRedisConnection } from "../queues/connection";
import { createNotificationWorker } from "./notificationWorker";
import { createEmailWorker } from "./emailWorker";
import { createPaymentWorker } from "./paymentWorker";
import { createReconciliationWorker } from "./reconciliationWorker";
import { createAntiFraudWorker } from "./antiFraudWorker";
import prisma from "../lib/prisma";

const log = createLogger("worker:main");

async function main() {
  log.info("Starting worker process...");

  const workers = [
    createNotificationWorker(),
    createEmailWorker(),
    createPaymentWorker(),
    createReconciliationWorker(),
    createAntiFraudWorker(),
  ];

  log.info({ workerCount: workers.length }, "All workers started");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, "Worker shutting down...");
    await Promise.all(workers.map((w) => w.close()));
    await closeRedisConnection();
    await prisma.$disconnect();
    log.info("Worker shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    log.fatal({ err }, "Worker uncaught exception");
    shutdown("UNCAUGHT_EXCEPTION");
  });
}

main().catch((err) => {
  log.fatal({ err }, "Worker failed to start");
  process.exit(1);
});
```

**Step 7: Add worker script to package.json**

In `backend/package.json`, add to `scripts`:
```json
"worker": "ts-node src/workers/index.ts",
"scheduler": "ts-node src/scheduler/index.ts"
```

**Step 8: Commit**

```bash
git add backend/src/workers/ backend/package.json
git commit -m "feat: add BullMQ worker process with 5 specialized workers

Workers: notifications, emails, payments, reconciliation, anti-fraud.
Graceful shutdown support. Concurrency limits per queue type."
```

---

### Task 5: Create Scheduler Process and Migrate from node-cron

**Files:**
- Create: `backend/src/scheduler/index.ts`
- Modify: `backend/src/index.ts` (remove node-cron startup)

**Step 1: Create scheduler entry point**

Create `backend/src/scheduler/index.ts`:

```typescript
import "dotenv/config";
import { getQueues, closeQueues } from "../queues/queues";
import { closeRedisConnection } from "../queues/connection";
import { createLogger } from "../lib/logger";

const log = createLogger("scheduler");

async function main() {
  log.info("Starting scheduler process...");

  const queues = getQueues();

  // ============================================
  // RECURRING JOBS (replaces node-cron in scheduler.ts)
  // ============================================

  // Every hour: auto-release eligible escrow payments
  await queues.payments.add(
    "auto-release-escrow",
    { type: "auto-release" },
    {
      repeat: { pattern: "0 * * * *" },
      jobId: "scheduled:auto-release",
    }
  );

  // Every 6 hours: check for expired orders
  await queues.notifications.add(
    "check-expired-orders",
    { type: "SYSTEM_ALERT", title: "expired-orders-check", message: "", userId: 0 },
    {
      repeat: { pattern: "0 */6 * * *" },
      jobId: "scheduled:expired-orders",
    }
  );

  // Every 12 hours: send deadline warnings
  await queues.notifications.add(
    "send-deadline-warnings",
    { type: "DEADLINE_WARNING", title: "deadline-warnings", message: "", userId: 0 },
    {
      repeat: { pattern: "0 */12 * * *" },
      jobId: "scheduled:deadline-warnings",
    }
  );

  // Every minute: check for late professionals
  await queues.notifications.add(
    "check-late-professionals",
    { type: "DEADLINE_WARNING", title: "late-professionals-check", message: "", userId: 0 },
    {
      repeat: { pattern: "* * * * *" },
      jobId: "scheduled:late-professionals",
    }
  );

  // Daily at 3 AM: MercadoPago reconciliation
  await queues.reconciliation.add(
    "daily-mp-reconciliation",
    { type: "daily-mp-reconciliation" },
    {
      repeat: { pattern: "0 3 * * *" },
      jobId: "scheduled:mp-reconciliation",
    }
  );

  // Weekly Sunday 4 AM: cleanup old notifications
  await queues.reconciliation.add(
    "cleanup-notifications",
    { type: "cleanup-notifications" },
    {
      repeat: { pattern: "0 4 * * 0" },
      jobId: "scheduled:cleanup-notifications",
    }
  );

  log.info("All recurring jobs registered");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, "Scheduler shutting down...");
    await closeQueues();
    await closeRedisConnection();
    log.info("Scheduler shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Keep process alive
  log.info("Scheduler running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  log.fatal({ err }, "Scheduler failed to start");
  process.exit(1);
});
```

**Step 2: Update index.ts — remove node-cron startup, add Redis health check**

In `backend/src/index.ts`:

- Remove import: `import { startScheduledTasks, stopScheduledTasks } from "./lib/scheduler";`
- Remove import: `import { scheduleDailySalaries, stopSalaryCron } from "./services/companyCronService";`
- In `gracefulShutdown`: remove `stopScheduledTasks()` and `stopSalaryCron()` calls
- In `server = httpServer.listen(...)` callback: remove `startScheduledTasks()` and `scheduleDailySalaries()` calls
- Add to graceful shutdown: `await closeQueues(); await closeRedisConnection();` (import from queues)
- Update `/health` endpoint to include Redis status

**Step 3: Commit**

```bash
git add backend/src/scheduler/ backend/src/index.ts
git commit -m "feat: add BullMQ scheduler process, decouple cron from API

Migrate all node-cron scheduled tasks to BullMQ repeat jobs.
Remove startScheduledTasks/scheduleDailySalaries from API server.
Scheduler now runs as independent process."
```

---

## Phase 3: Payment Event Store & Idempotency

### Task 6: Add PaymentEvent and AuditLog models to Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Add new enums and models**

Add to `backend/prisma/schema.prisma` (after existing enums):

```prisma
enum PaymentEventType {
  CREATED
  HELD
  APPROVED
  RELEASED
  REFUNDED
  PARTIALLY_REFUNDED
  FAILED
  EXPIRED
  DISPUTED
  RECONCILED
  MANUAL_OVERRIDE
}

enum EventSource {
  WEBHOOK
  INTERNAL
  ADMIN
  SCHEDULER
}
```

Add new models (after existing models):

```prisma
model PaymentEvent {
  id              Int              @id @default(autoincrement())
  paymentId       Int
  payment         Payment          @relation(fields: [paymentId], references: [id])
  eventType       PaymentEventType
  previousStatus  PaymentStatus?
  newStatus       PaymentStatus
  idempotencyKey  String           @unique
  amount          Float?
  metadata        Json?
  source          EventSource
  actorId         Int?
  ipAddress       String?
  createdAt       DateTime         @default(now())

  @@index([paymentId, createdAt])
  @@index([eventType, createdAt])
}

model AuditLog {
  id          Int      @id @default(autoincrement())
  action      String
  actorId     Int
  actor       User     @relation("auditLogs", fields: [actorId], references: [id])
  targetType  String
  targetId    Int
  metadata    Json?
  ipAddress   String?
  createdAt   DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([targetType, targetId])
}

model UserMFA {
  id              Int       @id @default(autoincrement())
  userId          Int       @unique
  user            User      @relation(fields: [userId], references: [id])
  secret          String
  isEnabled       Boolean   @default(false)
  isVerified      Boolean   @default(false)
  backupCodes     String?
  backupCodesUsed Int       @default(0)
  lastUsedAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

Update the `Payment` model to add the relation:
```prisma
  events          PaymentEvent[]
```

Update the `User` model to add relations:
```prisma
  auditLogs       AuditLog[]   @relation("auditLogs")
  mfa             UserMFA?
```

**Step 2: Push schema**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`
Expected: Schema synced successfully

**Step 3: Generate client**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma generate`

**Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add PaymentEvent, AuditLog, UserMFA models to schema

PaymentEvent: append-only event store with idempotency key.
AuditLog: generic admin action audit trail.
UserMFA: TOTP MFA configuration per user."
```

---

### Task 7: Create Payment State Machine

**Files:**
- Create: `backend/src/lib/paymentStateMachine.ts`

**Step 1: Write the state machine**

Create `backend/src/lib/paymentStateMachine.ts`:

```typescript
import prisma from "./prisma";
import { PaymentStatus, PaymentEventType, EventSource } from "@prisma/client";
import { createLogger } from "./logger";

const log = createLogger("paymentStateMachine");

// Valid transitions: from → [to, to, ...]
const VALID_TRANSITIONS: Record<string, PaymentStatus[]> = {
  PENDING: ["HELD", "FAILED"],
  HELD: ["RELEASED", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED"],
  FAILED: [], // Terminal state
  RELEASED: [], // Terminal state
  REFUNDED: [], // Terminal state
  PARTIALLY_REFUNDED: ["REFUNDED", "RELEASED"],
};

export interface TransitionParams {
  paymentId: number;
  newStatus: PaymentStatus;
  eventType: PaymentEventType;
  source: EventSource;
  idempotencyKey: string;
  amount?: number;
  metadata?: Record<string, any>;
  actorId?: number;
  ipAddress?: string;
}

export interface TransitionResult {
  success: boolean;
  isDuplicate?: boolean;
  error?: string;
  event?: any;
}

/**
 * Atomically transition a payment's status with event store tracking.
 *
 * 1. Validates transition against state machine
 * 2. Creates PaymentEvent with idempotencyKey (UNIQUE constraint)
 * 3. Updates Payment.status
 * 4. Returns result (success, duplicate, or error)
 */
export async function transitionPaymentStatus(
  params: TransitionParams
): Promise<TransitionResult> {
  const {
    paymentId,
    newStatus,
    eventType,
    source,
    idempotencyKey,
    amount,
    metadata,
    actorId,
    ipAddress,
  } = params;

  // 1. Check for duplicate idempotency key
  const existingEvent = await prisma.paymentEvent.findUnique({
    where: { idempotencyKey },
  });

  if (existingEvent) {
    log.info({ paymentId, idempotencyKey }, "Duplicate event — already processed");
    return { success: true, isDuplicate: true };
  }

  // 2. Fetch current payment status
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { status: true },
  });

  if (!payment) {
    return { success: false, error: "Payment not found" };
  }

  // 3. Validate transition
  const allowed = VALID_TRANSITIONS[payment.status] || [];
  if (!allowed.includes(newStatus)) {
    log.warn(
      { paymentId, from: payment.status, to: newStatus },
      "Invalid payment status transition"
    );
    return {
      success: false,
      error: `Invalid transition: ${payment.status} → ${newStatus}`,
    };
  }

  // 4. Atomic: create event + update status
  try {
    const [event] = await prisma.$transaction([
      prisma.paymentEvent.create({
        data: {
          paymentId,
          eventType,
          previousStatus: payment.status,
          newStatus,
          idempotencyKey,
          amount,
          metadata: metadata ?? undefined,
          source,
          actorId,
          ipAddress,
        },
      }),
      prisma.payment.update({
        where: { id: paymentId },
        data: { status: newStatus },
      }),
    ]);

    log.info(
      { paymentId, from: payment.status, to: newStatus, eventId: event.id },
      "Payment status transitioned"
    );

    return { success: true, event };
  } catch (err: any) {
    // Handle unique constraint violation (duplicate idempotency key from race condition)
    if (err.code === "P2002" && err.meta?.target?.includes("idempotencyKey")) {
      log.info({ paymentId, idempotencyKey }, "Race condition duplicate — already processed");
      return { success: true, isDuplicate: true };
    }
    log.error({ err, paymentId }, "Payment transition failed");
    return { success: false, error: err.message };
  }
}

/**
 * Get payment event history for a given payment.
 */
export async function getPaymentEventHistory(paymentId: number) {
  return prisma.paymentEvent.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" },
  });
}
```

**Step 2: Commit**

```bash
git add backend/src/lib/paymentStateMachine.ts
git commit -m "feat: add payment state machine with idempotent transitions

Validates transitions against allowed state graph.
Creates PaymentEvent atomically with status update.
Handles duplicate idempotency keys gracefully."
```

---

### Task 8: Update Webhook Handler to be Idempotent

**Files:**
- Modify: `backend/src/controllers/service/paymentController.ts` (mercadoPagoWebhook function, lines 549-749)

**Step 1: Refactor mercadoPagoWebhook to enqueue instead of process inline**

Replace the `mercadoPagoWebhook` export to:
1. Validate HMAC signature (keep existing)
2. Generate idempotencyKey
3. Check Redis for duplicate (fast path)
4. Enqueue job to `payments` queue
5. Return 200 immediately

The full processing moves to `paymentWorker.ts` (already created in Task 4 Step 3).

See design doc section 4.3 for the exact flow.

**Step 2: Commit**

```bash
git add backend/src/controllers/service/paymentController.ts
git commit -m "feat: make webhook handler idempotent with queue dispatch

Webhook now validates, deduplicates (Redis + DB), and enqueues.
Processing moved to paymentWorker for async execution."
```

---

## Phase 4: Migrate Notifications and Emails to Queues

### Task 9: Update notificationService to use queues with fallback

**Files:**
- Modify: `backend/src/services/notificationService.ts`

**Step 1: Update createNotification to enqueue with sync fallback**

Modify the `createNotification` function to:
1. Try to enqueue via `enqueueNotification()`
2. If Redis unavailable (returns false), execute synchronously (current behavior)
3. Email sending always enqueued separately via `enqueueEmail()`

**Step 2: Fix controllers that have local createNotification copies**

The following controllers define their own inline `createNotification` that only does `prisma.notification.create` (no Socket.io, no email). These should be updated to import from the service:

- `backend/src/controllers/service/paymentController.ts` (lines 48-70)
- `backend/src/controllers/service/orderController.ts` (line 67)
- `backend/src/controllers/service/messageController.ts` (line 48)
- `backend/src/controllers/service/reviewController.ts` (line 33)

For each: remove local `createNotification` const, add import from `../../services/notificationService`.

**Step 3: Commit**

```bash
git add backend/src/services/notificationService.ts backend/src/controllers/service/
git commit -m "feat: migrate notifications to async queue with sync fallback

All controllers now use centralized notificationService.
Notifications enqueued to BullMQ when Redis available,
falls back to synchronous execution otherwise."
```

---

### Task 10: Update emailService to enqueue emails

**Files:**
- Modify: `backend/src/services/emailService.ts`
- Modify: `backend/src/controllers/authController.ts`

**Step 1: Add enqueueOrSendEmail helper to emailService**

Add a new exported function that tries to enqueue, falls back to sync:

```typescript
export async function enqueueOrSendEmail(options: SendEmailOptions): Promise<void> {
  const queued = await enqueueEmail({
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
  if (!queued) {
    // Fallback: send synchronously
    await sendEmail(options);
  }
}
```

**Step 2: Update authController to use enqueueOrSendEmail**

Replace direct `sendEmail` / `sendVerificationEmail` calls with the enqueued version for fire-and-forget cases. Keep the `resendVerificationEmail` handler synchronous (user expects immediate response).

**Step 3: Commit**

```bash
git add backend/src/services/emailService.ts backend/src/controllers/authController.ts
git commit -m "feat: migrate email sending to async queue with sync fallback

Emails enqueued to BullMQ when Redis available.
Auth verification resend remains synchronous for UX."
```

---

## Phase 5: MFA (TOTP)

### Task 11: Install MFA dependencies and create MFA controller

**Files:**
- Create: `backend/src/controllers/mfaController.ts`
- Create: `backend/src/routes/mfaRoutes.ts`
- Create: `backend/src/middleware/mfa.ts`
- Modify: `backend/src/config/env.ts` (add MFA_ENCRYPTION_KEY)
- Modify: `backend/src/index.ts` (register mfaRoutes)
- Modify: `backend/src/controllers/authController.ts` (MFA login flow)

**Step 1: Install dependencies**

Run: `cd /home/levybonito/faztudo-main/backend && npm install otplib qrcode`
Run: `cd /home/levybonito/faztudo-main/backend && npm install -D @types/qrcode`

**Step 2: Add MFA_ENCRYPTION_KEY to env.ts**

Add to `EnvConfig` interface:
```typescript
  MFA_ENCRYPTION_KEY: string;
```

Add to config object:
```typescript
    MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY || (nodeEnv === 'production'
      ? (() => { throw new Error('FATAL: MFA_ENCRYPTION_KEY must be set in production'); })()
      : crypto.randomBytes(32).toString('hex')),
```

**Step 3: Create MFA controller**

Create `backend/src/controllers/mfaController.ts` with these endpoints:
- `setupMFA` — generates TOTP secret, encrypts with AES-256-GCM, stores in UserMFA, returns QR code URI
- `verifySetup` — validates first TOTP code, generates 10 backup codes (bcrypt hashed), enables MFA
- `validateMFA` — validates TOTP code during login (called after password check)
- `disableMFA` — requires current TOTP code, deletes UserMFA record
- `regenerateBackupCodes` — generates new backup codes, requires current TOTP code

**Step 4: Create MFA routes**

Create `backend/src/routes/mfaRoutes.ts`:
```typescript
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { setupMFA, verifySetup, validateMFA, disableMFA, regenerateBackupCodes } from "../controllers/mfaController";

const router = Router();

router.post("/setup", verifyToken, setupMFA);
router.post("/verify-setup", verifyToken, verifySetup);
router.post("/validate", validateMFA); // No verifyToken — uses temp mfaToken
router.post("/disable", verifyToken, disableMFA);
router.post("/backup-codes/regenerate", verifyToken, regenerateBackupCodes);

export default router;
```

**Step 5: Create requireMFA middleware**

Create `backend/src/middleware/mfa.ts`:
- Reads `X-MFA-Code` header
- If user has MFA enabled, validates the code against their TOTP secret
- Used on critical endpoints (wallet withdraw, password change, etc.)

**Step 6: Update login flow in authController**

Modify the `login` function in `authController.ts`:
- After password verification, check if user has MFA enabled
- If yes: return `{ mfaRequired: true, mfaToken: <short-lived-jwt> }` instead of access/refresh tokens
- The mfaToken is a JWT with 5-minute expiry containing `{ userId, purpose: "mfa" }`
- Client then calls `POST /api/auth/mfa/validate` with the mfaToken + TOTP code to get real tokens

**Step 7: Register routes in index.ts**

Add to `backend/src/index.ts`:
```typescript
import mfaRoutes from "./routes/mfaRoutes";
// ...
app.use("/api/auth/mfa", mfaRoutes);
```

**Step 8: Apply requireMFA to critical endpoints**

Add `requireMFA` middleware to:
- `walletRoutes.ts` — `POST /withdraw`
- `authRoutes.ts` — `PUT /change-password`

**Step 9: Commit**

```bash
git add backend/src/controllers/mfaController.ts backend/src/routes/mfaRoutes.ts backend/src/middleware/mfa.ts backend/src/controllers/authController.ts backend/src/config/env.ts backend/src/index.ts backend/package.json backend/package-lock.json
git commit -m "feat: add TOTP MFA authentication

Setup, verify, validate, disable MFA flows.
Obrigatorio para admins no login.
requireMFA middleware para acoes criticas (saques, senha)."
```

---

## Phase 6: Circuit Breaker, Health Checks, Audit Log

### Task 12: Add Circuit Breaker for MercadoPago

**Files:**
- Create: `backend/src/lib/circuitBreaker.ts`
- Modify: `backend/src/services/mercadopagoService.ts`

**Step 1: Install opossum**

Run: `cd /home/levybonito/faztudo-main/backend && npm install opossum`
Run: `cd /home/levybonito/faztudo-main/backend && npm install -D @types/opossum`

**Step 2: Create circuit breaker wrapper**

Create `backend/src/lib/circuitBreaker.ts`:

```typescript
import CircuitBreaker from "opossum";
import { createLogger } from "./logger";

const log = createLogger("circuitBreaker");

const DEFAULT_OPTIONS: CircuitBreaker.Options = {
  timeout: 10000,       // 10s timeout per call
  errorThresholdPercentage: 50,
  resetTimeout: 30000,  // Try again after 30s
  volumeThreshold: 5,   // Min 5 calls before tripping
};

export function createCircuitBreaker<T>(
  fn: (...args: any[]) => Promise<T>,
  name: string,
  options?: Partial<CircuitBreaker.Options>
): CircuitBreaker<any[], T> {
  const breaker = new CircuitBreaker(fn, {
    ...DEFAULT_OPTIONS,
    ...options,
    name,
  });

  breaker.on("open", () => log.warn({ name }, "Circuit OPEN — failing fast"));
  breaker.on("halfOpen", () => log.info({ name }, "Circuit HALF-OPEN — testing"));
  breaker.on("close", () => log.info({ name }, "Circuit CLOSED — recovered"));
  breaker.on("fallback", () => log.warn({ name }, "Circuit fallback triggered"));

  return breaker;
}
```

**Step 3: Wrap MercadoPago calls with circuit breaker**

In `mercadopagoService.ts`, wrap `getMPPaymentStatus`, `createCardPayment`, `createPixPayment`, `createBoletoPayment` with circuit breakers.

**Step 4: Commit**

```bash
git add backend/src/lib/circuitBreaker.ts backend/src/services/mercadopagoService.ts backend/package.json backend/package-lock.json
git commit -m "feat: add circuit breaker for MercadoPago API calls

Uses opossum with 50% error threshold, 30s reset.
Prevents cascading failures when MP is down."
```

---

### Task 13: Extend Health Checks and add Metrics endpoint

**Files:**
- Modify: `backend/src/index.ts` (health endpoint)
- Create: `backend/src/lib/metrics.ts`

**Step 1: Install prom-client**

Run: `cd /home/levybonito/faztudo-main/backend && npm install prom-client`

**Step 2: Create metrics module**

Create `backend/src/lib/metrics.ts` with Prometheus counters for:
- `http_requests_total` (method, path, status)
- `http_request_duration_seconds` (histogram)
- `bullmq_jobs_completed_total` (queue)
- `bullmq_jobs_failed_total` (queue)
- `payment_transitions_total` (from_status, to_status)

**Step 3: Update /health to include Redis and queue status**

**Step 4: Add GET /metrics endpoint (localhost only)**

**Step 5: Commit**

```bash
git add backend/src/lib/metrics.ts backend/src/index.ts backend/package.json backend/package-lock.json
git commit -m "feat: add Prometheus metrics and extended health checks

/health includes Redis, PostgreSQL, and queue status.
/metrics serves Prometheus-format metrics (localhost only)."
```

---

### Task 14: Add Audit Log Middleware

**Files:**
- Create: `backend/src/middleware/auditLog.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/src/routes/walletRoutes.ts`

**Step 1: Create audit log middleware**

Create `backend/src/middleware/auditLog.ts`:

```typescript
import { Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "./auth";
import { createLogger } from "../lib/logger";

const log = createLogger("auditLog");

export function auditAction(action: string, targetType: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method to intercept response
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Only log successful actions (2xx responses)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const targetId = parseInt(req.params.id || req.params.userId || "0", 10);

        prisma.auditLog.create({
          data: {
            action,
            actorId: req.user.id,
            targetType,
            targetId: targetId || 0,
            metadata: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              body: req.body ? Object.keys(req.body) : undefined, // Log field names, not values
            },
            ipAddress: req.ip || req.socket?.remoteAddress || null,
          },
        }).catch((err) => {
          log.error({ err, action, actorId: req.user?.id }, "Failed to create audit log");
        });
      }

      return originalJson(body);
    } as any;

    next();
  };
}
```

**Step 2: Apply to admin routes and financial routes**

**Step 3: Commit**

```bash
git add backend/src/middleware/auditLog.ts backend/src/routes/adminRoutes.ts backend/src/routes/walletRoutes.ts
git commit -m "feat: add audit log middleware for admin and financial actions

Logs action, actor, target, IP for all admin operations.
Applied to admin routes and wallet withdrawal."
```

---

## Phase 7: Secrets Management

### Task 15: Create Secrets Management Module

**Files:**
- Create: `backend/src/config/secrets.ts`
- Modify: `backend/src/config/env.ts`

**Step 1: Create secrets.ts**

Create `backend/src/config/secrets.ts`:

```typescript
import { createLogger } from "../lib/logger";

const log = createLogger("secrets");

type SecretsProvider = "env" | "aws" | "gcp" | "azure";

interface SecretsConfig {
  provider: SecretsProvider;
  region?: string;
  prefix?: string;
}

const secretsCache = new Map<string, string>();
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get a secret value. In dev, reads from process.env.
 * In production, reads from configured cloud provider.
 */
export async function getSecret(key: string): Promise<string> {
  const provider = (process.env.SECRETS_PROVIDER as SecretsProvider) || "env";

  // Check cache first
  const cached = secretsCache.get(key);
  if (cached && Date.now() - lastRefresh < REFRESH_INTERVAL_MS) {
    return cached;
  }

  let value: string;

  switch (provider) {
    case "env":
      value = process.env[key] || "";
      break;
    case "aws":
      // Future: AWS Secrets Manager SDK
      value = process.env[key] || "";
      log.warn("AWS Secrets Manager not yet implemented, falling back to env");
      break;
    case "gcp":
      // Future: GCP Secret Manager SDK
      value = process.env[key] || "";
      log.warn("GCP Secret Manager not yet implemented, falling back to env");
      break;
    default:
      value = process.env[key] || "";
  }

  secretsCache.set(key, value);
  lastRefresh = Date.now();
  return value;
}

/**
 * Preload all secrets at application startup.
 */
export async function preloadSecrets(keys: string[]): Promise<void> {
  log.info({ count: keys.length }, "Preloading secrets...");
  for (const key of keys) {
    await getSecret(key);
  }
  log.info("Secrets preloaded");
}

/**
 * Clear secrets cache (for rotation support).
 */
export function clearSecretsCache(): void {
  secretsCache.clear();
  lastRefresh = 0;
  log.info("Secrets cache cleared");
}
```

**Step 2: Commit**

```bash
git add backend/src/config/secrets.ts
git commit -m "feat: add secrets management with cloud provider support

Unified getSecret() interface. Env fallback for dev.
Cache with 1h TTL. Extensible for AWS/GCP/Azure."
```

---

## Phase 8: Webhook Rate Limiting

### Task 16: Add Webhook Rate Limiting

**Files:**
- Modify: `backend/src/middleware/rateLimiter.ts`
- Modify: `backend/src/routes/paymentRoutes.ts`

**Step 1: Add webhook rate limiter**

Add to `rateLimiter.ts`:

```typescript
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit by external_reference or IP
    return (req.query.external_reference as string) || req.ip || "unknown";
  },
  message: {
    success: false,
    message: "Too many webhook requests",
    statusCode: 429,
  },
});
```

**Step 2: Apply to webhook route**

**Step 3: Commit**

```bash
git add backend/src/middleware/rateLimiter.ts backend/src/routes/paymentRoutes.ts
git commit -m "feat: add rate limiting for MercadoPago webhooks

100 webhooks/min per external_reference.
Prevents webhook flood attacks."
```

---

## Phase 9: Testing

### Task 17: Write Tests for New Components

**Files:**
- Create: `backend/tests/queues/producers.test.ts`
- Create: `backend/tests/lib/paymentStateMachine.test.ts`
- Create: `backend/tests/middleware/mfa.test.ts`
- Create: `backend/tests/lib/circuitBreaker.test.ts`

**Step 1: Write payment state machine tests**

Test cases:
- Valid transitions (PENDING → HELD, HELD → RELEASED, etc.)
- Invalid transitions (PENDING → RELEASED should fail)
- Duplicate idempotency key returns `isDuplicate: true`
- Concurrent transitions with same idempotency key (race condition)

**Step 2: Write producer tests**

Test cases:
- `enqueueNotification` returns true when Redis available
- `enqueueNotification` returns false when Redis unavailable (graceful degradation)
- Job data is correctly structured

**Step 3: Write MFA tests**

Test cases:
- TOTP secret generation and QR code URL
- Valid TOTP code accepted
- Invalid TOTP code rejected
- Backup code works and is consumed
- MFA required for admin login

**Step 4: Write circuit breaker tests**

Test cases:
- Circuit opens after threshold failures
- Circuit half-opens after reset timeout
- Successful call closes circuit

**Step 5: Run all tests**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/tests/
git commit -m "test: add tests for payment state machine, producers, MFA, circuit breaker"
```

---

## Phase 10: Integration and Final Validation

### Task 18: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update documentation**

Update CLAUDE.md to reflect:
- New tech stack additions (BullMQ, Redis, PostgreSQL)
- New commands (`npm run worker`, `npm run scheduler`)
- Updated architecture diagram (3 processes)
- New env vars (REDIS_URL, MFA_ENCRYPTION_KEY, SECRETS_PROVIDER)
- New files map
- Updated gotchas

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with async processing, MFA, PostgreSQL architecture"
```

---

### Task 19: End-to-End Validation

**Step 1: Start all services**

```bash
# Terminal 1: PostgreSQL + Redis
docker compose up -d postgres redis

# Terminal 2: API Server
cd backend && npm run dev

# Terminal 3: Worker
cd backend && npm run worker

# Terminal 4: Scheduler
cd backend && npm run scheduler

# Terminal 5: Frontend
cd frontend && npm run dev
```

**Step 2: Verify health endpoint**

Run: `curl http://localhost:3001/health`
Expected: `{ "status": "healthy", "database": "connected", "redis": "connected", "queues": {...} }`

**Step 3: Run full test suite**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 4: Test MFA flow manually**

1. Login as admin
2. Setup MFA → scan QR code
3. Verify setup with TOTP code
4. Logout and login again → should require MFA

**Step 5: Final commit**

```bash
git commit -m "chore: end-to-end validation complete for async + security hardening"
```
