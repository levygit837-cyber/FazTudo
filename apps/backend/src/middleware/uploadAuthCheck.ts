import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("uploadAuthCheck");

/**
 * Middleware that verifies the authenticated user is a participant of the order
 * BEFORE multer processes the file.
 * Prevents files from being written to disk for unauthorized orders.
 */
export const requireOrderParticipant = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    if (isNaN(orderId)) {
      res.status(400).json({ success: false, message: "Invalid order ID" });
      return;
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { clientId: true, professionalId: true },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found" });
      return;
    }

    const userId = req.user.id;
    const isParticipant =
      order.clientId === userId ||
      order.professionalId === userId ||
      req.user.role === "ADMIN";

    if (!isParticipant) {
      log.warn({ userId, orderId }, "Unauthorized upload attempt blocked before disk write");
      res.status(403).json({ success: false, message: "You are not a participant of this order" });
      return;
    }

    next();
  } catch (error) {
    log.error({ err: error }, "Upload auth check error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
