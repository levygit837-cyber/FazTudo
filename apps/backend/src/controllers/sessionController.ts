import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("sessionController");

const successResponse = (data: unknown, message: string) => ({
  success: true,
  message,
  data,
});

const errorResponse = (message: string) => ({
  success: false,
  message,
});

/**
 * Parse User-Agent to determine device type
 */
function detectDevice(userAgent: string | undefined): string {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (
    /mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)
  )
    return "mobile";
  return "desktop";
}

/**
 * POST /api/sessions/start
 * Start a new tracking session
 */
export const startSession = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const device = detectDevice(req.headers["user-agent"]);

    const session = await prisma.userSession.create({
      data: {
        userId: req.user.id,
        device,
      },
      select: { id: true, startedAt: true, device: true },
    });

    res.status(201).json(successResponse({ session }, "Session started"));
  } catch (error) {
    log.error({ err: error }, "Failed to start session");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

/**
 * PATCH /api/sessions/:id/heartbeat
 * Update session heartbeat (keeps duration accurate)
 */
export const heartbeat = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const id = String(req.params.id);

    const session = await prisma.userSession.findUnique({
      where: { id },
      select: { userId: true, startedAt: true },
    });

    if (!session || session.userId !== req.user.id) {
      res.status(404).json(errorResponse("Session not found"));
      return;
    }

    const duration = Math.floor(
      (Date.now() - session.startedAt.getTime()) / 1000,
    );

    await prisma.userSession.update({
      where: { id },
      data: { duration },
    });

    res
      .status(200)
      .json(successResponse({ duration }, "Heartbeat recorded"));
  } catch (error) {
    log.error({ err: error }, "Failed to record heartbeat");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

/**
 * PATCH /api/sessions/:id/end
 * End a session
 */
export const endSession = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const id = String(req.params.id);

    const session = await prisma.userSession.findUnique({
      where: { id },
      select: { userId: true, startedAt: true },
    });

    if (!session || session.userId !== req.user.id) {
      res.status(404).json(errorResponse("Session not found"));
      return;
    }

    const duration = Math.floor(
      (Date.now() - session.startedAt.getTime()) / 1000,
    );

    const pageViewCount = await prisma.pageView.count({
      where: { sessionId: id },
    });

    await prisma.userSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
        duration,
        pagesViewed: pageViewCount,
      },
    });

    res.status(200).json(successResponse({ duration }, "Session ended"));
  } catch (error) {
    log.error({ err: error }, "Failed to end session");
    res.status(500).json(errorResponse("Internal server error"));
  }
};

/**
 * POST /api/sessions/:id/pageview
 * Record a page view within a session
 */
export const recordPageView = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const id = String(req.params.id);
    const { path: pagePath, duration } = req.body;

    if (!pagePath || typeof pagePath !== "string") {
      res.status(400).json(errorResponse("Path is required"));
      return;
    }

    const session = await prisma.userSession.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!session || session.userId !== req.user.id) {
      res.status(404).json(errorResponse("Session not found"));
      return;
    }

    const pageView = await prisma.pageView.create({
      data: {
        sessionId: id,
        path: pagePath,
        duration: typeof duration === "number" ? duration : undefined,
      },
      select: { id: true, path: true, enteredAt: true },
    });

    res
      .status(201)
      .json(successResponse({ pageView }, "Page view recorded"));
  } catch (error) {
    log.error({ err: error }, "Failed to record page view");
    res.status(500).json(errorResponse("Internal server error"));
  }
};
