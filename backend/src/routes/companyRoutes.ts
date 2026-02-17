import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyOwner, requireCompanyPermission } from "../middleware/companyPermission";
import { getCompanyProfile, updateCompanyProfile, getCompanyStorefront, getCompanyDashboard } from "../controllers/companyController";

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
router.put("/profile", requireCompanyPermission("company.settings"), updateCompanyProfile);
router.get("/dashboard", requireCompanyOwner, getCompanyDashboard);


// ============================================
// ANALYTICS ROUTES
// ============================================
router.get("/analytics/overview", requireCompanyPermission("metrics.view"), getAnalyticsOverview);
router.get("/analytics/revenue", requireCompanyPermission("metrics.view"), getRevenueAnalytics);
router.get("/analytics/members", requireCompanyPermission("metrics.viewTeam"), getMemberPerformance);
router.get("/analytics/services", requireCompanyPermission("metrics.view"), getTopServices);

export default router;
