import { Router } from "express";
import { verifyToken } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { presignUploadSchema, confirmUploadSchema } from "../middleware/validation";
import { presignUpload, confirmUpload } from "../controllers/storageController";

const router = Router();

router.post("/presign-upload", verifyToken, validateBody(presignUploadSchema), presignUpload);
router.post("/confirm-upload", verifyToken, validateBody(confirmUploadSchema), confirmUpload);

export default router;
