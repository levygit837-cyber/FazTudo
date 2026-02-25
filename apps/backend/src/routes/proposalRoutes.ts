import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireRole,
  requireVerified,
  authLogger,
} from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createProposalSchema } from "../middleware/validation";

const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// ROTAS DE PROPOSTAS
// ============================================

// Professional submits proposal for an order
router.post(
  "/orders/:orderId/proposals",
  verifyToken,
  requireRole("PROFESSIONAL"),
  requireVerified,
  validateBody(createProposalSchema),
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

export default router;
