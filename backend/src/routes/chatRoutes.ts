import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireVerified,
  authLogger,
} from "../middleware/auth";
import { requireOrderParticipant } from "../middleware/uploadAuthCheck";
import { validateBody } from "../middleware/validate";
import { sendMessageSchema } from "../middleware/validation";

const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// ROTAS DE CHATS (CONVERSAS)
// ============================================

// Listar conversas ativas do usuario
router.get("/chats", verifyToken, serviceController.getUserChats);

// ============================================
// ROTAS DE MENSAGENS
// ============================================

// Enviar mensagem em um pedido (envolvidos no pedido)
router.post(
  "/orders/:orderId/messages",
  verifyToken,
  requireVerified,
  validateBody(sendMessageSchema),
  serviceController.sendMessage,
);

// Upload de arquivo para chat
router.post(
  "/orders/:orderId/messages/upload",
  verifyToken,
  requireVerified,
  requireOrderParticipant,           // auth check BEFORE multer writes to disk
  serviceController.chatUpload.single("file"),
  serviceController.uploadChatFile,
);

// Listar mensagens de um pedido (envolvidos no pedido)
router.get(
  "/orders/:orderId/messages",
  verifyToken,
  serviceController.getOrderMessages,
);

export default router;
