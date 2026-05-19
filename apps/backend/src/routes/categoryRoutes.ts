import { Router } from "express";
import {
  listCategories,
  getCategoryById,
  getCategoryByName,
  getMainCategories,
  searchCategories,
  getCategoryTree,
  createCategory,
  updateCategory,
  deleteCategory,
  getPopularCategories,
} from "../controllers/categoryController";
import { verifyToken, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createCategorySchema, updateCategorySchema } from "../middleware/validation";

const router = Router();

// ==================== PUBLIC ROUTES ====================

// Rotas específicas primeiro (antes das rotas com parâmetros)
router.get("/main", getMainCategories);
router.get("/popular", getPopularCategories);
router.get("/search", searchCategories);
router.get("/tree", getCategoryTree);
router.get("/slug/:name", getCategoryByName);

// Lista todas as categorias
router.get("/", listCategories);

// Obtém categoria por ID
router.get("/:id", getCategoryById);

// ==================== ADMIN ROUTES ====================

// Criar categoria (Admin only)
router.post("/", verifyToken, requireRole("ADMIN"), validateBody(createCategorySchema), createCategory);

// Atualizar categoria (Admin only)
router.put("/:id", verifyToken, requireRole("ADMIN"), validateBody(updateCategorySchema), updateCategory);

// Deletar categoria (Admin only)
router.delete("/:id", verifyToken, requireRole("ADMIN"), deleteCategory);

export default router;
