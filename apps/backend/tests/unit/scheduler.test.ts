import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock bullmq Queue
const mockAdd = vi.fn().mockResolvedValue({ id: "test-job-id" });
const mockGetRepeatableJobs = vi.fn().mockResolvedValue([]);
const mockRemoveRepeatableByKey = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock("bullmq", () => {
  return {
    Queue: vi.fn().mockImplementation(function (this: any) {
      this.add = mockAdd;
      this.getRepeatableJobs = mockGetRepeatableJobs;
      this.removeRepeatableByKey = mockRemoveRepeatableByKey;
      this.close = mockClose;
    }),
  };
});

// Mock Redis connection
vi.mock("../../src/queues/connection", () => ({
  getRedisConnectionOpts: vi.fn(() => ({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
  })),
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

import { startScheduledTasks, stopScheduledTasks } from "../../src/lib/scheduler";

describe("Scheduler (BullMQ)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register 5 repeatable jobs when started", async () => {
    await startScheduledTasks();
    expect(mockAdd).toHaveBeenCalledTimes(5);
  });

  it("should schedule auto-release payments every hour", async () => {
    await startScheduledTasks();
    const calls = mockAdd.mock.calls;
    const autoRelease = calls.find((c: any[]) => c[0] === "auto-release-escrow");
    expect(autoRelease).toBeDefined();
    expect(autoRelease![2].repeat.pattern).toBe("0 * * * *");
  });

  it("should schedule expired orders check every 6 hours", async () => {
    await startScheduledTasks();
    const calls = mockAdd.mock.calls;
    const expired = calls.find((c: any[]) => c[0] === "check-expired-orders");
    expect(expired).toBeDefined();
    expect(expired![2].repeat.pattern).toBe("0 */6 * * *");
  });

  it("should schedule deadline warnings every 12 hours", async () => {
    await startScheduledTasks();
    const calls = mockAdd.mock.calls;
    const warnings = calls.find((c: any[]) => c[0] === "deadline-warnings");
    expect(warnings).toBeDefined();
    expect(warnings![2].repeat.pattern).toBe("0 */12 * * *");
  });

  it("should schedule delay check every minute", async () => {
    await startScheduledTasks();
    const calls = mockAdd.mock.calls;
    const delay = calls.find((c: any[]) => c[0] === "delay-check");
    expect(delay).toBeDefined();
    expect(delay![2].repeat.pattern).toBe("* * * * *");
  });

  it("should schedule daily reconciliation at 02:00 UTC", async () => {
    await startScheduledTasks();
    const calls = mockAdd.mock.calls;
    const recon = calls.find((c: any[]) => c[0] === "daily-reconciliation");
    expect(recon).toBeDefined();
    expect(recon![2].repeat.pattern).toBe("0 2 * * *");
  });

  it("should clean stale repeatable jobs before registering new ones", async () => {
    const staleJob = { key: "stale-key" };
    mockGetRepeatableJobs.mockResolvedValueOnce([staleJob]);

    await startScheduledTasks();

    expect(mockGetRepeatableJobs).toHaveBeenCalled();
    expect(mockRemoveRepeatableByKey).toHaveBeenCalledWith("stale-key");
  });

  it("should stop all tasks when stopScheduledTasks is called", async () => {
    await startScheduledTasks();
    await stopScheduledTasks();
    expect(mockClose).toHaveBeenCalled();
  });
});
