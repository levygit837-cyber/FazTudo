import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";

const log = createLogger("companyCronService");

// ──────────────────────────────────────────────────────────
// Core logic: process salary payments for today
// ──────────────────────────────────────────────────────────

/**
 * Returns the start and end of today in UTC (midnight → 23:59:59.999).
 */
function getTodayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
  return { start, end };
}

/**
 * Process all active salary rules whose dayOfMonth matches today's UTC day.
 * Each rule is processed independently so a single failure never aborts the run.
 */
export async function processDailySalaries(): Promise<void> {
  const todayDay = new Date().getUTCDate();
  const { start: todayStart, end: todayEnd } = getTodayBounds();

  log.info({ todayDay, todayStart, todayEnd }, "Starting daily salary processing");

  // 1. Fetch all active rules due today
  const rules = await prisma.companySalaryRule.findMany({
    where: {
      dayOfMonth: todayDay,
      isActive: true,
    },
    include: {
      company: {
        include: {
          user: { select: { id: true, balance: true, name: true } },
        },
      },
      role: {
        include: {
          members: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, balance: true, name: true } },
            },
          },
        },
      },
    },
  });

  log.info({ count: rules.length }, "Salary rules found for today");

  for (const rule of rules) {
    // Build the list of members to pay for this rule
    let memberIds: number[] = [];

    if (rule.memberId !== null) {
      // Individual rule — targets a specific CompanyMember
      memberIds = [rule.memberId];
    } else if (rule.roleId !== null && rule.role) {
      // Role-based rule — targets all active members with this role
      memberIds = rule.role.members.map((m) => m.id);
    } else {
      log.warn({ ruleId: rule.id }, "Rule has no memberId and no roleId — skipping");
      continue;
    }

    for (const memberId of memberIds) {
      try {
        await processSinglePayment({
          rule: {
            id: rule.id,
            amount: rule.amount,
            description: rule.description,
            companyUserId: rule.company.user.id,
            companyBalance: rule.company.user.balance,
            companyName: rule.company.user.name,
          },
          memberId,
          todayStart,
          todayEnd,
        });
      } catch (err) {
        // Never let one rule failure crash the whole cron run
        log.error(
          { err, ruleId: rule.id, memberId },
          "Failed to process salary payment — continuing with next",
        );
      }
    }
  }

  log.info("Daily salary processing complete");
}

// ──────────────────────────────────────────────────────────
// Per-rule/member payment handler
// ──────────────────────────────────────────────────────────

interface ProcessPaymentArgs {
  rule: {
    id: number;
    amount: number;
    description: string | null;
    companyUserId: number;
    companyBalance: number;
    companyName: string;
  };
  memberId: number;
  todayStart: Date;
  todayEnd: Date;
}

async function processSinglePayment({
  rule,
  memberId,
  todayStart,
  todayEnd,
}: ProcessPaymentArgs): Promise<void> {
  // 2. Idempotency — skip if already paid today
  const existing = await prisma.companySalaryPayment.findFirst({
    where: {
      ruleId: rule.id,
      memberId,
      paidAt: { gte: todayStart, lte: todayEnd },
      status: "PAID",
    },
  });

  if (existing) {
    log.info(
      { ruleId: rule.id, memberId, existingPaymentId: existing.id },
      "Already paid today — skipping (idempotency guard)",
    );
    return;
  }

  // 3. Resolve the CompanyMember → User
  const member = await prisma.companyMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, balance: true, name: true } } },
  });

  if (!member) {
    log.warn({ ruleId: rule.id, memberId }, "CompanyMember not found — skipping");
    return;
  }

  // 4. Validate company has sufficient balance
  if (rule.companyBalance < rule.amount) {
    log.warn(
      {
        ruleId: rule.id,
        memberId,
        companyBalance: rule.companyBalance,
        required: rule.amount,
      },
      "Insufficient company balance — recording FAILED payment",
    );

    await prisma.companySalaryPayment.create({
      data: {
        ruleId: rule.id,
        memberId,
        amount: rule.amount,
        paidAt: new Date(),
        status: "FAILED",
        note: `Saldo insuficiente: empresa tinha R$${rule.companyBalance.toFixed(2)}, necessário R$${rule.amount.toFixed(2)}`,
      },
    });
    return;
  }

  const now = new Date();
  const memberBalanceBefore = member.user.balance;
  const companyBalanceBefore = rule.companyBalance;
  const memberBalanceAfter = memberBalanceBefore + rule.amount;
  const companyBalanceAfter = companyBalanceBefore - rule.amount;
  const description =
    rule.description ??
    `Salário automático para ${member.user.name} (regra #${rule.id})`;

  // 5. Atomically debit company, credit member, create Transaction records
  //    and CompanySalaryPayment — all in a single DB transaction
  await prisma.$transaction(async (tx) => {
    // Debit company wallet
    await tx.user.update({
      where: { id: rule.companyUserId },
      data: { balance: { decrement: rule.amount } },
    });

    // Credit member wallet
    await tx.user.update({
      where: { id: member.userId },
      data: { balance: { increment: rule.amount } },
    });

    // Transaction record — company side (debit)
    await tx.transaction.create({
      data: {
        type: "SALARY_DEBIT",
        amount: rule.amount,
        description: `[Empresa → ${member.user.name}] ${description}`,
        balanceBefore: companyBalanceBefore,
        balanceAfter: companyBalanceAfter,
        userId: rule.companyUserId,
      },
    });

    // Transaction record — member side (credit)
    await tx.transaction.create({
      data: {
        type: "SALARY_CREDIT",
        amount: rule.amount,
        description: `[${rule.companyName}] ${description}`,
        balanceBefore: memberBalanceBefore,
        balanceAfter: memberBalanceAfter,
        userId: member.userId,
      },
    });

    // CompanySalaryPayment record for audit/history
    await tx.companySalaryPayment.create({
      data: {
        ruleId: rule.id,
        memberId,
        amount: rule.amount,
        paidAt: now,
        status: "PAID",
        note: description,
      },
    });
  });

  log.info(
    {
      ruleId: rule.id,
      memberId,
      memberUserId: member.userId,
      memberName: member.user.name,
      amount: rule.amount,
    },
    "Salary payment processed successfully",
  );
}

// ──────────────────────────────────────────────────────────
// Scheduler: fires daily at 11:00 UTC (08:00 BRT)
// ──────────────────────────────────────────────────────────

const TARGET_HOUR_UTC = 11;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

let salaryTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
let salaryIntervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Calculate milliseconds until the next occurrence of TARGET_HOUR_UTC:00:00 UTC.
 */
function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), TARGET_HOUR_UTC, 0, 0, 0),
  );

  if (next.getTime() <= now.getTime()) {
    // The target hour has already passed today — schedule for tomorrow
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * Schedule the daily salary cron.
 * First run fires at the next 11:00 UTC; subsequent runs every 24 h.
 */
export function scheduleDailySalaries(): void {
  const delay = msUntilNextRun();
  const nextRunAt = new Date(Date.now() + delay);

  log.info(
    { nextRunAt, delayMs: delay },
    `Salary cron scheduled — first run at ${nextRunAt.toISOString()}`,
  );

  salaryTimeoutHandle = setTimeout(() => {
    // First fire
    processDailySalaries().catch((err) =>
      log.error({ err }, "Unhandled error in daily salary cron"),
    );

    // Then repeat every 24 hours
    salaryIntervalHandle = setInterval(() => {
      processDailySalaries().catch((err) =>
        log.error({ err }, "Unhandled error in daily salary cron"),
      );
    }, MS_PER_DAY);
  }, delay);
}

/**
 * Cancel scheduled salary tasks (used during graceful shutdown).
 */
export function stopSalaryCron(): void {
  if (salaryTimeoutHandle) {
    clearTimeout(salaryTimeoutHandle);
    salaryTimeoutHandle = null;
  }
  if (salaryIntervalHandle) {
    clearInterval(salaryIntervalHandle);
    salaryIntervalHandle = null;
  }
  log.info("Salary cron stopped");
}
