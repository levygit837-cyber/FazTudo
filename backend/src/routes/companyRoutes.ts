import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyOwner, requireCompanyPermission } from "../middleware/companyPermission";
import { validateBody } from "../middleware/validate";
import { updateCompanyProfileSchema } from "../middleware/validation";
import { getCompanyProfile, updateCompanyProfile, getCompanyStorefront, getCompanyDashboard, getCompanyOrders } from "../controllers/companyController";

import {
  getRevenueAnalytics,
  getMemberPerformance,
  getTopServices,
  getAnalyticsOverview,
} from "../controllers/companyAnalyticsController";

const router = Router();

// Public storefront — no auth needed
router.get("/storefront/:companyId", getCompanyStorefront);

// Authenticated routes
router.use(verifyToken);

router.get("/profile", requireCompanyOwner, getCompanyProfile);
router.put("/profile", requireCompanyPermission("company.settings"), validateBody(updateCompanyProfileSchema), updateCompanyProfile);
router.get("/dashboard", requireCompanyOwner, getCompanyDashboard);
router.get("/orders", requireCompanyPermission("orders.view"), getCompanyOrders);


// ============================================
// ANALYTICS ROUTES
// ============================================
router.get("/analytics/overview", requireCompanyPermission("metrics.view"), getAnalyticsOverview);
router.get("/analytics/revenue", requireCompanyPermission("metrics.view"), getRevenueAnalytics);
router.get("/analytics/members", requireCompanyPermission("metrics.viewTeam"), getMemberPerformance);
router.get("/analytics/services", requireCompanyPermission("metrics.view"), getTopServices);

export default router;
