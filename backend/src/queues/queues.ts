import { Queue } from "bullmq";
import { getRedisConnectionOpts } from "./connection";
import { createLogger } from "../lib/logger";

const log = createLogger("queues");

// Queue names as constants
export const QUEUE_NAMES = {
  NOTIFICATION: "notification",
  EMAIL: "email",
  PAYMENT: "payment",
  RECONCILIATION: "reconciliation",
  ANTI_FRAUD: "anti-fraud",
  ESCROW: "escrow",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Job data types
export interface NotificationJobData {
  userId: number;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  serviceOrderId?: number;
}

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface PaymentJobData {
  paymentId: number;
  action: "process" | "release" | "refund" | "verify";
  metadata?: Record<string, unknown>;
}

export interface ReconciliationJobData {
  date: string; // ISO date
  batchSize?: number;
}

export interface AntiFraudJobData {
  paymentId: number;
  userId: number;
  amount: number;
  metadata?: Record<string, unknown>;
}

export interface EscrowJobData {
  paymentId: number;
  action: "hold" | "release" | "check-expiry";
}

// Create queues lazily
const queueInstances = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  if (!queueInstances.has(name)) {
    const queue = new Queue(name, {
      connection: getRedisConnectionOpts(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7 days
        },
      },
    });

    queue.on("error", (err) => {
      log.error({ queue: name, err }, "Queue error");
    });

    queueInstances.set(name, queue);
    log.info({ queue: name }, "Queue created");
  }

  return queueInstances.get(name)!;
}

export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queueInstances.entries()).map(
    async ([name, queue]) => {
      await queue.close();
      log.info({ queue: name }, "Queue closed");
    }
  );
  await Promise.all(closePromises);
  queueInstances.clear();
}

export async function getQueueStatus(name: QueueName) {
  const queue = getQueue(name);
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { name, waiting, active, completed, failed, delayed };
}
