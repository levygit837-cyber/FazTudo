import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import { validateBody } from "../middleware/validate";
import { createRoleSchema, inviteMemberSchema } from "../middleware/validation";
import { getRoles, createRole, updateRole, deleteRole, getMembers, inviteMember, updateMember, removeMember, getMemberMetrics } from "../controllers/companyMemberController";

const router = Router();
router.use(verifyToken);

// Cargos
router.get("/roles", requireCompanyPermission("team.view"), getRoles);
router.post("/roles", requireCompanyPermission("company.roles"), validateBody(createRoleSchema), createRole);
router.put("/roles/:roleId", requireCompanyPermission("company.roles"), updateRole);
router.delete("/roles/:roleId", requireCompanyPermission("company.roles"), deleteRole);

// Membros
router.get("/", requireCompanyPermission("team.view"), getMembers);
router.post("/invite", requireCompanyPermission("team.invite"), validateBody(inviteMemberSchema), inviteMember);
router.put("/:memberId", requireCompanyPermission("team.manage"), updateMember);
router.delete("/:memberId", requireCompanyPermission("team.manage"), removeMember);
router.get("/:memberId/metrics", requireCompanyPermission("metrics.viewTeam"), getMemberMetrics);

export default router;
