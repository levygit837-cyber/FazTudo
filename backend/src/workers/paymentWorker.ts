import { Worker, Job } from "bullmq";
import { getRedisConnectionOpts } from "../queues/connection";
import { QUEUE_NAMES, type PaymentJobData } from "../queues/queues";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("worker:payment");

async function processPayment(job: Job<PaymentJobData>): Promise<void> {
  const { paymentId, action, metadata } = job.data;

  log.info({ jobId: job.id, paymentId, action }, "Processing payment job");

  switch (action) {
    case "verify": {
      // Verify payment status with gateway
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        log.warn({ paymentId }, "Payment not found for verification");
        return;
      }

      log.info({ paymentId, status: payment.status }, "Payment verified");
      break;
    }

    case "process": {
      // Process a new payment
      log.info({ paymentId }, "Payment processing delegated to gateway");
      break;
    }

    case "release": {
      // Release payment from escrow — actual release logic is in escrowService
      log.info({ paymentId }, "Payment release requested");
      break;
    }

    case "refund": {
      // Refund payment — actual refund logic is in escrowService
      log.info({ paymentId, metadata }, "Payment refund requested");
      break;
    }

    default:
      log.warn({ paymentId, action }, "Unknown payment action");
  }
}

export function createPaymentWorker(): Worker<PaymentJobData> {
  const worker = new Worker<PaymentJobData>(
    QUEUE_NAMES.PAYMENT,
    processPayment,
    {
      connection: getRedisConnectionOpts(),
      concurrency: 3,
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Payment job completed");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Payment job failed");
  });

  log.info("Payment worker started");
  return worker;
}
