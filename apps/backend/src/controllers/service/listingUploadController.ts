import path from "path";
import fs from "fs";
import multer from "multer";
import { Request, Response } from "express";
import { createLogger } from "../../lib/logger";

const log = createLogger("listingUpload");

// ─── Configuração de Storage ───────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "listings");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB por imagem
const MAX_FILES = 8; // máximo de imagens por upload
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// Garantir que o diretório existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `listing-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
    return;
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new Error(`Extensão não permitida: ${ext}`));
    return;
  }
  cb(null, true);
};

export const listingUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
});

// ─── Controller ────────────────────────────────────────────────────────────
export async function uploadListingImages(req: Request, res: Response): Promise<void> {
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    res.status(400).json({ success: false, message: "Nenhum arquivo enviado" });
    return;
  }

  const uploadedUrls: string[] = [];
  const failedFiles: string[] = [];

  for (const file of files) {
    try {
      // Validação de magic bytes — previne upload de arquivos disfarçados
      const { fileTypeFromFile } = await import("file-type");
      const detected = await fileTypeFromFile(file.path).catch(() => null);

      if (!detected || !ALLOWED_MIME_TYPES.includes(detected.mime)) {
        log.warn(
          { filename: file.filename, declared: file.mimetype, detected: detected?.mime },
          "Magic byte mismatch — arquivo rejeitado"
        );
        fs.unlinkSync(file.path);
        failedFiles.push(file.originalname);
        continue;
      }

      // URL pública relativa
      const publicUrl = `/uploads/listings/${file.filename}`;
      uploadedUrls.push(publicUrl);
    } catch (err) {
      log.error({ err, filename: file.filename }, "Erro ao validar arquivo");
      try { fs.unlinkSync(file.path); } catch { /* ignore cleanup error */ }
      failedFiles.push(file.originalname);
    }
  }

  if (uploadedUrls.length === 0) {
    res.status(400).json({
      success: false,
      message: "Nenhum arquivo válido. Verifique se são imagens reais (JPEG, PNG, WebP, GIF).",
      failed: failedFiles,
    });
    return;
  }

  log.info({ count: uploadedUrls.length }, "Imagens de listing enviadas");

  res.status(201).json({
    success: true,
    message: `${uploadedUrls.length} imagem(ns) enviada(s)${failedFiles.length > 0 ? `, ${failedFiles.length} rejeitada(s)` : ""}`,
    data: { urls: uploadedUrls, failed: failedFiles },
  });
}
