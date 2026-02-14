import { Router } from "express";
import * as authController from "../controllers/authController";
import {
  verifyToken,
  requireVerified,
  authLogger,
  handleAuthError,
} from "../middleware/auth";
import { authLimiter, sensitiveLimiter } from "../middleware/rateLimiter";
import { validateBody } from "../middleware/validate";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  documentVerificationSchema,
  facialVerificationSchema,
} from "../middleware/validation";

const router = Router();

// Middleware de log para autenticacao
router.use(authLogger);

// Rotas publicas (com rate limiting + validacao Zod)
router.post("/register", authLimiter, validateBody(registerSchema), authController.register);
router.post("/login", authLimiter, validateBody(loginSchema), authController.login);
router.post("/forgot-password", sensitiveLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", sensitiveLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
router.post("/verify-email", sensitiveLimiter, authController.verifyEmail);

// Rotas protegidas (requerem autenticacao + validacao)
router.get("/profile", verifyToken, authController.getProfile);
router.put("/profile", verifyToken, validateBody(updateProfileSchema), authController.updateProfile);
router.post("/change-password", verifyToken, sensitiveLimiter, validateBody(changePasswordSchema), authController.changePassword);
router.post(
  "/verification/document",
  verifyToken,
  validateBody(documentVerificationSchema),
  authController.submitDocumentVerification,
);
router.post(
  "/verification/facial",
  verifyToken,
  validateBody(facialVerificationSchema),
  authController.submitFacialVerification,
);
router.get(
  "/verification/status",
  verifyToken,
  authController.getVerificationStatus,
);
router.post(
  "/upgrade-to-professional",
  verifyToken,
  authController.upgradeToProfessional,
);

// Middleware de tratamento de erros de autenticacao
router.use(handleAuthError);

export default router;
