import { Worker, Job } from "bullmq";
import { getRedisConnectionOpts } from "../queues/connection";
import {
  checkAutoReleasablePayments,
  checkExpiredOrders,
  sendDeadlineWarnings,
} from "../services/escrowService";
import { enqueueReconciliation } from "../queues/producers";
import prisma from "../lib/prisma";
import { emitToUser } from "../lib/socket";
import { createLogger } from "../lib/logger";

const log = createLogger("worker:scheduler");

interface SchedulerJobData {
  task: string;
  daysBeforeDeadline?: number;
}

async function processSchedulerJob(job: Job<SchedulerJobData>): Promise<void> {
  const { task } = job.data;

  switch (task) {
    case "auto-release-escrow": {
      const count = await checkAutoReleasablePayments();
      if (count > 0) {
        log.info({ count }, "Auto-released payments from escrow");
      }
      break;
    }

    case "check-expired-orders": {
      const count = await checkExpiredOrders();
      if (count > 0) {
        log.info({ count }, "Marked orders as expired");
      }
      break;
    }

    case "deadline-warnings": {
      const days = job.data.daysBeforeDeadline ?? 1;
      const count = await sendDeadlineWarnings(days);
      if (count > 0) {
        log.info({ count }, "Sent deadline warnings");
      }
      break;
    }

    case "delay-check": {
      await checkLateProfessionals();
      break;
    }

    case "daily-reconciliation": {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await enqueueReconciliation({
        date: yesterday.toISOString().slice(0, 10),
        batchSize: 500,
      });
      log.info("Daily reconciliation enqueued");
      break;
    }

    default:
      log.warn({ task }, "Unknown scheduler task");
  }
}

/**
 * Check for late professionals (15 min past scheduled time, no en-route).
 * Migrated from the old node-cron delay-check.
 */
async function checkLateProfessionals(): Promise<void> {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  const lateOrders = await prisma.serviceOrder.findMany({
    where: {
      scheduledDate: { lte: fifteenMinutesAgo },
      enRouteAt: null,
      status: { in: ["ACCEPTED", "IN_PROGRESS"] },
      notifications: {
        none: {
          type: "DEADLINE_WARNING",
          createdAt: {
            gte: new Date(now.getTime() - 60 * 60 * 1000),
          },
        },
      },
    },
    include: { professional: true },
  });

  for (const order of lateOrders) {
    await prisma.notification.create({
      data: {
        userId: order.clientId,
        type: "DEADLINE_WARNING",
        title: "Profissional atrasado",
        message: `O horario agendado para "${order.title}" ja passou e o profissional ainda nao confirmou que esta a caminho. O profissional ja chegou?`,
        serviceOrderId: order.id,
        metadata: JSON.stringify({
          delayAlert: true,
          professionalName: order.professional?.name,
        }),
      },
    });

    emitToUser(order.clientId, "order:delayAlert", {
      orderId: order.id,
      orderTitle: order.title,
      professionalName: order.professional?.name,
      scheduledDate: order.scheduledDate?.toISOString(),
    });

    log.info({ orderId: order.id }, "Sent delay alert to client");
  }
}

export function createSchedulerWorker(): Worker<SchedulerJobData> {
  const worker = new Worker<SchedulerJobData>(
    "scheduler",
    processSchedulerJob,
    {
      connection: getRedisConnectionOpts(),
      concurrency: 1, // Run scheduler tasks sequentially
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id, task: job.data.task }, "Scheduler job completed");
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, task: job?.data?.task, err }, "Scheduler job failed");
  });

  log.info("Scheduler worker started");
  return worker;
}
