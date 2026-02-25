import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { createLogger } from "../lib/logger";

const log = createLogger("companyMemberController");

export async function getRoles(req: AuthRequest, res: Response) {
  const roles = await prisma.companyRole.findMany({
    where: { companyId: req.companyId! },
    include: { _count: { select: { members: true } } },
    orderBy: { level: "asc" },
  });
  return res.json({ success: true, message: "Cargos obtidos", data: roles });
}

export async function createRole(req: AuthRequest, res: Response) {
  try {
    const { name, level, permissions, color } = req.body;
    const role = await prisma.companyRole.create({
      data: { companyId: req.companyId!, name, level, permissions, color },
    });
    return res.status(201).json({ success: true, message: "Cargo criado", data: role });
  } catch (err) {
    log.error({ err }, "createRole error");
    throw err;
  }
}

export async function updateRole(req: AuthRequest, res: Response) {
  try {
    const { roleId } = req.params;
    const { name, level, permissions, color } = req.body;
    const role = await prisma.companyRole.update({
      where: { id: Number(roleId), companyId: req.companyId! },
      data: { name, level, permissions, color },
    });
    return res.json({ success: true, message: "Cargo atualizado", data: role });
  } catch (err) {
    log.error({ err }, "updateRole error");
    throw err;
  }
}

export async function deleteRole(req: AuthRequest, res: Response) {
  try {
    const { roleId } = req.params;
    const memberCount = await prisma.companyMember.count({ where: { roleId: Number(roleId) } });
    if (memberCount > 0) {
      return res.status(400).json({ success: false, message: "Não é possível excluir cargo com membros. Reatribua os membros primeiro." });
    }
    await prisma.companyRole.delete({ where: { id: Number(roleId), companyId: req.companyId! } });
    return res.json({ success: true, message: "Cargo excluído" });
  } catch (err) {
    log.error({ err }, "deleteRole error");
    throw err;
  }
}

export async function getMembers(req: AuthRequest, res: Response) {
  const members = await prisma.companyMember.findMany({
    where: { companyId: req.companyId! },
    include: {
      user: { select: { id: true, name: true, email: true, profileImage: true } },
      role: true,
    },
    orderBy: { joinedAt: "asc" },
  });
  return res.json({ success: true, message: "Membros obtidos", data: members });
}

export async function inviteMember(req: AuthRequest, res: Response) {
  try {
    const { email, roleId } = req.body;
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) return res.status(404).json({ success: false, message: "Usuário não encontrado com esse email" });

    const existing = await prisma.companyMember.findFirst({
      where: { userId: targetUser.id, companyId: req.companyId! },
    });
    if (existing) return res.status(400).json({ success: false, message: "Usuário já é membro desta empresa" });

    const member = await prisma.companyMember.create({
      data: { companyId: req.companyId!, userId: targetUser.id, roleId: roleId ? Number(roleId) : undefined },
      include: { user: { select: { id: true, name: true, email: true, profileImage: true } }, role: true },
    });
    return res.status(201).json({ success: true, message: "Membro adicionado", data: member });
  } catch (err) {
    log.error({ err }, "inviteMember error");
    throw err;
  }
}

export async function updateMember(req: AuthRequest, res: Response) {
  try {
    const { memberId } = req.params;
    const { roleId, customPermissions, isActive } = req.body;
    const member = await prisma.companyMember.update({
      where: { id: Number(memberId), companyId: req.companyId! },
      data: { roleId: roleId ? Number(roleId) : undefined, customPermissions, isActive },
      include: { user: { select: { id: true, name: true, email: true, profileImage: true } }, role: true },
    });
    return res.json({ success: true, message: "Membro atualizado", data: member });
  } catch (err) {
    log.error({ err }, "updateMember error");
    throw err;
  }
}

export async function removeMember(req: AuthRequest, res: Response) {
  try {
    const { memberId } = req.params;
    await prisma.companyMember.update({
      where: { id: Number(memberId), companyId: req.companyId! },
      data: { isActive: false },
    });
    return res.json({ success: true, message: "Membro removido" });
  } catch (err) {
    log.error({ err }, "removeMember error");
    throw err;
  }
}

export async function getMemberMetrics(req: AuthRequest, res: Response) {
  try {
    const { memberId } = req.params;
    const member = await prisma.companyMember.findUnique({
      where: { id: Number(memberId), companyId: req.companyId! },
      include: { user: { select: { id: true, name: true, ratingAverage: true, totalReviews: true } } },
    });
    if (!member) return res.status(404).json({ success: false, message: "Membro não encontrado" });

    const [assignedTeams, completedTeams] = await Promise.all([
      prisma.serviceTeamMember.count({ where: { memberId: member.id } }),
      prisma.serviceTeamMember.count({
        where: { memberId: member.id, team: { order: { status: "COMPLETED" } } },
      }),
    ]);

    return res.json({
      success: true,
      message: "Métricas obtidas",
      data: { member, assignedTeams, completedTeams },
    });
  } catch (err) {
    log.error({ err }, "getMemberMetrics error");
    throw err;
  }
}
