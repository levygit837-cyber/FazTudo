import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireRole,
  requireVerified,
  authLogger,
} from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createOrderSchema } from "../middleware/validation";

const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// ROTAS DE SERVICE ORDERS (PEDIDOS)
// ============================================

// Criar novo pedido de servico (apenas clientes verificados)
router.post(
  "/orders",
  verifyToken,
  requireRole("CLIENT"),
  requireVerified,
  validateBody(createOrderSchema),
  serviceController.createServiceOrder,
);

// Obter pedidos do usuario (como cliente ou profissional)
router.get("/orders", verifyToken, serviceController.getUserServiceOrders);

// Obter detalhes de um pedido especifico (envolvidos ou admin)
router.get("/orders/:id", verifyToken, serviceController.getServiceOrder);

// Aceitar pedido (apenas profissional designado ou admin)
router.post(
  "/orders/:id/accept",
  verifyToken,
  requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
  requireVerified,
  serviceController.acceptServiceOrder,
);

// Iniciar servico (apenas profissional designado ou admin)
router.post(
  "/orders/:id/start",
  verifyToken,
  requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
  requireVerified,
  serviceController.startServiceOrder,
);

// Cliente confirma que o serviço foi realizado (aguardando confirmacao do profissional)
router.post(
  "/orders/:id/submit-completion",
  verifyToken,
  requireRole("CLIENT", "ADMIN"),
  requireVerified,
  serviceController.completeServiceOrder,
);

// REMOVED: confirm-completion route — no longer needed.
// New flow: Client → submit-completion → AWAITING_PROFESSIONAL_CONFIRMATION → confirm-professional → COMPLETED

// Profissional confirma conclusao (apos cliente ja ter confirmado)
router.post(
  "/orders/:id/confirm-professional",
  verifyToken,
  requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
  requireVerified,
  serviceController.confirmProfessionalCompletion,
);

// Cancelar pedido (cliente, profissional envolvido ou admin)
router.post(
  "/orders/:id/cancel",
  verifyToken,
  requireVerified,
  serviceController.cancelServiceOrder,
);

// Reagendar pedido
router.post(
  "/orders/:id/reschedule",
  verifyToken,
  serviceController.rescheduleOrder,
);

// Aceitar reagendamento proposto (apenas cliente)
router.post(
  "/orders/:id/reschedule/accept",
  verifyToken,
  requireRole("CLIENT", "ADMIN"),
  serviceController.acceptReschedule,
);

// Recusar reagendamento proposto (apenas cliente)
router.post(
  "/orders/:id/reschedule/reject",
  verifyToken,
  requireRole("CLIENT", "ADMIN"),
  serviceController.rejectReschedule,
);

export default router;
