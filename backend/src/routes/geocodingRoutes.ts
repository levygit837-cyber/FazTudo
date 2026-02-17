import { Router, Response } from "express";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { geocodeAddress, getDirections, reverseGeocode } from "../services/geocodingService";
import { getRouteAlerts } from "../services/overpassService";
import { geocodeSchema, directionsSchema, reverseGeocodeSchema, routeAlertsSchema } from "../middleware/geocodingValidation";
import { createLogger } from "../lib/logger";

const log = createLogger("geocodingRoutes");
const router = Router();

// Geocode an address (authenticated)
router.post("/geocode", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = geocodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors.map(e => e.message).join(", "),
      });
      return;
    }
    const { address } = parsed.data;

    const result = await geocodeAddress(address);

    if (!result) {
      res.status(404).json({ success: false, message: "Address not found" });
      return;
    }

    res.json({ success: true, message: "Address geocoded", data: result });
  } catch (error) {
    log.error({ err: error }, "Geocode endpoint error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get directions between two points (authenticated)
router.post("/directions", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = directionsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors.map(e => e.message).join(", "),
      });
      return;
    }
    const { origin, destination } = parsed.data;

    const result = await getDirections(origin, destination);

    if (!result) {
      res.status(404).json({ success: false, message: "No route found" });
      return;
    }

    res.json({ success: true, message: "Directions computed", data: result });
  } catch (error) {
    log.error({ err: error }, "Directions endpoint error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Reverse geocode lat/lng to address (authenticated)
router.post("/reverse", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = reverseGeocodeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors.map(e => e.message).join(", "),
      });
      return;
    }
    const { latitude, longitude } = parsed.data;

    const result = await reverseGeocode(latitude, longitude);

    if (!result) {
      res.status(404).json({ success: false, message: "No address found for coordinates" });
      return;
    }

    res.json({ success: true, message: "Reverse geocoded", data: result });
  } catch (error) {
    log.error({ err: error }, "Reverse geocode endpoint error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get road alerts along a route (authenticated)
router.post("/route-alerts", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = routeAlertsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors.map(e => e.message).join(", "),
      });
      return;
    }
    const { polyline, radius } = parsed.data;

    const alerts = await getRouteAlerts(polyline, radius);

    res.json({
      success: true,
      message: `Found ${alerts.length} alerts`,
      data: { alerts },
    });
  } catch (error) {
    log.error({ err: error }, "Route alerts endpoint error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
