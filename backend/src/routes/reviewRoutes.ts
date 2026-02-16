import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireVerified,
  authLogger,
} from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createReviewSchema } from "../middleware/validation";

const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// ROTAS DE AVALIACOES
// ============================================

// Criar avaliacao para um pedido concluido (cliente ou profissional)
router.post(
  "/orders/:orderId/reviews",
  verifyToken,
  requireVerified,
  validateBody(createReviewSchema),
  serviceController.createReview,
);

export default router;
