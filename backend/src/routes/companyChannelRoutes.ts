import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  addMemberToChannel,
  removeMemberFromChannel,
  getMyChannels,
} from "../controllers/companyChannelController";

const router = Router();
router.use(verifyToken);

router.get("/my", getMyChannels);

router.get("/", requireCompanyPermission("chat.manage"), getChannels);
router.post("/", requireCompanyPermission("chat.manage"), createChannel);
router.put("/:channelId", requireCompanyPermission("chat.manage"), updateChannel);
router.delete("/:channelId", requireCompanyPermission("chat.manage"), deleteChannel);

router.post("/:channelId/members", requireCompanyPermission("chat.manage"), addMemberToChannel);
router.delete("/:channelId/members/:memberId", requireCompanyPermission("chat.manage"), removeMemberFromChannel);

export default router;
