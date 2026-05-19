import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireRole,
  requireVerified,
  authLogger,
} from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createServiceSchema, updateServiceSchema } from "../middleware/validation";
import { listingUpload, uploadListingImages } from "../controllers/service/listingUploadController";

const router = Router();

// Middleware de log para todas as rotas de servicos
router.use(authLogger);

// Param middleware: rejeita :id não-numérico com next("route"),
// permitindo que outros routers montados em /api/services processem a request.
// Sem isso, /:id captura paths como /orders, /chat, etc.
router.param("id", (req, res, next, value) => {
  if (!/^\d+$/.test(value)) {
    return next("route");
  }
  next();
});

// ============================================
// ROTAS DE SERVICE LISTINGS (CATALOGO)
// ============================================

// Listar todos os servicos disponiveis (publico)
router.get("/", serviceController.listServices);

// Upload de imagens para listagem (profissionais verificados)
// DEVE ficar antes das rotas com /:id para não conflitar
router.post(
  "/listings/upload-images",
  verifyToken,
  requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
  listingUpload.array("images", 8),
  uploadListingImages
);

// Criar nova listagem de servico (apenas profissionais verificados)
router.post(
  "/",
  verifyToken,
  requireRole("PROFESSIONAL", "COMPANY", "ADMIN"),
  requireVerified,
  validateBody(createServiceSchema),
  serviceController.createServiceListing,
);

// ============================================
// SMART BRIEF ROUTES
// ============================================

// Brief templates (publico)
router.get("/briefs/templates/:categorySlug", serviceController.getBriefTemplate);

// Create order with brief (clientes verificados)
router.post(
  "/orders/with-brief",
  verifyToken,
  requireRole("CLIENT"),
  requireVerified,
  serviceController.createOrderWithBrief,
);


// ============================================
// PROFESSIONAL PUBLIC STOREFRONT
// ============================================

// Professional public storefront (no auth required)
router.get("/professional/:userId/storefront", serviceController.getProfessionalStorefront);

// ============================================
// ROTAS DE SERVICE LISTINGS COM PARAMETRO (DEVEM VIR POR ULTIMO)
// ============================================

// Obter detalhes de um servico especifico (publico)
router.get("/:id", serviceController.getService);

// Atualizar listagem de servico (apenas proprietario ou admin)
router.put(
  "/:id",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  validateBody(updateServiceSchema),
  serviceController.updateServiceListing,
);

// Deletar listagem de servico (apenas proprietario ou admin)
router.delete(
  "/:id",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.deleteServiceListing,
);

export default router;
