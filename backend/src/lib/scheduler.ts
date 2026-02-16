import cron, { type ScheduledTask } from "node-cron";
import {
  checkAutoReleasablePayments,
  checkExpiredOrders,
  sendDeadlineWarnings,
} from "../services/escrowService";
import { createLogger } from "./logger";

const log = createLogger("scheduler");

let tasks: ScheduledTask[] = [];

/**
 * Start all scheduled cron tasks.
 * Call this once after the server starts.
 */
export function startScheduledTasks(): void {
  log.info("Starting scheduled tasks...");

  // Every hour: auto-release eligible escrow payments
  const autoRelease = cron.schedule("0 * * * *", async () => {
    try {
      const count = await checkAutoReleasablePayments();
      if (count > 0) {
        log.info({ count }, "Auto-released payments from escrow");
      }
    } catch (err) {
      log.error({ err }, "Failed to auto-release payments");
    }
  });

  // Every 6 hours: mark expired orders
  const expiredOrders = cron.schedule("0 */6 * * *", async () => {
    try {
      const count = await checkExpiredOrders();
      if (count > 0) {
        log.info({ count }, "Marked orders as expired");
      }
    } catch (err) {
      log.error({ err }, "Failed to check expired orders");
    }
  });

  // Every 12 hours: send deadline warnings (1 day before)
  const deadlineWarnings = cron.schedule("0 */12 * * *", async () => {
    try {
      const count = await sendDeadlineWarnings(1);
      if (count > 0) {
        log.info({ count }, "Sent deadline warnings");
      }
    } catch (err) {
      log.error({ err }, "Failed to send deadline warnings");
    }
  });

  tasks = [autoRelease, expiredOrders, deadlineWarnings];

  log.info("Scheduled tasks started: auto-release (hourly), expired-orders (6h), deadline-warnings (12h)");
}

/**
 * Stop all scheduled cron tasks.
 * Call this during graceful shutdown.
 */
export function stopScheduledTasks(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
  log.info("All scheduled tasks stopped");
}
