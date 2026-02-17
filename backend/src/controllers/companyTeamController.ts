import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyTeamController");

export async function createTeam(req: AuthRequest, res: Response) {
  try {
    const { orderId, leaderId, memberIds } = req.body;

    if (!leaderId) {
      return res.status(400).json({ success: false, message: "Líder da equipe é obrigatório" });
    }
    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: "Equipe deve ter pelo menos um membro" });
    }

    const companyProfile = await prisma.companyProfile.findUnique({ where: { id: req.companyId! } });
    const order = await prisma.serviceOrder.findFirst({
      where: { id: Number(orderId), professionalId: companyProfile?.userId },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!order) return res.status(404).json({ success: false, message: "Pedido não encontrado" });

    const existing = await prisma.serviceTeam.findUnique({ where: { orderId: Number(orderId) } });
    if (existing) return res.status(400).json({ success: false, message: "Pedido já possui uma equipe" });

    const team = await prisma.$transaction(async (tx) => {
      const newTeam = await tx.serviceTeam.create({
        data: {
          orderId: Number(orderId),
          leaderId: Number(leaderId),
          members: {
            create: (memberIds as number[]).map((id) => ({ memberId: id })),
          },
        },
        include: { members: { include: { member: { include: { user: true } } } }, leader: { include: { user: true } } },
      });

      const memberNames = newTeam.members.map((m) => m.member.user.name).join(", ");

      // Create a group message using the existing Message model
      await tx.message.create({
        data: {
          serviceOrderId: Number(orderId),
          senderId: companyProfile!.userId,
          recipientId: order.clientId,
          content: `Equipe designada para o serviço. Membros: ${memberNames}`,
          isGroup: true,
          teamId: newTeam.id,
        },
      });

      return newTeam;
    });

    return res.status(201).json({ success: true, message: "Equipe criada e chat em grupo iniciado", data: team });
  } catch (err) {
    log.error({ err }, "createTeam error");
    throw err;
  }
}

export async function getTeamByOrder(req: AuthRequest, res: Response) {
  try {
    const { orderId } = req.params;
    const team = await prisma.serviceTeam.findUnique({
      where: { orderId: Number(orderId) },
      include: {
        leader: { include: { user: { select: { id: true, name: true, profileImage: true } } } },
        members: { include: { member: { include: { user: { select: { id: true, name: true, profileImage: true } } } } } },
      },
    });
    if (!team) return res.status(404).json({ success: false, message: "Equipe não encontrada" });
    return res.json({ success: true, message: "Equipe obtida", data: team });
  } catch (err) {
    log.error({ err }, "getTeamByOrder error");
    throw err;
  }
}

export async function confirmTeamCompletion(req: AuthRequest, res: Response) {
  try {
    const { teamId } = req.params;
    const memberId = req.companyMemberId;

    const team = await prisma.serviceTeam.findUnique({ where: { id: Number(teamId) } });
    if (!team) return res.status(404).json({ success: false, message: "Equipe não encontrada" });
    if (team.leaderId !== memberId) {
      return res.status(403).json({ success: false, message: "Apenas o líder pode confirmar a conclusão" });
    }

    await prisma.serviceOrder.update({
      where: { id: team.orderId },
      data: { status: "AWAITING_CLIENT_CONFIRMATION" },
    });

    return res.json({ success: true, message: "Conclusão confirmada pelo líder. Aguardando confirmação do cliente." });
  } catch (err) {
    log.error({ err }, "confirmTeamCompletion error");
    throw err;
  }
}
