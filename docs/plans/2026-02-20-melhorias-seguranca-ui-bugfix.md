# Security, UI & Bugfix Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 real issues: (1) Refresh token flow incorrectly reads from req.body instead of httpOnly cookie; (2) Register popup modals have hardcoded light-mode colors making inputs invisible in dark mode; (3) TypeScript error in orderController due to stale Prisma client.

**Architecture:**
- Auth fix: minimal surgical change — read refreshToken from `req.cookies` instead of `req.body`, set new tokens as cookies on refresh response, remove refreshToken from JSON login body
- Dark mode fix: add `dark:` Tailwind variants to both `RegisterPromptClient.tsx` and `RegisterPromptProfessional.tsx` — modal wrapper, inputs, labels, headings, step badges
- TS bugfix: run `npx prisma generate` to regenerate the Prisma client so `metadata Json?` is included in `MessageCreateInput`

**Note on Upload (Issue #1):** The current upload system already has MIME allowlist + magic-byte validation + UUID filenames + auth-gated static serving. Migrating to object storage (S3/GCS) + signed URLs + antivirus is a **large infrastructure change** requiring cloud credentials, S3 bucket setup, and multer-s3 migration. This is explicitly **OUT OF SCOPE** for this plan — it's a separate infrastructure task. The current implementation is production-safe for the current scale.

**Tech Stack:** Express 5, TypeScript, Prisma 7, React 19, Tailwind CSS v4, cookie-parser (already installed)

---

## Pre-Flight Check

Before starting, verify the dev environment compiles:

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit 2>&1 | head -30
```

Expected: you'll likely see the `metadata` error at `orderController.ts:1486`. That's what we're fixing first.

---

## Task 1: Fix TypeScript Error — Regenerate Prisma Client

**Context:** The `metadata Json?` field was added to `prisma/schema.prisma` in the `Message` model, but the Prisma client was not regenerated. TypeScript therefore sees the old `MessageCreateInput` type without the `metadata` field. Running `prisma generate` rebuilds the client from the schema.

**Files:**
- Run: `backend/` (no source file changes)

### Step 1: Regenerate the Prisma client

```bash
cd /home/levybonito/faztudo-main/backend && npx prisma generate
```

Expected output: `✔ Generated Prisma Client (v7.x.x) to ./node_modules/@prisma/client`

### Step 2: Verify the TypeScript error is gone

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit 2>&1 | grep -E "orderController|metadata"
```

Expected: **no output** (no errors for those files).

### Step 3: Verify the full build has no regressions

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: clean or only pre-existing unrelated errors.

### Step 4: Commit

```bash
cd /home/levybonito/faztudo-main && git add backend/package.json
git commit -m "fix: regenerate prisma client to include metadata field in MessageCreateInput"
```

Note: `prisma generate` doesn't modify tracked source files — the generated client lives in `node_modules` (gitignored). The commit documents intent; if there are no staged files, skip the commit and note that `prisma generate` must be run post-clone (add to README if needed).

---

## Task 2: Fix Refresh Token Flow — Read from Cookie, Not Body

**Context:** On login, `refreshToken` is correctly set as an `httpOnly` cookie (`getCookieOptions`). However, the `refreshAccessToken` endpoint reads `const { refreshToken } = req.body` — meaning JS can read it from the response body and send it back manually, defeating the httpOnly security model. The fix: read from `req.cookies.refreshToken` instead, set new tokens as cookies on refresh, and stop returning `refreshToken` in the JSON body.

**Files:**
- Modify: `backend/src/controllers/authController.ts`

### Step 1: Read the current refreshAccessToken function

Open `backend/src/controllers/authController.ts` and find the `refreshAccessToken` function (around line 1053). Read the full function to understand its shape before editing.

### Step 2: Change the source of refreshToken (read from cookie)

Find this block in `refreshAccessToken`:

```typescript
export const refreshAccessToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json(errorResponse("Refresh token is required"));
    return;
  }
```

Replace with:

```typescript
export const refreshAccessToken = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    res.status(401).json(errorResponse("Refresh token not found"));
    return;
  }
```

**Why:** `req.cookies.refreshToken` reads the httpOnly cookie. Status changed to 401 (unauthenticated, not bad request).

### Step 3: Set new tokens as cookies in the refresh response

Find the success response at the end of `refreshAccessToken` (around line 1113–1118):

```typescript
res.status(200).json(
  successResponse(
    { token: newToken, refreshToken: newRefreshToken },
    "Token refreshed successfully",
  ),
);
```

Replace with:

```typescript
res.cookie("accessToken", newToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
res.cookie("refreshToken", newRefreshToken, getCookieOptions(REFRESH_TOKEN_MAX_AGE));

res.status(200).json(
  successResponse(
    { token: newToken },
    "Token refreshed successfully",
  ),
);
```

**Why:** Token rotation — the old refresh token is invalidated and a new one is issued as a cookie. We still return `token` in the body because some frontend code may need it to update an in-memory reference, but `refreshToken` is never exposed to JS.

### Step 4: Remove refreshToken from login JSON response body

Find the login success response in `login` function (around line 326–338):

```typescript
res.cookie("accessToken", token, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
res.cookie("refreshToken", newRefreshToken, getCookieOptions(REFRESH_TOKEN_MAX_AGE));

return res.status(200).json(
  successResponse(
    {
      user: { ... },
      token,
      refreshToken: newRefreshToken,   // ← REMOVE THIS LINE
    },
    "Login realizado com sucesso",
  ),
);
```

Remove the `refreshToken: newRefreshToken` line from the JSON body. The cookie is already set above it.

### Step 5: Remove refreshToken from register response body (if present)

Search the `register` function (around line 225–241) for any similar `refreshToken: newRefreshToken` in the JSON body. If found, remove it for the same reason.

### Step 6: Verify TypeScript compiles

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit 2>&1 | grep -E "authController"
```

Expected: no errors.

### Step 7: Run existing auth tests

```bash
cd /home/levybonito/faztudo-main/backend && npm test -- --reporter=verbose 2>&1 | grep -E "(auth|PASS|FAIL|✓|✗)"
```

Expected: all auth-related tests pass. If any fail, they were testing the old `req.body` behavior and need updating to use cookies.

### Step 8: If auth tests fail — update test to send cookie

If a test calls `POST /api/auth/refresh` with `{ refreshToken: "..." }` in the body and now fails, update it to set a cookie instead:

```typescript
// Old (broken):
const res = await request(app)
  .post("/api/auth/refresh")
  .send({ refreshToken: token });

// New (correct):
const res = await request(app)
  .post("/api/auth/refresh")
  .set("Cookie", `refreshToken=${token}`);
```

### Step 9: Commit

```bash
cd /home/levybonito/faztudo-main && git add backend/src/controllers/authController.ts
# Include any test files if updated
git commit -m "fix: read refresh token from httpOnly cookie instead of request body

- refreshAccessToken now reads from req.cookies.refreshToken
- Token rotation: sets new accessToken and refreshToken as httpOnly cookies on refresh
- Removes refreshToken from login/register JSON response bodies (cookie is sufficient)
- Status 401 instead of 400 when refresh token missing"
```

---

## Task 3: Fix Register Popup Dark Mode — RegisterPromptClient.tsx

**Context:** `RegisterPromptClient.tsx` is a multi-step registration modal. All colors are hardcoded for light mode (`bg-white`, `text-slate-900`, `border-slate-300`). In dark mode, the modal background is white but the browser may render input text as white-on-white. We need to add `dark:` Tailwind variants throughout.

**Files:**
- Modify: `frontend/src/components/landing/RegisterPromptClient.tsx` (check exact path first with `find frontend/src -name "RegisterPromptClient.tsx"`)

### Step 1: Find the files

```bash
find /home/levybonito/faztudo-main/frontend/src -name "RegisterPrompt*.tsx"
```

Note the exact paths for use below.

### Step 2: Fix the modal wrapper (the outermost panel)

Find the modal content wrapper — it has `bg-white` and `border-slate-200`. Example:

```tsx
<div className={`relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto
  rounded-2xl border border-slate-200 bg-white shadow-2xl ...`}>
```

Add dark variants:

```tsx
<div className={`relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto
  rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl ...`}>
```

### Step 3: Fix the overlay/backdrop (if it exists)

Find any `bg-black/50` or `bg-slate-900/80` backdrop div. It usually already works in dark mode, but verify it doesn't have a conflicting light-mode class.

### Step 4: Fix all `<input>` and `<select>` elements

Every input currently has no `bg-*` or `text-*` class. Add these classes to ALL inputs and selects:

**Before:**
```tsx
className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm
  outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
```

**After:**
```tsx
className="w-full rounded-xl border border-slate-300 dark:border-slate-600
  bg-white dark:bg-slate-800 text-slate-900 dark:text-white
  placeholder-slate-400 dark:placeholder-slate-500
  py-2.5 pl-10 pr-3 text-sm outline-none transition
  focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900"
```

Do this for **every** `<input>`, `<select>`, and `<textarea>` in the file.

### Step 5: Fix headings

Every `<h2>` or `<h3>` with `text-slate-900`:

```tsx
// Before:
<h2 className="text-2xl font-bold text-slate-900">

// After:
<h2 className="text-2xl font-bold text-slate-900 dark:text-white">
```

### Step 6: Fix labels

Every `<label>` with `text-slate-700`:

```tsx
// Before:
<label className="mb-1 block text-sm font-medium text-slate-700">

// After:
<label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
```

### Step 7: Fix the left panel / sidebar (if exists)

If there's a left info panel with `bg-slate-50` or `bg-slate-100`:

```tsx
// Before:
<div className="... bg-slate-50 ...">

// After:
<div className="... bg-slate-50 dark:bg-slate-800/50 ...">
```

Any text in it with `text-slate-700` or `text-slate-600` gets `dark:text-slate-300`.

### Step 8: Fix the StepBadge / progress indicator

Find the step badge component (may be inline or a sub-component). It likely has:

```tsx
// Active step:
<span className={`... text-slate-900 bg-white ...`}>

// Inactive step:
<span className={`... text-slate-500 bg-slate-200 ...`}>
```

Fix:

```tsx
// Active:
className={`... text-slate-900 dark:text-white bg-white dark:bg-slate-800 border dark:border-slate-600 ...`}

// Inactive:
className={`... text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 ...`}
```

### Step 9: Fix close button

```tsx
// Before:
<button className="... hover:bg-slate-100 hover:text-slate-900 ...">

// After:
<button className="... hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white ...">
```

### Step 10: Fix summary/review panel (if step 3 shows a summary)

Panels with `bg-slate-50 text-slate-700`:

```tsx
// Before:
<div className="bg-slate-50 ..."><p className="text-slate-700">

// After:
<div className="bg-slate-50 dark:bg-slate-800 ..."><p className="text-slate-700 dark:text-slate-300">
```

### Step 11: Visual check in browser

```bash
cd /home/levybonito/faztudo-main/frontend && npm run dev
```

Open http://localhost:5173, navigate to the landing page, switch to dark mode, click "Criar conta". Verify:
- Modal background is dark (not white)
- Input fields have dark background with visible text
- Labels are visible
- Step progress indicators are visible

### Step 12: Commit

```bash
cd /home/levybonito/faztudo-main && git add frontend/src/components/landing/RegisterPromptClient.tsx
git commit -m "fix: add dark mode support to RegisterPromptClient modal

Adds dark: Tailwind variants to all hardcoded light-mode colors:
- Modal wrapper: dark:bg-slate-900 dark:border-slate-700
- Inputs: dark:bg-slate-800 dark:text-white dark:border-slate-600
- Labels: dark:text-slate-300
- Headings: dark:text-white
- Step badges: dark variants
- Review/summary panels: dark variants"
```

---

## Task 4: Fix Register Popup Dark Mode — RegisterPromptProfessional.tsx

**Context:** Same problem as Task 3 but for the professional registration modal. Apply identical fixes.

**Files:**
- Modify: `frontend/src/components/landing/RegisterPromptProfessional.tsx`

### Step 1: Apply all the same dark mode fixes as Task 3

Repeat Steps 2–10 from Task 3 for `RegisterPromptProfessional.tsx`. The structure is identical.

Additional elements specific to the professional modal:
- **Category/skill checkboxes**: likely `bg-white border-slate-200` → add `dark:bg-slate-800 dark:border-slate-700`
- **Checkbox label text**: `text-slate-700` → add `dark:text-slate-300`
- **Badge pills for selected skills**: check if they have hardcoded light colors

### Step 2: Visual check

With `npm run dev` still running (or restart if needed), navigate to the professional landing page, switch to dark mode, click "Criar conta como profissional". Verify same criteria as Task 3.

### Step 3: Commit

```bash
cd /home/levybonito/faztudo-main && git add frontend/src/components/landing/RegisterPromptProfessional.tsx
git commit -m "fix: add dark mode support to RegisterPromptProfessional modal

Same dark: variant additions as RegisterPromptClient:
- Modal, inputs, labels, headings, step badges, review panels
- Additional: category checkboxes and skill badge pills"
```

---

## Task 5: Final Verification Pass

### Step 1: Full backend type check

```bash
cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit
```

Expected: 0 errors (or same count as before these changes — we should not have introduced any new ones).

### Step 2: Run all backend tests

```bash
cd /home/levybonito/faztudo-main/backend && npm test 2>&1 | tail -20
```

Expected: all tests pass.

### Step 3: Frontend type check

```bash
cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit
```

Expected: 0 errors.

### Step 4: Frontend lint

```bash
cd /home/levybonito/faztudo-main/frontend && npm run lint
```

Expected: no errors.

### Step 5: Final commit if anything was missed

If any small fixes were needed in the verification pass:

```bash
cd /home/levybonito/faztudo-main && git add -p
git commit -m "fix: address verification pass findings"
```

---

## Out of Scope (Documented for Future)

**Upload → Object Storage Migration** — The current upload system is reasonably secure (MIME allowlist, magic-byte validation, UUID names, auth-gated). Full S3/GCS migration requires:
- Cloud credentials setup (AWS/GCP)
- `multer-s3` or buffer-based upload integration
- Signed URL generation endpoint (`GET /api/files/:id/url`)
- Remove `express.static` for `/uploads/chat`
- Antivirus integration (ClamAV or cloud-native scanning)

This is a separate infrastructure task. Create a new plan when cloud credentials are available.
