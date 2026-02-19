# FazTudo — Remaining Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all remaining security vulnerabilities, failing tests, and missing validation across the entire codebase.

**Architecture:** Defence-in-depth approach: add route-level middleware guards first (rate limiting, role checks, Zod validation), then fix data leaks in controllers, then fix failing tests. Each task is isolated and testable.

**Tech Stack:** Express 5, Zod, Prisma, Vitest + Supertest, TypeScript

---

## Priority Map

| Priority | Tasks | Description |
|----------|-------|-------------|
| 🔴 Critical | 1-5 | Route-level security gaps that allow unauthorized access |
| 🟠 High | 6-11 | Missing input validation (Zod schemas) on POST/PUT endpoints |
| 🟡 Medium | 12-15 | Data leak fixes, safe select in remaining controllers |
| 🔵 Low | 16-19 | Failing test fixes, test improvements |

---

### Task 1: Add rate limiting to `/api/auth/refresh` and `/api/auth/verify-email`

**Files:**
- Modify: `backend/src/routes/authRoutes.ts:32-34`
- Test: `backend/tests/security/rateLimiting.test.ts`

**Step 1: Write the failing test**

Add to `backend/tests/security/rateLimiting.test.ts`:

```typescript
describe("Security: Sensitive Endpoint Rate Limiting", () => {
  it("refresh endpoint should have rate limiting headers", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    const hasHeaders =
      res.headers["ratelimit-limit"] !== undefined ||
      res.headers["x-ratelimit-limit"] !== undefined;
    expect(hasHeaders).toBe(true);
  });

  it("verify-email endpoint should have rate limiting headers", async () => {
    const res = await request(app).post("/api/auth/verify-email").send({});
    const hasHeaders =
      res.headers["ratelimit-limit"] !== undefined ||
      res.headers["x-ratelimit-limit"] !== undefined;
    expect(hasHeaders).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/security/rateLimiting.test.ts -v`
Expected: FAIL — no rate limit headers on those endpoints

**Step 3: Implement — add `authLimiter` to both routes**

In `backend/src/routes/authRoutes.ts`, change:
```typescript
router.post("/verify-email", sensitiveLimiter, authController.verifyEmail);
router.post("/refresh", authLimiter, authController.refreshAccessToken);
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/security/rateLimiting.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/routes/authRoutes.ts backend/tests/security/rateLimiting.test.ts
git commit -m "fix(security): add rate limiting to auth/refresh and auth/verify-email"
```

---

### Task 2: Add `requireRole` + `requireVerified` to payment release route

**Files:**
- Modify: `backend/src/routes/paymentRoutes.ts:46-51`
- Test: `backend/tests/security/authBypass.test.ts`

**Step 1: Write the failing test**

Add to `backend/tests/security/authBypass.test.ts` in the RBAC describe:

```typescript
it("professional should NOT release payment (only CLIENT or ADMIN)", async () => {
  if (!professionalToken) return;

  const res = await request(app)
    .post("/api/services/orders/99999/payments/release")
    .set("Authorization", `Bearer ${professionalToken}`);

  // Should be 403 (role restricted) or 404 (order not found)
  // Must NOT be 200 (success)
  expect([403, 404]).toContain(res.status);
});
```

Note: This test requires `professionalToken` — add a `beforeAll` login for professional if not already present in authBypass.test.ts (it already exists in idor.test.ts, copy the pattern).

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/security/authBypass.test.ts -v`
Expected: FAIL — currently returns 404 or 500 instead of 403

**Step 3: Implement — add role and verified middleware**

In `backend/src/routes/paymentRoutes.ts`, change the release route:
```typescript
router.post(
  "/orders/:orderId/payments/release",
  verifyToken,
  requireRole("CLIENT", "ADMIN"),
  requireVerified,
  financialLimiter,
  serviceController.releasePayment,
);
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/security/authBypass.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/routes/paymentRoutes.ts backend/tests/security/authBypass.test.ts
git commit -m "fix(security): add requireRole and requireVerified to payment release"
```

---

### Task 3: Add `requireVerified` to order cancel + `requireCompanyPermission` to team complete

**Files:**
- Modify: `backend/src/routes/orderRoutes.ts:77-81`
- Modify: `backend/src/routes/companyTeamRoutes.ts:11`

**Step 1: Implement order cancel fix**

In `backend/src/routes/orderRoutes.ts`, change cancel route:
```typescript
router.post(
  "/orders/:id/cancel",
  verifyToken,
  requireVerified,
  serviceController.cancelServiceOrder,
);
```

**Step 2: Implement team complete fix**

In `backend/src/routes/companyTeamRoutes.ts`, change:
```typescript
router.post("/:teamId/complete", requireCompanyPermission("orders.assign"), confirmTeamCompletion);
```

**Step 3: Run security tests**

Run: `cd backend && npx vitest run tests/security/ -v`
Expected: All 75+ tests pass

**Step 4: Commit**

```bash
git add backend/src/routes/orderRoutes.ts backend/src/routes/companyTeamRoutes.ts
git commit -m "fix(security): add requireVerified to cancel, permission guard to team complete"
```

---

### Task 4: Add `authLimiter` to admin login

**Files:**
- Modify: `backend/src/routes/adminRoutes.ts:18`

**Step 1: Implement**

In `backend/src/routes/adminRoutes.ts`, add import and limiter:
```typescript
import { authLimiter } from "../middleware/rateLimiter";
// ...
router.post("/login", authLimiter, validateBody(adminLoginSchema), adminController.adminLogin);
```

**Step 2: Run security tests**

Run: `cd backend && npx vitest run tests/security/ -v`
Expected: All pass

**Step 3: Commit**

```bash
git add backend/src/routes/adminRoutes.ts
git commit -m "fix(security): add authLimiter to admin login endpoint"
```

---

### Task 5: Add `requireRole("PROFESSIONAL")` to dashboard professional endpoints

**Files:**
- Modify: `backend/src/routes/dashboardRoutes.ts`

**Step 1: Read current file and identify lines**

**Step 2: Implement — add role guard**

For all `/professional/*` routes in dashboardRoutes.ts, add `requireRole("PROFESSIONAL", "ADMIN")`:
```typescript
router.get("/professional/crm", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), dashboardController.getProfessionalCRM);
router.get("/professional/calendar", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), dashboardController.getProfessionalCalendar);
router.get("/professional/calendar/:date", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), dashboardController.getProfessionalCalendarByDate);
router.get("/professional/reputation", verifyToken, requireRole("PROFESSIONAL", "ADMIN"), dashboardController.getProfessionalReputation);
```

Also add `requireRole("PROFESSIONAL", "ADMIN")` to `GET /professional/overview` in `walletRoutes.ts`.

**Step 3: Run tests**

Run: `cd backend && npx vitest run tests/security/ -v`
Expected: All pass

**Step 4: Commit**

```bash
git add backend/src/routes/dashboardRoutes.ts backend/src/routes/walletRoutes.ts
git commit -m "fix(security): add role guards to professional-only endpoints"
```

---

### Task 6: Create Zod schemas for disputes and proposals

**Files:**
- Modify: `backend/src/middleware/validation.ts` — add `createDisputeSchema` and `createProposalSchema`
- Modify: `backend/src/routes/disputeRoutes.ts` — add `validateBody`
- Modify: `backend/src/routes/proposalRoutes.ts` — add `validateBody`
- Test: `backend/tests/security/inputValidation.test.ts`

**Step 1: Write failing test**

Add to `inputValidation.test.ts`:
```typescript
describe("Dispute validation", () => {
  it("should reject dispute with missing reason", async () => {
    if (!clientToken) return;
    const res = await request(app)
      .post("/api/services/orders/99999/disputes")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ description: "test" });
    expect([400, 403, 404]).toContain(res.status);
  });

  it("should reject dispute with extremely long description", async () => {
    if (!clientToken) return;
    const res = await request(app)
      .post("/api/services/orders/99999/disputes")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ reason: "QUALITY", description: "a".repeat(10001) });
    expect([400, 403, 404]).toContain(res.status);
  });
});
```

**Step 2: Implement schemas in validation.ts**

```typescript
export const createDisputeSchema = z.object({
  reason: z.enum(["QUALITY", "DELAY", "NO_SHOW", "COMMUNICATION", "PRICING", "DAMAGE", "OTHER"]),
  description: z.string().min(10).max(5000),
});

export const createProposalSchema = z.object({
  price: z.number().positive().max(1000000),
  description: z.string().min(10).max(5000),
  estimatedDays: z.number().int().min(0).max(365).optional(),
  estimatedHours: z.number().int().min(0).max(24).optional(),
  guaranteeDays: z.number().int().min(0).max(365).optional(),
});
```

**Step 3: Add validateBody to routes**

In `disputeRoutes.ts`:
```typescript
import { validateBody } from "../middleware/validate";
import { createDisputeSchema } from "../middleware/validation";
// ...
router.post("/orders/:orderId/disputes", verifyToken, requireVerified, validateBody(createDisputeSchema), serviceController.createDispute);
```

In `proposalRoutes.ts`:
```typescript
import { validateBody } from "../middleware/validate";
import { createProposalSchema } from "../middleware/validation";
// ...
router.post("/orders/:orderId/proposals", verifyToken, requireRole("PROFESSIONAL"), requireVerified, validateBody(createProposalSchema), serviceController.createProposal);
```

**Step 4: Run tests**

Run: `cd backend && npx vitest run tests/security/ -v`

**Step 5: Commit**

```bash
git add backend/src/middleware/validation.ts backend/src/routes/disputeRoutes.ts backend/src/routes/proposalRoutes.ts backend/tests/security/inputValidation.test.ts
git commit -m "fix(security): add Zod validation to disputes and proposals"
```

---

### Task 7: Create Zod schemas for service creation/update and schedule update

**Files:**
- Modify: `backend/src/middleware/validation.ts` — add `createServiceListingSchema`, `updateServiceListingSchema`, `updateScheduleSchema`
- Modify: `backend/src/routes/serviceRoutes.ts` — add `validateBody`
- Modify: `backend/src/routes/scheduleRoutes.ts` — add `validateBody`

**Step 1: Read current controllers to understand required fields**

Read `listingController.ts` create/update and `scheduleController.ts` update to understand body shape.

**Step 2: Add schemas to validation.ts**

```typescript
export const createServiceListingSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  basePrice: z.number().positive().max(1000000),
  categoryId: z.number().int().positive(),
  estimatedDuration: z.string().max(100).optional(),
  serviceArea: z.string().max(500).optional(),
});

export const updateScheduleSchema = z.object({
  schedule: z.record(z.array(z.object({
    start: z.string(),
    end: z.string(),
  }))),
});
```

**Step 3: Wire into routes**

**Step 4: Run tests**

Run: `cd backend && npx vitest run -v`

**Step 5: Commit**

```bash
git add backend/src/middleware/validation.ts backend/src/routes/serviceRoutes.ts backend/src/routes/scheduleRoutes.ts
git commit -m "fix(security): add Zod validation to service listings and schedule"
```

---

### Task 8: Create Zod schemas for company routes (profile, channels, salary, members)

**Files:**
- Modify: `backend/src/middleware/validation.ts` — add company-related schemas
- Modify: `backend/src/routes/companyRoutes.ts`
- Modify: `backend/src/routes/companyChannelRoutes.ts`
- Modify: `backend/src/routes/companySalaryRoutes.ts`
- Modify: `backend/src/routes/companyMemberRoutes.ts`

**Step 1: Read controllers to understand body shapes**

Read `companyController.ts`, `companyChannelController.ts`, `companySalaryController.ts`, `companyMemberController.ts`.

**Step 2: Add schemas**

```typescript
export const updateCompanyProfileSchema = z.object({
  companyName: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional(),
  phone: z.string().max(20).optional(),
  website: z.string().url().max(500).optional().or(z.literal("")),
});

export const createChannelSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

export const createSalaryRuleSchema = z.object({
  roleId: z.number().int().positive(),
  baseSalary: z.number().positive().max(1000000),
  commissionPercentage: z.number().min(0).max(100).optional(),
});

export const transferSalarySchema = z.object({
  memberId: z.number().int().positive(),
  amount: z.number().positive().max(1000000),
  note: z.string().max(500).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  roleId: z.number().int().positive(),
});

export const createRoleSchema = z.object({
  name: z.string().min(2).max(100),
  permissions: z.array(z.string()).min(1),
});
```

**Step 3: Wire into routes with validateBody**

**Step 4: Run tests**

Run: `cd backend && npx vitest run -v`

**Step 5: Commit**

```bash
git add backend/src/middleware/validation.ts backend/src/routes/company*.ts
git commit -m "fix(security): add Zod validation to all company routes"
```

---

### Task 9: Create Zod schemas for location, category CRUD, and admin verify

**Files:**
- Modify: `backend/src/middleware/validation.ts`
- Modify: `backend/src/routes/locationRoutes.ts`
- Modify: `backend/src/routes/categoryRoutes.ts`
- Modify: `backend/src/routes/adminRoutes.ts:50`

**Step 1: Add schemas**

```typescript
export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  parentId: z.number().int().positive().optional(),
});

export const verifyCompanySchema = z.object({
  approved: z.boolean(),
  reason: z.string().max(500).optional(),
});
```

**Step 2: Wire into routes**

**Step 3: Run tests**

**Step 4: Commit**

```bash
git add backend/src/middleware/validation.ts backend/src/routes/locationRoutes.ts backend/src/routes/categoryRoutes.ts backend/src/routes/adminRoutes.ts
git commit -m "fix(security): add Zod validation to location, categories, and admin verify"
```

---

### Task 10: Add query param bounds to public listing search and category search

**Files:**
- Modify: `backend/src/routes/serviceRoutes.ts` or `backend/src/controllers/service/listingController.ts`
- Modify: `backend/src/controllers/service/categoryController.ts` (if exists) or `categoryRoutes.ts`

**Step 1: In listingController, cap `limit` and `offset`**

In the `getServiceListings` function, after parsing `req.query.limit`:
```typescript
const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
```

Similarly in `searchCategories`, cap `limit` to 50.

**Step 2: Run tests**

**Step 3: Commit**

```bash
git add backend/src/controllers/service/listingController.ts backend/src/routes/categoryRoutes.ts
git commit -m "fix(security): cap query param bounds on listing and category search"
```

---

### Task 11: Fix `include: { user: true }` data leaks in company controllers

**Files:**
- Modify: `backend/src/controllers/companyTeamController.ts:38` — replace `user: true` with `user: { select: SAFE_USER_SELECT }`
- Modify: `backend/src/controllers/companySalaryController.ts:86` — replace `user: true` with `user: { select: { id: true, name: true, email: true, balance: true } }`

**Step 1: Implement**

In `companyTeamController.ts` line 38:
```typescript
import { SAFE_USER_SELECT } from "../lib/safeSelect";
// ...
include: { members: { include: { member: { include: { user: { select: SAFE_USER_SELECT } } } } }, leader: { include: { user: { select: SAFE_USER_SELECT } } } },
```

In `companySalaryController.ts` line 86:
```typescript
import { SAFE_USER_SELECT_MINIMAL } from "../lib/safeSelect";
// ...
include: { user: { select: { ...SAFE_USER_SELECT_MINIMAL, balance: true } } },
```

**Step 2: TypeScript check**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 errors

**Step 3: Run tests**

Run: `cd backend && npx vitest run tests/security/ -v`

**Step 4: Commit**

```bash
git add backend/src/controllers/companyTeamController.ts backend/src/controllers/companySalaryController.ts
git commit -m "fix(security): replace include user:true with safe select in company controllers"
```

---

### Task 12: Fix `include: { serviceOrder: true }` in webhook handler

**Files:**
- Modify: `backend/src/controllers/service/paymentController.ts:572,585`

**Step 1: Implement — use select instead of include**

Replace:
```typescript
include: { serviceOrder: true },
```
With:
```typescript
include: { serviceOrder: { select: { id: true, clientId: true, professionalId: true, status: true, price: true } } },
```

**Step 2: Run tests**

**Step 3: Commit**

```bash
git add backend/src/controllers/service/paymentController.ts
git commit -m "fix(security): use select in webhook payment query instead of serviceOrder:true"
```

---

### Task 13: Fix admin login `tokenVersion` leak

**Files:**
- Modify: `backend/src/controllers/adminController.ts:728-744`

**Step 1: Read admin login function**

The admin login queries `tokenVersion: true` (line 695) and strips only `password` from the response (line 739). `tokenVersion` and `refreshToken` are still exposed.

**Step 2: Implement — strip sensitive fields**

Change line 739:
```typescript
const { password: _, tokenVersion: _tv, refreshToken: _rt, ...userData } = user;
```

**Step 3: Run tests**

Run: `cd backend && npx vitest run tests/security/dataLeak.test.ts -v`

**Step 4: Commit**

```bash
git add backend/src/controllers/adminController.ts
git commit -m "fix(security): strip tokenVersion and refreshToken from admin login response"
```

---

### Task 14: Fix companyFlow.test.ts failures (Prisma nested filter issue)

**Files:**
- Modify: `backend/tests/companyFlow.test.ts`

**Step 1: Diagnose**

The companyFlow test uses nested `deleteMany` with relation filters:
```typescript
await prisma.companyMember.deleteMany({ where: { company: { cnpj: "99999999000199" } } });
```
This uses nested relation filtering which is NOT supported by libSQL/SQLite adapter. The fix is to rewrite cleanup to first find the company, then delete by `companyId`.

**Step 2: Rewrite cleanup**

```typescript
beforeAll(async () => {
  // Clean up any existing test data
  const existing = await prisma.companyProfile.findFirst({ where: { cnpj: "99999999000199" } });
  if (existing) {
    await prisma.companyMember.deleteMany({ where: { companyId: existing.id } });
    await prisma.companyRole.deleteMany({ where: { companyId: existing.id } });
    await prisma.companyProfile.delete({ where: { id: existing.id } });
  }
  await prisma.user.deleteMany({ where: { email: "empresa_test@test.com" } });
});
```

**Step 3: Run test**

Run: `cd backend && npx vitest run tests/companyFlow.test.ts -v`

**Step 4: Commit**

```bash
git add backend/tests/companyFlow.test.ts
git commit -m "fix(test): rewrite companyFlow cleanup to avoid nested relation filters"
```

---

### Task 15: Fix companyChannels.test.ts failures (401 — company token not obtained)

**Files:**
- Modify: `backend/tests/companyChannels.test.ts`

**Step 1: Diagnose**

The test gets 401 on all authenticated requests. This means the `companyToken` in `beforeAll` is not being obtained. The test likely registers a COMPANY user but doesn't activate it, or the login endpoint requires specific fields.

**Step 2: Read the test and fix the auth flow**

Ensure the test:
1. Creates a COMPANY user via registration
2. Activates the user (sets `status: "ACTIVE"`) — required since company accounts need admin verification
3. Creates a CompanyProfile
4. Logs in with correct credentials
5. Uses the token properly

**Step 3: Run test**

Run: `cd backend && npx vitest run tests/companyChannels.test.ts -v`

**Step 4: Commit**

```bash
git add backend/tests/companyChannels.test.ts
git commit -m "fix(test): fix company auth flow in companyChannels test"
```

---

### Task 16: Fix companyOrderFlow.test.ts failures

**Files:**
- Modify: `backend/tests/companyOrderFlow.test.ts`

**Step 1: Same pattern as Task 15 — fix company auth flow**

**Step 2: Run test**

**Step 3: Commit**

```bash
git add backend/tests/companyOrderFlow.test.ts
git commit -m "fix(test): fix company auth flow in companyOrderFlow test"
```

---

### Task 17: Fix emailVerification.test.ts failures (Prisma operation timeout)

**Files:**
- Modify: `backend/tests/integration/emailVerification.test.ts`

**Step 1: Diagnose**

Failures show `PrismaClientKnownRequestError: Operation has timed out` on `prisma.user.create()`. The test creates users and then tries to update them with verification tokens, but SQLite locks during parallel test execution. Also, the registration test fails because email sending is attempted during test (should be mocked).

**Step 2: Fix — add test isolation**

1. Increase vitest `testTimeout` for this file or add `{ timeout: 30000 }` to slow tests
2. Add `beforeEach` cleanup to avoid SQLite lock contention
3. Mock `emailService.sendVerificationEmail` to avoid actual email sending during tests

**Step 3: Run test**

Run: `cd backend && npx vitest run tests/integration/emailVerification.test.ts -v`

**Step 4: Commit**

```bash
git add backend/tests/integration/emailVerification.test.ts
git commit -m "fix(test): fix email verification test timeouts and mocking"
```

---

### Task 18: Fix passwordReset.test.ts failures

**Files:**
- Modify: `backend/tests/integration/passwordReset.test.ts`

**Step 1: Diagnose**

Same issue as emailVerification — Prisma operation timeout on user creation/update. The test creates test users but hits SQLite locking issues.

**Step 2: Fix — same pattern as Task 17**

1. Add proper test isolation
2. Mock email service
3. Increase timeout if needed

**Step 3: Run test**

**Step 4: Commit**

```bash
git add backend/tests/integration/passwordReset.test.ts
git commit -m "fix(test): fix password reset test timeouts and isolation"
```

---

### Task 19: Run full test suite verification

**Step 1: Run all tests**

Run: `cd backend && npx vitest run -v`

**Step 2: Verify results**

Expected: 0 failed test files, all tests pass

**Step 3: Run TypeScript check**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`

**Step 4: Final commit if any remaining fixes needed**

```bash
git push origin main
```

---

## Summary

| Category | Tasks | Count |
|----------|-------|-------|
| 🔴 Critical security fixes | 1-5 | 5 |
| 🟠 Zod validation | 6-10 | 5 |
| 🟡 Data leak fixes | 11-13 | 3 |
| 🔵 Failing test fixes | 14-18 | 5 |
| ✅ Verification | 19 | 1 |
| **Total** | | **19** |
