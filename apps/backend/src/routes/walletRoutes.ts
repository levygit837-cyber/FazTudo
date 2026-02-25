import { Router } from "express";
import * as walletController from "../controllers/walletController";
import { verifyToken, requireRole, requireVerified } from "../middleware/auth";
import { requireMFA } from "../middleware/mfa";
import { validateBody } from "../middleware/validate";
import { withdrawalSchema } from "../middleware/validation";
import { financialLimiter, userFinancialLimiter } from "../middleware/rateLimiter";
import { auditLog } from "../middleware/auditLog";

const router = Router();

router.get("/balance", verifyToken, walletController.getBalance);
router.get("/transactions", verifyToken, walletController.getTransactions);
router.get("/summary", verifyToken, walletController.getSummary);
router.get("/professional/overview", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), walletController.getProfessionalFinancialOverview);
router.post(
  "/withdraw",
  verifyToken,
  requireRole("PROFESSIONAL"),
  requireVerified,
  requireMFA,
  financialLimiter,
  userFinancialLimiter,
  auditLog("WITHDRAWAL_REQUEST"),
  validateBody(withdrawalSchema),
  walletController.requestWithdrawal,
);

export default router;
