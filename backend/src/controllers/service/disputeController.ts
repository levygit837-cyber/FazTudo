import { Request, Response } from "express";
import prisma from "../../lib/prisma";

import { createLogger } from "../../lib/logger";

const log = createLogger("disputeController");


const DISPUTE_REASONS = [
  "Serviço não entregue",
  "Qualidade insatisfatória",
  "Profissional não compareceu",
  "Cobrança indevida",
  "Outro",
];

/**
 * POST /api/services/orders/:orderId/disputes
 * Open a dispute for an order
 */
export const createDispute = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const orderId = parseInt(String(req.params.orderId), 10);
    const { reason, description, attachments } = req.body;

    if (!reason || !description) {
      res.status(400).json({
        success: false,
        message: "Motivo e descrição são obrigatórios",
      });
      return;
    }

    // Verify the order exists and user is involved
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Pedido não encontrado" });
      return;
    }

    if (order.clientId !== userId && order.professionalId !== userId) {
      res.status(403).json({ success: false, message: "Sem permissão para abrir disputa neste pedido" });
      return;
    }

    // Only allow disputes for orders in certain statuses
    const allowedStatuses = ["IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION", "COMPLETED"];
    if (!allowedStatuses.includes(order.status)) {
      res.status(400).json({
        success: false,
        message: `Não é possível abrir disputa para pedidos com status "${order.status}"`,
      });
      return;
    }

    // Check for existing open dispute
    const existingDispute = await prisma.dispute.findFirst({
      where: {
        serviceOrderId: orderId,
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
    });

    if (existingDispute) {
      res.status(400).json({
        success: false,
        message: "Já existe uma disputa aberta para este pedido",
      });
      return;
    }

    const dispute = await prisma.dispute.create({
      data: {
        serviceOrderId: orderId,
        initiatorId: userId,
        reason,
        description,
        attachments: attachments || [],
        status: "OPEN",
      },
      include: {
        initiator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create notification for the other party
    const otherUserId = order.clientId === userId ? order.professionalId : order.clientId;
    if (otherUserId) {
      await prisma.notification.create({
        data: {
          userId: otherUserId,
          type: "SYSTEM_ALERT",
          title: "Disputa aberta",
          message: `Uma disputa foi aberta no pedido #${orderId}: ${reason}`,
          metadata: { orderId, disputeId: dispute.id },
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "Disputa aberta com sucesso",
      data: { dispute, availableReasons: DISPUTE_REASONS },
    });
  } catch (error) {
    log.error({ err: error }, "Error creating dispute");
    res.status(500).json({ success: false, message: "Erro interno do servidor" });
  }
};

/**
 * GET /api/services/orders/:orderId/disputes
 * Get disputes for an order
 */
export const getOrderDisputes = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const orderId = parseInt(String(req.params.orderId), 10);

    // Verify the order exists and user is involved
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Pedido não encontrado" });
      return;
    }

    if (order.clientId !== userId && order.professionalId !== userId) {
      res.status(403).json({ success: false, message: "Sem permissão" });
      return;
    }

    const disputes = await prisma.dispute.findMany({
      where: { serviceOrderId: orderId },
      include: {
        initiator: {
          select: { id: true, name: true, profileImage: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: { disputes, availableReasons: DISPUTE_REASONS },
    });
  } catch (error) {
    log.error({ err: error }, "Error fetching disputes");
    res.status(500).json({ success: false, message: "Erro interno do servidor" });
  }
};
