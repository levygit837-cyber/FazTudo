import { Router } from "express";
import * as adminController from "../controllers/adminController";
import { verifyToken, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { updateUserStatusSchema, reviewVerificationSchema } from "../middleware/validation";

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(verifyToken, requireRole("ADMIN"));

// Platform statistics
router.get("/stats", adminController.getAdminStats);

// User management
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserDetails);
router.put("/users/:id/status", validateBody(updateUserStatusSchema), adminController.updateUserStatus);

// Verification management
router.get("/verifications", adminController.listVerifications);
router.put("/verifications/:id", validateBody(reviewVerificationSchema), adminController.reviewVerification);

export default router;
