import { Router } from "express";
import { verifyToken, requireRole, requireVerified } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { updateLocationSchema } from "../middleware/validation";
import {
  updateLocation,
  getLocation,
  startRoute,
  clearLocation,
  getMapConfig,
} from "../controllers/service/locationController";

const router = Router();

// Get Google Maps API key (must be BEFORE :id routes)
router.get(
  "/map-config",
  verifyToken,
  getMapConfig
);

// Professional updates location while en route
router.post(
  "/orders/:id/location",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  validateBody(updateLocationSchema),
  updateLocation
);

// Get professional's current location (client or professional)
router.get(
  "/orders/:id/location",
  verifyToken,
  getLocation
);

// Professional starts route → notifies client
router.post(
  "/orders/:id/start-route",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  startRoute
);

// Clear location tracking
router.delete(
  "/orders/:id/location",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  clearLocation
);

export default router;
