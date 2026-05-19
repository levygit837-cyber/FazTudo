import {
  getQueue,
  QUEUE_NAMES,
  type NotificationJobData,
  type EmailJobData,
  type PaymentJobData,
  type ReconciliationJobData,
  type AntiFraudJobData,
  type EscrowJobData,
} from "./queues";
import { createLogger } from "../lib/logger";

const log = createLogger("producers");

/**
 * Enqueue a notification to be created asynchronously.
 */
export async function enqueueNotification(data: NotificationJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.NOTIFICATION);
  const job = await queue.add("create-notification", data, {
    priority: data.type === "SYSTEM_ALERT" ? 1 : 3,
  });
  log.debug({ jobId: job.id, userId: data.userId, type: data.type }, "Notification enqueued");
  return job.id!;
}

/**
 * Enqueue an email to be sent asynchronously.
 */
export async function enqueueEmail(data: EmailJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.EMAIL);
  const job = await queue.add("send-email", data, {
    priority: 2,
  });
  log.debug({ jobId: job.id, to: data.to, template: data.template }, "Email enqueued");
  return job.id!;
}

/**
 * Enqueue a payment processing job.
 */
export async function enqueuePayment(data: PaymentJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.PAYMENT);
  const job = await queue.add(`payment-${data.action}`, data, {
    priority: 1, // High priority
    attempts: 5, // More retries for payments
    backoff: {
      type: "exponential",
      delay: 3000,
    },
  });
  log.info({ jobId: job.id, paymentId: data.paymentId, action: data.action }, "Payment job enqueued");
  return job.id!;
}

/**
 * Enqueue a reconciliation batch job.
 */
export async function enqueueReconciliation(data: ReconciliationJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.RECONCILIATION);
  const job = await queue.add("reconcile", data, {
    priority: 5, // Low priority
  });
  log.info({ jobId: job.id, date: data.date }, "Reconciliation enqueued");
  return job.id!;
}

/**
 * Enqueue an anti-fraud check.
 */
export async function enqueueAntiFraud(data: AntiFraudJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.ANTI_FRAUD);
  const job = await queue.add("check-fraud", data, {
    priority: 1,
  });
  log.debug({ jobId: job.id, paymentId: data.paymentId }, "Anti-fraud check enqueued");
  return job.id!;
}

/**
 * Enqueue an escrow action.
 */
export async function enqueueEscrow(data: EscrowJobData): Promise<string> {
  const queue = getQueue(QUEUE_NAMES.ESCROW);
  const job = await queue.add(`escrow-${data.action}`, data, {
    priority: 2,
  });
  log.info({ jobId: job.id, paymentId: data.paymentId, action: data.action }, "Escrow job enqueued");
  return job.id!;
}
