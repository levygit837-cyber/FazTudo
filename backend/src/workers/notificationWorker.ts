import { Worker, Job } from "bullmq";
import { getRedisConnectionOpts } from "../queues/connection";
import { QUEUE_NAMES, type NotificationJobData } from "../queues/queues";
import prisma from "../lib/prisma";
import { emitToUser } from "../lib/socket";
import { createLogger } from "../lib/logger";
import { queueJobsTotal, queueJobDuration } from "../lib/metrics";

const log = createLogger("worker:notification");

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { userId, type, title, message, metadata, serviceOrderId } = job.data;

  log.info({ jobId: job.id, userId, type }, "Processing notification");

  // Create notification in database
  const notification = await prisma.notification.create({
    data: {
      type: type as any,
      title,
      message,
      status: "UNREAD",
      userId,
      serviceOrderId: serviceOrderId || null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });

  // Real-time Socket.io emission
  emitToUser(userId, "notification:new", {
    id: notification.id,
    type,
    title,
    message,
    serviceOrderId,
  });

  log.info({ jobId: job.id, notificationId: notification.id }, "Notification created");
}

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    processNotification,
    {
      connection: getRedisConnectionOpts(),
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    }
  );

  worker.on("completed", (job) => {
    log.debug({ jobId: job.id }, "Notification job completed");
    queueJobsTotal.inc({ queue: "notification", status: "completed" });
    if (job.processedOn && job.finishedOn) {
      queueJobDuration.observe({ queue: "notification" }, (job.finishedOn - job.processedOn) / 1000);
    }
  });

  worker.on("failed", (job, err) => {
    log.error({ jobId: job?.id, err }, "Notification job failed");
    queueJobsTotal.inc({ queue: "notification", status: "failed" });
  });

  log.info("Notification worker started");
  return worker;
}
