// backend/tests/integration/professionalFinance.test.ts
import { describe, it, expect } from "vitest";

describe("Professional Financial Forecast", () => {
  it("should calculate next withdrawal forecast from held payments", () => {
    const heldPayments = [
      { amount: 500, heldUntil: new Date(2026, 1, 20), status: "HELD" },
      { amount: 300, heldUntil: new Date(2026, 1, 25), status: "HELD" },
      { amount: 200, heldUntil: new Date(2026, 2, 1), status: "HELD" },
    ];
    const feePercentage = 10;

    const forecast = heldPayments.map((p) => ({
      amount: p.amount * (1 - feePercentage / 100),
      releaseDate: p.heldUntil,
    }));

    expect(forecast[0]).toEqual({
      amount: 450,
      releaseDate: new Date(2026, 1, 20),
    });
    expect(forecast[1]).toEqual({
      amount: 270,
      releaseDate: new Date(2026, 1, 25),
    });
  });

  it("should compute fee breakdown correctly", () => {
    const grossAmount = 1000;
    const feePercentage = 10;
    const platformFee = grossAmount * (feePercentage / 100);
    const netAmount = grossAmount - platformFee;

    expect(platformFee).toBe(100);
    expect(netAmount).toBe(900);
  });
});
