# FazTudo — Bug Fixes: Admin SPA + Client Dashboard Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 bugs across the Admin SPA and main frontend — users not listing, Traffic/Retention blank screen, Settings `[Object]` rendering and `~0.0 MB` display, update user status HTTP method mismatch, sidebar collapse scroll flash, dashboard tips drag interaction, and category emojis removal.

**Architecture:** All fixes are isolated — no cross-file dependencies between tasks. Admin SPA bugs are in `admin/src/`, frontend bugs are in `frontend/src/`. No backend changes required for any of these bugs.

**Tech Stack:** React 18 + TypeScript, TailwindCSS, Axios (admin SPA uses `admin_token` via `admin/src/services/api.ts`)

---

## Root Cause Summary

| Bug | Root Cause | File |
|-----|-----------|------|
| Users not listing | Backend returns `{ users, pagination }` but service expects `{ items, ... }` | `admin/src/services/adminService.ts` |
| Retention screen blank | `stats.retention` does not exist on backend response — backend sends no `retention` field | `admin/src/pages/TrafficPage.tsx` |
| Settings `[Object]` | `getPlatformConfig` returns `{ escrow, system }` objects, not flat `PlatformConfig` — `String(obj)` = `[object Object]` | `admin/src/services/adminService.ts` + `admin/src/pages/SettingsPage.tsx` |
| `~0.0 MB` display | `maxUpload` is initialized from `data.maxFileUploadSize` which may be `undefined` initially | `admin/src/pages/SettingsPage.tsx` |
| `updateUserStatus` 405 | Service calls `PATCH /admin/users/:id/status` but route is `PUT` | `admin/src/services/adminService.ts` |
| Settings values disappear on refresh | `updatePlatformConfig` backend returns `null`, service returns `null`, `setConfig(null)` clears state | `admin/src/services/adminService.ts` + `admin/src/pages/SettingsPage.tsx` |
| Sidebar collapse flash | CSS: `overflow-hidden` with `max-h` transition causes layout flash showing scrollbar briefly | `frontend/src/components/Layout.tsx` |
| Tips no drag | Only dot-button clicks work; no pointer/touch swipe events on the container | `frontend/src/pages/client/Dashboard.tsx` |
| Category emojis | `CATEGORY_ICONS` map passes emoji to `CategoryPills` which renders it | `frontend/src/pages/client/Dashboard.tsx` |

---

## Task 1: Fix `listUsers` — backend returns `{ users, pagination }` not `{ items, ... }`

**Files:**
- Modify: `admin/src/services/adminService.ts`

**Step 1: Understand the shape**

Backend `GET /admin/users` returns:
```json
{
  "data": {
    "users": [...],
    "pagination": { "page": 1, "limit": 15, "total": 42, "totalPages": 3 }
  }
}
```

But `adminService.listUsers` extracts `res.data.data` and returns it typed as `PaginatedResponse<UserListItem>` — which expects `{ items: [...], total, page, limit, totalPages }`. The `items` field does not exist, so `data?.items` is `undefined` → empty table.

**Step 2: Fix the `listUsers` function to normalize the response**

In `admin/src/services/adminService.ts`, replace:

```typescript
export async function listUsers(
  page?: number,
  limit?: number,
  search?: string,
  role?: string,
  status?: string
) {
  const params: Record<string, string | number> = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (search) params.search = search;
  if (role) params.role = role;
  if (status) params.status = status;

  const res = await api.get<ApiResponse<PaginatedResponse<UserListItem>>>(
    "/admin/users",
    { params }
  );
  return res.data.data;
}
```

With:

```typescript
export async function listUsers(
  page?: number,
  limit?: number,
  search?: string,
  role?: string,
  status?: string
): Promise<PaginatedResponse<UserListItem>> {
  const params: Record<string, string | number> = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (search) params.search = search;
  if (role) params.role = role;
  if (status) params.status = status;

  const res = await api.get<ApiResponse<{ users: UserListItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>>(
    "/admin/users",
    { params }
  );
  const { users, pagination } = res.data.data;
  return {
    items: users,
    total: pagination.total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: pagination.totalPages,
  };
}
```

**Step 3: Fix `updateUserStatus` — wrong HTTP method (PATCH vs PUT)**

Backend route is `PUT /admin/users/:id/status` but service calls `PATCH`. Replace:

```typescript
export async function updateUserStatus(id: number, status: string) {
  const res = await api.patch<ApiResponse<UserDetails>>(
    `/admin/users/${id}/status`,
    { status }
  );
  return res.data.data;
}
```

With:

```typescript
export async function updateUserStatus(id: number, status: string) {
  const res = await api.put<ApiResponse<UserDetails>>(
    `/admin/users/${id}/status`,
    { status }
  );
  return res.data.data;
}
```

**Step 4: Verify manually**
- Open admin SPA at `http://localhost:5174/users`
- Confirm user list populates with rows
- Try changing a user status — should not get 405

**Step 5: Commit**

```bash
git add admin/src/services/adminService.ts
git commit -m "fix(admin): normalize listUsers response shape and fix updateUserStatus HTTP method"
```

---

## Task 2: Fix `getPlatformConfig` response mismatch — `[Object]` in settings + values disappear on refresh

**Files:**
- Modify: `admin/src/services/adminService.ts`
- Modify: `admin/src/pages/SettingsPage.tsx`

**Step 1: Understand the shape**

Backend `GET /admin/config` returns:
```json
{
  "data": {
    "escrow": { "platformFeePercentage": 10, "defaultHoldDays": 7, "disputePeriodDays": 3, ... },
    "system": [{ "key": "max_file_upload_size", "value": "10485760" }, { "key": "maintenance_mode", "value": "false" }, ...]
  }
}
```

The `system` array holds `{ key, value }` records where `value` is a JSON string. The current service returns this raw object typed as `PlatformConfig` — causing `String({ key, value }) = "[object Object]"` when rendered.

Backend `PUT /admin/config` returns `null` (the controller returns `successResponse(null, "...")`). The current service returns `null` typed as `PlatformConfig` — so `setConfig(null)` clears config after save.

**Step 2: Add a raw API types and a normalizer in `adminService.ts`**

Add the raw types and update `getPlatformConfig` and `updatePlatformConfig`:

```typescript
// Raw API shape from backend
interface RawConfigResponse {
  escrow: {
    platformFeePercentage: number;
    defaultHoldDays: number;
    disputePeriodDays: number;
    // other escrow fields
    [key: string]: unknown;
  } | null;
  system: Array<{ key: string; value: string }>;
}

function normalizeConfig(raw: RawConfigResponse): PlatformConfig {
  // Parse system config array into a key-value lookup
  const sysMap: Record<string, string> = {};
  for (const entry of raw.system) {
    sysMap[entry.key] = entry.value;
  }

  return {
    platformFeePercentage: raw.escrow?.platformFeePercentage ?? 10,
    escrowHoldDays: raw.escrow?.defaultHoldDays ?? 7,
    maxFileUploadSize: sysMap["max_file_upload_size"]
      ? Number(JSON.parse(sysMap["max_file_upload_size"]))
      : 10485760,
    maintenanceMode: sysMap["maintenance_mode"]
      ? JSON.parse(sysMap["maintenance_mode"]) === true
      : false,
  };
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const res = await api.get<ApiResponse<RawConfigResponse>>("/admin/config");
  return normalizeConfig(res.data.data);
}

export async function updatePlatformConfig(data: Partial<PlatformConfig>): Promise<void> {
  await api.put("/admin/config", {
    platformFeePercentage: data.platformFeePercentage,
    defaultHoldDays: data.escrowHoldDays,
    max_file_upload_size: data.maxFileUploadSize,
    maintenance_mode: data.maintenanceMode,
  });
  // Backend returns null — caller should re-fetch or update state manually
}
```

**Step 3: Fix `SettingsPage.tsx` — update `updatePlatformConfig` call and `setConfig` after save**

In `admin/src/pages/SettingsPage.tsx`, the `handleSave` function currently does:
```typescript
const updated = await updatePlatformConfig({...});
setConfig(updated);
```

Since `updatePlatformConfig` now returns `void`, change it to re-fetch after save:

```typescript
const handleSave = async () => {
  if (!validate()) return;

  setSaving(true);
  setToast(null);
  try {
    await updatePlatformConfig({
      platformFeePercentage: Number(feePercentage),
      escrowHoldDays: Number(holdDays),
      maxFileUploadSize: Number(maxUpload),
      maintenanceMode,
    });
    // Re-fetch to show updated values
    const fresh = await getPlatformConfig();
    setConfig(fresh);
    setToast({ message: "Configuracoes salvas com sucesso!", type: "success" });
    setTimeout(() => setToast(null), 3000);
  } catch (err) {
    setToast({
      message: err instanceof Error ? err.message : "Erro ao salvar",
      type: "error",
    });
  } finally {
    setSaving(false);
  }
};
```

**Step 4: Fix `~0.0 MB` display — `maxUpload` is string, division by 1024*1024 on an empty string gives NaN**

The display logic is:
```typescript
{maxUpload
  ? `~${(Number(maxUpload) / (1024 * 1024)).toFixed(1)} MB`
  : "—"}
```

This is correct when `maxUpload` is "10485760" (a valid bytes string). The `~0.0 MB` bug occurs when `maxUpload` is `"0"` (initialized with `String(undefined)` = "undefined" which `Number()` converts to NaN → `toFixed` gives "NaN"). The fix: initialize `maxUpload` to `""` and handle the conversion properly.

In `SettingsPage.tsx`, change the initialization and display:

Line where config is loaded:
```typescript
setMaxUpload(String(data.maxFileUploadSize));
```
Change to:
```typescript
setMaxUpload(data.maxFileUploadSize > 0 ? String(data.maxFileUploadSize) : "");
```

And update the MB display helper to guard for falsy:
```typescript
<p className="text-xs text-slate-400 mt-1">
  {maxUpload && Number(maxUpload) > 0
    ? `~${(Number(maxUpload) / (1024 * 1024)).toFixed(1)} MB`
    : "Insira um valor em bytes"}
</p>
```

**Step 5: Verify**
- Open admin settings
- Confirm "Valores Atuais" shows proper key-value pairs (not `[Object]`)
- Enter `10485760` in max upload → should show `~10.0 MB`
- Save → values should remain visible after save

**Step 6: Commit**

```bash
git add admin/src/services/adminService.ts admin/src/pages/SettingsPage.tsx
git commit -m "fix(admin): fix config response normalization, [Object] rendering, and MB display"
```

---

## Task 3: Fix Traffic/Retention blank screen — `stats.retention` not in backend response

**Files:**
- Modify: `admin/src/pages/TrafficPage.tsx`

**Step 1: Understand the bug**

The backend `GET /admin/stats/traffic` does NOT return a `retention` field. The `TrafficStats` type in `adminService.ts` has:
```typescript
retention: Array<{ cohort: string; d1: number; d7: number; d14: number; d30: number }>;
```

When `setStats(data)` is called, `stats.retention` is `undefined`. The `RetentionSection` component does `stats.retention.length === 0` which throws `TypeError: Cannot read properties of undefined (reading 'length')`. This crashes the component tree and the content panel shows a blank/broken screen.

**Step 2: Fix `TrafficStats` type to make `retention` optional**

In `admin/src/services/adminService.ts`, update the type:

```typescript
export interface TrafficStats {
  kpis: {
    totalSessions: { value: number; change: number };
    avgDuration: { value: number; change: number };
    activeUsers: { value: number; change: number };
  };
  charts: {
    dailySessions: Array<{ date: string; sessions: number; uniqueUsers: number }>;
    hourlyDistribution: number[];
    deviceDistribution: Array<{ device: string; count: number }>;
  };
  chat: {
    totalMessages: number;
    avgMessagesPerDay: number;
    avgMessagesPerConversation: number;
    avgChatDurationSeconds: number;
  };
  retention?: Array<{ cohort: string; d1: number; d7: number; d14: number; d30: number }>;
}
```

**Step 3: Fix `RetentionSection` to handle `undefined` retention**

In `admin/src/pages/TrafficPage.tsx`, find the `RetentionSection` component and update the check:

```typescript
const RetentionSection: React.FC<{ stats: TrafficStats }> = ({ stats }) => {
  const retention = stats.retention ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-6">
        ...
        {retention.length === 0 ? (
          ...empty state...
        ) : (
          ...table with retention.map(...)...
        )}
      </div>
    </div>
  );
};
```

The key change: replace `stats.retention` with `retention` (the local variable that defaults to `[]`) throughout the entire `RetentionSection` component body.

**Step 4: Verify**
- Navigate to admin `/traffic`
- Click "Retenção" in the sidebar
- Should show the empty state ("Dados de retenção insuficientes") instead of crashing

**Step 5: Commit**

```bash
git add admin/src/services/adminService.ts admin/src/pages/TrafficPage.tsx
git commit -m "fix(admin): handle missing retention field in traffic stats — prevent blank screen"
```

---

## Task 4: Fix sidebar collapse scroll flash in main frontend

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Understand the bug**

The mobile nav uses `max-h` + `overflow-hidden` CSS transition:
```tsx
className={clsx(
  "md:hidden border-t border-slate-200 dark:border-slate-800/50 overflow-hidden transition-all duration-300 ease-in-out",
  isMobileMenuOpen ? "max-h-[80vh] py-4 opacity-100" : "max-h-0 py-0 opacity-0",
)}
```

When collapsing, the browser briefly shows scroll overflow on the inner content before `max-h` fully animates to `0`. This causes a scroll flash. The fix: add `overflow-hidden` unconditionally (it's already there, but the issue is that the inner `div.flex-col` has no explicit height and the transition between `max-h-[80vh]` and `max-h-0` causes a momentary overflow visible before full collapse.

The real fix is to not use `max-h-[80vh]` and instead use a proper CSS animation that starts hidden and fades content — or add `overscroll-behavior: contain` on the container and `will-change: max-height` hint.

**Step 2: Add `will-change` and ensure no scroll flicker**

In `frontend/src/components/Layout.tsx`, find the mobile nav container and add `will-change-[max-height]` and ensure overflow is always hidden:

```tsx
className={clsx(
  "md:hidden border-t border-slate-200 dark:border-slate-800/50 overflow-hidden transition-all duration-300 ease-in-out will-change-[max-height]",
  isMobileMenuOpen ? "max-h-[80vh] py-4 opacity-100" : "max-h-0 py-0 opacity-0",
)}
```

Also add `overflow-y-hidden` to the inner container to doubly prevent scrollbar flash:

```tsx
<div className="flex flex-col space-y-2 overflow-y-hidden">
```

(This inner `<div>` is at line ~521 of Layout.tsx)

**Step 3: Verify**
- Open mobile view (browser devtools responsive mode, < 768px)
- Open then close the nav menu rapidly
- The scroll flash should no longer appear

**Step 4: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "fix(layout): prevent scrollbar flash on mobile nav collapse"
```

---

## Task 5: Add drag-to-swipe interaction to dashboard tips carousel

**Files:**
- Modify: `frontend/src/pages/client/Dashboard.tsx`

**Step 1: Understand current state**

The tips carousel in `ClientDashboard` at the bottom of the sidebar currently:
- Auto-rotates every 8 seconds via `setInterval`
- Has dot buttons to click directly to a tip
- Has NO drag/swipe interaction

The user wants: click-and-drag to swipe left/right between tips, with the current tip advancing when released past a threshold.

**Step 2: Add drag logic to the tips container**

Replace the tips card section (the `<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br...">` block) with a version that adds pointer event handlers:

```tsx
{/* Dica do FazTudo — with drag support */}
{(() => {
  const dragRef = React.useRef<{ startX: number; isDragging: boolean }>({ startX: 0, isDragging: false });

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, isDragging: true };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const delta = e.clientX - dragRef.current.startX;
    dragRef.current.isDragging = false;
    const THRESHOLD = 40;
    if (delta < -THRESHOLD) {
      setTipIndex((i) => (i + 1) % TIPS.length);
    } else if (delta > THRESHOLD) {
      setTipIndex((i) => (i - 1 + TIPS.length) % TIPS.length);
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-indigo-600 text-white p-6 shadow-lg shadow-primary-600/20 cursor-grab active:cursor-grabbing select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragRef.current.isDragging = false; }}
    >
      {/* ... rest of the existing tip card content ... */}
    </div>
  );
})()}
```

However, using an IIFE inside JSX just to create the ref is not idiomatic React and won't work (hooks can't be called inside callbacks). Instead, add `dragRef` at the component level alongside the existing `scrollContainerRef` and `tipIndex` state.

**Step 3: Correct implementation — add at component level**

In `ClientDashboard`, after the existing:
```tsx
const scrollContainerRef = React.useRef<HTMLDivElement>(null);
```

Add:
```tsx
const tipDragRef = React.useRef<{ startX: number; isDragging: boolean }>({ startX: 0, isDragging: false });

const handleTipPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
  tipDragRef.current = { startX: e.clientX, isDragging: true };
  e.currentTarget.setPointerCapture(e.pointerId);
}, []);

const handleTipPointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
  if (!tipDragRef.current.isDragging) return;
  tipDragRef.current.isDragging = false;
  const delta = e.clientX - tipDragRef.current.startX;
  const THRESHOLD = 40;
  if (delta < -THRESHOLD) {
    setTipIndex((i) => (i + 1) % TIPS.length);
  } else if (delta > THRESHOLD) {
    setTipIndex((i) => (i - 1 + TIPS.length) % TIPS.length);
  }
}, []);
```

Then add to the tips container `<div>`:
```tsx
<div
  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-indigo-600 text-white p-6 shadow-lg shadow-primary-600/20 cursor-grab active:cursor-grabbing select-none"
  onPointerDown={handleTipPointerDown}
  onPointerUp={handleTipPointerUp}
  onPointerCancel={() => { tipDragRef.current.isDragging = false; }}
>
```

**Step 4: Verify**
- Open `http://localhost:5173/client/dashboard`
- Click and drag left on the tips card → advances to next tip
- Click and drag right → goes to previous tip
- Short clicks (no drag) should not change tip

**Step 5: Commit**

```bash
git add frontend/src/pages/client/Dashboard.tsx
git commit -m "feat(dashboard): add drag-to-swipe interaction for tips carousel"
```

---

## Task 6: Remove category emojis from dashboard category pills

**Files:**
- Modify: `frontend/src/pages/client/Dashboard.tsx`

**Step 1: Understand the issue**

In `ClientDashboard`, `CATEGORY_ICONS` maps some category names to emojis:
```tsx
const CATEGORY_ICONS: Record<string, string> = {
  "Eletrica": "⚡",
  "Encanamento": "🔧",
  ...
};
```

And when building `categoryPills`:
```tsx
const categoryPills = categories.slice(0, 8).map((cat) => ({
  id: String(cat.id),
  name: cat.name,
  count: cat._count?.serviceListings || 0,
  icon: CATEGORY_ICONS[cat.name] || undefined,
}));
```

This means categories with a matching name get an emoji, others don't. The fix: stop passing `icon` to the pills.

**Step 2: Remove the `CATEGORY_ICONS` constant and the icon mapping**

In `frontend/src/pages/client/Dashboard.tsx`:

1. Delete the entire `CATEGORY_ICONS` constant (lines 50-59):
```tsx
const CATEGORY_ICONS: Record<string, string> = {
  "Eletrica": "⚡",
  // ...
};
```

2. Remove the `icon` field from `categoryPills` mapping. Change:
```tsx
const categoryPills: CategoryPillItem[] = useMemo(
  () =>
    categories.slice(0, 8).map((cat) => ({
      id: String(cat.id),
      name: cat.name,
      count: cat._count?.serviceListings || 0,
      icon: CATEGORY_ICONS[cat.name] || undefined,
    })),
  [categories],
);
```

To:
```tsx
const categoryPills: CategoryPillItem[] = useMemo(
  () =>
    categories.slice(0, 8).map((cat) => ({
      id: String(cat.id),
      name: cat.name,
      count: cat._count?.serviceListings || 0,
    })),
  [categories],
);
```

**Step 3: Verify**
- Open `http://localhost:5173/client/dashboard`
- The "Explorar Categorias" section should show pills without emojis
- All categories should look uniform

**Step 4: Commit**

```bash
git add frontend/src/pages/client/Dashboard.tsx
git commit -m "fix(dashboard): remove inconsistent category emojis from pills"
```

---

## Task 7: Fix notification rate limit issue — reduce polling frequency

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/services/notificationService.ts`

**Step 1: Understand the issue**

The rate limit is `100 requests per 15 minutes (RATE_LIMIT_WINDOW_MS=900000, RATE_LIMIT_MAX_REQUESTS=100)`.

`Layout.tsx` polls `getUnreadCount()` every 60 seconds. `getUnreadCount` calls `getNotifications({ status: UNREAD, limit: 0 })` which makes a full API request. Over 15 minutes = 15 requests from the notification polling alone.

Other polling in the app:
- Chat messages: every 5 seconds = 180 req/15min (very heavy)
- Location updates

The user reports being "disconnected" after navigating notifications many times. Each tab switch triggers `loadNotifications()` with `setLoading(true)`, which fires a new request every time. With 3 tabs × multiple switches, the rate limit can be hit quickly.

**Step 2: Increase notification poll interval in Layout from 60s to 5 minutes**

In `frontend/src/components/Layout.tsx`, find:
```tsx
const interval = setInterval(fetchUnread, 60000);
```

Change to:
```tsx
const interval = setInterval(fetchUnread, 300000); // 5 minutes
```

**Step 3: Add `getUnreadCount` dedicated endpoint call instead of fetching all notifications**

The `getUnreadCount` currently fetches all notifications with a `limit: 0` filter, which has overhead. Change it to call a lightweight endpoint:

In `frontend/src/services/notificationService.ts`, change `getUnreadCount`:

```typescript
export const getUnreadCount = async (): Promise<number> => {
  // Use limit:1 to get the unreadCount metadata without fetching full list
  const data = await getNotifications({ status: NotificationStatus.UNREAD, limit: 1 });
  return data.unreadCount;
};
```

This reduces response payload (only 1 notification returned vs. potentially 50+) while still getting the accurate `unreadCount` from the server.

**Step 4: Increase the general rate limit in the backend to accommodate SPA usage**

The current limit of 100 req/15min is too low for a SPA with polling. Change it to 500 req/15min:

In `backend/.env`, change:
```
RATE_LIMIT_MAX_REQUESTS=500
```

(This matches the comment in `rateLimiter.ts` that says "500 req/15min — generous enough for SPAs with periodic polling".)

**Step 5: Verify**
- Navigate between notification tabs (Todas/Não lidas/Lidas) many times rapidly
- Wait 15 minutes without server restart
- Should not get 429 errors or appear disconnected

**Step 6: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/services/notificationService.ts backend/.env
git commit -m "fix(notifications): reduce polling frequency and fix rate limit to prevent 429 disconnects"
```

---

## Execution Order

Tasks 1–3 (Admin SPA fixes) can be done in any order. Tasks 4–7 (frontend fixes) are independent. Suggested order: 1 → 2 → 3 → commit → 4 → 5 → 6 → 7.

All tasks are frontend/config-only. **No Prisma migrations needed. No backend endpoint changes needed.**
