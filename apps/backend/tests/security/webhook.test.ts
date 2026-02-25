import { describe, it, expect } from "vitest";
import crypto from "crypto";

// Direct import — will fail until implementation exists
import { validateMercadoPagoSignature } from "../../src/lib/webhookValidator";

describe("Webhook HMAC Validation", () => {
  const secret = "test-webhook-secret-12345";

  it("rejects request without x-signature header", () => {
    const result = validateMercadoPagoSignature({
      xSignature: null,
      xRequestId: "req-123",
      dataId: "pay-456",
      secret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing_signature");
  });

  it("rejects request with wrong signature", () => {
    const result = validateMercadoPagoSignature({
      xSignature: "ts=12345,v1=fakehash",
      xRequestId: "req-123",
      dataId: "pay-456",
      secret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_signature");
  });

  it("rejects when MP_WEBHOOK_SECRET is empty", () => {
    const result = validateMercadoPagoSignature({
      xSignature: "ts=12345,v1=somehash",
      xRequestId: "req-123",
      dataId: "pay-456",
      secret: "",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("secret_not_configured");
  });

  it("accepts valid HMAC signature", () => {
    const ts = "1700000000000";
    const requestId = "req-123";
    const dataId = "pay-456";
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const validHash = crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    const result = validateMercadoPagoSignature({
      xSignature: `ts=${ts},v1=${validHash}`,
      xRequestId: requestId,
      dataId,
      secret,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects malformed signature header", () => {
    const result = validateMercadoPagoSignature({
      xSignature: "garbage-data",
      xRequestId: "req-123",
      dataId: "pay-456",
      secret,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("malformed_signature");
  });
});
