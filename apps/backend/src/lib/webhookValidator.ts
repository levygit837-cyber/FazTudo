import crypto from "crypto";
import { createLogger } from "./logger";

const log = createLogger("webhookValidator");

interface ValidateSignatureParams {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}

interface ValidationResult {
  valid: boolean;
  reason?: "missing_signature" | "invalid_signature" | "secret_not_configured" | "malformed_signature";
}

/**
 * Valida a assinatura HMAC-SHA256 do webhook MercadoPago.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Header format: x-signature: ts=<timestamp>,v1=<hash>
 * Manifest: id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;
 */
export const validateMercadoPagoSignature = (
  params: ValidateSignatureParams,
): ValidationResult => {
  const { xSignature, xRequestId, dataId, secret } = params;

  if (!secret || secret.trim().length === 0) {
    log.warn("MP_WEBHOOK_SECRET not configured — rejecting webhook");
    return { valid: false, reason: "secret_not_configured" };
  }

  if (!xSignature) {
    return { valid: false, reason: "missing_signature" };
  }

  // Parse "ts=<timestamp>,v1=<hash>"
  const parts: Record<string, string> = {};
  xSignature.split(",").forEach((part) => {
    const [key, ...rest] = part.split("=");
    if (key && rest.length > 0) {
      parts[key.trim()] = rest.join("=").trim();
    }
  });

  const ts = parts["ts"];
  const hash = parts["v1"];

  if (!ts || !hash) {
    return { valid: false, reason: "malformed_signature" };
  }

  // Build manifest string
  const manifest = `id:${dataId ?? ""};request-id:${xRequestId ?? ""};ts:${ts};`;

  // Compute expected HMAC
  const computed = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  // Timing-safe comparison
  const computedBuf = Buffer.from(computed, "hex");
  const hashBuf = Buffer.from(hash, "hex");

  if (computedBuf.length !== hashBuf.length) {
    return { valid: false, reason: "invalid_signature" };
  }

  const isValid = crypto.timingSafeEqual(computedBuf, hashBuf);
  return { valid: isValid, reason: isValid ? undefined : "invalid_signature" };
};
