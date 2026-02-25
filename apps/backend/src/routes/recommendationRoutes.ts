import { Router } from "express";
import {
  verifyToken,
  authLogger,
} from "../middleware/auth";
import { getRecommendations } from "../services/recommendationService";

import { createLogger } from "../lib/logger";

const log = createLogger("recommendations");


const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// ROTAS DE RECOMENDACOES
// ============================================

// Obter recomendacoes personalizadas (clientes autenticados)
router.get("/recommendations", verifyToken, async (req: any, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await getRecommendations({
      userId: req.user.id,
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      message: "Recommendations retrieved successfully",
      data: result,
    });
  } catch (error) {
    log.error({ err: error }, "Recommendations error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
