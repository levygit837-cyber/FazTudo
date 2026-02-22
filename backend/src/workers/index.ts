import { Worker } from "bullmq";
import { createNotificationWorker } from "./notificationWorker";
import { createEmailWorker } from "./emailWorker";
import { createPaymentWorker } from "./paymentWorker";
import { createReconciliationWorker } from "./reconciliationWorker";
import { createAntiFraudWorker } from "./antiFraudWorker";
import { createSchedulerWorker } from "./schedulerWorker";
import { createLogger } from "../lib/logger";

const log = createLogger("workers");

const workers: Worker[] = [];

/**
 * Start all BullMQ workers.
 */
export function startWorkers(): void {
  log.info("Starting all workers...");

  workers.push(
    createNotificationWorker(),
    createEmailWorker(),
    createPaymentWorker(),
    createReconciliationWorker(),
    createAntiFraudWorker(),
    createSchedulerWorker()
  );

  log.info({ count: workers.length }, "All workers started");
}

/**
 * Gracefully stop all workers.
 */
export async function stopWorkers(): Promise<void> {
  log.info("Stopping all workers...");

  const closePromises = workers.map(async (worker) => {
    try {
      await worker.close();
      log.info({ name: worker.name }, "Worker stopped");
    } catch (err) {
      log.error({ name: worker.name, err }, "Error stopping worker");
    }
  });

  await Promise.all(closePromises);
  workers.length = 0;

  log.info("All workers stopped");
}
