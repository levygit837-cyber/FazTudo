import { Router } from "express";
import * as serviceController from "../controllers/service";
import {
  verifyToken,
  requireRole,
  requireVerified,
  authLogger,
} from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { updateScheduleSchema } from "../middleware/validation";

const router = Router();

// Middleware de log
router.use(authLogger);

// ============================================
// ROTAS DE AGENDA / CALENDARIO
// ============================================

// Get professional schedule
router.get("/professionals/:id/schedule", serviceController.getProfessionalSchedule);

// Update professional schedule
router.put(
  "/professionals/schedule",
  verifyToken,
  requireRole("PROFESSIONAL"),
  requireVerified,
  validateBody(updateScheduleSchema),
  serviceController.updateProfessionalSchedule,
);

// Get available slots for a date
router.get("/professionals/:id/available-slots", serviceController.getAvailableSlots);

export default router;
