import prisma from "../lib/prisma";
import { PaymentStatus, ServiceOrderStatus } from "@prisma/client";
import { env } from "../config/env";
import { createNotification, NotificationType } from "./notificationService";

import { createLogger } from "../lib/logger";

const log = createLogger("escrow");


// ==================== TIPOS ====================

interface EscrowConfig {
  defaultHoldDays: number;
  autoReleaseDays: number;
  disputePeriodDays: number;
  platformFeePercentage: number;
  minServiceValue: number;
  maxServiceValue: number | null;
}

interface CreatePaymentParams {
  serviceOrderId: number;
  clientId: number;
  professionalId: number;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  metadata?: any;
}

interface ReleasePaymentResult {
  success: boolean;
  payment?: any;
  professionalAmount?: number;
  platformFee?: number;
  error?: string;
}

// ==================== CONFIGURAÇÃO ====================

let cachedConfig: EscrowConfig | null = null;

/**
 * Obtém configuração de escrow do banco de dados
 */
export const getEscrowConfig = async (): Promise<EscrowConfig> => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const dbConfig = await prisma.escrowConfig.findFirst({
    where: { name: "default" },
  });

  if (dbConfig) {
    cachedConfig = {
      defaultHoldDays: dbConfig.defaultHoldDays,
      autoReleaseDays: dbConfig.autoReleaseDays,
      disputePeriodDays: dbConfig.disputePeriodDays,
      platformFeePercentage: dbConfig.platformFeePercentage,
      minServiceValue: dbConfig.minServiceValue,
      maxServiceValue: dbConfig.maxServiceValue,
    };
  } else {
    // Valores padrão do env
    cachedConfig = {
      defaultHoldDays: env.DEFAULT_ESCROW_HOLD_DAYS,
      autoReleaseDays: env.ESCROW_AUTO_RELEASE_DAYS,
      platformFeePercentage: env.PLATFORM_FEE_PERCENTAGE,
      disputePeriodDays: 3,
      minServiceValue: 0,
      maxServiceValue: null,
    };
  }

  return cachedConfig;
};

/**
 * Invalida cache de configuração
 */
export const invalidateConfigCache = (): void => {
  cachedConfig = null;
};

// ==================== CRIAÇÃO DE PAGAMENTO ====================

/**
 * Cria um pagamento e coloca em escrow
 */
export const createPaymentWithEscrow = async (
  params: CreatePaymentParams
): Promise<any> => {
  const config = await getEscrowConfig();
  const now = new Date();

  // Calcular data de retenção (quando pode ser liberado)
  const heldUntil = new Date(now);
  heldUntil.setDate(heldUntil.getDate() + config.defaultHoldDays);

  // Criar pagamento em escrow
  const payment = await prisma.payment.create({
    data: {
      amount: params.amount,
      status: "HELD",
      paymentMethod: params.paymentMethod,
      transactionId: params.transactionId || null,
      metadata: params.metadata || null,
      paidAt: now,
      heldUntil: heldUntil,
      serviceOrderId: params.serviceOrderId,
      clientId: params.clientId,
      professionalId: params.professionalId,
    },
  });

  // Criar transação de entrada no sistema
  await prisma.transaction.create({
    data: {
      type: "PAYMENT",
      amount: params.amount,
      description: `Payment received for order #${params.serviceOrderId}`,
      balanceBefore: 0,
      balanceAfter: 0,
      userId: params.clientId,
      paymentId: payment.id,
    },
  });

  return payment;
};

// ==================== LIBERAÇÃO DE PAGAMENTO ====================

/**
 * Libera pagamento do escrow para o profissional
 */
export const releasePaymentFromEscrow = async (
  paymentId: number,
  forcedByAdmin: boolean = false
): Promise<ReleasePaymentResult> => {
  const config = await getEscrowConfig();
  const now = new Date();

  // Buscar pagamento
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      serviceOrder: {
        include: {
          professional: true,
          client: true,
        },
      },
    },
  });

  if (!payment) {
    return { success: false, error: "Payment not found" };
  }

  if (payment.status !== "HELD") {
    return { success: false, error: "Payment is not in escrow" };
  }

  // Verificar se período de retenção já passou (exceto admin)
  if (!forcedByAdmin && payment.heldUntil && now < payment.heldUntil) {
    return {
      success: false,
      error: `Payment cannot be released yet. Available after: ${payment.heldUntil.toISOString()}`,
    };
  }

  // Calcular valores
  const platformFee = (payment.amount * config.platformFeePercentage) / 100;
  const professionalAmount = payment.amount - platformFee;

  // Executar transação
  const [updatedPayment] = await prisma.$transaction([
    // Atualizar status do pagamento
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "RELEASED",
        releasedAt: now,
      },
    }),
    // Criar transação para o profissional
    prisma.transaction.create({
      data: {
        type: "PAYMENT",
        amount: professionalAmount,
        description: `Payment released from escrow for order #${payment.serviceOrderId}`,
        balanceBefore: payment.serviceOrder.professional?.balance || 0,
        balanceAfter: (payment.serviceOrder.professional?.balance || 0) + professionalAmount,
        userId: payment.professionalId!,
        paymentId: payment.id,
      },
    }),
    // Atualizar saldo do profissional
    prisma.user.update({
      where: { id: payment.professionalId! },
      data: {
        balance: {
          increment: professionalAmount,
        },
      },
    }),
  ]);

  // Notificar profissional
  if (payment.professionalId) {
    await createNotification(
      payment.professionalId,
      NotificationType.PAYMENT_RELEASED,
      "Pagamento liberado",
      `Pagamento de R$${professionalAmount.toFixed(2)} liberado para seu saldo`,
      payment.serviceOrderId,
      {
        paymentId: payment.id,
        totalAmount: payment.amount,
        platformFee,
        professionalAmount,
      }
    );
  }

  return {
    success: true,
    payment: updatedPayment,
    professionalAmount,
    platformFee,
  };
};

// ==================== REEMBOLSO ====================

/**
 * Processa reembolso de pagamento em escrow
 */
export const refundPayment = async (
  paymentId: number,
  reason: string,
  partialAmount?: number
): Promise<{ success: boolean; error?: string }> => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      serviceOrder: true,
    },
  });

  if (!payment) {
    return { success: false, error: "Payment not found" };
  }

  if (payment.status !== "HELD" && payment.status !== "PENDING") {
    return { success: false, error: "Payment cannot be refunded in current status" };
  }

  const refundAmount = partialAmount || payment.amount;
  const isPartial = partialAmount && partialAmount < payment.amount;
  const now = new Date();

  await prisma.$transaction([
    // Atualizar pagamento
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: isPartial ? "PARTIALLY_REFUNDED" : "REFUNDED",
        refundedAt: now,
        metadata: {
          ...(payment.metadata as object || {}),
          refundReason: reason,
          refundAmount,
          refundedAt: now.toISOString(),
        },
      },
    }),
    // Criar transação de reembolso
    prisma.transaction.create({
      data: {
        type: "REFUND",
        amount: refundAmount,
        description: `Refund for order #${payment.serviceOrderId}: ${reason}`,
        balanceBefore: 0,
        balanceAfter: 0,
        userId: payment.clientId,
        paymentId: payment.id,
      },
    }),
  ]);

  // Notificar cliente
  await createNotification(
    payment.clientId,
    NotificationType.SYSTEM_ALERT,
    "Reembolso processado",
    `Reembolso de R$${refundAmount.toFixed(2)} processado para o pedido #${payment.serviceOrderId}`,
    payment.serviceOrderId,
    { refundAmount, reason }
  );

  return { success: true };
};

// ==================== VERIFICAÇÃO DE PRAZOS ====================

/**
 * Verifica pagamentos que podem ser liberados automaticamente
 */
export const checkAutoReleasablePayments = async (): Promise<number> => {
  const config = await getEscrowConfig();
  const now = new Date();

  // Buscar pagamentos em escrow cujo prazo de retenção já passou
  // E cujas orders estão completas
  const payments = await prisma.payment.findMany({
    where: {
      status: "HELD",
      heldUntil: {
        lte: now,
      },
      serviceOrder: {
        status: "COMPLETED",
      },
    },
    include: {
      serviceOrder: true,
    },
  });

  let releasedCount = 0;

  for (const payment of payments) {
    // Verificar se já passou o período de auto-release após conclusão
    const serviceOrder = payment.serviceOrder;
    if (serviceOrder.completedAt) {
      const autoReleaseDate = new Date(serviceOrder.completedAt);
      autoReleaseDate.setDate(autoReleaseDate.getDate() + config.autoReleaseDays);

      if (now >= autoReleaseDate) {
        const result = await releasePaymentFromEscrow(payment.id, true);
        if (result.success) {
          releasedCount++;
          log.info("Auto-released payment #%s for order #%s");
        }
      }
    }
  }

  return releasedCount;
};

// ==================== VERIFICAÇÃO DE ORDENS EXPIRADAS ====================

/**
 * Verifica ordens que passaram do prazo
 */
export const checkExpiredOrders = async (): Promise<number> => {
  const now = new Date();

  // Buscar ordens em andamento que passaram do prazo
  const expiredOrders = await prisma.serviceOrder.findMany({
    where: {
      status: {
        in: ["ACCEPTED", "IN_PROGRESS"],
      },
      deadlineDate: {
        lt: now,
      },
    },
    include: {
      client: true,
      professional: true,
    },
  });

  let notifiedCount = 0;

  for (const order of expiredOrders) {
    // Atualizar status para expirado
    await prisma.serviceOrder.update({
      where: { id: order.id },
      data: { status: "EXPIRED" },
    });

    // Notificar cliente
    await createNotification(
      order.clientId,
      NotificationType.DEADLINE_EXPIRED,
      "Prazo do serviço expirado",
      `O prazo do serviço "${order.title}" expirou. Entre em contato com o profissional ou solicite cancelamento.`,
      order.id,
      {
        orderId: order.id,
        professionalId: order.professionalId,
        deadlineDate: order.deadlineDate?.toISOString(),
      }
    );

    // Notificar profissional
    if (order.professionalId) {
      await createNotification(
        order.professionalId,
        NotificationType.DEADLINE_EXPIRED,
        "Prazo do serviço expirado",
        `O prazo do serviço "${order.title}" expirou. Entre em contato com o cliente para resolver a situação.`,
        order.id,
        {
          orderId: order.id,
          clientId: order.clientId,
          deadlineDate: order.deadlineDate?.toISOString(),
        }
      );
    }

    notifiedCount++;
  }

  return notifiedCount;
};

/**
 * Envia avisos de prazos próximos de expirar
 */
export const sendDeadlineWarnings = async (daysBeforeDeadline: number = 1): Promise<number> => {
  const now = new Date();
  const warningDate = new Date(now);
  warningDate.setDate(warningDate.getDate() + daysBeforeDeadline);

  // Buscar ordens que vão expirar em breve
  const ordersNearDeadline = await prisma.serviceOrder.findMany({
    where: {
      status: {
        in: ["ACCEPTED", "IN_PROGRESS"],
      },
      deadlineDate: {
        gte: now,
        lte: warningDate,
      },
    },
    include: {
      client: true,
      professional: true,
      notifications: {
        where: {
          type: "DEADLINE_WARNING",
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Últimas 24h
          },
        },
      },
    },
  });

  let warningsSent = 0;

  for (const order of ordersNearDeadline) {
    // Não enviar se já enviou aviso nas últimas 24h
    if (order.notifications.length > 0) {
      continue;
    }

    const hoursRemaining = Math.ceil(
      (order.deadlineDate!.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    // Notificar cliente
    await createNotification(
      order.clientId,
      NotificationType.DEADLINE_WARNING,
      "Prazo próximo de expirar",
      `O prazo do serviço "${order.title}" expira em ${hoursRemaining} horas.`,
      order.id,
      {
        orderId: order.id,
        hoursRemaining,
        deadlineDate: order.deadlineDate?.toISOString(),
      }
    );

    // Notificar profissional
    if (order.professionalId) {
      await createNotification(
        order.professionalId,
        NotificationType.DEADLINE_WARNING,
        "Prazo próximo de expirar",
        `O prazo do serviço "${order.title}" expira em ${hoursRemaining} horas. Finalize o serviço para receber o pagamento.`,
        order.id,
        {
          orderId: order.id,
          hoursRemaining,
          deadlineDate: order.deadlineDate?.toISOString(),
        }
      );
    }

    warningsSent++;
  }

  return warningsSent;
};

// ==================== CÁLCULOS ====================

/**
 * Calcula valores de um serviço (preço, taxa, valor líquido)
 */
export const calculateServiceValues = async (
  grossAmount: number
): Promise<{
  grossAmount: number;
  platformFee: number;
  professionalAmount: number;
  platformFeePercentage: number;
}> => {
  const config = await getEscrowConfig();
  const platformFee = (grossAmount * config.platformFeePercentage) / 100;
  const professionalAmount = grossAmount - platformFee;

  return {
    grossAmount,
    platformFee,
    professionalAmount,
    platformFeePercentage: config.platformFeePercentage,
  };
};

/**
 * Valida valor do serviço contra limites configurados
 */
export const validateServiceValue = async (
  amount: number
): Promise<{ valid: boolean; error?: string }> => {
  const config = await getEscrowConfig();

  if (amount < config.minServiceValue) {
    return {
      valid: false,
      error: `Minimum service value is R$${config.minServiceValue.toFixed(2)}`,
    };
  }

  if (config.maxServiceValue && amount > config.maxServiceValue) {
    return {
      valid: false,
      error: `Maximum service value is R$${config.maxServiceValue.toFixed(2)}`,
    };
  }

  return { valid: true };
};

export default {
  getEscrowConfig,
  invalidateConfigCache,
  createPaymentWithEscrow,
  releasePaymentFromEscrow,
  refundPayment,
  checkAutoReleasablePayments,
  checkExpiredOrders,
  sendDeadlineWarnings,
  calculateServiceValues,
  validateServiceValue,
};
