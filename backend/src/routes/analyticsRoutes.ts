import { Router } from "express";
import { trackSearch, trackListingView } from "../controllers/analyticsController";
import { validateBody } from "../middleware/validate";
import { trackSearchSchema, trackListingViewSchema } from "../middleware/validation";
import { createUserRateLimiter } from "../middleware/rateLimiter";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// 100 events per minute per user/IP — analytics should never be slow
const analyticsLimiter = createUserRateLimiter(100, 60 * 1000);

// Auth is optional for both routes (anonymous tracking supported)
router.post(
  "/search",
  analyticsLimiter,
  optionalAuth,
  validateBody(trackSearchSchema),
  trackSearch,
);

router.post(
  "/listing-view",
  analyticsLimiter,
  optionalAuth,
  validateBody(trackListingViewSchema),
  trackListingView,
);

export default router;
