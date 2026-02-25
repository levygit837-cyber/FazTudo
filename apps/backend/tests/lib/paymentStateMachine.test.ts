import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// MOCKS
// ============================================

const mockRedisSet = vi.fn();
const mockRedisConnection = {
  set: mockRedisSet,
};

vi.mock("../../src/queues/connection", () => ({
  getRedisConnection: vi.fn(() => mockRedisConnection),
  getRedisConnectionOpts: vi.fn(() => ({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null,
  })),
}));

const mockPrismaPaymentFindUnique = vi.fn();
const mockPrismaPaymentEventCreate = vi.fn();
const mockPrismaPaymentUpdate = vi.fn();
const mockPrismaTransaction = vi.fn();
const mockPrismaPaymentEventFindMany = vi.fn();

vi.mock("../../src/lib/prisma", () => ({
  default: {
    payment: {
      findUnique: (...args: any[]) => mockPrismaPaymentFindUnique(...args),
      update: (...args: any[]) => mockPrismaPaymentUpdate(...args),
    },
    paymentEvent: {
      create: (...args: any[]) => mockPrismaPaymentEventCreate(...args),
      findMany: (...args: any[]) => mockPrismaPaymentEventFindMany(...args),
    },
    $transaction: (...args: any[]) => mockPrismaTransaction(...args),
  },
}));

vi.mock("../../src/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import AFTER mocks
import {
  transitionPaymentStatus,
  appendPaymentEvent,
  getPaymentEventHistory,
} from "../../src/lib/paymentStateMachine";

// ============================================
// TESTS
// ============================================

describe("paymentStateMachine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Redis NX succeeds
    mockRedisSet.mockResolvedValue("OK");
  });

  describe("transitionPaymentStatus", () => {
    it("should transition PENDING → HELD successfully", async () => {
      mockPrismaPaymentFindUnique.mockResolvedValue({
        id: 1,
        status: "PENDING",
      });

      const mockEvent = {
        id: 100,
        paymentId: 1,
        eventType: "HELD",
        previousStatus: "PENDING",
        newStatus: "HELD",
        idempotencyKey: "test-key-1",
        createdAt: new Date(),
      };

      mockPrismaTransaction.mockResolvedValue([mockEvent]);

      const result = await transitionPaymentStatus({
        paymentId: 1,
        newStatus: "HELD",
        eventType: "HELD",
        source: "WEBHOOK",
        idempotencyKey: "test-key-1",
      });

      expect(result.success).toBe(true);
      expect(result.duplicate).toBeUndefined();
      expect(result.event).toEqual(mockEvent);
    });

    it("should reject invalid transition PENDING → RELEASED", async () => {
      mockPrismaPaymentFindUnique.mockResolvedValue({
        id: 1,
        status: "PENDING",
      });

      const result = await transitionPaymentStatus({
        paymentId: 1,
        newStatus: "RELEASED",
        eventType: "RELEASED",
        source: "INTERNAL",
        idempotencyKey: "test-key-2",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot transition from PENDING to RELEASED");
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it("should return duplicate when Redis NX fails", async () => {
      mockRedisSet.mockResolvedValue(null); // NX not set = duplicate

      const result = await transitionPaymentStatus({
        paymentId: 1,
        newStatus: "HELD",
        eventType: "HELD",
        source: "WEBHOOK",
        idempotencyKey: "duplicate-key",
      });

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
      // Should NOT query the DB
      expect(mockPrismaPaymentFindUnique).not.toHaveBeenCalled();
    });

    it("should return duplicate when DB unique constraint is violated", async () => {
      mockPrismaPaymentFindUnique.mockResolvedValue({
        id: 1,
        status: "PENDING",
      });

      mockPrismaTransaction.mockRejectedValue({
        code: "P2002",
        meta: { target: ["idempotencyKey"] },
      });

      const result = await transitionPaymentStatus({
        paymentId: 1,
        newStatus: "HELD",
        eventType: "HELD",
        source: "WEBHOOK",
        idempotencyKey: "db-dup-key",
      });

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
    });

    it("should return error when payment not found", async () => {
      mockPrismaPaymentFindUnique.mockResolvedValue(null);

      const result = await transitionPaymentStatus({
        paymentId: 999,
        newStatus: "HELD",
        eventType: "HELD",
        source: "INTERNAL",
        idempotencyKey: "missing-payment",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Payment 999 not found");
    });

    it("should fall back to DB-only when Redis is down", async () => {
      mockRedisSet.mockRejectedValue(new Error("Redis connection refused"));
      mockPrismaPaymentFindUnique.mockResolvedValue({
        id: 1,
        status: "PENDING",
      });

      const mockEvent = {
        id: 101,
        paymentId: 1,
        eventType: "HELD",
        previousStatus: "PENDING",
        newStatus: "HELD",
        idempotencyKey: "redis-down-key",
        createdAt: new Date(),
      };

      mockPrismaTransaction.mockResolvedValue([mockEvent]);

      const result = await transitionPaymentStatus({
        paymentId: 1,
        newStatus: "HELD",
        eventType: "HELD",
        source: "WEBHOOK",
        idempotencyKey: "redis-down-key",
      });

      expect(result.success).toBe(true);
      expect(result.event).toEqual(mockEvent);
    });

    it("should allow HELD → RELEASED transition", async () => {
      mockPrismaPaymentFindUnique.mockResolvedValue({
        id: 1,
        status: "HELD",
      });

      const mockEvent = {
        id: 102,
        paymentId: 1,
        eventType: "RELEASED",
        previousStatus: "HELD",
        newStatus: "RELEASED",
        idempotencyKey: "release-key",
        createdAt: new Date(),
      };

      mockPrismaTransaction.mockResolvedValue([mockEvent]);

      const result = await transitionPaymentStatus({
        paymentId: 1,
        newStatus: "RELEASED",
        eventType: "RELEASED",
        source: "INTERNAL",
        idempotencyKey: "release-key",
      });

      expect(result.success).toBe(true);
      expect(result.event?.newStatus).toBe("RELEASED");
    });

    it("should allow HELD → REFUNDED transition", async () => {
      mockPrismaPaymentFindUnique.mockResolvedValue({
        id: 1,
        status: "HELD",
      });

      const mockEvent = {
        id: 103,
        paymentId: 1,
        eventType: "REFUNDED",
        previousStatus: "HELD",
        newStatus: "REFUNDED",
        idempotencyKey: "refund-key",
        createdAt: new Date(),
      };

      mockPrismaTransaction.mockResolvedValue([mockEvent]);

      const result = await transitionPaymentStatus({
        paymentId: 1,
        newStatus: "REFUNDED",
        eventType: "REFUNDED",
        source: "ADMIN",
        idempotencyKey: "refund-key",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("appendPaymentEvent", () => {
    it("should append event without changing status", async () => {
      mockPrismaPaymentFindUnique.mockResolvedValue({
        id: 1,
        status: "PENDING",
      });

      const mockEvent = {
        id: 200,
        paymentId: 1,
        eventType: "WEBHOOK_RECEIVED",
        previousStatus: "PENDING",
        newStatus: "PENDING",
        idempotencyKey: "append-key",
        createdAt: new Date(),
      };

      mockPrismaPaymentEventCreate.mockResolvedValue(mockEvent);

      const result = await appendPaymentEvent({
        paymentId: 1,
        eventType: "WEBHOOK_RECEIVED",
        source: "WEBHOOK",
        idempotencyKey: "append-key",
      });

      expect(result.success).toBe(true);
      expect(result.event?.newStatus).toBe("PENDING");
      // Should NOT update payment status
      expect(mockPrismaPaymentUpdate).not.toHaveBeenCalled();
    });

    it("should return duplicate on idempotency collision", async () => {
      mockPrismaPaymentFindUnique.mockResolvedValue({
        id: 1,
        status: "PENDING",
      });

      mockPrismaPaymentEventCreate.mockRejectedValue({
        code: "P2002",
        meta: { target: ["idempotencyKey"] },
      });

      const result = await appendPaymentEvent({
        paymentId: 1,
        eventType: "WEBHOOK_RECEIVED",
        source: "WEBHOOK",
        idempotencyKey: "dup-append-key",
      });

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
    });
  });

  describe("getPaymentEventHistory", () => {
    it("should return events in chronological order", async () => {
      const mockEvents = [
        { id: 1, eventType: "CREATED", createdAt: new Date("2026-01-01") },
        { id: 2, eventType: "HELD", createdAt: new Date("2026-01-02") },
      ];

      mockPrismaPaymentEventFindMany.mockResolvedValue(mockEvents);

      const events = await getPaymentEventHistory(1);

      expect(events).toEqual(mockEvents);
      expect(mockPrismaPaymentEventFindMany).toHaveBeenCalledWith({
        where: { paymentId: 1 },
        orderBy: { createdAt: "asc" },
      });
    });
  });
});
