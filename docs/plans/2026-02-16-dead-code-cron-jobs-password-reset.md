# Dead Code Cleanup, Cron Jobs & Password Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove dead code files, implement cron jobs for escrow/deadline functions, and implement real password reset logic (backend + frontend).

**Architecture:** Three independent work streams: (1) Delete dead code `serviceController.ts`, (2) Install `node-cron` and wire up three escrow periodic tasks that already exist but are never called, (3) Add `resetPasswordToken`/`resetPasswordExpires` fields to User model, implement real crypto-based token generation in `forgotPassword`, real token verification in `resetPassword`, and create frontend pages for the flow.

**Tech Stack:** Express 5, Prisma 7.3 (SQLite), node-cron, Node.js `crypto`, bcrypt, Vitest, React 18, TailwindCSS

---

## Task 1: Delete Dead Code — `serviceController.ts`

**Files:**
- Delete: `backend/src/controllers/serviceController.ts` (2,690 lines)

**Context:** This file contains 21 exported functions that were refactored into specialized controllers in `backend/src/controllers/service/`. All route files import from the barrel `controllers/service/index.ts`. Zero references to this file exist anywhere in the codebase.

**Step 1: Verify no imports exist**

Run: `grep -r "serviceController" backend/src/ backend/tests/`
Expected: ZERO results (only hits in the file itself, if any)

**Step 2: Run existing tests to establish baseline**

Run: `cd backend && npm test`
Expected: All tests pass (except known `validation.test.ts` bug)

**Step 3: Delete the file**

```bash
rm backend/src/controllers/serviceController.ts
```

**Step 4: Run tests again to confirm nothing broke**

Run: `cd backend && npm test`
Expected: Same results as Step 2

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove dead serviceController.ts (2690 lines, fully superseded by controllers/service/)"
```

---

## Task 2: Install `node-cron` for Scheduled Tasks

**Files:**
- Modify: `backend/package.json` (add dependency)

**Step 1: Install node-cron**

```bash
cd backend && npm install node-cron && npm install -D @types/node-cron
```

**Step 2: Verify installation**

Run: `cd backend && node -e "require('node-cron')"`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "feat: add node-cron for scheduled tasks"
```

---

## Task 3: Create Scheduler Module

**Files:**
- Create: `backend/src/lib/scheduler.ts`

**Step 1: Write the failing test**

Create file `backend/tests/unit/scheduler.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/scheduler.test.ts`
Expected: FAIL — module `../../src/lib/scheduler` not found

**Step 3: Write implementation**

Create file `backend/src/lib/scheduler.ts`:

```typescript
import cron from "node-cron";
import {
  checkAutoReleasablePayments,
  checkExpiredOrders,
  sendDeadlineWarnings,
} from "../services/escrowService";
import { createLogger } from "./logger";

const log = createLogger("scheduler");

let tasks: cron.ScheduledTask[] = [];

/**
 * Start all scheduled cron tasks.
 * Call this once after the server starts.
 */
export function startScheduledTasks(): void {
  log.info("Starting scheduled tasks...");

  // Every hour: auto-release eligible escrow payments
  const autoRelease = cron.schedule("0 * * * *", async () => {
    try {
      const count = await checkAutoReleasablePayments();
      if (count > 0) {
        log.info({ count }, "Auto-released payments from escrow");
      }
    } catch (err) {
      log.error({ err }, "Failed to auto-release payments");
    }
  });

  // Every 6 hours: mark expired orders
  const expiredOrders = cron.schedule("0 */6 * * *", async () => {
    try {
      const count = await checkExpiredOrders();
      if (count > 0) {
        log.info({ count }, "Marked orders as expired");
      }
    } catch (err) {
      log.error({ err }, "Failed to check expired orders");
    }
  });

  // Every 12 hours: send deadline warnings (1 day before)
  const deadlineWarnings = cron.schedule("0 */12 * * *", async () => {
    try {
      const count = await sendDeadlineWarnings(1);
      if (count > 0) {
        log.info({ count }, "Sent deadline warnings");
      }
    } catch (err) {
      log.error({ err }, "Failed to send deadline warnings");
    }
  });

  tasks = [autoRelease, expiredOrders, deadlineWarnings];

  log.info("Scheduled tasks started: auto-release (hourly), expired-orders (6h), deadline-warnings (12h)");
}

/**
 * Stop all scheduled cron tasks.
 * Call this during graceful shutdown.
 */
export function stopScheduledTasks(): void {
  for (const task of tasks) {
    task.stop();
  }
  tasks = [];
  log.info("All scheduled tasks stopped");
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/unit/scheduler.test.ts`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add backend/src/lib/scheduler.ts backend/tests/unit/scheduler.test.ts
git commit -m "feat: add scheduler module with cron jobs for escrow auto-release, expired orders, and deadline warnings"
```

---

## Task 4: Wire Scheduler into Server Startup and Shutdown

**Files:**
- Modify: `backend/src/index.ts` (add import + call on startup + call on shutdown)

**Step 1: Add import at top of `backend/src/index.ts`**

After line `import walletRoutes from "./routes/walletRoutes";` (line 26), add:

```typescript
import { startScheduledTasks, stopScheduledTasks } from "./lib/scheduler";
```

**Step 2: Start scheduler after server starts**

After the `server = app.listen(...)` block (line 198-200), add inside the callback:

```typescript
const server = app.listen(PORT, () => {
  log.info({ port: PORT, env: env.NODE_ENV }, "Server started");
  startScheduledTasks();
});
```

**Step 3: Stop scheduler during graceful shutdown**

Inside the `gracefulShutdown` function (after line 165), before `server.close(...)`, add:

```typescript
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info({ signal }, "Shutting down gracefully...");
  try {
    stopScheduledTasks();
    server.close(() => {
      log.info("HTTP server closed");
    });
    // ... rest unchanged
```

**Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: wire scheduler into server startup and graceful shutdown"
```

---

## Task 5: Add Password Reset Fields to Prisma Schema

**Files:**
- Modify: `backend/prisma/schema.prisma` (add 2 fields to User model)

**Step 1: Add fields to User model**

In `backend/prisma/schema.prisma`, after line 97 (`tokenVersion  Int @default(0)`), add:

```prisma
  resetPasswordToken   String?   @unique
  resetPasswordExpires DateTime?
```

**Step 2: Push schema to database**

Run: `cd backend && npx prisma db push`
Expected: Success — 2 new columns added to User table

**Step 3: Generate Prisma client**

Run: `cd backend && npx prisma generate`
Expected: Prisma Client generated successfully

**Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add resetPasswordToken and resetPasswordExpires fields to User model"
```

---

## Task 6: Add `FRONTEND_URL` Environment Variable

**Files:**
- Modify: `backend/.env.example` (add FRONTEND_URL)
- Modify: `backend/src/config/env.ts` (add FRONTEND_URL to config)

**Step 1: Add to `.env.example`**

At the end of `backend/.env.example`, add:

```env

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:5173
```

**Step 2: Add to EnvConfig interface in `backend/src/config/env.ts`**

After line 73 (`ENABLE_SWAGGER: boolean;`), add:

```typescript
  // Frontend
  FRONTEND_URL: string;
```

**Step 3: Add to config object in `getEnvConfig()`**

After line 157 (`ENABLE_SWAGGER: process.env.ENABLE_SWAGGER === 'true',`), add:

```typescript
    // Frontend
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
```

**Step 4: Add `FRONTEND_URL=http://localhost:5173` to actual `.env` file (if it exists)**

**Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/.env.example backend/src/config/env.ts
git commit -m "feat: add FRONTEND_URL environment variable for password reset links"
```

---

## Task 7: Implement Real `forgotPassword` Logic

**Files:**
- Modify: `backend/src/controllers/authController.ts` (replace stub with real logic)

**Step 1: Write the failing test**

Create file `backend/tests/integration/passwordReset.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import app from "../../src/index";
import prisma from "../../src/lib/prisma";
import { hashPassword } from "../../src/middleware/auth";
import supertest from "supertest";

const request = supertest(app);

describe("Password Reset Flow", () => {
  const testEmail = "resettest@teste.com";
  const testPassword = "Teste@123";

  beforeAll(async () => {
    // Create test user
    const hashed = await hashPassword(testPassword);
    await prisma.user.upsert({
      where: { email: testEmail },
      update: { password: hashed },
      create: {
        email: testEmail,
        name: "Reset Test User",
        password: hashed,
        role: "CLIENT",
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should return success even for non-existent email (timing-safe)", async () => {
      const res = await request
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@teste.com" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should generate a reset token for existing user", async () => {
      const res = await request
        .post("/api/auth/forgot-password")
        .send({ email: testEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Token should be saved to database
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
        select: { resetPasswordToken: true, resetPasswordExpires: true },
      });

      expect(user?.resetPasswordToken).toBeTruthy();
      expect(user?.resetPasswordExpires).toBeTruthy();
      expect(new Date(user!.resetPasswordExpires!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("POST /api/auth/reset-password", () => {
    let resetToken: string;

    beforeEach(async () => {
      // Generate a token via forgot-password
      // We need to capture the token — use a spy on the log or query DB
      await request
        .post("/api/auth/forgot-password")
        .send({ email: testEmail });

      // Get the hashed token from DB (we can't recover the raw token this way)
      // So instead, we'll manually set a known token for testing
      const crypto = await import("crypto");
      resetToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

      await prisma.user.update({
        where: { email: testEmail },
        data: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
        },
      });
    });

    it("should reject invalid token", async () => {
      const res = await request
        .post("/api/auth/reset-password")
        .send({ token: "invalidtoken123", newPassword: "NewPassword@123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject expired token", async () => {
      const crypto = await import("crypto");
      const expiredToken = crypto.randomBytes(32).toString("hex");
      const hashedExpired = crypto.createHash("sha256").update(expiredToken).digest("hex");

      await prisma.user.update({
        where: { email: testEmail },
        data: {
          resetPasswordToken: hashedExpired,
          resetPasswordExpires: new Date(Date.now() - 1000), // expired
        },
      });

      const res = await request
        .post("/api/auth/reset-password")
        .send({ token: expiredToken, newPassword: "NewPassword@123" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reset password with valid token", async () => {
      const newPassword = "NewPassword@123";

      const res = await request
        .post("/api/auth/reset-password")
        .send({ token: resetToken, newPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Token should be cleared
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
        select: { resetPasswordToken: true, resetPasswordExpires: true },
      });
      expect(user?.resetPasswordToken).toBeNull();
      expect(user?.resetPasswordExpires).toBeNull();

      // Should be able to login with new password
      const loginRes = await request
        .post("/api/auth/login")
        .send({ email: testEmail, password: newPassword });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/integration/passwordReset.test.ts`
Expected: FAIL — tests fail because forgotPassword doesn't generate tokens and resetPassword returns 501

**Step 3: Implement `forgotPassword` in `backend/src/controllers/authController.ts`**

Add `import crypto from "crypto";` at the top of the file (after existing imports).

Replace the `forgotPassword` function (lines 436-474) with:

```typescript
// Forgot password (initiate reset)
export const forgotPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json(errorResponse("Email is required"));
      return;
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user) {
      // Generate cryptographically secure reset token
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Hash the token before storing (so a DB leak doesn't expose tokens)
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Save hashed token + expiration (1 hour) to database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: hashedToken,
          resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // Build reset URL
      const { env } = await import("../config/env");
      const resetUrl = `${env.FRONTEND_URL}/reset-password/${resetToken}`;

      // Log the reset link in development (replace with email in production)
      if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
        log.info({ resetUrl, email: user.email }, "Password reset link generated (dev mode)");
      }

      // TODO: Send email with resetUrl when email service is configured
      // Example: await sendResetEmail(user.email, resetUrl);
    } else {
      // Timing-safe: perform a dummy hash to prevent timing attacks
      await hashPassword("dummy-password-for-timing-safety");
    }

    // Always return success (don't reveal if email exists)
    res
      .status(200)
      .json(
        successResponse(
          null,
          "If an account exists with this email, you will receive a password reset link",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Forgot password error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 4: Implement `resetPassword` in `backend/src/controllers/authController.ts`**

Replace the `resetPassword` function (lines 477-516) with:

```typescript
// Reset password with token
export const resetPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res
        .status(400)
        .json(errorResponse("Token and new password are required"));
      return;
    }

    // Hash the incoming token to compare against stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with matching token that hasn't expired
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      res
        .status(400)
        .json(errorResponse("Invalid or expired reset token"));
      return;
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password, clear reset token, increment tokenVersion (invalidates existing JWTs)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        tokenVersion: { increment: 1 },
      },
    });

    log.info({ userId: user.id }, "Password reset successful");

    res
      .status(200)
      .json(
        successResponse(
          null,
          "Password has been reset successfully. Please login with your new password.",
        ),
      );
  } catch (error) {
    log.error({ err: error }, "Reset password error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/integration/passwordReset.test.ts`
Expected: All tests PASS

**Step 6: Run all tests to verify nothing else broke**

Run: `cd backend && npm test`
Expected: All tests pass (except known `validation.test.ts` bug)

**Step 7: Commit**

```bash
git add backend/src/controllers/authController.ts backend/tests/integration/passwordReset.test.ts
git commit -m "feat: implement real password reset logic with crypto tokens and expiration"
```

---

## Task 8: Create Frontend `ForgotPassword` Page

**Files:**
- Create: `frontend/src/pages/ForgotPassword.tsx`
- Modify: `frontend/src/App.tsx` (add route)

**Step 1: Create the page**

Create file `frontend/src/pages/ForgotPassword.tsx`:

```tsx
import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Ocorreu um erro. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
              <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Verifique seu email
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Se uma conta existir com o email <strong>{email}</strong>, você
              receberá um link para redefinir sua senha.
            </p>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
              Não recebeu? Verifique sua caixa de spam ou{" "}
              <button
                onClick={() => setSubmitted(false)}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                tente novamente
              </button>
              .
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block text-primary-600 hover:text-primary-700 font-medium"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Esqueceu a senha?
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Digite seu email e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              placeholder="seu@email.com"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isLoading ? "Enviando..." : "Enviar link de redefinição"}
          </button>

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Voltar ao login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Add route to `frontend/src/App.tsx`**

Add import at the top (near other page imports):
```tsx
import ForgotPassword from "./pages/ForgotPassword";
```

Add route inside the Router, among the public routes (after `/register` route):
```tsx
<Route path="/forgot-password" element={<ForgotPassword />} />
```

**Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/pages/ForgotPassword.tsx frontend/src/App.tsx
git commit -m "feat: add ForgotPassword page with email form and success state"
```

---

## Task 9: Create Frontend `ResetPassword` Page

**Files:**
- Create: `frontend/src/pages/ResetPassword.tsx`
- Modify: `frontend/src/App.tsx` (add route)

**Step 1: Create the page**

Create file `frontend/src/pages/ResetPassword.tsx`:

```tsx
import { useState, FormEvent } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordRequirements = [
    { label: "Pelo menos 8 caracteres", test: (p: string) => p.length >= 8 },
    { label: "Uma letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Uma letra minúscula", test: (p: string) => /[a-z]/.test(p) },
    { label: "Um número", test: (p: string) => /\d/.test(p) },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    const allMet = passwordRequirements.every((r) => r.test(newPassword));
    if (!allMet) {
      setError("A senha não atende todos os requisitos.");
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Token inválido ou expirado. Solicite um novo link."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Link inválido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Este link de redefinição de senha é inválido.
          </p>
          <Link
            to="/forgot-password"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Senha redefinida!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Sua senha foi alterada com sucesso. Redirecionando para o login...
          </p>
          <Link
            to="/login"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Redefinir senha
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Digite sua nova senha abaixo.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Nova senha
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              placeholder="Nova senha"
              disabled={isLoading}
            />
          </div>

          {/* Password requirements checklist */}
          {newPassword.length > 0 && (
            <ul className="space-y-1">
              {passwordRequirements.map((req) => (
                <li
                  key={req.label}
                  className={`flex items-center text-sm ${
                    req.test(newPassword)
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {req.test(newPassword) ? (
                    <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {req.label}
                </li>
              ))}
            </ul>
          )}

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Confirmar nova senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              placeholder="Confirme a nova senha"
              disabled={isLoading}
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                As senhas não coincidem
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !newPassword || !confirmPassword}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isLoading ? "Redefinindo..." : "Redefinir senha"}
          </button>

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Voltar ao login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Add route to `frontend/src/App.tsx`**

Add import (near other page imports):
```tsx
import ResetPassword from "./pages/ResetPassword";
```

Add route (near the `ForgotPassword` route):
```tsx
<Route path="/reset-password/:token" element={<ResetPassword />} />
```

**Step 3: Verify frontend compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/pages/ResetPassword.tsx frontend/src/App.tsx
git commit -m "feat: add ResetPassword page with token validation, password requirements, and success state"
```

---

## Task 10: Run Full Test Suite and Final Verification

**Files:** None (verification only)

**Step 1: Run backend tests**

Run: `cd backend && npm test`
Expected: All tests pass (except known `validation.test.ts` bug)

**Step 2: Check backend TypeScript**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Check frontend TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Verify dead code is gone**

Run: `ls backend/src/controllers/serviceController.ts`
Expected: `No such file or directory`

**Step 5: Verify scheduler exists**

Run: `ls backend/src/lib/scheduler.ts`
Expected: File exists

**Step 6: Verify Prisma schema has reset fields**

Run: `grep "resetPassword" backend/prisma/schema.prisma`
Expected: Shows `resetPasswordToken` and `resetPasswordExpires`

**Step 7: Verify frontend pages exist**

Run: `ls frontend/src/pages/ForgotPassword.tsx frontend/src/pages/ResetPassword.tsx`
Expected: Both files exist

---

## Summary of Changes

| Area | Action | Files Touched |
|------|--------|---------------|
| Dead Code | Delete `serviceController.ts` | 1 file deleted |
| Cron Jobs | Install `node-cron`, create scheduler, wire to server | `package.json`, `lib/scheduler.ts`, `index.ts` |
| Password Reset (Backend) | Add schema fields, env var, implement real logic | `schema.prisma`, `env.ts`, `.env.example`, `authController.ts` |
| Password Reset (Frontend) | Create ForgotPassword + ResetPassword pages | 2 pages, `App.tsx` |
| Tests | Scheduler unit tests + password reset integration tests | 2 test files |

**Total new files:** 4 (scheduler.ts, scheduler.test.ts, ForgotPassword.tsx, ResetPassword.tsx)
**Total modified files:** 5 (package.json, index.ts, schema.prisma, env.ts, App.tsx, authController.ts)
**Total deleted files:** 1 (serviceController.ts — 2,690 lines removed)
