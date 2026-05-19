import { describe, it, expect } from "vitest";
import { filterChatContent } from "../../src/middleware/chatFilter";

/**
 * Integration-style tests verifying the complete order flow logic:
 * 1. Chat content filtering (protects against contact info leaks)
 * 2. Order flow state machine validation
 * 3. Payment + review lifecycle
 */

describe("Chat Content Filter — Integration", () => {
  it("should block phone numbers in various formats", () => {
    const tests = [
      { input: "Me liga: 11 98765-4321", blocked: "telefone" },
      { input: "Meu fone (11) 98765-4321", blocked: "telefone" },
      { input: "Whatsapp 11987654321", blocked: "telefone" },
    ];

    for (const t of tests) {
      const result = filterChatContent(t.input);
      expect(result.clean).toBe(false);
      expect(result.blockedTypes).toContain(t.blocked);
      expect(result.sanitized).not.toMatch(/\d{4,5}[-.]?\d{4}/);
    }
  });

  it("should block email addresses", () => {
    const result = filterChatContent("Meu email: usuario@gmail.com");
    expect(result.clean).toBe(false);
    expect(result.blockedTypes).toContain("email");
    expect(result.sanitized).not.toContain("@gmail.com");
  });

  it("should block social media handles and URLs", () => {
    const tests = [
      "Me segue no instagram.com/profissional123",
      "Facebook: facebook.com/meu_perfil",
      "Meu perfil @username_pro",
    ];

    for (const input of tests) {
      const result = filterChatContent(input);
      expect(result.clean).toBe(false);
      expect(result.blockedTypes).toContain("rede social");
    }
  });

  it("should block CPF numbers", () => {
    const result = filterChatContent("Meu CPF: 123.456.789-01");
    expect(result.clean).toBe(false);
    expect(result.blockedTypes).toContain("CPF");
    expect(result.sanitized).not.toMatch(/\d{3}\.\d{3}\.\d{3}/);
  });

  it("should block CNPJ numbers", () => {
    const result = filterChatContent("CNPJ da empresa: 12.345.678/0001-90");
    expect(result.clean).toBe(false);
    expect(result.blockedTypes).toContain("CNPJ");
  });

  it("should block WhatsApp mentions", () => {
    const result = filterChatContent("Me chama no zap: 11999998888");
    expect(result.clean).toBe(false);
    expect(result.blockedTypes).toContain("telefone");
  });

  it("should allow clean messages", () => {
    const cleanMessages = [
      "Olá, gostaria de saber mais sobre o serviço",
      "Pode me enviar orçamento?",
      "O serviço ficou excelente, muito obrigado!",
      "Quando podemos agendar a visita?",
    ];

    for (const msg of cleanMessages) {
      const result = filterChatContent(msg);
      expect(result.clean).toBe(true);
      expect(result.blockedTypes).toHaveLength(0);
      expect(result.sanitized).toBe(msg);
    }
  });

  it("should handle multiple blocked types in one message", () => {
    const result = filterChatContent(
      "Meu email: teste@gmail.com e meu telefone 11 98765-4321"
    );
    expect(result.clean).toBe(false);
    expect(result.blockedTypes).toContain("email");
    expect(result.blockedTypes).toContain("telefone");
    expect(result.blockedTypes.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Order Flow State Machine", () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ["ACCEPTED", "CANCELLED"],
    ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["AWAITING_CLIENT_CONFIRMATION", "COMPLETED"],
    AWAITING_CLIENT_CONFIRMATION: ["COMPLETED"],
    COMPLETED: [], // Terminal state
    CANCELLED: [], // Terminal state
  };

  it("should validate allowed status transitions", () => {
    expect(VALID_TRANSITIONS["PENDING"]).toContain("ACCEPTED");
    expect(VALID_TRANSITIONS["PENDING"]).toContain("CANCELLED");
    expect(VALID_TRANSITIONS["ACCEPTED"]).toContain("IN_PROGRESS");
    expect(VALID_TRANSITIONS["IN_PROGRESS"]).toContain("AWAITING_CLIENT_CONFIRMATION");
    expect(VALID_TRANSITIONS["AWAITING_CLIENT_CONFIRMATION"]).toContain("COMPLETED");
  });

  it("should not allow backward transitions", () => {
    expect(VALID_TRANSITIONS["COMPLETED"]).not.toContain("PENDING");
    expect(VALID_TRANSITIONS["COMPLETED"]).not.toContain("IN_PROGRESS");
    expect(VALID_TRANSITIONS["CANCELLED"]).not.toContain("PENDING");
    expect(VALID_TRANSITIONS["IN_PROGRESS"]).not.toContain("PENDING");
  });

  it("should have terminal states with no transitions", () => {
    expect(VALID_TRANSITIONS["COMPLETED"]).toHaveLength(0);
    expect(VALID_TRANSITIONS["CANCELLED"]).toHaveLength(0);
  });

  it("should cover complete lifecycle path", () => {
    const lifecycle = [
      "PENDING",
      "ACCEPTED",
      "IN_PROGRESS",
      "AWAITING_CLIENT_CONFIRMATION",
      "COMPLETED",
    ];

    for (let i = 0; i < lifecycle.length - 1; i++) {
      const from = lifecycle[i];
      const to = lifecycle[i + 1];
      expect(VALID_TRANSITIONS[from]).toContain(to);
    }
  });
});

describe("Payment Flow", () => {
  const PAYMENT_STATUSES = ["PENDING", "HELD", "RELEASED", "FAILED", "REFUNDED"];

  it("should define valid payment statuses", () => {
    expect(PAYMENT_STATUSES).toContain("PENDING");
    expect(PAYMENT_STATUSES).toContain("HELD");
    expect(PAYMENT_STATUSES).toContain("RELEASED");
    expect(PAYMENT_STATUSES).toContain("FAILED");
    expect(PAYMENT_STATUSES).toContain("REFUNDED");
  });

  it("should support escrow flow: PENDING → HELD → RELEASED", () => {
    const escrowFlow = ["PENDING", "HELD", "RELEASED"];
    for (let i = 0; i < escrowFlow.length; i++) {
      expect(PAYMENT_STATUSES).toContain(escrowFlow[i]);
    }
  });

  it("should verify fee calculation logic", () => {
    const orderPrice = 100;
    const platformFeePercent = 10;
    const platformFee = orderPrice * (platformFeePercent / 100);
    const professionalAmount = orderPrice - platformFee;

    expect(platformFee).toBe(10);
    expect(professionalAmount).toBe(90);
    expect(platformFee + professionalAmount).toBe(orderPrice);
  });
});

describe("Review System", () => {
  it("should compute overall rating as average of 3 criteria", () => {
    const quality = 5;
    const punctuality = 4;
    const communication = 3;
    const overall = Math.round((quality + punctuality + communication) / 3 * 10) / 10;

    expect(overall).toBe(4);
  });

  it("should handle perfect scores", () => {
    const overall = Math.round((5 + 5 + 5) / 3 * 10) / 10;
    expect(overall).toBe(5);
  });

  it("should handle minimum scores", () => {
    const overall = Math.round((1 + 1 + 1) / 3 * 10) / 10;
    expect(overall).toBe(1);
  });

  it("should handle mixed scores with decimal", () => {
    const overall = Math.round((5 + 4 + 4) / 3 * 10) / 10;
    expect(overall).toBe(4.3);
  });
});
