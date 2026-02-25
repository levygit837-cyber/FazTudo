import { Router, Request, Response, NextFunction } from "express";
import { verifyToken } from "../middleware/auth";
import { requireCompanyPermission } from "../middleware/companyPermission";
import { getCompanyStorefront } from "../controllers/companyController";
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

// All auth-protected routes require company membership / ownership
const companyAuth = [verifyToken, requireCompanyPermission("catalog.edit")] as const;

// Editor
router.get("/editor", ...companyAuth, getStorefrontEditor);

// Sections
router.post("/sections", ...companyAuth, createSection);
router.patch("/sections/:sectionId", ...companyAuth, updateSection);
router.delete("/sections/:sectionId", ...companyAuth, deleteSection);

// Section items
router.post("/sections/:sectionId/items", ...companyAuth, addItemToSection);
router.delete("/sections/:sectionId/items/:itemId", ...companyAuth, removeItemFromSection);

// Blocks
router.put("/blocks", ...companyAuth, upsertBlock);

// Pinned testimonials
router.post("/testimonials/pin", ...companyAuth, pinTestimonial);
router.delete("/testimonials/:pinnedId", ...companyAuth, unpinTestimonial);

// Public: get storefront by numeric company ID (no auth required).
// Registered LAST so it does not shadow named routes above.
// The param guard rejects non-numeric values before reaching the controller.
function requireNumericCompanyId(req: Request, res: Response, next: NextFunction): void {
  const id = req.params.companyId;
  if (typeof id !== "string" || !/^\d+$/.test(id)) {
    res.status(400).json({ success: false, message: "ID de empresa inválido" });
    return;
  }
  next();
}
router.get("/:companyId", requireNumericCompanyId, getCompanyStorefront);

export default router;
