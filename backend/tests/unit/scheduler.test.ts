import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node-cron
vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn(),
    validate: vi.fn(() => true),
  },
}));

// Mock escrow service
vi.mock("../../src/services/escrowService", () => ({
  checkAutoReleasablePayments: vi.fn().mockResolvedValue(0),
  checkExpiredOrders: vi.fn().mockResolvedValue(0),
  sendDeadlineWarnings: vi.fn().mockResolvedValue(0),
}));

// Mock logger
vi.mock("../../src/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import cron from "node-cron";
import { startScheduledTasks, stopScheduledTasks } from "../../src/lib/scheduler";

describe("Scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register 3 cron jobs when started", () => {
    startScheduledTasks();
    expect(cron.schedule).toHaveBeenCalledTimes(3);
  });

  it("should schedule auto-release payments every hour", () => {
    startScheduledTasks();
    const calls = (cron.schedule as any).mock.calls;
    // First call: every hour at minute 0
    expect(calls[0][0]).toBe("0 * * * *");
    expect(typeof calls[0][1]).toBe("function");
  });

  it("should schedule expired orders check every 6 hours", () => {
    startScheduledTasks();
    const calls = (cron.schedule as any).mock.calls;
    expect(calls[1][0]).toBe("0 */6 * * *");
    expect(typeof calls[1][1]).toBe("function");
  });

  it("should schedule deadline warnings every 12 hours", () => {
    startScheduledTasks();
    const calls = (cron.schedule as any).mock.calls;
    expect(calls[2][0]).toBe("0 */12 * * *");
    expect(typeof calls[2][1]).toBe("function");
  });

  it("should stop all tasks when stopScheduledTasks is called", () => {
    const mockTask = { stop: vi.fn() };
    (cron.schedule as any).mockReturnValue(mockTask);

    startScheduledTasks();
    stopScheduledTasks();

    expect(mockTask.stop).toHaveBeenCalledTimes(3);
  });
});
