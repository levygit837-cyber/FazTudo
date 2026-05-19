import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  authLogger,
} from "../middleware/auth";

const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// ROTAS DE NOTIFICACOES
// ============================================

// Obter notificacoes do usuario
router.get("/notifications", verifyToken, serviceController.getNotifications);

// Marcar todas notificacoes como lidas
router.post(
  "/notifications/read-all",
  verifyToken,
  serviceController.markAllNotificationsAsRead,
);

// Marcar notificacao como lida/arquivada
router.put(
  "/notifications/:id",
  verifyToken,
  serviceController.updateNotification,
);

export default router;
