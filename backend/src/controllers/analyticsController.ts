// backend/src/controllers/analyticsController.ts
import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("analyticsController");

// POST /api/analytics/search — records a search event
export const trackSearch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { query, categoryId, city, resultCount, device } = req.body as {
      query?: string;
      categoryId?: number;
      city?: string;
      resultCount?: number;
      device?: string;
    };

    await prisma.searchEvent.create({
      data: {
        userId: req.user?.id ?? null,
        query: query ?? "",
        categoryId: categoryId ?? null,
        city: city ?? null,
        resultCount: resultCount ?? 0,
        device: device ?? null,
      },
    });

    res.status(201).json({ success: true, message: "Search tracked" });
  } catch (error) {
    log.error({ err: error }, "Track search error");
    // Fire-and-forget: never degrade UX for analytics failures
    res.status(200).json({ success: true });
  }
};

// POST /api/analytics/listing-view — records a listing impression/view
export const trackListingView = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { listingId, source, device, sessionDuration, convertedToOrder } = req.body as {
      listingId: number;
      source?: string;
      device?: string;
      sessionDuration?: number;
      convertedToOrder?: boolean;
    };

    await prisma.serviceListingView.create({
      data: {
        listingId,
        viewerId: req.user?.id ?? null,
        source: source ?? null,
        device: device ?? null,
        sessionDuration: sessionDuration ?? null,
        convertedToOrder: convertedToOrder ?? false,
      },
    });

    res.status(201).json({ success: true, message: "View tracked" });
  } catch (error) {
    log.error({ err: error }, "Track listing view error");
    res.status(200).json({ success: true }); // never fail
  }
};
