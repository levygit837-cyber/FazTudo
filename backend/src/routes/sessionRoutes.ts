import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import * as sessionController from "../controllers/sessionController";

const router = Router();

// All session routes require authentication
router.use(verifyToken);

router.post("/start", sessionController.startSession);
router.patch("/:id/heartbeat", sessionController.heartbeat);
router.patch("/:id/end", sessionController.endSession);
router.post("/:id/pageview", sessionController.recordPageView);

export default router;
