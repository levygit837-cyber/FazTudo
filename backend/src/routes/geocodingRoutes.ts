import { Router, Response } from "express";
import { verifyToken, AuthRequest } from "../middleware/auth";
import { geocodeAddress, getDirections } from "../services/geocodingService";
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

export default router;
