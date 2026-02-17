import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companySalaryController");

export async function getSalaryRules(req: AuthRequest, res: Response) {
  const rules = await prisma.companySalaryRule.findMany({
    where: { companyId: req.companyId! },
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json({ success: true, message: "Regras obtidas", data: rules });
}

export async function createSalaryRule(req: AuthRequest, res: Response) {
  try {
    const { roleId, memberId, amount, dayOfMonth, description } = req.body;
    if (!roleId && !memberId) {
      return res.status(400).json({ success: false, message: "Informe roleId (por cargo) ou memberId (individual)" });
    }
    const rule = await prisma.companySalaryRule.create({
      data: {
        companyId: req.companyId!,
        roleId: roleId ? Number(roleId) : null,
        memberId: memberId ? Number(memberId) : null,
        amount: Number(amount),
        dayOfMonth: Number(dayOfMonth),
        description,
      },
    });
    return res.status(201).json({ success: true, message: "Regra criada", data: rule });
  } catch (err) {
    log.error({ err }, "createSalaryRule error");
    throw err;
  }
}

export async function updateSalaryRule(req: AuthRequest, res: Response) {
  try {
    const { ruleId } = req.params;
    const { amount, dayOfMonth, description, isActive } = req.body;
    const rule = await prisma.companySalaryRule.update({
      where: { id: Number(ruleId) },
      data: { amount: amount ? Number(amount) : undefined, dayOfMonth: dayOfMonth ? Number(dayOfMonth) : undefined, description, isActive },
    });
    return res.json({ success: true, message: "Regra atualizada", data: rule });
  } catch (err) {
    log.error({ err }, "updateSalaryRule error");
    throw err;
  }
}

export async function deleteSalaryRule(req: AuthRequest, res: Response) {
  try {
    const { ruleId } = req.params;
    await prisma.companySalaryRule.update({ where: { id: Number(ruleId) }, data: { isActive: false } });
    return res.json({ success: true, message: "Regra desativada" });
  } catch (err) {
    log.error({ err }, "deleteSalaryRule error");
    throw err;
  }
}

export async function getSalaryHistory(req: AuthRequest, res: Response) {
  try {
    const { memberId } = req.params;
    const payments = await prisma.companySalaryPayment.findMany({
      where: { memberId: Number(memberId) },
      include: { rule: true },
      orderBy: { paidAt: "desc" },
    });
    return res.json({ success: true, message: "Histórico obtido", data: payments });
  } catch (err) {
    log.error({ err }, "getSalaryHistory error");
    throw err;
  }
}

export async function transferSalary(req: AuthRequest, res: Response) {
  try {
    const { memberId, amount, note } = req.body;
    const member = await prisma.companyMember.findUnique({
      where: { id: Number(memberId), companyId: req.companyId! },
      include: { user: true },
    });
    if (!member) return res.status(404).json({ success: false, message: "Membro não encontrado" });

    const companyProfile = await prisma.companyProfile.findUnique({
      where: { id: req.companyId! },
      include: { user: { select: { balance: true, id: true } } },
    });
    if (!companyProfile) return res.status(404).json({ success: false, message: "Empresa não encontrada" });

    const transferAmount = Number(amount);
    if (companyProfile.user.balance < transferAmount) {
      return res.status(400).json({ success: false, message: "Saldo insuficiente na wallet corporativa" });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: companyProfile.userId }, data: { balance: { decrement: transferAmount } } }),
      prisma.user.update({ where: { id: member.userId }, data: { balance: { increment: transferAmount } } }),
    ]);

    const rule = await prisma.companySalaryRule.findFirst({ where: { memberId: member.id, companyId: req.companyId! } });

    if (rule) {
      await prisma.companySalaryPayment.create({
        data: {
          ruleId: rule.id,
          memberId: member.id,
          amount: transferAmount,
          paidAt: new Date(),
          status: "PAID",
          note,
        },
      });
    }

    return res.json({ success: true, message: `R$ ${transferAmount.toFixed(2)} transferido para ${member.user.name}` });
  } catch (err) {
    log.error({ err }, "transferSalary error");
    throw err;
  }
}
