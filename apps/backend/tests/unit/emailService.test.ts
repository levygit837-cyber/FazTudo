import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nodemailer before importing emailService
const mockSendMail = vi.fn().mockResolvedValue({
  messageId: "test-message-id",
  accepted: ["test@test.com"],
  rejected: [],
});

const mockCreateTransport = vi.fn().mockReturnValue({
  sendMail: mockSendMail,
  verify: vi.fn().mockResolvedValue(true),
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
    createTestAccount: vi.fn().mockResolvedValue({
      user: "ethereal-user",
      pass: "ethereal-pass",
    }),
    getTestMessageUrl: vi.fn().mockReturnValue("https://ethereal.email/message/123"),
  },
}));

// Mock env
vi.mock("../../src/config/env", () => ({
  env: {
    NODE_ENV: "test",
    SMTP_HOST: "",
    SMTP_PORT: 587,
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM_NAME: "FazTudo",
    SMTP_FROM_EMAIL: "noreply@faztudo.com.br",
    ENABLE_EMAIL_NOTIFICATIONS: true,
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));

describe("EmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export sendEmail function", async () => {
    const { sendEmail } = await import("../../src/services/emailService");
    expect(typeof sendEmail).toBe("function");
  });

  it("should send email with correct parameters", async () => {
    const { sendEmail } = await import("../../src/services/emailService");

    const result = await sendEmail({
      to: "test@test.com",
      subject: "Test Subject",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@test.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      })
    );
  });

  it("should export sendVerificationEmail function", async () => {
    const { sendVerificationEmail } = await import("../../src/services/emailService");
    expect(typeof sendVerificationEmail).toBe("function");
  });

  it("should export sendPasswordResetEmail function", async () => {
    const { sendPasswordResetEmail } = await import("../../src/services/emailService");
    expect(typeof sendPasswordResetEmail).toBe("function");
  });

  it("should export sendWelcomeEmail function", async () => {
    const { sendWelcomeEmail } = await import("../../src/services/emailService");
    expect(typeof sendWelcomeEmail).toBe("function");
  });

  it("should handle send failure gracefully", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP connection failed"));

    const { sendEmail } = await import("../../src/services/emailService");

    const result = await sendEmail({
      to: "test@test.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
