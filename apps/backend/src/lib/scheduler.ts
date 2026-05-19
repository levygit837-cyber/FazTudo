import { Queue } from "bullmq";
import { getRedisConnectionOpts } from "../queues/connection";
import { QUEUE_NAMES } from "../queues/queues";
import { createLogger } from "../lib/logger";

const log = createLogger("scheduler");

const SCHEDULER_QUEUE = "scheduler";

let schedulerQueue: Queue | null = null;

/**
 * Get or create the scheduler queue (for repeatable/cron jobs).
 */
function getSchedulerQueue(): Queue {
  if (!schedulerQueue) {
    schedulerQueue = new Queue(SCHEDULER_QUEUE, {
      connection: getRedisConnectionOpts(),
    });
  }
  return schedulerQueue;
}

/**
 * Register all repeatable jobs using BullMQ cron patterns.
 * These replace the old node-cron tasks.
 */
export async function startScheduledTasks(): Promise<void> {
  log.info("Registering scheduled tasks via BullMQ...");

  const queue = getSchedulerQueue();

  // Remove stale repeatable jobs from previous deployments
  const existingRepeatable = await queue.getRepeatableJobs();
  for (const job of existingRepeatable) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Every hour: auto-release eligible escrow payments
  await queue.add(
    "auto-release-escrow",
    { task: "auto-release-escrow" },
    {
      repeat: { pattern: "0 * * * *" }, // Every hour
      removeOnComplete: { count: 24 },
      removeOnFail: { count: 48 },
    }
  );

  // Every 6 hours: mark expired orders
  await queue.add(
    "check-expired-orders",
    { task: "check-expired-orders" },
    {
      repeat: { pattern: "0 */6 * * *" },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    }
  );

  // Every 12 hours: send deadline warnings (1 day before)
  await queue.add(
    "deadline-warnings",
    { task: "deadline-warnings", daysBeforeDeadline: 1 },
    {
      repeat: { pattern: "0 */12 * * *" },
      removeOnComplete: { count: 5 },
      removeOnFail: { count: 10 },
    }
  );

  // Every minute: check for late professionals
  await queue.add(
    "delay-check",
    { task: "delay-check" },
    {
      repeat: { pattern: "* * * * *" },
      removeOnComplete: { count: 60 },
      removeOnFail: { count: 120 },
    }
  );

  // Daily at 02:00 UTC: reconciliation
  await queue.add(
    "daily-reconciliation",
    { task: "daily-reconciliation" },
    {
      repeat: { pattern: "0 2 * * *" },
      removeOnComplete: { count: 7 },
      removeOnFail: { count: 14 },
    }
  );

  log.info(
    "Scheduled tasks registered: auto-release (hourly), expired-orders (6h), " +
    "deadline-warnings (12h), delay-check (1m), reconciliation (daily 02:00)"
  );
}

/**
 * Stop all scheduled tasks and close the scheduler queue.
 */
export async function stopScheduledTasks(): Promise<void> {
  if (schedulerQueue) {
    // Remove all repeatable jobs
    const repeatableJobs = await schedulerQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await schedulerQueue.removeRepeatableByKey(job.key);
    }
    await schedulerQueue.close();
    schedulerQueue = null;
    log.info("All scheduled tasks stopped");
  }
}
