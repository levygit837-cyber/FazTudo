import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { env } from "../../config/env";
import { NotificationType } from "@prisma/client";
import {
  createPaymentPreference,
  getMPPaymentStatus,
  createCardPayment,
  createPixPayment,
  createBoletoPayment,
} from "../../services/mercadopagoService";

// Tipos para checkout transparente
interface CheckoutTransparenteBody {
  paymentMethod: "credit_card" | "pix" | "boleto";
  // Para cartão de crédito
  token?: string;
  paymentMethodId?: string;
  installments?: number;
  // Dados do pagador (todos os métodos)
  payerEmail?: string;
  payerName?: string;
  payerCPF?: string;
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

// Retorna public key do MercadoPago para o frontend
export const getMercadoPagoPublicKey = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const publicKey = env.MP_PUBLIC_KEY;
    if (!publicKey) {
      res.status(500).json(errorResponse("MercadoPago public key not configured", 500));
      return;
    }

    res.status(200).json(successResponse({
      publicKey,
      sandbox: env.MP_SANDBOX,
    }, "MercadoPago config retrieved"));
  } catch (error) {
    console.error("Get MP config error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// Criar pagamento para um pedido (apenas cliente) - Checkout Transparente
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
    const body: CheckoutTransparenteBody = req.body;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    if (!body.paymentMethod) {
      res.status(400).json(errorResponse("Payment method is required"));
      return;
    }

    if (!body.payerEmail || !body.payerName || !body.payerCPF) {
      res.status(400).json(errorResponse("Payer email, name and CPF are required"));
      return;
    }

    // Validar campos específicos do cartão
    if (body.paymentMethod === "credit_card") {
      if (!body.token || !body.paymentMethodId) {
        res.status(400).json(errorResponse("Card token and payment method ID are required for credit card payments"));
        return;
      }
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

    // Calcular taxas
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (serviceOrder.price * platformFeePercentage) / 100;
    const professionalAmount = serviceOrder.price - platformFee;
    const externalReference = `order-${orderId}-${Date.now()}`;

    let mpResult: any = null;
    let paymentData: any = {};

    try {
      if (body.paymentMethod === "credit_card") {
        const result = await createCardPayment({
          orderId,
          token: body.token!,
          paymentMethodId: body.paymentMethodId!,
          installments: body.installments || 1,
          amount: serviceOrder.price,
          payerEmail: body.payerEmail,
          payerName: body.payerName,
          payerCPF: body.payerCPF,
          externalReference,
          description: serviceOrder.title,
        });
        mpResult = result;
        paymentData = {
          mpPaymentId: result.id,
          mpStatus: result.status,
          mpStatusDetail: result.statusDetail,
          paymentType: "credit_card",
        };
      } else if (body.paymentMethod === "pix") {
        const result = await createPixPayment({
          orderId,
          amount: serviceOrder.price,
          payerEmail: body.payerEmail,
          payerName: body.payerName,
          payerCPF: body.payerCPF,
          externalReference,
          description: serviceOrder.title,
        });
        mpResult = result;
        paymentData = {
          mpPaymentId: result.id,
          mpStatus: result.status,
          mpStatusDetail: result.statusDetail,
          paymentType: "pix",
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          ticketUrl: result.ticketUrl,
          expirationDate: result.expirationDate,
        };
      } else if (body.paymentMethod === "boleto") {
        const result = await createBoletoPayment({
          orderId,
          amount: serviceOrder.price,
          payerEmail: body.payerEmail,
          payerName: body.payerName,
          payerCPF: body.payerCPF,
          externalReference,
          description: serviceOrder.title,
        });
        mpResult = result;
        paymentData = {
          mpPaymentId: result.id,
          mpStatus: result.status,
          mpStatusDetail: result.statusDetail,
          paymentType: "boleto",
          boletoUrl: result.boletoUrl,
          barcode: result.barcode,
          expirationDate: result.expirationDate,
        };
      }
    } catch (mpError: any) {
      console.error("MercadoPago payment creation failed:", mpError);

      // Em dev, criar pagamento local como fallback
      if (env.NODE_ENV !== "production") {
        console.warn("⚠️ MercadoPago unavailable — creating local payment record");
        mpResult = { status: "approved", id: `local-${Date.now()}` };
        paymentData = { paymentType: body.paymentMethod, localFallback: true };
      } else {
        res.status(502).json(errorResponse("Payment gateway unavailable. Try again later.", 502));
        return;
      }
    }

    // Determinar status do pagamento com base na resposta do MP
    const isApproved = mpResult?.status === "approved";
    const isPending = mpResult?.status === "pending" || mpResult?.status === "in_process";
    const now = new Date();
    const heldUntil = new Date();
    heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

    const payment = await prisma.payment.create({
      data: {
        amount: serviceOrder.price,
        status: isApproved ? "HELD" : "PENDING",
        paymentMethod: body.paymentMethod,
        transactionId: String(mpResult?.id || ""),
        metadata: {
          externalReference,
          ...paymentData,
          platformFee,
          professionalAmount,
          platformFeePercentage,
        },
        paidAt: isApproved ? now : null,
        heldUntil: isApproved ? heldUntil : null,
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

    // Se aprovado, criar transação e notificar
    if (isApproved) {
      await prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: serviceOrder.price,
          description: `Pagamento confirmado para pedido #${orderId}: ${serviceOrder.title}`,
          balanceBefore: 0,
          balanceAfter: 0,
          userId: req.user.id,
          paymentId: payment.id,
        },
      });

      // Criar mensagem de sistema no chat
      if (serviceOrder.professionalId) {
        await prisma.message.create({
          data: {
            content: `✅ Pagamento confirmado! O chat para o serviço "${serviceOrder.title}" está aberto. Use este canal para combinar detalhes do serviço.`,
            type: "SYSTEM",
            senderId: serviceOrder.clientId,
            recipientId: serviceOrder.professionalId,
            serviceOrderId: serviceOrder.id,
          },
        });
      }

      // Notificar profissional sobre pagamento
      if (serviceOrder.professionalId) {
        await createNotification(
          serviceOrder.professionalId,
          NotificationType.PAYMENT_RECEIVED,
          "💰 Pagamento confirmado",
          `Pagamento de R$${serviceOrder.price.toFixed(2)} confirmado para "${serviceOrder.title}". Verifique os detalhes do serviço e entre em contato com o cliente.`,
          orderId,
          { amount: serviceOrder.price, platformFee, professionalAmount, paymentMethod: body.paymentMethod },
        );
      }

      // Notificar cliente sobre pagamento aprovado
      await createNotification(
        req.user.id,
        NotificationType.PAYMENT_RECEIVED,
        "✅ Pagamento aprovado",
        `Seu pagamento de R$${serviceOrder.price.toFixed(2)} para "${serviceOrder.title}" foi aprovado! O profissional será notificado.`,
        orderId,
        { amount: serviceOrder.price, paymentMethod: body.paymentMethod },
      );
    }

    // Resposta com dados específicos do método de pagamento
    res.status(201).json(
      successResponse(
        {
          payment,
          paymentData: {
            status: mpResult?.status || "unknown",
            statusDetail: mpResult?.statusDetail || "",
            ...paymentData,
          },
          feeBreakdown: {
            totalAmount: serviceOrder.price,
            platformFeePercentage,
            platformFee,
            professionalAmount,
          },
        },
        isApproved
          ? "Pagamento aprovado! O profissional será notificado."
          : isPending
            ? "Pagamento em processamento. Você será notificado quando for confirmado."
            : "Pagamento criado.",
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

    const now = new Date();

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
        // Criar mensagem de sistema automática no chat
        ...(payment.serviceOrder.professionalId
          ? [
              prisma.message.create({
                data: {
                  content: `✅ Pagamento confirmado! O chat para o serviço "${payment.serviceOrder.title}" está aberto. Use este canal para combinar detalhes do serviço. Lembre-se: informações pessoais de contato são bloqueadas automaticamente para sua segurança.`,
                  type: "SYSTEM",
                  senderId: payment.serviceOrder.clientId,
                  recipientId: payment.serviceOrder.professionalId,
                  serviceOrderId: payment.serviceOrder.id,
                },
              }),
            ]
          : []),
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
