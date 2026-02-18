import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import { checkIdempotencyKey } from "../lib/idempotency";

import { createLogger } from "../lib/logger";

const log = createLogger("walletController");


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

const VALID_TRANSACTION_TYPES = ["DEPOSIT", "WITHDRAWAL", "PAYMENT", "REFUND", "FEE"];

/**
 * GET /api/wallet/balance
 * Retorna saldo do usuario autenticado
 */
export const getBalance = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { balance: true },
    });

    if (!user) {
      res.status(404).json(errorResponse("Usuario nao encontrado"));
      return;
    }

    res.status(200).json(successResponse({ balance: user.balance }, "Saldo recuperado"));
  } catch (error) {
    log.error({ err: error }, "Wallet balance error");
    res.status(500).json(errorResponse("Erro interno do servidor", 500));
  }
};

/**
 * GET /api/wallet/transactions
 * Lista transacoes com filtros e paginacao
 */
export const getTransactions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const {
      type,
      dateFrom,
      dateTo,
      page: pageStr,
      limit: limitStr,
    } = req.query;

    const page = Math.max(1, parseInt(pageStr as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitStr as string) || 20));

    // Validacao do tipo
    if (type && !VALID_TRANSACTION_TYPES.includes(type as string)) {
      res.status(400).json(
        errorResponse(
          `Tipo invalido. Valores aceitos: ${VALID_TRANSACTION_TYPES.join(", ")}`,
        ),
      );
      return;
    }

    // Montar filtro
    const where: any = { userId: req.user.id };

    if (type) {
      where.type = type as string;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo as string);
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          payment: {
            select: { id: true, status: true, serviceOrderId: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.status(200).json(
      successResponse(
        {
          transactions,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Transacoes recuperadas",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Wallet transactions error");
    res.status(500).json(errorResponse("Erro interno do servidor", 500));
  }
};

/**
 * GET /api/wallet/summary
 * Resumo financeiro (difere por role)
 */
export const getSummary = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const userId = req.user.id;
    const role = req.user.role;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      res.status(404).json(errorResponse("Usuario nao encontrado"));
      return;
    }

    if (role === "CLIENT") {
      const [spentAgg, refundAgg, pendingEscrow] = await Promise.all([
        prisma.transaction.aggregate({
          where: { userId, type: "PAYMENT" },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "REFUND" },
          _sum: { amount: true },
        }),
        prisma.payment.findMany({
          where: { clientId: userId, status: "HELD" },
          select: { amount: true },
        }),
      ]);

      const pendingInEscrow = pendingEscrow.reduce((sum, p) => sum + p.amount, 0);

      res.status(200).json(
        successResponse(
          {
            balance: user.balance,
            totalSpent: spentAgg._sum.amount || 0,
            totalRefunded: refundAgg._sum.amount || 0,
            pendingInEscrow,
          },
          "Resumo do cliente recuperado",
        ),
      );
    } else if (role === "PROFESSIONAL") {
      const [earnedAgg, withdrawnAgg, feeAgg, pendingEscrow] = await Promise.all([
        prisma.transaction.aggregate({
          where: { userId, type: "PAYMENT" },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "WITHDRAWAL" },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "FEE" },
          _sum: { amount: true },
        }),
        prisma.payment.findMany({
          where: { professionalId: userId, status: "HELD" },
          select: { amount: true },
        }),
      ]);

      const totalEarned = earnedAgg._sum.amount || 0;
      const totalWithdrawn = withdrawnAgg._sum.amount || 0;
      const totalFees = feeAgg._sum.amount || 0;
      const pendingInEscrow = pendingEscrow.reduce((sum, p) => sum + p.amount, 0);

      res.status(200).json(
        successResponse(
          {
            balance: user.balance,
            totalEarned,
            totalWithdrawn,
            totalFees,
            pendingInEscrow,
            availableForWithdrawal: user.balance,
          },
          "Resumo do profissional recuperado",
        ),
      );
    } else {
      res.status(403).json(errorResponse("Role nao suportada para resumo financeiro"));
    }
  } catch (error) {
    log.error({ err: error }, "Wallet summary error");
    res.status(500).json(errorResponse("Erro interno do servidor", 500));
  }
};

/**
 * POST /api/wallet/withdraw
 * Solicitar saque (somente PROFESSIONAL)
 */
export const requestWithdrawal = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    // Idempotency check: prevent duplicate withdrawal requests from network retries
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (idempotencyKey) {
      const { isDuplicate } = await checkIdempotencyKey(idempotencyKey, req.user.id);
      if (isDuplicate) {
        res.status(409).json({
          success: false,
          message: "Duplicate request: this operation has already been processed",
        });
        return;
      }
    }

    const { amount } = req.body;

    // Validacoes
    if (typeof amount !== "number" || isNaN(amount)) {
      res.status(400).json(errorResponse("Valor deve ser um numero valido"));
      return;
    }

    if (amount <= 0) {
      res.status(400).json(errorResponse("Valor deve ser maior que zero"));
      return;
    }

    if (amount < 10) {
      res.status(400).json(errorResponse("Valor minimo para saque e R$ 10,00"));
      return;
    }

    const userId = req.user.id;

    // Transacao atomica
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user) {
        throw new Error("USUARIO_NAO_ENCONTRADO");
      }

      if (amount > user.balance) {
        throw new Error("SALDO_INSUFICIENTE");
      }

      const balanceBefore = user.balance;
      const balanceAfter = balanceBefore - amount;

      const transaction = await tx.transaction.create({
        data: {
          type: "WITHDRAWAL",
          amount,
          balanceBefore,
          balanceAfter,
          description: "Saque solicitado",
          userId,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });

      return { transaction, newBalance: balanceAfter };
    });

    res.status(200).json(
      successResponse(result, "Saque solicitado com sucesso"),
    );
  } catch (error: any) {
    if (error.message === "USUARIO_NAO_ENCONTRADO") {
      res.status(404).json(errorResponse("Usuario nao encontrado"));
      return;
    }
    if (error.message === "SALDO_INSUFICIENTE") {
      res.status(400).json(errorResponse("Saldo insuficiente para este saque"));
      return;
    }
    log.error({ err: error }, "Wallet withdrawal error");
    res.status(500).json(errorResponse("Erro interno do servidor", 500));
  }
};

/**
 * GET /api/wallet/professional/overview
 * Enhanced financial overview with forecast
 */
export const getProfessionalFinancialOverview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access financial overview"));
      return;
    }

    const userId = req.user.id;

    const [user, heldPayments, earnedAgg, withdrawnAgg, feeAgg, escrowConfig] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { balance: true },
        }),
        prisma.payment.findMany({
          where: { professionalId: userId, status: "HELD" },
          select: { amount: true, heldUntil: true, serviceOrderId: true },
          orderBy: { heldUntil: "asc" },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "PAYMENT" },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "WITHDRAWAL" },
          _sum: { amount: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, type: "FEE" },
          _sum: { amount: true },
        }),
        prisma.escrowConfig.findFirst({ where: { name: "default" } }),
      ]);

    const feePercentage = escrowConfig?.platformFeePercentage ?? 10;
    const pendingInEscrow = heldPayments.reduce((sum, p) => sum + p.amount, 0);

    // Build release forecast
    const releaseForecast = heldPayments.map((p) => ({
      grossAmount: p.amount,
      netAmount: p.amount * (1 - feePercentage / 100),
      platformFee: p.amount * (feePercentage / 100),
      releaseDate: p.heldUntil,
      serviceOrderId: p.serviceOrderId,
    }));

    // Get recent transactions (last 30)
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId },
      include: {
        payment: { select: { id: true, status: true, serviceOrderId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    res.status(200).json(
      successResponse({
        balance: user?.balance || 0,
        totalEarned: earnedAgg._sum.amount || 0,
        totalWithdrawn: withdrawnAgg._sum.amount || 0,
        totalFees: feeAgg._sum.amount || 0,
        pendingInEscrow,
        feePercentage,
        releaseForecast,
        recentTransactions,
      }, "Professional financial overview retrieved"),
    );
  } catch (error) {
    log.error({ err: error }, "Professional financial overview error");
    res.status(500).json(errorResponse("Erro interno do servidor", 500));
  }
};
