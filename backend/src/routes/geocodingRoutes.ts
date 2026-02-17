import { Router, Response } from "express";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { geocodeAddress, getDirections, reverseGeocode } from "../services/geocodingService";
import { getRouteAlerts } from "../services/overpassService";
import { createLogger } from "../lib/logger";

const log = createLogger("geocodingRoutes");
const router = Router();

// Geocode an address (authenticated)
router.post("/geocode", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { address } = req.body;

    if (!address || typeof address !== "string") {
      res.status(400).json({ success: false, message: "Address is required" });
      return;
    }

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
    const { origin, destination } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      res.status(400).json({
        success: false,
        message: "Origin and destination with lat/lng are required",
      });
      return;
    }

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
    const { latitude, longitude } = req.body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      res.status(400).json({ success: false, message: "latitude and longitude are required numbers" });
      return;
    }

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
    const { polyline, radius } = req.body;

    if (!Array.isArray(polyline) || polyline.length < 2) {
      res.status(400).json({
        success: false,
        message: "polyline must be an array of [lat, lng] pairs with at least 2 points",
      });
      return;
    }

    const alerts = await getRouteAlerts(polyline, radius || 200);

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
