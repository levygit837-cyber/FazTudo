import { describe, it, expect } from "vitest";
import { validateRescheduleRequest, canReschedule } from "../src/services/rescheduleService";

describe("rescheduleService", () => {
  describe("canReschedule", () => {
    it("allows ACCEPTED orders", () => {
      expect(canReschedule("ACCEPTED")).toBe(true);
    });

    it("allows IN_PROGRESS orders", () => {
      expect(canReschedule("IN_PROGRESS")).toBe(true);
    });

    it("allows PENDING orders", () => {
      expect(canReschedule("PENDING")).toBe(true);
    });

    it("rejects COMPLETED orders", () => {
      expect(canReschedule("COMPLETED")).toBe(false);
    });

    it("rejects CANCELLED orders", () => {
      expect(canReschedule("CANCELLED")).toBe(false);
    });
  });

  describe("validateRescheduleRequest", () => {
    it("accepts valid future date", () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const result = validateRescheduleRequest(tomorrow);
      expect(result.valid).toBe(true);
    });

    it("rejects missing date", () => {
      const result = validateRescheduleRequest("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("New date is required");
    });

    it("rejects invalid date string", () => {
      const result = validateRescheduleRequest("not-a-date");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid date format");
    });
  });
});
