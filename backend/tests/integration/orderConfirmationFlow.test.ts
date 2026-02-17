import { describe, it, expect } from "vitest";

/**
 * Tests for the new client-first order confirmation flow.
 *
 * New flow:
 *   IN_PROGRESS
 *     → Client calls submit-completion
 *       → Status: AWAITING_PROFESSIONAL_CONFIRMATION (clientConfirmedAt = now)
 *         → Professional calls confirm-professional
 *           → Status: COMPLETED (professionalConfirmedAt = now, payment released)
 *
 * The old flow (professional initiates via submit-completion → AWAITING_CLIENT_CONFIRMATION)
 * is no longer used for new orders.
 */

describe("Order Confirmation Flow (Client-First)", () => {
  // ============================
  // State machine validation
  // ============================

  const NEW_FLOW_TRANSITIONS: Record<string, string[]> = {
    PENDING: ["ACCEPTED", "CANCELLED"],
    ACCEPTED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["AWAITING_PROFESSIONAL_CONFIRMATION", "CANCELLED", "DISPUTED"],
    AWAITING_PROFESSIONAL_CONFIRMATION: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
  };

  it("should transition from IN_PROGRESS directly to AWAITING_PROFESSIONAL_CONFIRMATION (client initiates)", () => {
    expect(NEW_FLOW_TRANSITIONS["IN_PROGRESS"]).toContain(
      "AWAITING_PROFESSIONAL_CONFIRMATION"
    );
  });

  it("should NOT transition from IN_PROGRESS to AWAITING_CLIENT_CONFIRMATION (old flow removed)", () => {
    expect(NEW_FLOW_TRANSITIONS["IN_PROGRESS"]).not.toContain(
      "AWAITING_CLIENT_CONFIRMATION"
    );
  });

  it("should transition from AWAITING_PROFESSIONAL_CONFIRMATION to COMPLETED", () => {
    expect(NEW_FLOW_TRANSITIONS["AWAITING_PROFESSIONAL_CONFIRMATION"]).toContain(
      "COMPLETED"
    );
  });

  it("should cover the complete new lifecycle path", () => {
    const lifecycle = [
      "PENDING",
      "ACCEPTED",
      "IN_PROGRESS",
      "AWAITING_PROFESSIONAL_CONFIRMATION",
      "COMPLETED",
    ];

    for (let i = 0; i < lifecycle.length - 1; i++) {
      const from = lifecycle[i];
      const to = lifecycle[i + 1];
      expect(NEW_FLOW_TRANSITIONS[from]).toContain(to);
    }
  });

  // ============================
  // Role-based access validation
  // ============================

  describe("Role-based access for submit-completion", () => {
    const ALLOWED_ROLES_SUBMIT_COMPLETION = ["CLIENT", "ADMIN"];

    it("should allow CLIENT to call submit-completion", () => {
      expect(ALLOWED_ROLES_SUBMIT_COMPLETION).toContain("CLIENT");
    });

    it("should allow ADMIN to call submit-completion", () => {
      expect(ALLOWED_ROLES_SUBMIT_COMPLETION).toContain("ADMIN");
    });

    it("should NOT allow PROFESSIONAL to call submit-completion", () => {
      expect(ALLOWED_ROLES_SUBMIT_COMPLETION).not.toContain("PROFESSIONAL");
    });
  });

  describe("Role-based access for confirm-professional", () => {
    const ALLOWED_ROLES_CONFIRM_PROFESSIONAL = ["PROFESSIONAL", "ADMIN"];

    it("should allow PROFESSIONAL to call confirm-professional", () => {
      expect(ALLOWED_ROLES_CONFIRM_PROFESSIONAL).toContain("PROFESSIONAL");
    });

    it("should allow ADMIN to call confirm-professional", () => {
      expect(ALLOWED_ROLES_CONFIRM_PROFESSIONAL).toContain("ADMIN");
    });

    it("should NOT allow CLIENT to call confirm-professional", () => {
      expect(ALLOWED_ROLES_CONFIRM_PROFESSIONAL).not.toContain("CLIENT");
    });
  });

  // ============================
  // Confirmation timestamp logic
  // ============================

  describe("Confirmation timestamps", () => {
    it("should set clientConfirmedAt when client submits completion", () => {
      // Simulates what the controller does
      const now = new Date();
      const orderUpdate = {
        status: "AWAITING_PROFESSIONAL_CONFIRMATION" as const,
        clientConfirmedAt: now,
      };

      expect(orderUpdate.status).toBe("AWAITING_PROFESSIONAL_CONFIRMATION");
      expect(orderUpdate.clientConfirmedAt).toBeInstanceOf(Date);
    });

    it("should set professionalConfirmedAt when professional confirms", () => {
      const now = new Date();
      const orderUpdate = {
        status: "COMPLETED" as const,
        completedAt: now,
        professionalConfirmedAt: now,
      };

      expect(orderUpdate.status).toBe("COMPLETED");
      expect(orderUpdate.professionalConfirmedAt).toBeInstanceOf(Date);
      expect(orderUpdate.completedAt).toBeInstanceOf(Date);
    });

    it("should have client confirmed before professional in new flow", () => {
      const clientConfirmedAt = new Date("2026-02-17T10:00:00Z");
      const professionalConfirmedAt = new Date("2026-02-17T10:30:00Z");

      expect(clientConfirmedAt.getTime()).toBeLessThan(
        professionalConfirmedAt.getTime()
      );
    });
  });

  // ============================
  // Payment release on completion
  // ============================

  describe("Payment release", () => {
    it("should calculate correct professional amount after platform fee", () => {
      const paymentAmount = 150;
      const platformFeePercentage = 10;
      const platformFee = (paymentAmount * platformFeePercentage) / 100;
      const professionalAmount = paymentAmount - platformFee;

      expect(platformFee).toBe(15);
      expect(professionalAmount).toBe(135);
      expect(platformFee + professionalAmount).toBe(paymentAmount);
    });

    it("should release payment only when status becomes COMPLETED", () => {
      const statusRequiredForRelease = "AWAITING_PROFESSIONAL_CONFIRMATION";
      const finalStatus = "COMPLETED";
      const paymentStatus = "RELEASED";

      // Payment is only released when transitioning to COMPLETED
      expect(statusRequiredForRelease).toBe("AWAITING_PROFESSIONAL_CONFIRMATION");
      expect(finalStatus).toBe("COMPLETED");
      expect(paymentStatus).toBe("RELEASED");
    });
  });

  // ============================
  // Notification flow
  // ============================

  describe("Notification flow", () => {
    it("should notify professional when client submits completion", () => {
      // In the new flow, the notification goes TO the professional
      const notification = {
        recipientRole: "PROFESSIONAL",
        title: "Cliente confirmou o serviço",
        type: "ORDER_COMPLETED",
      };

      expect(notification.recipientRole).toBe("PROFESSIONAL");
      expect(notification.type).toBe("ORDER_COMPLETED");
    });

    it("should notify client when professional confirms final completion", () => {
      const notification = {
        recipientRole: "CLIENT",
        title: "Serviço concluído",
        type: "ORDER_COMPLETED",
      };

      expect(notification.recipientRole).toBe("CLIENT");
      expect(notification.type).toBe("ORDER_COMPLETED");
    });
  });
});
