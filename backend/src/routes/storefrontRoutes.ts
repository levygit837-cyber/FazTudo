import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  createStorefrontSchema,
  updateStorefrontSchema,
  publishStorefrontSchema,
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  createServiceSchema,
  updateServiceSchema,
  createOptionSchema,
  updateOptionSchema,
} from "../middleware/storefrontValidation";
import {
  listStorefronts,
  getStorefrontBySlug,
} from "../controllers/storefrontController";
import {
  getMyStorefront,
  createStorefront,
  updateStorefront,
  publishStorefront,
  listMyCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  listMyServices,
  createService,
  updateService,
  deleteService,
  createOption,
  updateOption,
  deleteOption,
} from "../controllers/storefrontManageController";

const router = Router();

// ── Public routes ──────────────────────────────────────
router.get("/", listStorefronts);

// ── Authenticated routes (MUST come before /:slug) ─────
// All /mine/* routes require authentication + PROFESSIONAL/COMPANY role
const authMiddleware = [verifyToken, requireRole("PROFESSIONAL", "COMPANY")];

router.get("/mine", ...authMiddleware, getMyStorefront);
router.post(
  "/",
  ...authMiddleware,
  validateBody(createStorefrontSchema),
  createStorefront,
);
router.put(
  "/mine",
  ...authMiddleware,
  validateBody(updateStorefrontSchema),
  updateStorefront,
);
router.put(
  "/mine/publish",
  ...authMiddleware,
  validateBody(publishStorefrontSchema),
  publishStorefront,
);

// Categories
router.get("/mine/categories", ...authMiddleware, listMyCategories);
router.post(
  "/mine/categories",
  ...authMiddleware,
  validateBody(createCategorySchema),
  createCategory,
);
router.put(
  "/mine/categories/reorder",
  ...authMiddleware,
  validateBody(reorderCategoriesSchema),
  reorderCategories,
);
router.put(
  "/mine/categories/:id",
  ...authMiddleware,
  validateBody(updateCategorySchema),
  updateCategory,
);
router.delete("/mine/categories/:id", ...authMiddleware, deleteCategory);

// Services
router.get("/mine/services", ...authMiddleware, listMyServices);
router.post(
  "/mine/services",
  ...authMiddleware,
  validateBody(createServiceSchema),
  createService,
);
router.put(
  "/mine/services/:id",
  ...authMiddleware,
  validateBody(updateServiceSchema),
  updateService,
);
router.delete("/mine/services/:id", ...authMiddleware, deleteService);

// Options
router.post(
  "/mine/services/:id/options",
  ...authMiddleware,
  validateBody(createOptionSchema),
  createOption,
);
router.put(
  "/mine/options/:id",
  ...authMiddleware,
  validateBody(updateOptionSchema),
  updateOption,
);
router.delete("/mine/options/:id", ...authMiddleware, deleteOption);

// ── Public parameterized route (MUST be last) ──────────
router.get("/:slug", getStorefrontBySlug);

export default router;
