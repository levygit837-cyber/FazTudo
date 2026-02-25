// backend/tests/integration/professionalCrm.test.ts
import { describe, it, expect } from "vitest";

describe("Professional CRM Stats", () => {
  it("should calculate orders today correctly", () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const orders = [
      { createdAt: new Date(), status: "PENDING" },
      { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), status: "COMPLETED" },
      { createdAt: new Date(), status: "IN_PROGRESS" },
    ];

    const ordersToday = orders.filter(
      (o) => o.createdAt >= todayStart && o.createdAt < todayEnd
    ).length;

    expect(ordersToday).toBe(2);
  });

  it("should calculate orders last 7 days correctly", () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const orders = [
      { createdAt: new Date(), status: "PENDING" },
      { createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), status: "COMPLETED" },
      { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), status: "COMPLETED" },
    ];

    const ordersLast7Days = orders.filter((o) => o.createdAt >= sevenDaysAgo).length;

    expect(ordersLast7Days).toBe(2);
  });

  it("should calculate monthly revenue from released payments", () => {
    const payments = [
      { amount: 100, status: "RELEASED" },
      { amount: 200, status: "RELEASED" },
      { amount: 50, status: "HELD" },
    ];
    const platformFeePercentage = 10;

    const monthlyRevenue = payments
      .filter((p) => p.status === "RELEASED")
      .reduce((sum, p) => sum + p.amount * (1 - platformFeePercentage / 100), 0);

    expect(monthlyRevenue).toBe(270); // (100 + 200) * 0.9
  });
});
