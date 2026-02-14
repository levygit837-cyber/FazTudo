import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { env } from "../../config/env";
import { NotificationType } from "@prisma/client";

// Tipos para request bodies
interface CreatePaymentBody {
  paymentMethod: string;
  transactionId?: string;
  metadata?: any;
}

// Utilitário para respostas padronizadas
const successResponse = (data: any, message: string = "Success") => ({
  success: true,
  message,
  data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false,
  message,
  statusCode,
});

// Utilitário para criar notificações
const createNotification = async (
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  serviceOrderId?: number,
  metadata?: any,
) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        serviceOrderId: serviceOrderId || null,
        metadata,
      },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

// Criar pagamento para um pedido (apenas cliente)
export const createPayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "CLIENT") {
      res.status(403).json(errorResponse("Only clients can create payments"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const { paymentMethod, transactionId, metadata }: CreatePaymentBody =
      req.body;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    if (!paymentMethod) {
      res.status(400).json(errorResponse("Payment method is required"));
      return;
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        professional: true,
        payments: {
          where: {
            status: {
              in: ["PENDING", "HELD"],
            },
          },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar se pedido pertence ao cliente
    if (serviceOrder.clientId !== req.user.id) {
      res
        .status(403)
        .json(errorResponse("You don't have permission to pay for this order"));
      return;
    }

    // Verificar se pedido pode receber pagamento
    if (
      serviceOrder.status !== "PENDING" &&
      serviceOrder.status !== "ACCEPTED"
    ) {
      res
        .status(400)
        .json(
          errorResponse(
            `Payment cannot be processed. Order status: ${serviceOrder.status}`,
          ),
        );
      return;
    }

    // Verificar se já existe pagamento ativo
    if (serviceOrder.payments.length > 0) {
      res
        .status(400)
        .json(
          errorResponse("There is already an active payment for this order"),
        );
      return;
    }

    // Calcular taxa da plataforma
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (serviceOrder.price * platformFeePercentage) / 100;
    const professionalAmount = serviceOrder.price - platformFee;

    // Calcular datas
    const now = new Date();
    const heldUntil = new Date();
    heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

    // Criar pagamento em escrow
    const payment = await prisma.payment.create({
      data: {
        amount: serviceOrder.price,
        status: "HELD",
        paymentMethod,
        transactionId: transactionId || undefined,
        metadata: metadata || undefined,
        paidAt: now,
        heldUntil,
        serviceOrderId: orderId,
        clientId: req.user.id,
        professionalId: serviceOrder.professionalId || undefined,
      },
      include: {
        serviceOrder: {
          select: {
            title: true,
            price: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Criar transação
    await prisma.transaction.create({
      data: {
        type: "PAYMENT",
        amount: serviceOrder.price,
        description: `Payment for order #${orderId}: ${serviceOrder.title}`,
        balanceBefore: 0, // Seria calculado com o saldo atual
        balanceAfter: 0,
        userId: req.user.id,
        paymentId: payment.id,
      },
    });

    // Criar notificação para o profissional
    await createNotification(
      serviceOrder.professionalId!,
      NotificationType.PAYMENT_RECEIVED,
      "Pagamento recebido",
      `Pagamento de R$${serviceOrder.price.toFixed(2)} recebido para o pedido "${serviceOrder.title}"`,
      orderId,
      {
        amount: serviceOrder.price,
        platformFee,
        professionalAmount,
        heldUntil: heldUntil.toISOString(),
      },
    );

    res.status(201).json(
      successResponse(
        {
          payment,
          feeBreakdown: {
            totalAmount: serviceOrder.price,
            platformFeePercentage,
            platformFee,
            professionalAmount,
            heldUntil,
          },
        },
        "Payment created successfully. Amount held in escrow.",
      ),
    );
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Liberar pagamento em escrow (cliente após período de revisão ou automaticamente)
export const releasePayment = async (
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

    // Buscar pedido e pagamento
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: {
            status: "HELD",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar se pedido pertence ao cliente ou é admin
    const isClient = serviceOrder.clientId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isClient && !isAdmin) {
      res
        .status(403)
        .json(
          errorResponse("You don't have permission to release this payment"),
        );
      return;
    }

    // Verificar se há pagamento em escrow
    if (serviceOrder.payments.length === 0) {
      res
        .status(404)
        .json(errorResponse("No payment held in escrow for this order"));
      return;
    }

    const payment = serviceOrder.payments[0];

    if (!payment) {
      res.status(404).json(errorResponse("Payment not found"));
      return;
    }

    // Verificar se pagamento pode ser liberado
    if (payment.status !== "HELD") {
      res.status(400).json(errorResponse("Payment is not in escrow status"));
      return;
    }

    if (serviceOrder.status !== "COMPLETED" && !isAdmin) {
      res
        .status(400)
        .json(
          errorResponse(
            "Payment can only be released after order completion confirmation",
          ),
        );
      return;
    }

    // Verificar se período de espera já passou (ou admin pode liberar)
    const now = new Date();
    if (payment.heldUntil && now < payment.heldUntil && !isAdmin) {
      res.status(400).json({
        success: false,
        message: `Payment cannot be released yet. Available after: ${payment.heldUntil.toISOString()}`,
        data: { heldUntil: payment.heldUntil },
      });
      return;
    }

    // Calcular valores
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (payment.amount * platformFeePercentage) / 100;
    const professionalAmount = payment.amount - platformFee;

    // Executar transação para liberar pagamento
    const [updatedPayment, professionalTransaction] = await prisma.$transaction(
      [
        // Atualizar status do pagamento
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "RELEASED",
            releasedAt: now,
          },
        }),
        // Adicionar transação para o profissional
        prisma.transaction.create({
          data: {
            type: "PAYMENT",
            amount: professionalAmount,
            description: `Payment released from escrow for order #${orderId}`,
            balanceBefore: 0, // Seria calculado com o saldo atual do profissional
            balanceAfter: 0,
            userId: serviceOrder.professionalId!,
            paymentId: payment.id,
          },
        }),
        // Atualizar saldo do profissional
        prisma.user.update({
          where: { id: serviceOrder.professionalId! },
          data: {
            balance: {
              increment: professionalAmount,
            },
          },
        }),
      ],
    );

    // Criar notificação para o profissional
    await createNotification(
      serviceOrder.professionalId!,
      NotificationType.PAYMENT_RELEASED,
      "Pagamento liberado",
      `Pagamento de R$${professionalAmount.toFixed(2)} liberado do escrow para o pedido "${serviceOrder.title}"`,
      orderId,
      {
        totalAmount: payment.amount,
        platformFee,
        professionalAmount,
        releasedAt: now.toISOString(),
      },
    );

    res.status(200).json(
      successResponse(
        {
          payment: updatedPayment,
          releasedAmount: professionalAmount,
          platformFee,
        },
        "Payment released successfully",
      ),
    );
  } catch (error) {
    console.error("Release payment error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
