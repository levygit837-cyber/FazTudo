import cron, { type ScheduledTask } from "node-cron";
import {
  checkAutoReleasablePayments,
  checkExpiredOrders,
  sendDeadlineWarnings,
} from "../services/escrowService";
import { createLogger } from "./logger";
import { emitToUser } from "./socket";
import prisma from "./prisma";

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

  // Every minute: check for late professionals (15 min past scheduled time, no en-route)
  const delayCheck = cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      // Find orders where scheduled time + 15 min has passed,
      // professional hasn't marked en-route, status is active,
      // and no DEADLINE_WARNING notification was sent in the last hour
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
        // Create notification for client
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

        // Emit real-time alert to client
        emitToUser(order.clientId, "order:delayAlert", {
          orderId: order.id,
          orderTitle: order.title,
          professionalName: order.professional?.name,
          scheduledDate: order.scheduledDate?.toISOString(),
        });

        log.info({ orderId: order.id }, "Sent delay alert to client");
      }
    } catch (err) {
      log.error({ err }, "Failed to check for late professionals");
    }
  });

  tasks = [autoRelease, expiredOrders, deadlineWarnings, delayCheck];

  log.info(
    "Scheduled tasks started: auto-release (hourly), expired-orders (6h), deadline-warnings (12h), delay-check (1m)",
  );
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
