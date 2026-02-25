import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { createNotification, NotificationType } from "../../services/notificationService";

import { createLogger } from "../../lib/logger";

const log = createLogger("proposalController");


const successResponse = (data: any, message: string = "Success") => ({
  success: true, message, data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false, message, statusCode,
});

// POST /api/services/orders/:orderId/proposals — Professional submits proposal
export const createProposal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can create proposals"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const { price, estimatedDays, estimatedHours, description, guaranteeDays } = req.body;

    if (!price || price <= 0) {
      res.status(400).json(errorResponse("Price is required and must be positive"));
      return;
    }
    if (!description || !description.trim()) {
      res.status(400).json(errorResponse("Description is required"));
      return;
    }

    // Verificar se o pedido existe e está aberto
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { client: { select: { id: true, name: true } } },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.status !== "PENDING") {
      res.status(400).json(errorResponse("Proposals can only be submitted for pending orders"));
      return;
    }

    // Verificar se já existe proposta deste profissional
    const existingProposal = await prisma.proposal.findUnique({
      where: {
        serviceOrderId_professionalId: {
          serviceOrderId: orderId,
          professionalId: req.user.id,
        },
      },
    });

    if (existingProposal) {
      res.status(400).json(errorResponse("You already submitted a proposal for this order"));
      return;
    }

    const proposal = await prisma.proposal.create({
      data: {
        serviceOrderId: orderId,
        professionalId: req.user.id,
        price: parseFloat(String(price)),
        estimatedDays: estimatedDays ? parseInt(String(estimatedDays), 10) : null,
        estimatedHours: estimatedHours ? parseInt(String(estimatedHours), 10) : null,
        description: description.trim(),
        guaranteeDays: guaranteeDays ? parseInt(String(guaranteeDays), 10) : null,
        status: "PENDING",
      },
      include: {
        professional: {
          select: { id: true, name: true, profileImage: true, ratingAverage: true, totalReviews: true },
        },
      },
    });

    // Notificar o cliente
    await createNotification(
      serviceOrder.clientId,
      NotificationType.ORDER_ACCEPTED,
      "Nova proposta recebida",
      `${req.user.name} enviou uma proposta de R$${parseFloat(String(price)).toFixed(2)} para "${serviceOrder.title}"`,
      orderId,
      { proposalId: proposal.id, professionalId: req.user.id },
    );

    res.status(201).json(successResponse({ proposal }, "Proposal submitted successfully"));
  } catch (error) {
    log.error({ err: error }, "Create proposal error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// GET /api/services/orders/:orderId/proposals — Get proposals for an order
export const getOrderProposals = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Verificar acesso
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    const isClient = serviceOrder.clientId === req.user.id;
    const isProfessional = req.user.role === "PROFESSIONAL";
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isProfessional && !isAdmin) {
      res.status(403).json(errorResponse("Access denied"));
      return;
    }

    const proposals = await prisma.proposal.findMany({
      where: {
        serviceOrderId: orderId,
        // Profissionais só veem a própria proposta
        ...(isProfessional && !isAdmin ? { professionalId: req.user.id } : {}),
      },
      include: {
        professional: {
          select: {
            id: true,
            name: true,
            profileImage: true,
            ratingAverage: true,
            totalReviews: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json(successResponse({ proposals, total: proposals.length }));
  } catch (error) {
    log.error({ err: error }, "Get order proposals error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// POST /api/services/orders/:orderId/proposals/:proposalId/accept — Client accepts a proposal
export const acceptProposal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const proposalId = parseInt(String(req.params.proposalId), 10);

    if (isNaN(orderId) || isNaN(proposalId)) {
      res.status(400).json(errorResponse("Invalid order or proposal ID"));
      return;
    }

    // Verificar pedido e propriedade
    const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }
    if (serviceOrder.clientId !== req.user.id) {
      res.status(403).json(errorResponse("Only the order client can accept proposals"));
      return;
    }
    if (serviceOrder.status !== "PENDING") {
      res.status(400).json(errorResponse("Can only accept proposals for pending orders"));
      return;
    }

    // Verificar proposta
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, serviceOrderId: orderId, status: "PENDING" },
      include: { professional: { select: { id: true, name: true } } },
    });

    if (!proposal) {
      res.status(404).json(errorResponse("Proposal not found or already processed"));
      return;
    }

    // Aceitar proposta e atualizar pedido numa transação
    const [updatedProposal, updatedOrder] = await prisma.$transaction([
      // Aceitar proposta
      prisma.proposal.update({
        where: { id: proposalId },
        data: { status: "ACCEPTED" },
      }),
      // Atualizar pedido com profissional e preço
      prisma.serviceOrder.update({
        where: { id: orderId },
        data: {
          professionalId: proposal.professionalId,
          price: proposal.price,
          status: "ACCEPTED",
        },
      }),
      // Rejeitar todas as outras propostas
      prisma.proposal.updateMany({
        where: {
          serviceOrderId: orderId,
          id: { not: proposalId },
          status: "PENDING",
        },
        data: { status: "REJECTED" },
      }),
    ]);

    // Notificar profissional aceito
    await createNotification(
      proposal.professionalId,
      NotificationType.ORDER_ACCEPTED,
      "Proposta aceita!",
      `Sua proposta de R$${proposal.price.toFixed(2)} para "${serviceOrder.title}" foi aceita!`,
      orderId,
      { proposalId },
    );

    res.status(200).json(successResponse({ proposal: updatedProposal, serviceOrder: updatedOrder }, "Proposal accepted"));
  } catch (error) {
    log.error({ err: error }, "Accept proposal error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// POST /api/services/orders/:orderId/proposals/:proposalId/reject — Client rejects
export const rejectProposal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const proposalId = parseInt(String(req.params.proposalId), 10);

    if (isNaN(orderId) || isNaN(proposalId)) {
      res.status(400).json(errorResponse("Invalid IDs"));
      return;
    }

    const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id: orderId } });
    if (!serviceOrder || serviceOrder.clientId !== req.user.id) {
      res.status(403).json(errorResponse("Access denied"));
      return;
    }

    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, serviceOrderId: orderId, status: "PENDING" },
    });

    if (!proposal) {
      res.status(404).json(errorResponse("Proposal not found"));
      return;
    }

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "REJECTED" },
    });

    res.status(200).json(successResponse({ proposal: updated }, "Proposal rejected"));
  } catch (error) {
    log.error({ err: error }, "Reject proposal error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// POST /api/services/orders/:orderId/proposals/:proposalId/withdraw — Professional withdraws
export const withdrawProposal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const proposalId = parseInt(String(req.params.proposalId), 10);

    if (isNaN(orderId) || isNaN(proposalId)) {
      res.status(400).json(errorResponse("Invalid IDs"));
      return;
    }

    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, serviceOrderId: orderId, professionalId: req.user.id, status: "PENDING" },
    });

    if (!proposal) {
      res.status(404).json(errorResponse("Proposal not found or cannot be withdrawn"));
      return;
    }

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: "WITHDRAWN" },
    });

    res.status(200).json(successResponse({ proposal: updated }, "Proposal withdrawn"));
  } catch (error) {
    log.error({ err: error }, "Withdraw proposal error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
