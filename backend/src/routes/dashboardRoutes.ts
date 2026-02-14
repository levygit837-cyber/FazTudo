import { Router } from "express";
import * as dashboardController from "../controllers/dashboardController";
import * as calendarController from "../controllers/calendarController";
import { verifyToken } from "../middleware/auth";

const router = Router();

router.get("/stats", verifyToken, dashboardController.getDashboardStats);
router.get("/recent-orders", verifyToken, dashboardController.getRecentOrders);
router.get("/professional/crm", verifyToken, dashboardController.getProfessionalCrmStats);
router.get("/professional/calendar", verifyToken, calendarController.getCalendarOverview);
router.get("/professional/calendar/:date", verifyToken, calendarController.getCalendarDayDetail);

export default router;
