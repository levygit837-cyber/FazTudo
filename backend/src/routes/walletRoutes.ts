import { Router } from "express";
import * as walletController from "../controllers/walletController";
import { verifyToken, requireRole, requireVerified } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { withdrawalSchema } from "../middleware/validation";
import { financialLimiter } from "../middleware/rateLimiter";

const router = Router();

router.get("/balance", verifyToken, walletController.getBalance);
router.get("/transactions", verifyToken, walletController.getTransactions);
router.get("/summary", verifyToken, walletController.getSummary);
router.post(
  "/withdraw",
  verifyToken,
  requireRole("PROFESSIONAL"),
  requireVerified,
  financialLimiter,
  validateBody(withdrawalSchema),
  walletController.requestWithdrawal,
);

export default router;
