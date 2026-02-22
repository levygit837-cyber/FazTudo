# Async Processing, Payment Safety & Security Hardening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separar a API em 3 processos (API / Worker / Scheduler), migrar para PostgreSQL, implementar event store de pagamentos com idempotência, adicionar MFA TOTP, secrets management, SLOs, circuit breaker e audit log.

**Architecture:** API Express despacha jobs para Redis via BullMQ. Worker consome filas (notifications, emails, payments, reconciliation, anti-fraud). Scheduler registra jobs recorrentes. PostgreSQL substitui SQLite. Event store append-only para trilha de pagamentos. MFA TOTP para admins e ações críticas.

**Tech Stack:** BullMQ, IORedis, PostgreSQL 16, otplib, qrcode, opossum (circuit breaker), prom-client (metrics)

---

## Task 1: Instalar e Configurar PostgreSQL + Redis via Docker

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/.env.example`
- Modify: `backend/.env`

**Step 1: Atualizar docker-compose.yml com PostgreSQL e Redis**

Adicionar os serviços `postgres` e `redis` ao `docker-compose.yml` existente. Atualizar o service `backend` para depender de ambos e usar `DATABASE_URL` PostgreSQL.

```yaml
services:
  postgres:
    image: postgres:16-alpine
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
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    volumes:
      - redisdata:/data

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: development
      PORT: 3001
      DATABASE_URL: postgresql://faztudo:faztudo_dev_2026@postgres:5432/faztudo
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET:-dev-secret-key-change-in-production-minimum-32-chars}
      JWT_EXPIRES_IN: 7d
      CORS_ORIGIN: http://localhost:5173,http://localhost:5174
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/src:/app/src
      - ./backend/prisma:/app/prisma
      - ./backend/tests:/app/tests
      - backend_node_modules:/app/node_modules
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:3001
    depends_on:
      - backend
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
      - frontend_node_modules:/app/node_modules
    restart: unless-stopped

  admin:
    build: ./admin
    ports:
      - "5174:5174"
    environment:
      VITE_API_URL: http://localhost:3001
    depends_on:
      - backend
    volumes:
      - ./admin/src:/app/src
      - ./admin/public:/app/public
      - admin_node_modules:/app/node_modules
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
  backend_node_modules:
  frontend_node_modules:
  admin_node_modules:
```

**Step 2: Instalar PostgreSQL e Redis localmente (sem Docker)**

Para dev local sem Docker, instalar PostgreSQL 16 e Redis 7:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y postgresql-16 redis-server

# Criar banco e usuário
sudo -u postgres psql -c "CREATE USER faztudo WITH PASSWORD 'faztudo_dev_2026';"
sudo -u postgres psql -c "CREATE DATABASE faztudo OWNER faztudo;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE faztudo TO faztudo;"

# Verificar
psql -U faztudo -d faztudo -c "SELECT 1;"
redis-cli ping
```

**Step 3: Atualizar .env com novas variáveis**

Adicionar ao `backend/.env`:
```
DATABASE_URL=postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo
REDIS_URL=redis://localhost:6379
MFA_ENCRYPTION_KEY=  # Será gerado no Task 8
```

Atualizar `backend/.env.example` com as mesmas variáveis (sem valores sensíveis).

**Step 4: Verificar que PostgreSQL e Redis estão rodando**

```bash
psql -U faztudo -d faztudo -c "SELECT version();"
redis-cli ping
```

Expected: Versão do PostgreSQL e `PONG`.

**Step 5: Commit**

```bash
git add docker-compose.yml backend/.env.example
git commit -m "infra: add PostgreSQL 16 and Redis 7 to docker-compose"
```

---

## Task 2: Migrar Prisma de SQLite para PostgreSQL

**Files:**
- Modify: `backend/prisma/schema.prisma` (linhas 1-10: datasource)
- Modify: `backend/package.json` (remover libsql deps)
- Modify: `backend/src/lib/prisma.ts`
- Modify: `backend/src/config/env.ts` (DATABASE_URL default)

**Step 1: Atualizar datasource no schema.prisma**

No topo do `backend/prisma/schema.prisma`, substituir o datasource block inteiro:

De (atual — pode ter adapter para libsql):
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Para:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Remover qualquer referência a `previewFeatures = ["driverAdapters"]` no generator block se existir.

**Step 2: Atualizar prisma.ts para remover adapter libsql**

O arquivo `backend/src/lib/prisma.ts` pode ter configuração de adapter libsql. Simplificar para:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;
```

**Step 3: Remover dependências libsql do package.json**

```bash
cd backend && npm uninstall @prisma/adapter-libsql @libsql/client
```

**Step 4: Atualizar default DATABASE_URL em env.ts**

No arquivo `backend/src/config/env.ts`, mudar o default de `DATABASE_URL`:

De: `DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db'`
Para: `DATABASE_URL: process.env.DATABASE_URL || 'postgresql://faztudo:faztudo_dev_2026@localhost:5432/faztudo'`

**Step 5: Gerar cliente Prisma e push schema**

```bash
cd backend && npx prisma generate && npx prisma db push
```

Expected: Schema criado no PostgreSQL sem erros.

**Step 6: Rodar seed**

```bash
cd backend && npm run db:seed
```

Expected: Seed completo com categorias, configs, 3 usuários teste, 8 listings.

**Step 7: Rodar testes existentes**

```bash
cd backend && npm test
```

Expected: Todos os testes passam (ou pelo menos mesma quantidade de antes).

**Step 8: Verificar tipo check**

```bash
cd backend && npx tsc --noEmit
```

Expected: Sem erros de tipo.

**Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/lib/prisma.ts backend/src/config/env.ts backend/package.json backend/package-lock.json
git commit -m "feat: migrate from SQLite to PostgreSQL 16"
```

---

## Task 3: Instalar BullMQ + IORedis e Criar Infra de Filas

**Files:**
- Create: `backend/src/queues/connection.ts`
- Create: `backend/src/queues/queues.ts`
- Create: `backend/src/queues/producers.ts`
- Modify: `backend/package.json`

**Step 1: Instalar dependências**

```bash
cd backend && npm install bullmq ioredis
npm install -D @types/ioredis
```

**Step 2: Criar connection.ts**

Criar `backend/src/queues/connection.ts`:

```typescript
import IORedis from "ioredis";
import { createLogger } from "../lib/logger";

const log = createLogger("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Shared IORedis connection options for BullMQ.
 * BullMQ requires a new connection per Queue/Worker, so we export the config.
 */
export const redisConnectionOptions = {
  host: new URL(REDIS_URL).hostname || "localhost",
  port: parseInt(new URL(REDIS_URL).port || "6379", 10),
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
};

/**
 * Creates a new IORedis instance for general use (caching, dedup).
 * For BullMQ, pass redisConnectionOptions to Queue/Worker constructors.
 */
export function createRedisClient(): IORedis {
  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 10) {
        log.error("Redis connection failed after 10 retries");
        return null; // Stop retrying
      }
      return Math.min(times * 200, 5000);
    },
  });

  client.on("connect", () => log.info("Redis connected"));
  client.on("error", (err) => log.error({ err }, "Redis error"));
  client.on("close", () => log.warn("Redis connection closed"));

  return client;
}

/**
 * Singleton Redis client for caching/dedup (not for BullMQ).
 */
let _redisClient: IORedis | null = null;

export function getRedisClient(): IORedis {
  if (!_redisClient) {
    _redisClient = createRedisClient();
  }
  return _redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (_redisClient) {
    await _redisClient.quit();
    _redisClient = null;
    log.info("Redis client closed");
  }
}
```

**Step 3: Criar queues.ts**

Criar `backend/src/queues/queues.ts`:

```typescript
import { Queue } from "bullmq";
import { redisConnectionOptions } from "./connection";

const defaultOpts = {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

// ==================== QUEUES ====================

export const notificationQueue = new Queue("notifications", {
  ...defaultOpts,
  defaultJobOptions: {
    ...defaultOpts.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  },
});

export const emailQueue = new Queue("emails", {
  ...defaultOpts,
  defaultJobOptions: {
    ...defaultOpts.defaultJobOptions,
    attempts: 5,
    backoff: { type: "exponential", delay: 30000 }, // 30s, 1m, 2m, 4m, 8m
  },
});

export const paymentQueue = new Queue("payments", {
  ...defaultOpts,
  defaultJobOptions: {
    ...defaultOpts.defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

export const reconciliationQueue = new Queue("reconciliation", {
  ...defaultOpts,
  defaultJobOptions: {
    ...defaultOpts.defaultJobOptions,
    attempts: 1,
  },
});

export const antiFraudQueue = new Queue("anti-fraud", {
  ...defaultOpts,
  defaultJobOptions: {
    ...defaultOpts.defaultJobOptions,
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  },
});

// ==================== GRACEFUL SHUTDOWN ====================

export async function closeAllQueues(): Promise<void> {
  await Promise.all([
    notificationQueue.close(),
    emailQueue.close(),
    paymentQueue.close(),
    reconciliationQueue.close(),
    antiFraudQueue.close(),
  ]);
}
```

**Step 4: Criar producers.ts**

Criar `backend/src/queues/producers.ts`:

```typescript
import { notificationQueue, emailQueue, paymentQueue, reconciliationQueue, antiFraudQueue } from "./queues";
import { createLogger } from "../lib/logger";

const log = createLogger("producers");

// ==================== TYPES ====================

export interface NotificationJobData {
  userId: number;
  type: string;
  title: string;
  message: string;
  serviceOrderId?: number;
  metadata?: Record<string, any>;
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: "verification" | "passwordReset" | "welcome";
  templateData?: Record<string, any>;
}

export interface PaymentWebhookJobData {
  mpPaymentId: string;
  action: string;
  idempotencyKey: string;
  rawPayload: Record<string, any>;
  receivedAt: string;
}

export interface PaymentReleaseJobData {
  paymentId: number;
  forcedByAdmin: boolean;
  actorId?: number;
}

export interface ReconciliationJobData {
  type: "daily" | "manual";
  triggeredBy?: number; // admin userId
}

export interface AntiFraudJobData {
  userId: number;
  action: string;
  metadata: Record<string, any>;
}

// ==================== PRODUCERS ====================

/**
 * Enfileira uma notificação. Fallback síncrono se Redis falhar.
 */
export async function enqueueNotification(data: NotificationJobData): Promise<boolean> {
  try {
    await notificationQueue.add("create-notification", data, {
      jobId: `notif-${data.userId}-${data.type}-${Date.now()}`,
    });
    return true;
  } catch (err) {
    log.warn({ err, data }, "Failed to enqueue notification — will be handled by fallback");
    return false;
  }
}

/**
 * Enfileira um email.
 */
export async function enqueueEmail(data: EmailJobData): Promise<boolean> {
  try {
    await emailQueue.add("send-email", data, {
      jobId: `email-${data.to}-${Date.now()}`,
    });
    return true;
  } catch (err) {
    log.warn({ err, data: { to: data.to, subject: data.subject } }, "Failed to enqueue email — will be handled by fallback");
    return false;
  }
}

/**
 * Enfileira processamento de webhook de pagamento.
 */
export async function enqueuePaymentWebhook(data: PaymentWebhookJobData): Promise<boolean> {
  try {
    await paymentQueue.add("process-webhook", data, {
      jobId: `webhook-${data.idempotencyKey}`,
    });
    return true;
  } catch (err) {
    log.error({ err, data }, "CRITICAL: Failed to enqueue payment webhook");
    return false;
  }
}

/**
 * Enfileira liberação de pagamento.
 */
export async function enqueuePaymentRelease(data: PaymentReleaseJobData): Promise<boolean> {
  try {
    await paymentQueue.add("release-payment", data, {
      jobId: `release-${data.paymentId}-${Date.now()}`,
    });
    return true;
  } catch (err) {
    log.error({ err, data }, "Failed to enqueue payment release");
    return false;
  }
}

/**
 * Enfileira reconciliação.
 */
export async function enqueueReconciliation(data: ReconciliationJobData): Promise<boolean> {
  try {
    await reconciliationQueue.add("reconcile", data);
    return true;
  } catch (err) {
    log.error({ err }, "Failed to enqueue reconciliation");
    return false;
  }
}

/**
 * Enfileira verificação anti-fraude.
 */
export async function enqueueAntiFraudCheck(data: AntiFraudJobData): Promise<boolean> {
  try {
    await antiFraudQueue.add("check", data);
    return true;
  } catch (err) {
    log.warn({ err }, "Failed to enqueue anti-fraud check");
    return false;
  }
}
```

**Step 5: Verificar tipo check**

```bash
cd backend && npx tsc --noEmit
```

Expected: Sem erros.

**Step 6: Commit**

```bash
git add backend/src/queues/ backend/package.json backend/package-lock.json
git commit -m "feat: add BullMQ queue infrastructure with Redis connection"
```

---

## Task 4: Criar Workers

**Files:**
- Create: `backend/src/workers/index.ts`
- Create: `backend/src/workers/notificationWorker.ts`
- Create: `backend/src/workers/emailWorker.ts`
- Create: `backend/src/workers/paymentWorker.ts`
- Create: `backend/src/workers/reconciliationWorker.ts`
- Create: `backend/src/workers/antiFraudWorker.ts`
- Modify: `backend/package.json` (novo script `worker`)

**Step 1: Criar notificationWorker.ts**

Criar `backend/src/workers/notificationWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/connection";
import type { NotificationJobData } from "../queues/producers";
import prisma from "../lib/prisma";
import { emitToUser } from "../lib/socket";
import { createLogger } from "../lib/logger";

const log = createLogger("notificationWorker");

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { userId, type, title, message, serviceOrderId, metadata } = job.data;

  log.info({ jobId: job.id, userId, type }, "Processing notification");

  // 1. Criar no banco
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

  // 2. Emitir via Socket.io (best-effort)
  try {
    emitToUser(userId, "notification:new", {
      id: notification.id,
      type,
      title,
      message,
      serviceOrderId,
    });
  } catch (err) {
    log.warn({ err, userId }, "Failed to emit socket notification — DB record created");
  }

  log.info({ jobId: job.id, notificationId: notification.id }, "Notification processed");
}

export function createNotificationWorker(): Worker {
  const worker = new Worker("notifications", processNotification, {
    connection: redisConnectionOptions,
    concurrency: 10,
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Notification job failed");
  });

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Notification job completed");
  });

  return worker;
}
```

**Step 2: Criar emailWorker.ts**

Criar `backend/src/workers/emailWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/connection";
import type { EmailJobData } from "../queues/producers";
import { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../services/emailService";
import { createLogger } from "../lib/logger";

const log = createLogger("emailWorker");

async function processEmail(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html, text, template, templateData } = job.data;

  log.info({ jobId: job.id, to, subject, template }, "Processing email");

  let result;

  if (template && templateData) {
    switch (template) {
      case "verification":
        result = await sendVerificationEmail(to, templateData.name, templateData.verifyUrl);
        break;
      case "passwordReset":
        result = await sendPasswordResetEmail(to, templateData.name, templateData.resetUrl);
        break;
      case "welcome":
        result = await sendWelcomeEmail(to, templateData.name, templateData.loginUrl);
        break;
      default:
        result = await sendEmail({ to, subject, html, text });
    }
  } else {
    result = await sendEmail({ to, subject, html, text });
  }

  if (!result.success) {
    throw new Error(`Email failed: ${result.error}`);
  }

  log.info({ jobId: job.id, messageId: result.messageId }, "Email sent");
}

export function createEmailWorker(): Worker {
  const worker = new Worker("emails", processEmail, {
    connection: redisConnectionOptions,
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err, to: job?.data?.to }, "Email job failed");
  });

  return worker;
}
```

**Step 3: Criar paymentWorker.ts (stub — lógica completa no Task 6)**

Criar `backend/src/workers/paymentWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/connection";
import type { PaymentWebhookJobData, PaymentReleaseJobData } from "../queues/producers";
import { createLogger } from "../lib/logger";

const log = createLogger("paymentWorker");

async function processPaymentJob(job: Job): Promise<void> {
  switch (job.name) {
    case "process-webhook":
      await processWebhook(job as Job<PaymentWebhookJobData>);
      break;
    case "release-payment":
      await processRelease(job as Job<PaymentReleaseJobData>);
      break;
    case "auto-release-check":
      await processAutoReleaseCheck();
      break;
    case "check-expired-orders":
      await processExpiredOrdersCheck();
      break;
    case "send-deadline-warnings":
      await processDeadlineWarnings();
      break;
    default:
      log.warn({ jobName: job.name }, "Unknown payment job type");
  }
}

async function processWebhook(job: Job<PaymentWebhookJobData>): Promise<void> {
  // Implementado no Task 6 (Payment Event Store)
  log.info({ jobId: job.id, mpPaymentId: job.data.mpPaymentId }, "Processing webhook — stub");
}

async function processRelease(job: Job<PaymentReleaseJobData>): Promise<void> {
  const { releasePaymentFromEscrow } = await import("../services/escrowService");
  const result = await releasePaymentFromEscrow(job.data.paymentId, job.data.forcedByAdmin);
  if (!result.success) {
    throw new Error(`Release failed: ${result.error}`);
  }
  log.info({ jobId: job.id, paymentId: job.data.paymentId }, "Payment released from escrow");
}

async function processAutoReleaseCheck(): Promise<void> {
  const { checkAutoReleasablePayments } = await import("../services/escrowService");
  const count = await checkAutoReleasablePayments();
  if (count > 0) {
    log.info({ count }, "Auto-released payments from escrow");
  }
}

async function processExpiredOrdersCheck(): Promise<void> {
  const { checkExpiredOrders } = await import("../services/escrowService");
  const count = await checkExpiredOrders();
  if (count > 0) {
    log.info({ count }, "Marked orders as expired");
  }
}

async function processDeadlineWarnings(): Promise<void> {
  const { sendDeadlineWarnings } = await import("../services/escrowService");
  const count = await sendDeadlineWarnings(1);
  if (count > 0) {
    log.info({ count }, "Sent deadline warnings");
  }
}

export function createPaymentWorker(): Worker {
  const worker = new Worker("payments", processPaymentJob, {
    connection: redisConnectionOptions,
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, jobName: job?.name, err }, "Payment job failed");
  });

  return worker;
}
```

**Step 4: Criar reconciliationWorker.ts (stub — lógica completa no Task 7)**

Criar `backend/src/workers/reconciliationWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/connection";
import type { ReconciliationJobData } from "../queues/producers";
import { createLogger } from "../lib/logger";

const log = createLogger("reconciliationWorker");

async function processReconciliation(job: Job<ReconciliationJobData>): Promise<void> {
  log.info({ jobId: job.id, type: job.data.type }, "Starting reconciliation");

  // Implementado no Task 7
  // 1. Buscar todos os Payment com status HELD ou PENDING > 24h
  // 2. Para cada um, consultar API do MercadoPago
  // 3. Comparar status local vs remoto
  // 4. Se divergência, criar PaymentEvent RECONCILED e corrigir
  // 5. Gerar relatório e alertar admins

  log.info({ jobId: job.id }, "Reconciliation complete — stub");
}

export function createReconciliationWorker(): Worker {
  const worker = new Worker("reconciliation", processReconciliation, {
    connection: redisConnectionOptions,
    concurrency: 1, // Serial — apenas um job de reconciliação por vez
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Reconciliation job failed");
  });

  return worker;
}
```

**Step 5: Criar antiFraudWorker.ts**

Criar `backend/src/workers/antiFraudWorker.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "../queues/connection";
import type { AntiFraudJobData } from "../queues/producers";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("antiFraudWorker");

async function processAntiFraud(job: Job<AntiFraudJobData>): Promise<void> {
  const { userId, action, metadata } = job.data;

  log.info({ jobId: job.id, userId, action }, "Processing anti-fraud check");

  switch (action) {
    case "withdrawal-velocity":
      await checkWithdrawalVelocity(userId);
      break;
    case "login-anomaly":
      await checkLoginAnomaly(userId, metadata);
      break;
    default:
      log.debug({ action }, "Unknown anti-fraud action — skipping");
  }
}

async function checkWithdrawalVelocity(userId: number): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentWithdrawals = await prisma.transaction.count({
    where: {
      userId,
      type: "WITHDRAWAL",
      createdAt: { gte: oneDayAgo },
    },
  });

  if (recentWithdrawals >= 5) {
    log.warn({ userId, recentWithdrawals }, "ALERT: Excessive withdrawal velocity");
    // Criar notificação para admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: "SYSTEM_ALERT",
          title: "Alerta Anti-Fraude",
          message: `Usuário #${userId} fez ${recentWithdrawals} saques nas últimas 24h.`,
          metadata: { alertType: "withdrawal-velocity", targetUserId: userId },
        },
      });
    }
  }
}

async function checkLoginAnomaly(userId: number, metadata: Record<string, any>): Promise<void> {
  // Verificação básica de anomalia de login
  log.debug({ userId, ip: metadata.ip }, "Login anomaly check — basic implementation");
}

export function createAntiFraudWorker(): Worker {
  const worker = new Worker("anti-fraud", processAntiFraud, {
    connection: redisConnectionOptions,
    concurrency: 3,
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Anti-fraud job failed");
  });

  return worker;
}
```

**Step 6: Criar worker entry point (index.ts)**

Criar `backend/src/workers/index.ts`:

```typescript
import "dotenv/config";
import { createNotificationWorker } from "./notificationWorker";
import { createEmailWorker } from "./emailWorker";
import { createPaymentWorker } from "./paymentWorker";
import { createReconciliationWorker } from "./reconciliationWorker";
import { createAntiFraudWorker } from "./antiFraudWorker";
import { createLogger } from "../lib/logger";
import prisma from "../lib/prisma";

const log = createLogger("worker-main");

log.info("Starting BullMQ workers...");

const workers = [
  createNotificationWorker(),
  createEmailWorker(),
  createPaymentWorker(),
  createReconciliationWorker(),
  createAntiFraudWorker(),
];

log.info(
  { workerCount: workers.length },
  "Workers started: notifications, emails, payments, reconciliation, anti-fraud",
);

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, "Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  log.info("All workers shut down");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  log.fatal({ err }, "Uncaught exception in worker");
  shutdown("UNCAUGHT_EXCEPTION");
});
```

**Step 7: Adicionar script worker ao package.json**

No `backend/package.json`, adicionar ao bloco `"scripts"`:
```json
"worker": "ts-node src/workers/index.ts"
```

**Step 8: Verificar tipo check**

```bash
cd backend && npx tsc --noEmit
```

**Step 9: Commit**

```bash
git add backend/src/workers/ backend/package.json
git commit -m "feat: add BullMQ workers for notifications, emails, payments, reconciliation, anti-fraud"
```

---

## Task 5: Migrar Scheduler de node-cron para BullMQ

**Files:**
- Create: `backend/src/scheduler/index.ts`
- Modify: `backend/src/index.ts` (remover node-cron, adicionar shutdown de filas)
- Modify: `backend/package.json` (novo script `scheduler`)

**Step 1: Criar scheduler/index.ts**

Criar `backend/src/scheduler/index.ts`:

```typescript
import "dotenv/config";
import { paymentQueue, notificationQueue, reconciliationQueue } from "../queues/queues";
import { createLogger } from "../lib/logger";

const log = createLogger("scheduler");

async function registerRepeatableJobs(): Promise<void> {
  log.info("Registering repeatable jobs...");

  // Auto-release escrow — hourly
  await paymentQueue.add(
    "auto-release-check",
    {},
    { repeat: { pattern: "0 * * * *" }, jobId: "repeat:auto-release" },
  );

  // Check expired orders — every 6 hours
  await paymentQueue.add(
    "check-expired-orders",
    {},
    { repeat: { pattern: "0 */6 * * *" }, jobId: "repeat:expired-orders" },
  );

  // Deadline warnings — every 12 hours
  await paymentQueue.add(
    "send-deadline-warnings",
    {},
    { repeat: { pattern: "0 */12 * * *" }, jobId: "repeat:deadline-warnings" },
  );

  // Late professionals check — every minute
  await notificationQueue.add(
    "check-late-professionals",
    {},
    { repeat: { pattern: "* * * * *" }, jobId: "repeat:late-professionals" },
  );

  // Daily reconciliation with MercadoPago — 3AM
  await reconciliationQueue.add(
    "reconcile",
    { type: "daily" },
    { repeat: { pattern: "0 3 * * *" }, jobId: "repeat:reconciliation" },
  );

  // Cleanup old archived notifications — Sunday 4AM
  await notificationQueue.add(
    "cleanup-old-notifications",
    {},
    { repeat: { pattern: "0 4 * * 0" }, jobId: "repeat:cleanup-notifications" },
  );

  log.info("All repeatable jobs registered successfully");
}

registerRepeatableJobs()
  .then(() => {
    log.info("Scheduler started — repeatable jobs registered in Redis");
    // Scheduler can exit after registering — BullMQ persists repeat config in Redis
    // Or keep alive for monitoring:
    log.info("Scheduler process staying alive for monitoring...");
  })
  .catch((err) => {
    log.fatal({ err }, "Failed to register repeatable jobs");
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGTERM", async () => {
  log.info("Scheduler shutting down...");
  process.exit(0);
});
process.on("SIGINT", async () => {
  log.info("Scheduler shutting down...");
  process.exit(0);
});
```

**Step 2: Atualizar index.ts para remover node-cron**

No `backend/src/index.ts`:

1. Remover imports:
   - `import { startScheduledTasks, stopScheduledTasks } from "./lib/scheduler";`
   - `import { scheduleDailySalaries, stopSalaryCron } from "./services/companyCronService";`

2. Adicionar imports:
   - `import { closeAllQueues } from "./queues/queues";`
   - `import { closeRedisClient } from "./queues/connection";`

3. No `gracefulShutdown`, substituir `stopScheduledTasks()` e `stopSalaryCron()` por:
   ```typescript
   await closeAllQueues();
   await closeRedisClient();
   ```

4. No callback de `httpServer.listen()`, remover:
   - `startScheduledTasks();`
   - `scheduleDailySalaries();`

**Step 3: Adicionar script scheduler ao package.json**

No `backend/package.json`, adicionar ao bloco `"scripts"`:
```json
"scheduler": "ts-node src/scheduler/index.ts"
```

**Step 4: Rodar testes**

```bash
cd backend && npm test
```

**Step 5: Commit**

```bash
git add backend/src/scheduler/ backend/src/index.ts backend/package.json
git commit -m "feat: migrate from node-cron to BullMQ scheduler with repeatable jobs"
```

---

## Task 6: Payment Event Store, State Machine e Idempotência

**Files:**
- Modify: `backend/prisma/schema.prisma` (adicionar PaymentEvent, enums)
- Create: `backend/src/lib/paymentStateMachine.ts`
- Modify: `backend/src/workers/paymentWorker.ts` (implementar webhook processing)
- Modify: `backend/src/controllers/service/paymentController.ts` (webhook idempotente)
- Modify: `backend/src/config/env.ts` (REDIS_URL)

**Step 1: Adicionar modelos ao schema.prisma**

No final do `backend/prisma/schema.prisma`, adicionar:

```prisma
// ==================== PAYMENT EVENT STORE ====================

model PaymentEvent {
  id              Int              @id @default(autoincrement())
  paymentId       Int
  payment         Payment          @relation(fields: [paymentId], references: [id])
  eventType       PaymentEventType
  previousStatus  String?
  newStatus       String
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

Também adicionar relação no model `Payment` existente:
```prisma
// Dentro do model Payment, adicionar:
events PaymentEvent[]
```

Aplicar:
```bash
cd backend && npx prisma db push && npx prisma generate
```

**Step 2: Criar paymentStateMachine.ts**

Criar `backend/src/lib/paymentStateMachine.ts`:

```typescript
import prisma from "./prisma";
import { getRedisClient } from "../queues/connection";
import { createLogger } from "./logger";

const log = createLogger("paymentStateMachine");

// Transições válidas: status atual → [status permitidos]
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["HELD", "FAILED"],
  HELD: ["RELEASED", "REFUNDED", "PARTIALLY_REFUNDED", "DISPUTED"],
  DISPUTED: ["RELEASED", "REFUNDED"],
};

interface TransitionParams {
  paymentId: number;
  newStatus: string;
  eventType: string;
  source: "WEBHOOK" | "INTERNAL" | "ADMIN" | "SCHEDULER";
  idempotencyKey: string;
  amount?: number;
  metadata?: Record<string, any>;
  actorId?: number;
  ipAddress?: string;
}

interface TransitionResult {
  success: boolean;
  duplicate?: boolean;
  error?: string;
  event?: any;
}

/**
 * Transiciona um pagamento para novo status com event store.
 * Garante idempotência via Redis (5min) + DB UNIQUE constraint.
 */
export async function transitionPaymentStatus(params: TransitionParams): Promise<TransitionResult> {
  const { paymentId, newStatus, eventType, source, idempotencyKey, amount, metadata, actorId, ipAddress } = params;

  // 1. Redis dedup (camada rápida, TTL 5min)
  try {
    const redis = getRedisClient();
    const redisKey = `dedup:payment:${idempotencyKey}`;
    const exists = await redis.set(redisKey, "1", "EX", 300, "NX"); // SET NX = only if not exists
    if (!exists) {
      log.info({ idempotencyKey }, "Duplicate payment event rejected (Redis)");
      return { success: true, duplicate: true };
    }
  } catch (err) {
    // Redis down — continue com DB check
    log.warn({ err }, "Redis dedup unavailable — falling back to DB only");
  }

  // 2. Buscar pagamento atual
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true },
  });

  if (!payment) {
    return { success: false, error: `Payment ${paymentId} not found` };
  }

  // 3. Validar transição
  const currentStatus = payment.status;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    log.warn(
      { paymentId, currentStatus, newStatus },
      "Invalid payment status transition",
    );
    return {
      success: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  // 4. Transação atômica: criar evento + atualizar status
  try {
    const [event] = await prisma.$transaction([
      prisma.paymentEvent.create({
        data: {
          paymentId,
          eventType: eventType as any,
          previousStatus: currentStatus,
          newStatus,
          idempotencyKey,
          amount,
          metadata: metadata ?? undefined,
          source: source as any,
          actorId,
          ipAddress,
        },
      }),
      prisma.payment.update({
        where: { id: paymentId },
        data: { status: newStatus as any },
      }),
    ]);

    log.info(
      { paymentId, from: currentStatus, to: newStatus, eventId: event.id },
      "Payment status transitioned",
    );

    return { success: true, event };
  } catch (err: any) {
    // UNIQUE constraint violation = duplicate
    if (err.code === "P2002" && err.meta?.target?.includes("idempotencyKey")) {
      log.info({ idempotencyKey }, "Duplicate payment event rejected (DB)");
      return { success: true, duplicate: true };
    }
    throw err;
  }
}

/**
 * Busca histórico de eventos de um pagamento.
 */
export async function getPaymentEventHistory(paymentId: number) {
  return prisma.paymentEvent.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" },
  });
}
```

**Step 3: Atualizar env.ts com REDIS_URL**

No `backend/src/config/env.ts`, adicionar ao interface `EnvConfig`:
```typescript
REDIS_URL: string;
```

E no `getEnvConfig()`:
```typescript
REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
```

**Step 4: Atualizar paymentController.ts — webhook idempotente**

No `backend/src/controllers/service/paymentController.ts`, reescrever a função `mercadoPagoWebhook` para:
1. Validar assinatura
2. Gerar idempotencyKey
3. Retornar 200 imediatamente
4. Enfileirar job no paymentQueue

Substituir a função `mercadoPagoWebhook` (atualmente linhas ~549-749):

```typescript
export const mercadoPagoWebhook = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";

  try {
    // 1. Validar assinatura HMAC
    const validation = validateMercadoPagoSignature({
      xSignature: req.headers["x-signature"] as string,
      xRequestId: req.headers["x-request-id"] as string,
      dataId: req.query["data.id"] as string,
      secret: env.MP_WEBHOOK_SECRET,
    });

    if (!validation.valid) {
      log.warn({ reason: validation.reason, ip }, "Webhook signature invalid");
      res.status(200).json({ received: false });
      return;
    }

    // 2. Extrair dados
    const { type, data, action } = req.body;
    const mpPaymentId = data?.id || req.query["data.id"];

    if (!mpPaymentId) {
      log.warn({ body: req.body }, "Webhook missing payment ID");
      res.status(200).json({ received: true });
      return;
    }

    // Filtrar — só processar eventos de payment
    if (type !== "payment" && !action?.startsWith("payment.")) {
      log.debug({ type, action }, "Webhook ignored — not a payment event");
      res.status(200).json({ received: true });
      return;
    }

    // 3. Gerar idempotency key
    const eventAction = action || type || "unknown";
    const idempotencyKey = `mp:${mpPaymentId}:${eventAction}`;

    // 4. Enfileirar para processamento assíncrono
    const { enqueuePaymentWebhook } = await import("../../queues/producers");
    const enqueued = await enqueuePaymentWebhook({
      mpPaymentId: String(mpPaymentId),
      action: eventAction,
      idempotencyKey,
      rawPayload: req.body,
      receivedAt: new Date().toISOString(),
    });

    if (!enqueued) {
      // Fallback: processar inline se Redis falhar
      log.warn("Redis unavailable — processing webhook inline");
      // Manter lógica original como fallback (importar do paymentWorker)
    }

    // 5. Responder imediatamente (< 500ms)
    res.status(200).json({ received: true });
  } catch (error) {
    log.error({ err: error, ip }, "Webhook processing error");
    res.status(200).json({ received: true }); // Sempre 200 para MP
  }
};
```

**Step 5: Implementar webhook processing no paymentWorker.ts**

Atualizar a função `processWebhook` no `backend/src/workers/paymentWorker.ts` com a lógica que estava no controller (buscar status no MP, atualizar pagamento local, notificar).

Esta é a parte mais complexa — mover a lógica das linhas ~596-749 do paymentController para o worker, usando `transitionPaymentStatus` em vez de updates diretos.

**Step 6: Push schema e testar**

```bash
cd backend && npx prisma db push && npx prisma generate
cd backend && npx tsc --noEmit
cd backend && npm test
```

**Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/lib/paymentStateMachine.ts backend/src/controllers/service/paymentController.ts backend/src/workers/paymentWorker.ts backend/src/config/env.ts
git commit -m "feat: add payment event store with state machine and idempotent webhook"
```

---

## Task 7: Migrar Notificações e Emails para Filas

**Files:**
- Modify: `backend/src/services/notificationService.ts`
- Modify: `backend/src/services/emailService.ts`
- Modify: `backend/src/controllers/authController.ts`
- Modify controllers com `createNotification` local: `paymentController.ts`, `orderController.ts`, `messageController.ts`, `reviewController.ts`

**Step 1: Atualizar notificationService.ts**

A função `createNotification` passa a enfileirar em vez de executar inline. Adicionar fallback síncrono:

```typescript
import { enqueueNotification } from "../queues/producers";

export const createNotification = async (
  userId: number,
  type: PrismaNotificationType,
  title: string,
  message: string,
  serviceOrderId?: number,
  metadata?: Record<string, any>
): Promise<any> => {
  // Tentar enfileirar (assíncrono)
  const enqueued = await enqueueNotification({
    userId,
    type,
    title,
    message,
    serviceOrderId,
    metadata,
  });

  if (enqueued) {
    // Retornar placeholder — notificação será criada pelo worker
    return { id: 0, queued: true };
  }

  // FALLBACK: Redis indisponível — executar inline (comportamento original)
  log.warn("Notification fallback to sync mode");
  const notification = await prisma.notification.create({
    data: {
      type,
      title,
      message,
      status: "UNREAD",
      userId,
      serviceOrderId: serviceOrderId || null,
      metadata: metadata ?? undefined,
    },
  });

  try {
    emitToUser(userId, "notification:new", {
      id: notification.id, type, title, message, serviceOrderId,
    });
  } catch (err) {
    log.warn({ err }, "Socket emit failed in fallback mode");
  }

  return notification;
};
```

**Step 2: Remover `createNotification` locais dos controllers**

Em cada um dos 4 controllers que definem sua própria `createNotification`:
- `paymentController.ts` (linhas 48-70)
- `orderController.ts` (linha ~67)
- `messageController.ts` (linha ~48)
- `reviewController.ts` (linha ~33)

Remover a definição local e adicionar import do service:
```typescript
import { createNotification, NotificationType } from "../../services/notificationService";
```

**Step 3: Atualizar authController.ts para enfileirar emails**

Substituir chamadas diretas a `sendVerificationEmail`, `sendPasswordResetEmail`, `sendWelcomeEmail` por `enqueueEmail`:

```typescript
import { enqueueEmail } from "../queues/producers";

// Em register (linha ~227):
// De: sendVerificationEmail(email, name, verifyUrl).catch(...)
// Para:
await enqueueEmail({
  to: email,
  subject: "Verifique seu email",
  html: "",
  template: "verification",
  templateData: { name, verifyUrl },
});

// Mesmo padrão para forgotPassword e verifyEmail
```

**Step 4: Verificar e testar**

```bash
cd backend && npx tsc --noEmit
cd backend && npm test
```

**Step 5: Commit**

```bash
git add backend/src/services/notificationService.ts backend/src/services/emailService.ts backend/src/controllers/
git commit -m "feat: migrate notifications and emails to async BullMQ queues with sync fallback"
```

---

## Task 8: MFA TOTP

**Files:**
- Modify: `backend/prisma/schema.prisma` (adicionar UserMFA)
- Create: `backend/src/controllers/mfaController.ts`
- Create: `backend/src/routes/mfaRoutes.ts`
- Create: `backend/src/middleware/mfa.ts`
- Modify: `backend/src/controllers/authController.ts` (login com MFA)
- Modify: `backend/src/index.ts` (registrar rotas MFA)
- Modify: `backend/src/config/env.ts` (MFA_ENCRYPTION_KEY)

**Step 1: Instalar dependências**

```bash
cd backend && npm install otplib qrcode
npm install -D @types/qrcode
```

**Step 2: Adicionar model UserMFA ao schema.prisma**

```prisma
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

Adicionar relação no model `User`:
```prisma
mfa UserMFA?
```

Aplicar:
```bash
cd backend && npx prisma db push && npx prisma generate
```

**Step 3: Adicionar MFA_ENCRYPTION_KEY ao env.ts**

No interface `EnvConfig`:
```typescript
MFA_ENCRYPTION_KEY: string;
```

No `getEnvConfig()`:
```typescript
MFA_ENCRYPTION_KEY: (() => {
  const key = process.env.MFA_ENCRYPTION_KEY;
  if (nodeEnv === 'production' && (!key || key.length < 32)) {
    throw new Error('FATAL: MFA_ENCRYPTION_KEY must be set (min 32 chars) in production');
  }
  return key || crypto.randomBytes(32).toString('hex');
})(),
```

**Step 4: Criar mfaController.ts**

Criar `backend/src/controllers/mfaController.ts` com funções:
- `setupMFA` — gera secret, retorna QR code
- `verifyMFASetup` — confirma primeiro código, gera backup codes
- `validateMFA` — valida código no login
- `disableMFA` — desativa (requer código)
- `regenerateBackupCodes` — gera novos backup codes

Usar `otplib.authenticator` para gerar/verificar TOTP. Encriptar secret com AES-256-GCM usando `MFA_ENCRYPTION_KEY`. Gerar QR code com `qrcode.toDataURL(otpauthUrl)`.

**Step 5: Criar middleware/mfa.ts**

Middleware `requireMFA` que verifica header `X-MFA-Code` para ações críticas:

```typescript
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import prisma from "../lib/prisma";
import { authenticator } from "otplib";
import { createLogger } from "../lib/logger";
// + decrypt function para o secret

const log = createLogger("mfa");

export const requireMFA = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }

  const mfaCode = req.headers["x-mfa-code"] as string;
  const userMfa = await prisma.userMFA.findUnique({
    where: { userId: req.user.id },
  });

  // Se não tem MFA configurado, permitir (exceto admins)
  if (!userMfa?.isEnabled) {
    if (req.user.role === "ADMIN") {
      res.status(403).json({
        success: false,
        message: "MFA obrigatório para administradores. Configure em Configurações.",
        mfaRequired: true,
      });
      return;
    }
    next();
    return;
  }

  if (!mfaCode) {
    res.status(403).json({
      success: false,
      message: "Código MFA necessário",
      mfaRequired: true,
    });
    return;
  }

  // Verificar TOTP
  const decryptedSecret = decryptSecret(userMfa.secret); // Implementar decrypt
  const isValid = authenticator.verify({ token: mfaCode, secret: decryptedSecret });

  if (!isValid) {
    // Tentar backup codes
    // ... verificar contra backupCodes hasheados
    res.status(403).json({ success: false, message: "Código MFA inválido" });
    return;
  }

  // Atualizar lastUsedAt
  await prisma.userMFA.update({
    where: { userId: req.user.id },
    data: { lastUsedAt: new Date() },
  });

  next();
};
```

**Step 6: Criar routes/mfaRoutes.ts**

```typescript
import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { setupMFA, verifyMFASetup, validateMFA, disableMFA, regenerateBackupCodes } from "../controllers/mfaController";

const router = Router();

router.post("/setup", verifyToken, setupMFA);
router.post("/verify-setup", verifyToken, verifyMFASetup);
router.post("/validate", validateMFA); // Não precisa de verifyToken — usa mfaToken
router.post("/disable", verifyToken, disableMFA);
router.post("/backup-codes/regenerate", verifyToken, regenerateBackupCodes);

export default router;
```

**Step 7: Atualizar authController.ts — login com MFA**

No fluxo de login, após validar senha, verificar se user tem MFA:
```typescript
// Após line 309 (generateToken):
const userMfa = await prisma.userMFA.findUnique({ where: { userId: user.id } });
if (userMfa?.isEnabled) {
  // Não emitir tokens reais — emitir token temporário MFA
  const mfaToken = jwt.sign(
    { id: user.id, type: "mfa-challenge" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "5m" },
  );
  res.json({
    success: true,
    message: "MFA required",
    data: { mfaRequired: true, mfaToken },
  });
  return;
}
// Caso contrário, continuar login normal...
```

**Step 8: Registrar rotas MFA no index.ts**

```typescript
import mfaRoutes from "./routes/mfaRoutes";
// ...
app.use("/api/auth/mfa", mfaRoutes);
```

**Step 9: Aplicar requireMFA em rotas críticas**

- `walletRoutes.ts`: adicionar `requireMFA` em `POST /withdraw`
- `authRoutes.ts`: adicionar `requireMFA` em `PUT /change-password`

**Step 10: Testar e commit**

```bash
cd backend && npx prisma db push && npx prisma generate
cd backend && npx tsc --noEmit
cd backend && npm test
git add .
git commit -m "feat: add MFA TOTP authentication with backup codes"
```

---

## Task 9: Reconciliação Diária com MercadoPago

**Files:**
- Modify: `backend/src/workers/reconciliationWorker.ts`
- Modify: `backend/src/workers/paymentWorker.ts` (webhook processing completo)

**Step 1: Implementar reconciliationWorker completo**

```typescript
async function processReconciliation(job: Job<ReconciliationJobData>): Promise<void> {
  log.info({ jobId: job.id, type: job.data.type }, "Starting reconciliation");

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Buscar pagamentos pendentes/held > 24h
  const payments = await prisma.payment.findMany({
    where: {
      status: { in: ["PENDING", "HELD"] },
      createdAt: { lt: oneDayAgo },
      transactionId: { not: null },
    },
    select: { id: true, status: true, transactionId: true, amount: true },
  });

  let synced = 0;
  let divergent = 0;
  let errors = 0;

  for (const payment of payments) {
    try {
      const mpStatus = await getMPPaymentStatus(payment.transactionId!);

      // Mapear status MP para status local
      const expectedLocalStatus = mapMPStatusToLocal(mpStatus.status);

      if (expectedLocalStatus && expectedLocalStatus !== payment.status) {
        divergent++;
        log.warn(
          { paymentId: payment.id, local: payment.status, mp: mpStatus.status, expected: expectedLocalStatus },
          "Payment status divergence found",
        );

        // Criar evento de reconciliação
        await transitionPaymentStatus({
          paymentId: payment.id,
          newStatus: expectedLocalStatus,
          eventType: "RECONCILED",
          source: "SCHEDULER",
          idempotencyKey: `reconcile:${payment.id}:${new Date().toISOString().split("T")[0]}`,
          metadata: { mpStatus: mpStatus.status, localStatus: payment.status },
        });
      } else {
        synced++;
      }
    } catch (err) {
      errors++;
      log.error({ err, paymentId: payment.id }, "Reconciliation error for payment");
    }
  }

  // Alertar admins se divergências
  if (divergent > 0) {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const admin of admins) {
      await enqueueNotification({
        userId: admin.id,
        type: "SYSTEM_ALERT",
        title: "Reconciliação: Divergências Encontradas",
        message: `Reconciliação diária: ${synced} OK, ${divergent} divergências corrigidas, ${errors} erros. Total: ${payments.length} pagamentos analisados.`,
        metadata: { synced, divergent, errors, total: payments.length },
      });
    }
  }

  log.info({ total: payments.length, synced, divergent, errors }, "Reconciliation complete");
}

function mapMPStatusToLocal(mpStatus: string): string | null {
  switch (mpStatus) {
    case "approved": return "HELD";
    case "rejected":
    case "cancelled": return "FAILED";
    case "refunded": return "REFUNDED";
    default: return null;
  }
}
```

**Step 2: Commit**

```bash
git add backend/src/workers/reconciliationWorker.ts
git commit -m "feat: implement daily MercadoPago reconciliation with divergence alerts"
```

---

## Task 10: Circuit Breaker para MercadoPago

**Files:**
- Create: `backend/src/lib/circuitBreaker.ts`
- Modify: `backend/src/services/mercadopagoService.ts`

**Step 1: Instalar opossum**

```bash
cd backend && npm install opossum
npm install -D @types/opossum
```

**Step 2: Criar circuitBreaker.ts**

```typescript
import CircuitBreaker from "opossum";
import { createLogger } from "./logger";

const log = createLogger("circuitBreaker");

export function createCircuitBreaker<T>(
  fn: (...args: any[]) => Promise<T>,
  name: string,
  options?: Partial<CircuitBreaker.Options>,
): CircuitBreaker {
  const breaker = new CircuitBreaker(fn, {
    timeout: 10000,         // 10s timeout
    errorThresholdPercentage: 50, // Open after 50% failures
    resetTimeout: 30000,    // Try again after 30s
    volumeThreshold: 5,     // Min 5 requests before evaluating
    ...options,
  });

  breaker.on("open", () => log.warn({ name }, "Circuit breaker OPENED"));
  breaker.on("halfOpen", () => log.info({ name }, "Circuit breaker HALF-OPEN"));
  breaker.on("close", () => log.info({ name }, "Circuit breaker CLOSED"));
  breaker.on("fallback", () => log.warn({ name }, "Circuit breaker fallback triggered"));

  return breaker;
}
```

**Step 3: Wrapping MercadoPago com circuit breaker**

No `mercadopagoService.ts`, wrap as funções que chamam a API do MP:

```typescript
import { createCircuitBreaker } from "../lib/circuitBreaker";

const mpBreaker = createCircuitBreaker(
  async (fn: () => Promise<any>) => fn(),
  "mercadopago",
  { timeout: 15000, resetTimeout: 60000 },
);

// Uso:
export async function getMPPaymentStatus(mpPaymentId: string) {
  return mpBreaker.fire(async () => {
    const payment = getPaymentClient();
    const response = await payment.get({ id: mpPaymentId });
    return { /* ... campos ... */ };
  });
}
```

**Step 4: Commit**

```bash
git add backend/src/lib/circuitBreaker.ts backend/src/services/mercadopagoService.ts backend/package.json backend/package-lock.json
git commit -m "feat: add circuit breaker for MercadoPago API calls"
```

---

## Task 11: Health Checks Estendidos + Metrics

**Files:**
- Modify: `backend/src/index.ts` (health check)
- Create: `backend/src/lib/metrics.ts`

**Step 1: Instalar prom-client**

```bash
cd backend && npm install prom-client
```

**Step 2: Criar metrics.ts**

Criar `backend/src/lib/metrics.ts`:

```typescript
import client from "prom-client";

// Coletar métricas default do Node.js
client.collectDefaultMetrics();

// Custom metrics
export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const httpRequestTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export const queueJobsTotal = new client.Counter({
  name: "queue_jobs_total",
  help: "Total number of queue jobs processed",
  labelNames: ["queue", "status"],
});

export const paymentEventsTotal = new client.Counter({
  name: "payment_events_total",
  help: "Total number of payment events",
  labelNames: ["event_type", "source"],
});

export const register = client.register;
```

**Step 3: Atualizar health check no index.ts**

Adicionar Redis e queue status ao `/health`:

```typescript
import { getRedisClient } from "./queues/connection";
import { notificationQueue, emailQueue, paymentQueue } from "./queues/queues";
import { register } from "./lib/metrics";

// Health check estendido
app.get("/health", localOnlyMiddleware, async (_req, res) => {
  const checks: Record<string, string> = {};

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Redis
  try {
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "error";
  }

  // Queues
  try {
    const [notifCounts, emailCounts, paymentCounts] = await Promise.all([
      notificationQueue.getJobCounts(),
      emailQueue.getJobCounts(),
      paymentQueue.getJobCounts(),
    ]);
    checks.queues = JSON.stringify({
      notifications: notifCounts,
      emails: emailCounts,
      payments: paymentCounts,
    });
  } catch {
    checks.queues = "error";
  }

  const isHealthy = checks.database === "ok" && checks.redis === "ok";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "healthy" : "degraded",
    ...checks,
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics endpoint
app.get("/metrics", localOnlyMiddleware, async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
```

**Step 4: Commit**

```bash
git add backend/src/lib/metrics.ts backend/src/index.ts backend/package.json backend/package-lock.json
git commit -m "feat: add extended health checks (Redis, queues) and Prometheus metrics"
```

---

## Task 12: Audit Log

**Files:**
- Modify: `backend/prisma/schema.prisma` (adicionar AuditLog)
- Create: `backend/src/middleware/auditLog.ts`

**Step 1: Adicionar model AuditLog ao schema.prisma**

```prisma
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
```

Adicionar relação no model `User`:
```prisma
auditLogs AuditLog[] @relation("auditLogs")
```

**Step 2: Criar middleware auditLog.ts**

```typescript
import prisma from "../lib/prisma";
import type { AuthRequest } from "./auth";
import { createLogger } from "../lib/logger";

const log = createLogger("audit");

export async function createAuditLog(params: {
  actorId: number;
  action: string;
  targetType: string;
  targetId: number;
  metadata?: Record<string, any>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params });
    log.info(
      { action: params.action, actorId: params.actorId, targetType: params.targetType, targetId: params.targetId },
      "Audit log created",
    );
  } catch (err) {
    log.error({ err, params }, "Failed to create audit log");
  }
}
```

**Step 3: Aplicar nos controllers admin e financeiros**

Adicionar `createAuditLog()` em:
- `adminController.ts` — approve/reject verification, ban user
- `walletController.ts` — withdraw
- `paymentController.ts` — release payment
- `mfaController.ts` — enable/disable MFA

**Step 4: Push schema, testar e commit**

```bash
cd backend && npx prisma db push && npx prisma generate
cd backend && npx tsc --noEmit
cd backend && npm test
git add .
git commit -m "feat: add audit log for admin and financial actions"
```

---

## Task 13: Secrets Management

**Files:**
- Create: `backend/src/config/secrets.ts`
- Modify: `backend/src/config/env.ts` (integrar com secrets)

**Step 1: Criar secrets.ts**

```typescript
import { createLogger } from "../lib/logger";

const log = createLogger("secrets");

type SecretsProvider = "env" | "aws" | "gcp" | "azure";

const SECRETS_PROVIDER = (process.env.SECRETS_PROVIDER || "env") as SecretsProvider;

const secretsCache = new Map<string, string>();
let lastReload = 0;
const RELOAD_INTERVAL_MS = 60 * 60 * 1000; // 1h

/**
 * Obtém um secret do provider configurado.
 * Em dev: lê de process.env (comportamento atual).
 * Em prod: lê do cloud provider secrets manager.
 */
export async function getSecret(key: string): Promise<string> {
  // Check cache
  if (secretsCache.has(key) && Date.now() - lastReload < RELOAD_INTERVAL_MS) {
    return secretsCache.get(key)!;
  }

  let value: string;

  switch (SECRETS_PROVIDER) {
    case "aws":
      value = await getAWSSecret(key);
      break;
    case "gcp":
      value = await getGCPSecret(key);
      break;
    case "azure":
      value = await getAzureSecret(key);
      break;
    case "env":
    default:
      value = process.env[key] || "";
  }

  secretsCache.set(key, value);
  lastReload = Date.now();
  return value;
}

async function getAWSSecret(key: string): Promise<string> {
  // Placeholder — implementar com @aws-sdk/client-secrets-manager quando em produção
  log.info({ key }, "AWS Secrets Manager — using env fallback for now");
  return process.env[key] || "";
}

async function getGCPSecret(key: string): Promise<string> {
  log.info({ key }, "GCP Secret Manager — using env fallback for now");
  return process.env[key] || "";
}

async function getAzureSecret(key: string): Promise<string> {
  log.info({ key }, "Azure Key Vault — using env fallback for now");
  return process.env[key] || "";
}

/**
 * Pre-carrega todos os secrets no boot.
 */
export async function preloadSecrets(): Promise<void> {
  const keys = [
    "JWT_SECRET", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET",
    "MP_ACCESS_TOKEN", "MP_CLIENT_SECRET", "MP_WEBHOOK_SECRET",
    "SMTP_PASS", "MFA_ENCRYPTION_KEY",
  ];

  for (const key of keys) {
    await getSecret(key);
  }

  log.info({ provider: SECRETS_PROVIDER, count: keys.length }, "Secrets preloaded");
}
```

**Step 2: Commit**

```bash
git add backend/src/config/secrets.ts
git commit -m "feat: add secrets management with cloud provider support"
```

---

## Task 14: Rate Limiting para Webhooks

**Files:**
- Modify: `backend/src/middleware/rateLimiter.ts`
- Modify: `backend/src/routes/paymentRoutes.ts`

**Step 1: Adicionar webhook rate limiter**

No `backend/src/middleware/rateLimiter.ts`, adicionar:

```typescript
/**
 * Rate limiter for webhooks.
 * 100 webhooks per minute per IP — prevents flood attacks.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many webhook requests",
    statusCode: 429,
  },
});
```

**Step 2: Aplicar na rota de webhook**

No `paymentRoutes.ts`, adicionar `webhookLimiter` antes do handler do webhook.

**Step 3: Commit**

```bash
git add backend/src/middleware/rateLimiter.ts backend/src/routes/paymentRoutes.ts
git commit -m "feat: add rate limiting for webhook endpoints"
```

---

## Task 15: Testes

**Files:**
- Create: `backend/tests/queues/producers.test.ts`
- Create: `backend/tests/lib/paymentStateMachine.test.ts`
- Create: `backend/tests/middleware/mfa.test.ts`
- Create: `backend/tests/workers/reconciliation.test.ts`

**Step 1: Teste do payment state machine**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
// Mock Prisma + Redis, test:
// - Transição válida PENDING → HELD funciona
// - Transição inválida PENDING → RELEASED é rejeitada
// - Idempotency key duplicada retorna { success: true, duplicate: true }
// - Evento é criado com campos corretos
```

**Step 2: Teste do MFA**

```typescript
import { describe, it, expect } from "vitest";
// Mock otplib, test:
// - Setup gera QR code válido
// - Verify aceita código correto
// - Verify rejeita código inválido
// - Backup code funciona uma vez
// - Admin sem MFA é bloqueado
```

**Step 3: Rodar todos os testes**

```bash
cd backend && npm test
```

**Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: add tests for payment state machine, MFA, and queue producers"
```

---

## Task 16: Atualizar CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Atualizar seções relevantes**

Atualizar as seções:
- **Comandos Essenciais**: adicionar `npm run worker`, `npm run scheduler`
- **Arquitetura**: atualizar diagrama com Worker e Scheduler
- **Banco de Dados**: PostgreSQL em vez de SQLite
- **Variáveis de Ambiente**: adicionar `REDIS_URL`, `MFA_ENCRYPTION_KEY`, `SECRETS_PROVIDER`
- **Gotchas**: remover ponto sobre SQLite, adicionar pontos sobre BullMQ, MFA, filas
- **O Que Precisa Ser Melhorado**: marcar itens resolvidos

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with PostgreSQL, BullMQ, MFA, and new architecture"
```

---

## Resumo de Ordem de Execução

| # | Task | Dependências | Estimativa |
|---|------|-------------|-----------|
| 1 | PostgreSQL + Redis (Docker/local) | Nenhuma | 15 min |
| 2 | Migrar Prisma SQLite → PostgreSQL | Task 1 | 20 min |
| 3 | BullMQ infra (connection, queues, producers) | Task 1 | 15 min |
| 4 | Workers (notification, email, payment, reconciliation, anti-fraud) | Task 3 | 30 min |
| 5 | Scheduler (node-cron → BullMQ repeat jobs) | Tasks 3, 4 | 15 min |
| 6 | Payment Event Store + State Machine + Idempotência | Tasks 2, 3 | 45 min |
| 7 | Migrar Notificações/Emails para filas | Tasks 3, 4 | 30 min |
| 8 | MFA TOTP | Task 2 | 45 min |
| 9 | Reconciliação diária | Tasks 6, 4 | 20 min |
| 10 | Circuit Breaker MercadoPago | Nenhuma | 15 min |
| 11 | Health Checks + Metrics | Tasks 3, 2 | 20 min |
| 12 | Audit Log | Task 2 | 15 min |
| 13 | Secrets Management | Nenhuma | 15 min |
| 14 | Rate Limiting Webhooks | Nenhuma | 10 min |
| 15 | Testes | Tasks 6, 8 | 30 min |
| 16 | Atualizar CLAUDE.md | Todas | 10 min |

**Total estimado: ~6 horas**
