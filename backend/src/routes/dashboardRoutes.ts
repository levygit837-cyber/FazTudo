import { Router } from "express";
import * as dashboardController from "../controllers/dashboardController";
import { verifyToken } from "../middleware/auth";

const router = Router();

router.get("/stats", verifyToken, dashboardController.getDashboardStats);
router.get("/recent-orders", verifyToken, dashboardController.getRecentOrders);

export default router;
