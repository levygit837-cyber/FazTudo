import prisma from "./prisma";
import { getRedisConnection } from "../queues/connection";
import { createLogger } from "./logger";
import type { PaymentEventType, EventSource } from "@prisma/client";

const log = createLogger("paymentStateMachine");

// Valid transitions: current status -> [allowed target statuses]
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["HELD", "FAILED"],
  HELD: ["RELEASED", "REFUNDED", "PARTIALLY_REFUNDED"],
  DISPUTED: ["RELEASED", "REFUNDED"],
};

interface TransitionParams {
  paymentId: number;
  newStatus: string;
  eventType: PaymentEventType;
  source: EventSource;
  idempotencyKey: string;
  amount?: number;
  metadata?: Record<string, unknown>;
  actorId?: number;
  ipAddress?: string;
}

interface TransitionResult {
  success: boolean;
  duplicate?: boolean;
  error?: string;
  event?: {
    id: number;
    paymentId: number;
    eventType: PaymentEventType;
    previousStatus: string | null;
    newStatus: string;
    idempotencyKey: string;
    createdAt: Date;
  };
}

/**
 * Transition a payment to a new status with event store.
 * Guarantees idempotency via Redis (5min TTL) + DB UNIQUE constraint.
 */
export async function transitionPaymentStatus(
  params: TransitionParams,
): Promise<TransitionResult> {
  const {
    paymentId,
    newStatus,
    eventType,
    source,
    idempotencyKey,
    amount,
    metadata,
    actorId,
    ipAddress,
  } = params;

  // 1. Redis dedup (fast layer, TTL 5min)
  try {
    const redis = getRedisConnection();
    const redisKey = `dedup:payment:${idempotencyKey}`;
    const setResult = await redis.set(redisKey, "1", "EX", 300, "NX");
    if (!setResult) {
      log.info({ idempotencyKey }, "Duplicate payment event rejected (Redis)");
      return { success: true, duplicate: true };
    }
  } catch (err) {
    // Redis down -- continue with DB check only
    log.warn({ err }, "Redis dedup unavailable -- falling back to DB only");
  }

  // 2. Fetch current payment
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true },
  });

  if (!payment) {
    return { success: false, error: `Payment ${paymentId} not found` };
  }

  // 3. Validate transition
  const currentStatus = payment.status;
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    log.warn(
      { paymentId, currentStatus, newStatus },
      "Invalid payment status transition",
    );
    return {
      success: false,
      error: `Cannot transition from ${currentStatus} to ${newStatus}`,
    };
  }

  // 4. Atomic transaction: create event + update status
  try {
    const [event] = await prisma.$transaction([
      prisma.paymentEvent.create({
        data: {
          paymentId,
          eventType,
          previousStatus: currentStatus,
          newStatus,
          idempotencyKey,
          amount,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
          source,
          actorId,
          ipAddress,
        },
      }),
      prisma.payment.update({
        where: { id: paymentId },
        data: { status: newStatus as any },
      }),
    ]);

    log.info(
      { paymentId, from: currentStatus, to: newStatus, eventId: event.id },
      "Payment status transitioned",
    );

    return { success: true, event };
  } catch (err: any) {
    // UNIQUE constraint violation = duplicate
    if (err.code === "P2002" && err.meta?.target?.includes("idempotencyKey")) {
      log.info({ idempotencyKey }, "Duplicate payment event rejected (DB)");
      return { success: true, duplicate: true };
    }
    throw err;
  }
}

/**
 * Append a payment event without status transition.
 * Useful for logging webhook receipts, fraud flags, reconciliation results.
 */
export async function appendPaymentEvent(params: {
  paymentId: number;
  eventType: PaymentEventType;
  source: EventSource;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  actorId?: number;
  ipAddress?: string;
}): Promise<TransitionResult> {
  const { paymentId, eventType, source, idempotencyKey, metadata, actorId, ipAddress } = params;

  // Redis dedup
  try {
    const redis = getRedisConnection();
    const redisKey = `dedup:payment:${idempotencyKey}`;
    const setResult = await redis.set(redisKey, "1", "EX", 300, "NX");
    if (!setResult) {
      return { success: true, duplicate: true };
    }
  } catch {
    // Redis unavailable, fall through to DB
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true },
  });

  if (!payment) {
    return { success: false, error: `Payment ${paymentId} not found` };
  }

  try {
    const event = await prisma.paymentEvent.create({
      data: {
        paymentId,
        eventType,
        previousStatus: payment.status,
        newStatus: payment.status, // No change
        idempotencyKey,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        source,
        actorId,
        ipAddress,
      },
    });

    return { success: true, event };
  } catch (err: any) {
    if (err.code === "P2002" && err.meta?.target?.includes("idempotencyKey")) {
      return { success: true, duplicate: true };
    }
    throw err;
  }
}

/**
 * Retrieve payment event history in chronological order.
 */
export async function getPaymentEventHistory(paymentId: number) {
  return prisma.paymentEvent.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" },
  });
}
