import { Worker, Job } from "bullmq";
import { getRedisConnectionOpts } from "../queues/connection";
import { QUEUE_NAMES, type ReconciliationJobData } from "../queues/queues";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("worker:reconciliation");

async function processReconciliation(job: Job<ReconciliationJobData>): Promise<void> {
  const { date, batchSize = 100 } = job.data;

  log.info({ jobId: job.id, date, batchSize }, "Starting reconciliation");

  const targetDate = new Date(date);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Find payments that were paid on the target date
  const payments = await prisma.payment.findMany({
    where: {
      paidAt: {
        gte: targetDate,
        lt: nextDay,
      },
      status: {
        in: ["HELD", "RELEASED"],
      },
    },
    take: batchSize,
    include: {
      serviceOrder: {
        select: { id: true, status: true },
      },
    },
  });

  let reconciled = 0;
  let discrepancies = 0;

  for (const payment of payments) {
    // Check for discrepancies between payment and order status
    const order = payment.serviceOrder;

    if (payment.status === "HELD" && order.status === "COMPLETED") {
      // Payment should have been released
      log.warn(
        { paymentId: payment.id, orderId: order.id },
        "Discrepancy: order completed but payment still held"
      );
      discrepancies++;
    }

    if (payment.status === "HELD" && order.status === "CANCELLED") {
      // Payment should have been refunded
      log.warn(
        { paymentId: payment.id, orderId: order.id },
        "Discrepancy: order cancelled but payment still held"
      );
      discrepancies++;
    }

    reconciled++;
  }

  await job.updateProgress(100);

  log.info(
    { jobId: job.id, date, reconciled, discrepancies },
    "Reconciliation completed"
  );
}

export function createReconciliationWorker(): Worker<ReconciliationJobData> {
  const worker = new Worker<ReconciliationJobData>(
    QUEUE_NAMES.RECONCILIATION,
    processReconciliation,
    {
      connection: getRedisConnectionOpts(),
      concurrency: 1, // Single-threaded reconciliation
    }
  );

  worker.on("completed", (job) => {
    log.info({ jobId: job.id }, "Reconciliation job completed");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Reconciliation job failed");
  });

  log.info("Reconciliation worker started");
  return worker;
}
