import { Router } from "express";
import * as adminController from "../controllers/adminController";
import { getAllCompanies, getPendingCompanies, verifyCompany } from "../controllers/adminController";
import { verifyToken, requireRole } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimiter";
import { validateBody } from "../middleware/validate";
import {
  updateUserStatusSchema,
  reviewVerificationSchema,
  adminLoginSchema,
  resolveDisputeSchema,
  updatePlatformConfigSchema,
  verifyCompanySchema,
} from "../middleware/validation";
import { auditLog } from "../middleware/auditLog";

const router = Router();

// Public admin login (no auth required)
router.post("/login", authLimiter, auditLog("ADMIN_LOGIN"), validateBody(adminLoginSchema), adminController.adminLogin);

// All routes below require admin auth
router.use(verifyToken, requireRole("ADMIN"));

// Platform statistics
router.get("/stats", adminController.getAdminStats);
router.get("/stats/dashboard", adminController.getDashboardStats);
router.get("/stats/traffic", adminController.getTrafficStats);

// User management
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserDetails);
router.put("/users/:id/status", auditLog("ADMIN_CHANGE_USER_STATUS"), validateBody(updateUserStatusSchema), adminController.updateUserStatus);
router.post("/users/:id/force-logout", auditLog("ADMIN_FORCE_LOGOUT"), adminController.forceLogout);

// Verification management
router.get("/verifications", adminController.listVerifications);
router.put("/verifications/:id", auditLog("ADMIN_REVIEW_VERIFICATION"), validateBody(reviewVerificationSchema), adminController.reviewVerification);

// Dispute management
router.get("/disputes", adminController.listDisputes);
router.put("/disputes/:id/resolve", auditLog("ADMIN_RESOLVE_DISPUTE"), validateBody(resolveDisputeSchema), adminController.resolveDisputeAdmin);

// Platform config
router.get("/config", adminController.getPlatformConfig);
router.put("/config", auditLog("ADMIN_UPDATE_CONFIG"), validateBody(updatePlatformConfigSchema), adminController.updatePlatformConfig);

// Company management
// IMPORTANT: /companies/pending must come BEFORE /companies/:companyId routes
router.get("/companies/pending", getPendingCompanies);
router.get("/companies", getAllCompanies);
router.post("/companies/:companyId/verify", auditLog("ADMIN_VERIFY_COMPANY"), validateBody(verifyCompanySchema), verifyCompany);

export default router;
