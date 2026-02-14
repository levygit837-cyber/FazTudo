import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { env } from "../../config/env";
import { NotificationType } from "@prisma/client";
import { createPaymentPreference, getMPPaymentStatus } from "../../services/mercadopagoService";

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
    const { paymentMethod }: CreatePaymentBody = req.body;

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
        client: true,
        serviceListing: true,
        payments: {
          where: {
            status: { in: ["PENDING", "HELD"] },
          },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.clientId !== req.user.id) {
      res.status(403).json(errorResponse("You don't have permission to pay for this order"));
      return;
    }

    if (serviceOrder.status !== "PENDING" && serviceOrder.status !== "ACCEPTED") {
      res.status(400).json(errorResponse(`Payment cannot be processed. Order status: ${serviceOrder.status}`));
      return;
    }

    if (serviceOrder.payments.length > 0) {
      res.status(400).json(errorResponse("There is already an active payment for this order"));
      return;
    }

    // Calcular taxa da plataforma
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (serviceOrder.price * platformFeePercentage) / 100;
    const professionalAmount = serviceOrder.price - platformFee;

    // Criar preferência MercadoPago
    const externalReference = `order-${orderId}-${Date.now()}`;

    let mpPreference: any = null;
    try {
      mpPreference = await createPaymentPreference({
        orderId,
        title: serviceOrder.title,
        description: serviceOrder.description || serviceOrder.title,
        amount: serviceOrder.price,
        payerEmail: serviceOrder.client.email,
        payerName: serviceOrder.client.name,
        externalReference,
      });
    } catch (mpError) {
      console.error("MercadoPago preference creation failed:", mpError);
      // Fallback: create payment record without MP (for development)
      if (env.NODE_ENV !== "production") {
        console.warn("⚠️ MercadoPago unavailable — creating local payment record");
      } else {
        res.status(502).json(errorResponse("Payment gateway unavailable. Try again later.", 502));
        return;
      }
    }

    // Criar pagamento PENDING (será atualizado via webhook quando MP confirmar)
    const now = new Date();
    const heldUntil = new Date();
    heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

    const payment = await prisma.payment.create({
      data: {
        amount: serviceOrder.price,
        status: mpPreference ? "PENDING" : "HELD", // PENDING if MP, HELD if fallback
        paymentMethod,
        transactionId: mpPreference?.preferenceId || null,
        metadata: {
          externalReference,
          preferenceId: mpPreference?.preferenceId || null,
          initPoint: mpPreference?.initPoint || null,
          sandboxInitPoint: mpPreference?.sandboxInitPoint || null,
          platformFee,
          professionalAmount,
          platformFeePercentage,
        },
        paidAt: mpPreference ? null : now, // Only set paidAt if fallback (no MP)
        heldUntil: mpPreference ? null : heldUntil,
        serviceOrderId: orderId,
        clientId: req.user.id,
        professionalId: serviceOrder.professionalId || undefined,
      },
      include: {
        serviceOrder: { select: { title: true, price: true } },
        client: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
      },
    });

    // Se fallback (sem MP), criar transação e notificar
    if (!mpPreference) {
      await prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: serviceOrder.price,
          description: `Payment for order #${orderId}: ${serviceOrder.title}`,
          balanceBefore: 0,
          balanceAfter: 0,
          userId: req.user.id,
          paymentId: payment.id,
        },
      });

      if (serviceOrder.professionalId) {
        await createNotification(
          serviceOrder.professionalId,
          NotificationType.PAYMENT_RECEIVED,
          "Pagamento recebido",
          `Pagamento de R$${serviceOrder.price.toFixed(2)} recebido para "${serviceOrder.title}"`,
          orderId,
          { amount: serviceOrder.price, platformFee, professionalAmount },
        );
      }
    }

    res.status(201).json(
      successResponse(
        {
          payment,
          checkout: mpPreference
            ? {
                preferenceId: mpPreference.preferenceId,
                checkoutUrl: env.MP_SANDBOX
                  ? mpPreference.sandboxInitPoint
                  : mpPreference.initPoint,
              }
            : null,
          feeBreakdown: {
            totalAmount: serviceOrder.price,
            platformFeePercentage,
            platformFee,
            professionalAmount,
          },
        },
        mpPreference
          ? "Payment preference created. Redirect user to checkout."
          : "Payment created successfully. Amount held in escrow.",
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

// Webhook do MercadoPago
export const mercadoPagoWebhook = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { type, data } = req.body;

    // MercadoPago envia notificações de diferentes tipos
    if (type !== "payment") {
      res.status(200).json({ received: true });
      return;
    }

    const mpPaymentId = data?.id;
    if (!mpPaymentId) {
      res.status(200).json({ received: true });
      return;
    }

    // Buscar status do pagamento no MercadoPago
    let mpPayment;
    try {
      mpPayment = await getMPPaymentStatus(String(mpPaymentId));
    } catch (err) {
      console.error("Failed to fetch MP payment status:", err);
      res.status(200).json({ received: true });
      return;
    }

    if (!mpPayment.externalReference) {
      res.status(200).json({ received: true });
      return;
    }

    // Extrair orderId do external_reference (formato: "order-{id}-{timestamp}")
    const refParts = mpPayment.externalReference.split("-");
    const orderId = parseInt(refParts[1] || "", 10);

    if (isNaN(orderId)) {
      console.error("Invalid external_reference:", mpPayment.externalReference);
      res.status(200).json({ received: true });
      return;
    }

    // Buscar pagamento pendente para esta ordem
    const payment = await prisma.payment.findFirst({
      where: {
        serviceOrderId: orderId,
        status: "PENDING",
      },
      include: {
        serviceOrder: true,
      },
    });

    if (!payment) {
      res.status(200).json({ received: true });
      return;
    }

    // Processar baseado no status do MP
    if (mpPayment.status === "approved") {
      const now = new Date();
      const heldUntil = new Date();
      heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

      // Atualizar pagamento para HELD (escrow)
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "HELD",
            transactionId: String(mpPaymentId),
            paidAt: now,
            heldUntil,
            metadata: {
              ...(payment.metadata as any || {}),
              mpPaymentId,
              mpStatus: mpPayment.status,
              mpStatusDetail: mpPayment.statusDetail,
              mpPaymentMethod: mpPayment.paymentMethodId,
              mpDateApproved: mpPayment.dateApproved,
            },
          },
        }),
        prisma.transaction.create({
          data: {
            type: "PAYMENT",
            amount: payment.amount,
            description: `Payment confirmed via MercadoPago for order #${orderId}`,
            balanceBefore: 0,
            balanceAfter: 0,
            userId: payment.clientId,
            paymentId: payment.id,
          },
        }),
      ]);

      // Notificar profissional
      if (payment.serviceOrder.professionalId) {
        const platformFee = (payment.amount * env.PLATFORM_FEE_PERCENTAGE) / 100;
        await createNotification(
          payment.serviceOrder.professionalId,
          NotificationType.PAYMENT_RECEIVED,
          "Pagamento confirmado",
          `Pagamento de R$${payment.amount.toFixed(2)} confirmado para "${payment.serviceOrder.title}"`,
          orderId,
          { amount: payment.amount, platformFee },
        );
      }
    } else if (mpPayment.status === "rejected" || mpPayment.status === "cancelled") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          metadata: {
            ...(payment.metadata as any || {}),
            mpPaymentId,
            mpStatus: mpPayment.status,
            mpStatusDetail: mpPayment.statusDetail,
          },
        },
      });
    }
    // For "pending" or "in_process", we keep the payment as PENDING

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("MercadoPago webhook error:", error);
    // Always return 200 to MP to avoid retries on our errors
    res.status(200).json({ received: true });
  }
};
