import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth";
import prisma from "../../lib/prisma";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

import { createLogger } from "../../lib/logger";

const log = createLogger("fileUploadController");


const UPLOAD_DIR = path.join(process.cwd(), "uploads", "chat");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

// Garantir que o diretório de uploads existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
  }
};

export const chatUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

const successResponse = (data: any, message: string = "Success") => ({
  success: true,
  message,
  data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false,
  message,
  statusCode,
});

/**
 * Upload de arquivo para o chat de um pedido.
 * Verifica que o usuário é participante do pedido.
 */
export const uploadChatFile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    if (!req.file) {
      res.status(400).json(errorResponse("No file uploaded"));
      return;
    }

    // SECURITY: Validate magic bytes to prevent MIME spoofing
    // file-type v19 is ESM-only, requires dynamic import
    const { fileTypeFromFile } = await import("file-type");
    const detectedType = await fileTypeFromFile(req.file.path).catch(() => null);
    const declaredMime = req.file.mimetype;

    if (detectedType && detectedType.mime !== declaredMime) {
      // Magic bytes differ from declared MIME — possible spoofing
      fs.unlinkSync(req.file.path);
      log.warn(
        { declared: declaredMime, detected: detectedType.mime, userId: req.user?.id },
        "File upload rejected: magic bytes mismatch (possible MIME spoofing)"
      );
      res.status(400).json(
        errorResponse("Arquivo inválido: tipo de arquivo não corresponde ao conteúdo")
      );
      return;
    }

    // Also verify detected type is in allowed list
    if (detectedType && !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json(
        errorResponse(`Tipo de arquivo não permitido: ${detectedType.mime}`)
      );
      return;
    }

    // Verificar que o usuário faz parte do pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        clientId: true,
        professionalId: true,
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    const isParticipant =
      serviceOrder.clientId === req.user.id ||
      serviceOrder.professionalId === req.user.id ||
      req.user.role === "ADMIN";

    if (!isParticipant) {
      // Remover arquivo uploaded
      fs.unlinkSync(req.file.path);
      res.status(403).json(errorResponse("You are not part of this service order"));
      return;
    }

    // Construir URL do arquivo
    const fileUrl = `/uploads/chat/${req.file.filename}`;

    // Salvar no banco de dados
    const file = await prisma.file.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        userId: req.user.id,
        serviceOrderId: orderId,
      },
    });

    res.status(201).json(
      successResponse(
        {
          file: {
            id: file.id,
            url: fileUrl,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
          },
        },
        "File uploaded successfully",
      ),
    );
  } catch (error: any) {
    log.error({ err: error }, "Upload chat file error");
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json(errorResponse("Arquivo muito grande (máximo 10MB)"));
      return;
    }
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
