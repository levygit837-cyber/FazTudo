import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireRole,
  requireVerified,
  authLogger,
} from "../middleware/auth";
import { financialLimiter, webhookLimiter } from "../middleware/rateLimiter";
import { validateBody } from "../middleware/validate";
import { createPaymentSchema } from "../middleware/validation";

const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// MERCADOPAGO WEBHOOK (publico - validado por assinatura)
// ============================================

router.post(
  "/payments/webhook",
  webhookLimiter,
  serviceController.mercadoPagoWebhook,
);

// ============================================
// ROTAS DE PAGAMENTOS
// ============================================

// Configuracao do MercadoPago (public key para checkout transparente)
router.get("/payments/config", verifyToken, serviceController.getMercadoPagoPublicKey);

// Criar pagamento para um pedido (apenas cliente)
router.post(
  "/orders/:orderId/payments",
  verifyToken,
  requireRole("CLIENT"),
  requireVerified,
  financialLimiter,
  validateBody(createPaymentSchema),
  serviceController.createPayment,
);

// Liberar pagamento em escrow (cliente apos periodo de revisao ou admin)
router.post(
  "/orders/:orderId/payments/release",
  verifyToken,
  requireRole("CLIENT", "ADMIN"),
  requireVerified,
  financialLimiter,
  serviceController.releasePayment,
);

export default router;
