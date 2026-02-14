import { Router } from "express";
import * as adminController from "../controllers/adminController";
import { verifyToken, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { updateUserStatusSchema, reviewVerificationSchema } from "../middleware/validation";
import { auditLog } from "../middleware/auditLog";

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(verifyToken, requireRole("ADMIN"));

// Platform statistics
router.get("/stats", adminController.getAdminStats);

// User management
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserDetails);
router.put("/users/:id/status", auditLog("ADMIN_CHANGE_USER_STATUS"), validateBody(updateUserStatusSchema), adminController.updateUserStatus);

// Verification management
router.get("/verifications", adminController.listVerifications);
router.put("/verifications/:id", auditLog("ADMIN_REVIEW_VERIFICATION"), validateBody(reviewVerificationSchema), adminController.reviewVerification);

export default router;
