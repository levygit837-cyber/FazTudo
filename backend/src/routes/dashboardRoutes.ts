import { Router } from "express";
import * as dashboardController from "../controllers/dashboardController";
import * as calendarController from "../controllers/calendarController";
import * as reputationController from "../controllers/reputationController";
import { verifyToken, requireRole } from "../middleware/auth";

const router = Router();

router.get("/stats", verifyToken, dashboardController.getDashboardStats);
router.get("/recent-orders", verifyToken, dashboardController.getRecentOrders);
router.get("/professional/crm", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), dashboardController.getProfessionalCrmStats);
router.get("/professional/calendar", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), calendarController.getCalendarOverview);
router.get("/professional/calendar/:date", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), calendarController.getCalendarDayDetail);
router.get("/professional/reputation", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), reputationController.getReputationAnalytics);

export default router;
