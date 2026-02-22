import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import {
  setupMFA,
  verifyMFASetup,
  validateMFA,
  disableMFA,
  regenerateBackupCodes,
} from "../controllers/mfaController";

const router = Router();

// Setup MFA (generate secret + QR code)
router.post("/setup", verifyToken, setupMFA);

// Verify first TOTP code to enable MFA
router.post("/verify-setup", verifyToken, verifyMFASetup);

// Validate MFA code during login (uses mfaToken, not verifyToken)
router.post("/validate", validateMFA);

// Disable MFA (requires current code)
router.post("/disable", verifyToken, disableMFA);

// Regenerate backup codes
router.post("/backup-codes/regenerate", verifyToken, regenerateBackupCodes);

export default router;
