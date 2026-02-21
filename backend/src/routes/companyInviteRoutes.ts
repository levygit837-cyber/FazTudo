import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import {
  generateInviteLink,
  validateInviteToken,
  acceptInvite,
} from "../controllers/companyInviteController";

const router = Router();

// POST /api/company/invite/generate
// Requires authenticated COMPANY user with team.invite permission
router.post(
  "/generate",
  verifyToken,
  requireCompanyPermission("team.invite"),
  generateInviteLink,
);

// GET /api/company/invite/:token  — public, no auth required
// Validate token before prompting the user to log in / register
router.get("/:token", validateInviteToken);

// POST /api/company/invite/:token/accept
// Requires the invited user to be logged in
router.post("/:token/accept", verifyToken, acceptInvite);

export default router;
