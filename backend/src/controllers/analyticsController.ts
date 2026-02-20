/**
 * Analytics Controller
 *
 * Fire-and-forget endpoints for tracking search events and listing views.
 * Never blocks the user flow on error. Anonymous requests supported.
 */

import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("analyticsController");

// ─── POST /api/analytics/search ─────────────────────────────────────────────

/**
 * Register a search event.
 * Accepts anonymous (no token) and authenticated requests.
 */
export const trackSearch = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const body = req.body as {
      query?: string;
      categoryId?: number;
      city?: string;
      lat?: number;
      lng?: number;
      resultCount?: number;
      clickedId?: number;
      device?: string;
    };

    await prisma.searchEvent.create({
      data: {
        userId: req.user?.id ?? null,
        query: body.query ?? "",
        categoryId: body.categoryId ?? null,
        city: body.city ?? null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        resultCount: body.resultCount ?? 0,
        clickedId: body.clickedId ?? null,
        device: body.device ?? null,
      },
    });

    res.status(201).json({ success: true, message: "Search tracked" });
  } catch (error) {
    log.error({ err: error }, "trackSearch error");
    // Fire-and-forget: never fail the user experience for analytics
    res.status(200).json({ success: true });
  }
};

// ─── POST /api/analytics/listing-view ───────────────────────────────────────

/**
 * Register a listing view / impression.
 */
export const trackListingView = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const body = req.body as {
      listingId: number;
      source?: string;
      device?: string;
      sessionDuration?: number;
    };

    await prisma.serviceListingView.create({
      data: {
        listingId: body.listingId,
        viewerId: req.user?.id ?? null,
        source: body.source ?? null,
        device: body.device ?? null,
        sessionDuration: body.sessionDuration ?? null,
      },
    });

    res.status(201).json({ success: true, message: "View tracked" });
  } catch (error) {
    log.error({ err: error }, "trackListingView error");
    res.status(200).json({ success: true }); // never fail
  }
};
