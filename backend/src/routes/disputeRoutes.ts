import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireVerified,
  authLogger,
} from "../middleware/auth";

const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// ROTAS DE DISPUTAS
// ============================================

// Open a dispute for an order
router.post(
  "/orders/:orderId/disputes",
  verifyToken,
  requireVerified,
  serviceController.createDispute,
);

// Get disputes for an order
router.get(
  "/orders/:orderId/disputes",
  verifyToken,
  serviceController.getOrderDisputes,
);

export default router;
