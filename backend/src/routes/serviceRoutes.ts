import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireRole,
  requireProfessionalOrAdmin,
  requireVerified,
  authLogger,
} from "../middleware/auth";
import { financialLimiter } from "../middleware/rateLimiter";
import { validateBody } from "../middleware/validate";
import {
  createOrderSchema,
  createPaymentSchema,
  sendMessageSchema,
  createReviewSchema,
} from "../middleware/validation";

const router = Router();

// Middleware de log para todas as rotas de serviços
router.use(authLogger);

// ============================================
// ROTAS DE SERVICE LISTINGS (CATÁLOGO)
// ============================================

// Listar todos os serviços disponíveis (público)
router.get("/", serviceController.listServices);

// Criar nova listagem de serviço (apenas profissionais verificados)
router.post(
  "/",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.createServiceListing,
);

// ============================================
// SMART BRIEF ROUTES
// ============================================

// Brief templates (público)
router.get("/briefs/templates/:categorySlug", serviceController.getBriefTemplate);

// Create order with brief (clientes verificados)
router.post(
  "/orders/with-brief",
  verifyToken,
  requireRole("CLIENT"),
  requireVerified,
  serviceController.createOrderWithBrief,
);

// ============================================
// ROTAS DE SERVICE ORDERS (PEDIDOS)
// ============================================

// Criar novo pedido de serviço (apenas clientes verificados)
router.post(
  "/orders",
  verifyToken,
  requireRole("CLIENT"),
  requireVerified,
  validateBody(createOrderSchema),
  serviceController.createServiceOrder,
);

// Obter pedidos do usuário (como cliente ou profissional)
router.get("/orders", verifyToken, serviceController.getUserServiceOrders);

// Obter detalhes de um pedido específico (envolvidos ou admin)
router.get("/orders/:id", verifyToken, serviceController.getServiceOrder);

// Aceitar pedido (apenas profissional designado ou admin)
router.post(
  "/orders/:id/accept",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.acceptServiceOrder,
);

// Iniciar serviço (apenas profissional designado ou admin)
router.post(
  "/orders/:id/start",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.startServiceOrder,
);

// Completar serviço (apenas profissional designado ou admin)
router.post(
  "/orders/:id/complete",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.completeServiceOrder,
);

// Profissional marca como entregue (aguardando confirmação do cliente)
router.post(
  "/orders/:id/submit-completion",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.completeServiceOrder,
);

// Cliente confirma conclusão do serviço
router.post(
  "/orders/:id/confirm-completion",
  verifyToken,
  requireRole("CLIENT", "ADMIN"),
  requireVerified,
  serviceController.confirmServiceOrderCompletion,
);

// Cancelar pedido (cliente, profissional envolvido ou admin)
router.post(
  "/orders/:id/cancel",
  verifyToken,
  serviceController.cancelServiceOrder,
);

// ============================================
// SCHEDULE ROUTES
// ============================================

// Get professional schedule
router.get("/professionals/:id/schedule", serviceController.getProfessionalSchedule);

// Update professional schedule
router.put(
  "/professionals/schedule",
  verifyToken,
  requireRole("PROFESSIONAL"),
  requireVerified,
  serviceController.updateProfessionalSchedule,
);

// Get available slots for a date
router.get("/professionals/:id/available-slots", serviceController.getAvailableSlots);

// Reschedule an order
router.post(
  "/orders/:id/reschedule",
  verifyToken,
  serviceController.rescheduleOrder,
);

// ============================================
// DISPUTE ROUTES
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

// ============================================
// PROPOSAL ROUTES
// ============================================

// Professional submits proposal for an order
router.post(
  "/orders/:orderId/proposals",
  verifyToken,
  requireRole("PROFESSIONAL"),
  requireVerified,
  serviceController.createProposal,
);

// Get proposals for an order
router.get(
  "/orders/:orderId/proposals",
  verifyToken,
  serviceController.getOrderProposals,
);

// Client accepts a proposal
router.post(
  "/orders/:orderId/proposals/:proposalId/accept",
  verifyToken,
  requireRole("CLIENT"),
  serviceController.acceptProposal,
);

// Client rejects a proposal
router.post(
  "/orders/:orderId/proposals/:proposalId/reject",
  verifyToken,
  requireRole("CLIENT"),
  serviceController.rejectProposal,
);

// Professional withdraws their proposal
router.post(
  "/orders/:orderId/proposals/:proposalId/withdraw",
  verifyToken,
  requireRole("PROFESSIONAL"),
  serviceController.withdrawProposal,
);

// ============================================
// MERCADOPAGO WEBHOOK (público — validado por assinatura)
// ============================================

router.post(
  "/payments/webhook",
  serviceController.mercadoPagoWebhook,
);

// ============================================
// ROTAS DE PAGAMENTOS
// ============================================

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

// Liberar pagamento em escrow (cliente após período de revisão ou admin)
router.post(
  "/orders/:orderId/payments/release",
  verifyToken,
  financialLimiter,
  serviceController.releasePayment,
);

// ============================================
// ROTAS DE AVALIAÇÕES
// ============================================

// Criar avaliação para um pedido concluído (cliente ou profissional)
router.post(
  "/orders/:orderId/reviews",
  verifyToken,
  requireVerified,
  validateBody(createReviewSchema),
  serviceController.createReview,
);

// ============================================
// ROTAS DE CHATS (CONVERSAS)
// ============================================

// Listar conversas ativas do usuário
router.get("/chats", verifyToken, serviceController.getUserChats);

// ============================================
// ROTAS DE MENSAGENS
// ============================================

// Enviar mensagem em um pedido (envolvidos no pedido)
router.post(
  "/orders/:orderId/messages",
  verifyToken,
  requireVerified,
  validateBody(sendMessageSchema),
  serviceController.sendMessage,
);

// Listar mensagens de um pedido (envolvidos no pedido)
router.get(
  "/orders/:orderId/messages",
  verifyToken,
  serviceController.getOrderMessages,
);

// ============================================
// ROTAS DE NOTIFICAÇÕES
// ============================================

// Obter notificações do usuário
router.get("/notifications", verifyToken, serviceController.getNotifications);

// Marcar todas notificações como lidas
router.post(
  "/notifications/read-all",
  verifyToken,
  serviceController.markAllNotificationsAsRead,
);

// Marcar notificação como lida/arquivada
router.put(
  "/notifications/:id",
  verifyToken,
  serviceController.updateNotification,
);

// ============================================
// ROTAS DE RECOMENDAÇÕES
// ============================================

// Obter recomendações personalizadas (clientes autenticados)
router.get("/recommendations", verifyToken, async (req: any, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const { getRecommendations } =
      await import("../services/recommendationService");
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await getRecommendations({
      userId: req.user.id,
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      message: "Recommendations retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Recommendations error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ============================================
// ROTAS DE SERVICE LISTINGS COM PARÂMETRO (DEVEM VIR POR ÚLTIMO)
// ============================================

// Obter detalhes de um serviço específico (público)
router.get("/:id", serviceController.getService);

// Atualizar listagem de serviço (apenas proprietário ou admin)
router.put(
  "/:id",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.updateServiceListing,
);

// Deletar listagem de serviço (apenas proprietário ou admin)
router.delete(
  "/:id",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.deleteServiceListing,
);

export default router;
