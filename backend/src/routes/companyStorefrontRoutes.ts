import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import {
  getStorefrontEditor,
  createSection,
  updateSection,
  deleteSection,
  addItemToSection,
  removeItemFromSection,
  upsertBlock,
  pinTestimonial,
  unpinTestimonial,
} from "../controllers/companyStorefrontController";

const router = Router();

// All routes require company membership / ownership
router.use(verifyToken, requireCompanyPermission("catalog.edit"));

// Editor
router.get("/editor", getStorefrontEditor);

// Sections
router.post("/sections", createSection);
router.patch("/sections/:sectionId", updateSection);
router.delete("/sections/:sectionId", deleteSection);

// Section items
router.post("/sections/:sectionId/items", addItemToSection);
router.delete("/sections/:sectionId/items/:itemId", removeItemFromSection);

// Blocks
router.put("/blocks", upsertBlock);

// Pinned testimonials
router.post("/testimonials/pin", pinTestimonial);
router.delete("/testimonials/:pinnedId", unpinTestimonial);

export default router;
