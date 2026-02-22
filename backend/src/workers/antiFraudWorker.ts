import { Worker, Job } from "bullmq";
import { getRedisConnectionOpts } from "../queues/connection";
import { QUEUE_NAMES, type AntiFraudJobData } from "../queues/queues";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("worker:anti-fraud");

// Simple fraud detection rules
const FRAUD_THRESHOLDS = {
  HIGH_VALUE_AMOUNT: 10000, // R$10,000
  MAX_DAILY_TRANSACTIONS: 20,
  MAX_DAILY_AMOUNT: 50000, // R$50,000
};

async function processAntiFraud(job: Job<AntiFraudJobData>): Promise<void> {
  const { paymentId, userId, amount, metadata } = job.data;

  log.info({ jobId: job.id, paymentId, userId, amount }, "Running anti-fraud check");

  const flags: string[] = [];

  // Rule 1: High-value transaction
  if (amount >= FRAUD_THRESHOLDS.HIGH_VALUE_AMOUNT) {
    flags.push("HIGH_VALUE_TRANSACTION");
    log.warn({ paymentId, amount }, "High-value transaction flagged");
  }

  // Rule 2: Too many transactions in 24 hours
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const recentPayments = await prisma.payment.count({
    where: {
      clientId: userId,
      createdAt: { gte: oneDayAgo },
    },
  });

  if (recentPayments >= FRAUD_THRESHOLDS.MAX_DAILY_TRANSACTIONS) {
    flags.push("EXCESSIVE_DAILY_TRANSACTIONS");
    log.warn({ paymentId, userId, count: recentPayments }, "Excessive daily transactions");
  }

  // Rule 3: Total daily amount exceeds threshold
  const dailyPayments = await prisma.payment.findMany({
    where: {
      clientId: userId,
      createdAt: { gte: oneDayAgo },
      status: { in: ["PENDING", "HELD"] },
    },
    select: { amount: true },
  });

  const totalDailyAmount = dailyPayments.reduce((sum, p) => sum + p.amount, 0);
  if (totalDailyAmount >= FRAUD_THRESHOLDS.MAX_DAILY_AMOUNT) {
    flags.push("EXCESSIVE_DAILY_AMOUNT");
    log.warn({ paymentId, userId, totalDailyAmount }, "Excessive daily amount");
  }

  // Store result
  if (flags.length > 0) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        metadata: {
          ...(metadata as object || {}),
          fraudFlags: flags,
          fraudCheckedAt: new Date().toISOString(),
        },
      },
    });

    log.warn({ paymentId, flags }, "Payment flagged for potential fraud");
  } else {
    log.info({ paymentId }, "Anti-fraud check passed");
  }
}

export function createAntiFraudWorker(): Worker<AntiFraudJobData> {
  const worker = new Worker<AntiFraudJobData>(
    QUEUE_NAMES.ANTI_FRAUD,
    processAntiFraud,
    {
      connection: getRedisConnectionOpts(),
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Anti-fraud check completed");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Anti-fraud check failed");
  });

  log.info("Anti-fraud worker started");
  return worker;
}
