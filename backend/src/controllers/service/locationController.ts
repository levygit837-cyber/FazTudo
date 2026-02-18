import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { createLogger } from "../../lib/logger";
import { createNotification } from "../../services/notificationService";
import { NotificationType } from "@prisma/client";
import { calculateBearing } from "../../utils/geo";

const log = createLogger("locationController");

const successResponse = (data: any, message: string = "Success") => ({
  success: true,
  message,
  data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false,
  message,
  statusCode,
});

// In-memory store for professional locations (per order)
// In production, use Redis. For dev/SQLite this is sufficient.
const locationStore = new Map<
  number,
  { lat: number; lng: number; bearing: number | null; updatedAt: string }
>();

/**
 * POST /api/services/orders/:id/location
 * Professional updates their current location while en route
 */
export const updateLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const { latitude, longitude } = req.body;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      res.status(400).json(errorResponse("latitude and longitude are required numbers"));
      return;
    }

    // Verify order exists and user is the professional
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, professionalId: true, status: true },
    });

    if (!order) {
      res.status(404).json(errorResponse("Order not found"));
      return;
    }

    if (order.professionalId !== req.user.id) {
      res.status(403).json(errorResponse("Only the assigned professional can update location"));
      return;
    }

    if (!["ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
      res.status(400).json(errorResponse("Can only track location for accepted or in-progress orders"));
      return;
    }

    // Calculate bearing from previous position
    const previousLocation = locationStore.get(orderId);
    let bearing: number | null = null;
    if (previousLocation) {
      bearing = calculateBearing(
        { lat: previousLocation.lat, lng: previousLocation.lng },
        { lat: latitude, lng: longitude }
      );
    }

    // Store location with bearing
    locationStore.set(orderId, {
      lat: latitude,
      lng: longitude,
      bearing,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json(successResponse({ orderId, latitude, longitude }, "Location updated"));
  } catch (error) {
    log.error({ err: error }, "Update location error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

/**
 * GET /api/services/orders/:id/location
 * Client gets the professional's current location
 */
export const getLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Verify order exists and user is client or professional
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, clientId: true, professionalId: true, status: true },
    });

    if (!order) {
      res.status(404).json(errorResponse("Order not found"));
      return;
    }

    if (order.clientId !== req.user.id && order.professionalId !== req.user.id) {
      res.status(403).json(errorResponse("Not authorized to view this order's location"));
      return;
    }

    const location = locationStore.get(orderId);

    res.status(200).json(
      successResponse(
        location || null,
        location ? "Location found" : "No location data available"
      )
    );
  } catch (error) {
    log.error({ err: error }, "Get location error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

/**
 * POST /api/services/orders/:id/start-route
 * Professional starts navigating to the client — sends notification
 */
export const startRoute = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { client: { select: { id: true, name: true } } },
    });

    if (!order) {
      res.status(404).json(errorResponse("Order not found"));
      return;
    }

    if (order.professionalId !== req.user.id) {
      res.status(403).json(errorResponse("Only the assigned professional can start route"));
      return;
    }

    if (!["ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
      res.status(400).json(errorResponse("Order must be accepted or in progress to start route"));
      return;
    }

    // Notify client that professional is on the way
    await createNotification(
      order.clientId,
      NotificationType.PROFESSIONAL_EN_ROUTE,
      "Profissional a caminho",
      `${req.user.name} esta a caminho para realizar o servico "${order.title}".`,
      orderId,
      { professionalName: req.user.name }
    );

    res.status(200).json(successResponse({ orderId }, "Route started, client notified"));
  } catch (error) {
    log.error({ err: error }, "Start route error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

/**
 * DELETE /api/services/orders/:id/location
 * Clear location tracking (when arriving or stopping)
 */
export const clearLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { professionalId: true },
    });

    if (!order || order.professionalId !== req.user.id) {
      res.status(403).json(errorResponse("Not authorized"));
      return;
    }

    locationStore.delete(orderId);

    res.status(200).json(successResponse(null, "Location tracking cleared"));
  } catch (error) {
    log.error({ err: error }, "Clear location error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// getMapConfig removed: SECURITY — never expose server-side API keys to clients (CRÍTICA-3)
