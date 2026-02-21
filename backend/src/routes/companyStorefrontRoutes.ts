import { Router } from "express";
import { verifyToken } from "../middleware/auth";
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

// Editor (authenticated)
router.get("/editor", verifyToken, getStorefrontEditor);

// Sections
router.post("/sections", verifyToken, createSection);
router.patch("/sections/:sectionId", verifyToken, updateSection);
router.delete("/sections/:sectionId", verifyToken, deleteSection);

// Section items
router.post("/sections/:sectionId/items", verifyToken, addItemToSection);
router.delete("/sections/:sectionId/items/:itemId", verifyToken, removeItemFromSection);

// Blocks
router.put("/blocks", verifyToken, upsertBlock);

// Pinned testimonials
router.post("/testimonials/pin", verifyToken, pinTestimonial);
router.delete("/testimonials/:pinnedId", verifyToken, unpinTestimonial);

export default router;
