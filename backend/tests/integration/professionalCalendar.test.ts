// backend/tests/integration/professionalCalendar.test.ts
import { describe, it, expect } from "vitest";

describe("Professional Calendar", () => {
  it("should group orders by day in a month", () => {
    const orders = [
      { scheduledDate: new Date(2026, 1, 5), status: "COMPLETED", clientId: 1 },
      { scheduledDate: new Date(2026, 1, 5), status: "IN_PROGRESS", clientId: 2 },
      { scheduledDate: new Date(2026, 1, 10), status: "PENDING", clientId: 3 },
      { scheduledDate: new Date(2026, 1, 15), status: "ACCEPTED", clientId: 4 },
    ];

    const dayMap: Record<number, { total: number; completed: number; upcoming: number }> = {};

    for (const order of orders) {
      const day = order.scheduledDate.getDate();
      if (!dayMap[day]) {
        dayMap[day] = { total: 0, completed: 0, upcoming: 0 };
      }
      dayMap[day].total++;
      if (order.status === "COMPLETED") {
        dayMap[day].completed++;
      } else {
        dayMap[day].upcoming++;
      }
    }

    expect(dayMap[5]).toEqual({ total: 2, completed: 1, upcoming: 1 });
    expect(dayMap[10]).toEqual({ total: 1, completed: 0, upcoming: 1 });
    expect(dayMap[15]).toEqual({ total: 1, completed: 0, upcoming: 1 });
  });

  it("should identify available days from schedule", () => {
    const schedule = [
      { dayOfWeek: 0, isAvailable: false },
      { dayOfWeek: 1, isAvailable: true },
      { dayOfWeek: 2, isAvailable: true },
      { dayOfWeek: 3, isAvailable: true },
      { dayOfWeek: 4, isAvailable: true },
      { dayOfWeek: 5, isAvailable: true },
      { dayOfWeek: 6, isAvailable: false },
    ];

    const availableDays = schedule.filter((s) => s.isAvailable).map((s) => s.dayOfWeek);
    expect(availableDays).toEqual([1, 2, 3, 4, 5]);
  });
});
