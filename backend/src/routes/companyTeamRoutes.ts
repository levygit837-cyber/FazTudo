import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import { createTeam, getTeamByOrder, confirmTeamCompletion } from "../controllers/companyTeamController";

const router = Router();
router.use(verifyToken);

router.post("/", requireCompanyPermission("orders.assign"), createTeam);
router.get("/order/:orderId", requireCompanyPermission("orders.view"), getTeamByOrder);
router.post("/:teamId/complete", confirmTeamCompletion);

export default router;
