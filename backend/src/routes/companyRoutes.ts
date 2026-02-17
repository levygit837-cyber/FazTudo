import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyOwner, requireCompanyPermission } from "../middleware/companyPermission";
import { getCompanyProfile, updateCompanyProfile, getCompanyStorefront, getCompanyDashboard } from "../controllers/companyController";

const router = Router();

// Public storefront — no auth needed
router.get("/storefront/:companyId", getCompanyStorefront);

// Authenticated routes
router.use(verifyToken);

router.get("/profile", requireCompanyOwner, getCompanyProfile);
router.put("/profile", requireCompanyPermission("company.settings"), updateCompanyProfile);
router.get("/dashboard", requireCompanyOwner, getCompanyDashboard);

export default router;
