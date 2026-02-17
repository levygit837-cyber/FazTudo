import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyChannelController");

/** GET /api/company/channels — lista canais da empresa */
export async function getChannels(req: AuthRequest, res: Response) {
  try {
    const channels = await prisma.companyChannel.findMany({
      where: { companyId: req.companyId! },
      include: {
        _count: { select: { members: true } },
        members: {
          include: {
            member: {
              include: { user: { select: { id: true, name: true, profileImage: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ success: true, message: "Canais obtidos", data: channels });
  } catch (err) {
    log.error({ err }, "getChannels error");
    throw err;
  }
}

/** POST /api/company/channels — criar canal */
export async function createChannel(req: AuthRequest, res: Response) {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Nome do canal é obrigatório" });
    }
    const channel = await prisma.companyChannel.create({
      data: { companyId: req.companyId!, name: name.trim(), description },
    });
    return res.status(201).json({ success: true, message: "Canal criado", data: channel });
  } catch (err) {
    log.error({ err }, "createChannel error");
    throw err;
  }
}

/** PUT /api/company/channels/:channelId — atualizar canal */
export async function updateChannel(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const { name, description, isActive } = req.body;
    const channel = await prisma.companyChannel.update({
      where: { id: Number(channelId), companyId: req.companyId! },
      data: { name, description, isActive },
    });
    return res.json({ success: true, message: "Canal atualizado", data: channel });
  } catch (err) {
    log.error({ err }, "updateChannel error");
    throw err;
  }
}

/** DELETE /api/company/channels/:channelId — desativar canal */
export async function deleteChannel(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    await prisma.companyChannel.update({
      where: { id: Number(channelId), companyId: req.companyId! },
      data: { isActive: false },
    });
    return res.json({ success: true, message: "Canal desativado" });
  } catch (err) {
    log.error({ err }, "deleteChannel error");
    throw err;
  }
}

/** POST /api/company/channels/:channelId/members — adicionar membro ao canal */
export async function addMemberToChannel(req: AuthRequest, res: Response) {
  try {
    const { channelId } = req.params;
    const { memberId } = req.body;

    const member = await prisma.companyMember.findUnique({
      where: { id: Number(memberId), companyId: req.companyId! },
    });
    if (!member) {
      return res.status(404).json({ success: false, message: "Membro não encontrado nesta empresa" });
    }

    const channelMember = await prisma.companyChannelMember.create({
      data: { channelId: Number(channelId), memberId: Number(memberId) },
      include: {
        member: { include: { user: { select: { id: true, name: true, profileImage: true } } } },
      },
    });
    return res.status(201).json({ success: true, message: "Membro adicionado ao canal", data: channelMember });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(400).json({ success: false, message: "Membro já está neste canal" });
    }
    log.error({ err }, "addMemberToChannel error");
    throw err;
  }
}

/** DELETE /api/company/channels/:channelId/members/:memberId — remover membro do canal */
export async function removeMemberFromChannel(req: AuthRequest, res: Response) {
  try {
    const { channelId, memberId } = req.params;
    await prisma.companyChannelMember.deleteMany({
      where: { channelId: Number(channelId), memberId: Number(memberId) },
    });
    return res.json({ success: true, message: "Membro removido do canal" });
  } catch (err) {
    log.error({ err }, "removeMemberFromChannel error");
    throw err;
  }
}

/** GET /api/company/channels/my — canais do membro autenticado */
export async function getMyChannels(req: AuthRequest, res: Response) {
  try {
    const memberId = req.companyMemberId;
    if (!memberId) {
      return getChannels(req, res);
    }
    const channels = await prisma.companyChannel.findMany({
      where: {
        companyId: req.companyId!,
        isActive: true,
        members: { some: { memberId } },
      },
      include: { _count: { select: { members: true } } },
    });
    return res.json({ success: true, message: "Meus canais", data: channels });
  } catch (err) {
    log.error({ err }, "getMyChannels error");
    throw err;
  }
}
