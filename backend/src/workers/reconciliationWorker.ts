import { Worker, Job } from "bullmq";
import { getRedisConnectionOpts } from "../queues/connection";
import { QUEUE_NAMES, type ReconciliationJobData } from "../queues/queues";
import { enqueueNotification } from "../queues/producers";
import prisma from "../lib/prisma";
import { getMPPaymentStatus } from "../services/mercadopagoService";
import { transitionPaymentStatus } from "../lib/paymentStateMachine";
import { createLogger } from "../lib/logger";

const log = createLogger("worker:reconciliation");

/**
 * Maps a MercadoPago status string to the local Payment status.
 * Returns null for unknown statuses (no correction needed).
 */
function mapMPStatusToLocal(mpStatus: string): string | null {
  switch (mpStatus) {
    case "approved":
      return "HELD";
    case "rejected":
    case "cancelled":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    default:
      return null;
  }
}

async function processReconciliation(job: Job<ReconciliationJobData>): Promise<void> {
  const { date, batchSize = 100 } = job.data;

  log.info({ jobId: job.id, date, batchSize }, "Starting reconciliation");

  const targetDate = new Date(date);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // 1. Find payments that may need reconciliation:
  //    - Pending/Held payments older than 24h with a MercadoPago transactionId
  //    - Plus payments paid on the target date for order-status cross-check
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pendingPayments = await prisma.payment.findMany({
    where: {
      status: { in: ["PENDING", "HELD"] },
      createdAt: { lt: oneDayAgo },
      transactionId: { not: null },
    },
    select: { id: true, status: true, transactionId: true, amount: true },
    take: batchSize,
  });

  const paidPayments = await prisma.payment.findMany({
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

  let synced = 0;
  let divergent = 0;
  let errors = 0;

  // 2. Reconcile pending/held payments against MercadoPago API
  for (const payment of pendingPayments) {
    try {
      const mpStatus = await getMPPaymentStatus(payment.transactionId!);
      const expectedLocalStatus = mapMPStatusToLocal(mpStatus.status || "");

      if (expectedLocalStatus && expectedLocalStatus !== payment.status) {
        divergent++;
        log.warn(
          {
            paymentId: payment.id,
            local: payment.status,
            mp: mpStatus.status,
            expected: expectedLocalStatus,
          },
          "Payment status divergence found",
        );

        // Attempt automatic correction via state machine
        const dateKey = new Date().toISOString().split("T")[0];
        await transitionPaymentStatus({
          paymentId: payment.id,
          newStatus: expectedLocalStatus,
          eventType: "RECONCILED",
          source: "SCHEDULER",
          idempotencyKey: `reconcile:${payment.id}:${dateKey}`,
          metadata: {
            mpStatus: mpStatus.status,
            localStatus: payment.status,
            mpStatusDetail: mpStatus.statusDetail,
          },
        });
      } else {
        synced++;
      }
    } catch (err) {
      errors++;
      log.error({ err, paymentId: payment.id }, "Reconciliation error for payment");
    }

    await job.updateProgress(
      Math.floor(
        (pendingPayments.indexOf(payment) / pendingPayments.length) * 50,
      ),
    );
  }

  // 3. Cross-check paid payments vs order status
  let orderDiscrepancies = 0;

  for (const payment of paidPayments) {
    const order = payment.serviceOrder;

    if (payment.status === "HELD" && order.status === "COMPLETED") {
      log.warn(
        { paymentId: payment.id, orderId: order.id },
        "Discrepancy: order completed but payment still held",
      );
      orderDiscrepancies++;
    }

    if (payment.status === "HELD" && order.status === "CANCELLED") {
      log.warn(
        { paymentId: payment.id, orderId: order.id },
        "Discrepancy: order cancelled but payment still held",
      );
      orderDiscrepancies++;
    }
  }

  divergent += orderDiscrepancies;
  await job.updateProgress(100);

  // 4. Alert admins if divergences found
  if (divergent > 0) {
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });

      for (const admin of admins) {
        await enqueueNotification({
          userId: admin.id,
          type: "SYSTEM_ALERT",
          title: "Reconciliação: Divergências Encontradas",
          message: `Reconciliação diária: ${synced} OK, ${divergent} divergências (${orderDiscrepancies} ordem-pagamento), ${errors} erros. Total: ${pendingPayments.length + paidPayments.length} pagamentos analisados.`,
          metadata: {
            synced,
            divergent,
            orderDiscrepancies,
            errors,
            totalPending: pendingPayments.length,
            totalPaid: paidPayments.length,
            date,
          },
        });
      }
    } catch (err) {
      log.warn({ err }, "Failed to notify admins about reconciliation results");
    }
  }

  log.info(
    {
      jobId: job.id,
      date,
      synced,
      divergent,
      orderDiscrepancies,
      errors,
      totalPending: pendingPayments.length,
      totalPaid: paidPayments.length,
    },
    "Reconciliation completed",
  );
}

export function createReconciliationWorker(): Worker<ReconciliationJobData> {
  const worker = new Worker<ReconciliationJobData>(
    QUEUE_NAMES.RECONCILIATION,
    processReconciliation,
    {
      connection: getRedisConnectionOpts(),
      concurrency: 1, // Single-threaded reconciliation
    },
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
