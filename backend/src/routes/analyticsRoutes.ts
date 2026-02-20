// backend/src/routes/analyticsRoutes.ts
import { Router } from "express";
import { trackSearch, trackListingView } from "../controllers/analyticsController";
import { validateBody } from "../middleware/validate";
import { trackSearchSchema, trackListingViewSchema } from "../middleware/validation";
import { createUserRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// 100 analytics events per minute per user — generous but prevents abuse
const analyticsLimiter = createUserRateLimiter(100, 60 * 1000);

// These endpoints are intentionally open (no verifyToken) so anonymous users
// can also generate analytics. The userId field will simply be null.
router.post("/search", analyticsLimiter, validateBody(trackSearchSchema), trackSearch);
router.post("/listing-view", analyticsLimiter, validateBody(trackListingViewSchema), trackListingView);

export default router;
