# Auth Log [Unauthenticated] + Calendar Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two problems: (1) `authLogger` incorrectly logging `[Unauthenticated]` for authenticated POST/PUT/DELETE requests because it runs BEFORE `verifyToken` populates `req.user`; (2) Calendar shrinking on day click and empty slots panel.

**Architecture:**
- **Auth log bug**: `authLogger` is registered via `router.use(authLogger)` at the top of each router file — it runs *before* the per-route `verifyToken` middleware, so `req.user` is always undefined at log time. Fix: move the log to `res.on("finish")` callback (already there, but `userInfo` is captured at request-start time). Solution is to defer `userInfo` resolution to inside the `finish` callback so it reads `req.user` after all middlewares ran.
- **Calendar shrink bug**: The `card` CSS class in `index.css` has `overflow-hidden` which, combined with `aspect-square` buttons inside a `grid`, causes the card to collapse when state changes trigger a re-render. Fix: add `overflow-visible` or restructure the card wrapper to prevent collapse.
- **Calendar empty slots bug**: `getCalendarDayDetail` returns empty `slots` when the professional has no `ProfessionalSchedule` rows in DB — the default fallback `"08:00"–"18:00"` logic is correct but the frontend shows nothing when `dayDetail.slots.length === 0` AND `isAvailable = true`. The frontend branch for this case shows "Nenhum horario configurado" — which is correct behavior, but confusing. The real fix is the calendar shrink (same bug), or improving the UI to always show something useful.

**Tech Stack:** Express 5, TypeScript, React 18, TailwindCSS

---

## Root Cause Analysis

### Bug 1: `[Unauthenticated]` in logs

In `backend/src/middleware/auth.ts`, `authLogger` is:

```ts
export const authLogger = (req, res, next) => {
  const startTime = Date.now();
  const userInfo = req.user  // ← captured HERE, before verifyToken runs
    ? `[User: ${req.user.id}...]`
    : (isPublicRoute || req.method === "GET")
      ? "[Public]"
      : "[Unauthenticated]";  // ← always this for POST/PUT/DELETE

  log.debug({ userInfo, ... }, "Request started");

  res.on("finish", () => {
    log.info({ userInfo, ... }, "Request completed");  // ← same stale userInfo
  });

  next();
};
```

`authLogger` is called via `router.use(authLogger)` at the TOP of each router (serviceRoutes, notificationRoutes, etc.), **before** the per-route `verifyToken`. So `req.user` is always `undefined` when `userInfo` is captured.

**Fix**: Move `userInfo` resolution INSIDE the `res.on("finish")` callback so it reads `req.user` *after* all middlewares have run.

### Bug 2: Calendar shrinks on click

The `.card` class in `frontend/src/index.css` includes `overflow-hidden`. The calendar grid uses `aspect-square` buttons inside `grid grid-cols-7`. When state changes (day click → `setSelectedDay`, `setDayLoading`), React re-renders the entire component. The `lg:grid-cols-3` container needs stable column sizing. The left panel (`lg:col-span-2 card`) with `overflow-hidden` can collapse when inner content changes dimensions.

**Fix**: Add `min-w-0` to the calendar card div to prevent grid blowout, and ensure the calendar grid container has a stable `w-full` wrapper so `aspect-square` cells stay consistent.

### Bug 3: Empty slots panel

When a professional has no `ProfessionalSchedule` configured, the backend uses fallback `"08:00"–"18:00"` and builds slots. But the UI shows "Nenhum horario configurado" only when `slots.length === 0`. The actual issue: if `isAvailable = true` but `slots = []` because `startTime` or `endTime` is null (no schedule, AND `dow === 0`/Sunday), the UI correctly shows "Nenhum horario configurado". **This is not a bug.**

The real empty panel issue is that after clicking a day, `dayDetail` is `null` initially and shows a spinner. If the API call fails (e.g., auth error from calendar shrink causing re-mount), `dayDetail` stays null and nothing shows. The calendar card collapses (Bug 2) which may be causing the entire right panel to look wrong.

**Fix**: The calendar shrink fix (Task 2) likely resolves the empty panel appearance too. Add a defensive "no data" state in the sidebar for `dayDetail` being null after loading completes.

---

### Task 1: Fix `authLogger` to log correct user info

**Files:**
- Modify: `backend/src/middleware/auth.ts` (lines 304–340)

**Step 1: Understand the current code**

Read `backend/src/middleware/auth.ts` lines 303–340. The `userInfo` variable is computed at request-start time before `verifyToken` runs. We need to compute it lazily inside `res.on("finish")`.

**Step 2: Apply the fix**

In `authLogger`, change from capturing `userInfo` once at start to computing it dynamically inside `res.on("finish")`. Keep the debug log at request-start but with a simplified message. Full replacement:

```ts
export const authLogger = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const startTime = Date.now();

  const publicPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ];
  const isPublicRoute = publicPaths.some(
    (p) => req.path === p || req.path.endsWith(p),
  );

  log.debug({ method: req.method, path: req.path }, "Request started");

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    // Resolve userInfo here, AFTER verifyToken has had a chance to populate req.user
    const userInfo = req.user
      ? `[User: ${req.user.id}, Role: ${req.user.role}]`
      : (isPublicRoute || req.method === "GET")
        ? "[Public]"
        : "[Unauthenticated]";

    log.info(
      { userInfo, method: req.method, path: req.path, statusCode: res.statusCode, duration },
      "Request completed",
    );
  });

  next();
};
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 4: Run backend tests to confirm nothing broke**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: All tests pass (or same as before)

**Step 5: Commit**

```bash
git add backend/src/middleware/auth.ts
git commit -m "fix: resolve userInfo in authLogger after verifyToken runs

Moves userInfo computation from request-start (before verifyToken) to
res.on('finish') callback so req.user is populated by the time we log.
Fixes [Unauthenticated] log spam for authenticated POST/PUT/DELETE routes."
```

---

### Task 2: Fix calendar shrinking on day click

**Files:**
- Modify: `frontend/src/pages/professional/Calendar.tsx` (lines 150–248)

**Step 1: Understand the layout**

The outer grid is `grid grid-cols-1 lg:grid-cols-3 gap-6`. Left panel: `lg:col-span-2 card`. Right panel: `card min-h-[400px]`.

The `.card` class in `index.css` is:
```css
.card { @apply bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 p-5; }
```

The `overflow-hidden` clips the inner `aspect-square` buttons when the grid width isn't stable. On state change, the grid column width may recalculate and `aspect-square` cells shrink.

**Step 2: Apply the fix**

The root cause is `overflow-hidden` on `.card` + `aspect-square` buttons. The calendar grid needs a stable, fixed-width context. Apply these changes:

1. Add `min-w-0` to the left panel div so grid doesn't blow out
2. Wrap the `grid grid-cols-7` calendar days in a `w-full` div
3. Override `overflow-hidden` on the left panel card by adding `overflow-visible` inline

In `Calendar.tsx` line 152, change:
```tsx
<div className="lg:col-span-2 card">
```
To:
```tsx
<div className="lg:col-span-2 card !overflow-visible min-w-0">
```

And line 185, change:
```tsx
<div className="grid grid-cols-7 gap-1">
```
To:
```tsx
<div className="grid grid-cols-7 gap-1 w-full">
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Test visually**

Start the dev server: `cd /home/levybonito/faztudo-main/frontend && npm run dev`

Log in as professional (`profissional@teste.com / Teste@123`), go to Calendar. Click several dates. The calendar grid should maintain its size and not shrink.

**Step 5: Commit**

```bash
git add frontend/src/pages/professional/Calendar.tsx
git commit -m "fix: prevent calendar grid from collapsing on day click

Adds !overflow-visible and min-w-0 to the calendar card to prevent
the aspect-square grid cells from shrinking on React state updates."
```

---

### Task 3: Fix calendar right panel showing empty after day click

**Files:**
- Modify: `frontend/src/pages/professional/Calendar.tsx` (lines 249–353)

**Step 1: Understand the issue**

The sidebar logic (lines 251–353):
1. If `!selectedDay` → show "Selecione um dia"
2. Else if `dayLoading && !dayDetail` → show spinner
3. Else if `dayDetail` → show slots
4. Else → `null` (EMPTY! This is the bug)

When `getCalendarDayDetail` succeeds but returns a day where `isAvailable=true` and `slots=[]`, the UI shows "Nenhum horario configurado". That's fine.

But when `getCalendarDayDetail` fails OR returns unexpected data, the sidebar falls to `null` — blank. Fix: add a fallback error/empty state.

Additionally, the sidebar shows an empty card (not null) when there's an error loading the day. Add error handling in `handleDayClick` to set an error state in the sidebar.

**Step 2: Add `dayError` state**

After line 36 (`const [dayLoading, setDayLoading] = useState(false);`), add:
```tsx
const [dayError, setDayError] = useState<string | null>(null);
```

**Step 3: Update `handleDayClick` to set/clear `dayError`**

In `handleDayClick`, before `setSelectedDay(day.date)`, add: `setDayError(null);`

In the catch block (around line 90), after `setDayDetail(null)`, add:
```tsx
setDayError("Não foi possível carregar os detalhes deste dia.");
```

**Step 4: Update sidebar JSX to handle error and null state**

Replace the sidebar section (lines 249–353) to add `dayError` branch between the `dayLoading` check and the `dayDetail` check:

```tsx
{/* Day Detail Sidebar */}
<div className="card min-h-[400px]">
  {!selectedDay ? (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <CalendarIcon className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
      <p className="text-sm">Selecione um dia para ver os agendamentos</p>
    </div>
  ) : dayLoading && !dayDetail ? (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  ) : dayError ? (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <XCircle className="w-12 h-12 mb-3 text-red-400" />
      <p className="text-sm text-red-500">{dayError}</p>
      <button
        onClick={() => selectedDay && handleDayClick({ date: selectedDay } as CalendarDay)}
        className="mt-3 text-xs text-primary-600 hover:underline"
      >
        Tentar novamente
      </button>
    </div>
  ) : dayDetail ? (
    // ... existing dayDetail JSX unchanged ...
  ) : null}
</div>
```

**Step 5: Verify TypeScript**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/pages/professional/Calendar.tsx
git commit -m "fix: add error state to calendar day detail sidebar

Previously the sidebar showed nothing (null) when getCalendarDayDetail
failed. Now shows an error message with a retry button."
```

---

### Task 4: Verify backend actually enforces auth on service routes (sanity check)

**Files:**
- Read only: `backend/src/routes/serviceRoutes.ts`, `backend/src/controllers/service/listingController.ts`

**Step 1: Confirm routes ARE protected**

The routes file already shows `verifyToken + requireRole + requireVerified` on PUT/DELETE. The `[Unauthenticated]` log was a LOG BUG, not an actual security gap — the routes were protected, the logger just printed wrong because it ran before `verifyToken`.

To confirm: after applying Task 1's fix, restart the backend and try to PAUSE/DELETE a service as a logged-in professional. The logs should now show `[User: X, Role: PROFESSIONAL]`.

**Step 2: Confirm notification routes are protected**

`notificationRoutes.ts` has `verifyToken` on all 3 routes. Same log bug applies — after Task 1, logs will correctly show `[User: X, Role: PROFESSIONAL]`.

No code changes needed here — Task 1's fix covers all routes.

**Step 3: Document that operations WERE always protected**

The user was seeing `[Unauthenticated]` in DEBUG logs, but the operations WERE being blocked for truly unauthenticated users (verifyToken was running, just AFTER authLogger). The log was misleading, not a real security hole.

If a truly unauthenticated user tried to DELETE a service, they'd get a 401 response — authLogger logged `[Unauthenticated]` but verifyToken correctly blocked them.

---

### Task 5: Final integration test

**Step 1: Start backend**

```bash
cd /home/levybonito/faztudo-main/backend && npm run dev
```

**Step 2: Start frontend**

```bash
cd /home/levybonito/faztudo-main/frontend && npm run dev
```

**Step 3: Test auth logging**

1. Log in as `profissional@teste.com / Teste@123`
2. Go to "Meus Serviços"
3. Pause a service (PUT request)
4. Check backend logs — should see `[User: X, Role: PROFESSIONAL]` NOT `[Unauthenticated]`
5. Delete a service (DELETE request) — same check
6. Go to notifications, mark all as read (POST) — same check

**Step 4: Test calendar**

1. Go to Calendar (Agenda Operacional)
2. Click several different dates
3. Verify the calendar grid keeps its size (no shrinking)
4. Verify the right panel shows either slots, "Nenhum horario configurado", or a spinner/error — never blank

**Step 5: Run full test suite**

```bash
cd /home/levybonito/faztudo-main/backend && npm test
```

Expected: All tests pass

**Step 6: Final commit if anything was missed**

```bash
git add -A
git status  # review what's staged
git commit -m "fix: final integration fixes for auth log and calendar"
```
