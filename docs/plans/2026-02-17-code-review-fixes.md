# Code Review Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all real issues identified in the code review of 29 recent commits (map features, reschedule flow, auth fixes, order UX).

**Architecture:** Backend fixes focus on adding Zod validation schemas for geocoding routes and extracting reschedule logic into a service. Frontend fixes focus on propagating geocoding errors properly and extracting WazeMap into smaller composable hooks/components.

**Tech Stack:** Express 5, Zod, React 18, TypeScript, Vitest

---

## Review Triage — What's Real vs False Positives

| Issue | Verdict | Reason |
|-------|---------|--------|
| Critical #1: JWT Secret fallback | ❌ **FALSE POSITIVE** | `env.ts` already throws in prod, generates random secret in dev. `auth.ts` uses `env.JWT_SECRET` from validated config — no fallback string. |
| Critical #2: No geocoding route validation | ✅ **REAL** | Routes validate manually but don't use Zod. Lat/lng ranges not checked. No rate limiting on these routes. |
| Important #3: Auth refresh race condition | ❌ **FALSE POSITIVE** | `api.ts` already has `isRefreshing` mutex + `failedQueue` pattern (lines 33-121). Concurrent 401s are properly queued. |
| Important #4: Frontend geocoding error swallowing | ✅ **REAL** | All 4 functions in `geocodingService.ts` catch errors and return `null`/`[]` silently. Callers get no feedback. |
| Important #5: WazeMap component too large | ✅ **REAL** | 497 lines with GPS tracking, route management, alerts, and rendering mixed together. |
| Important #6: useGeolocation cleanup | ❌ **FALSE POSITIVE** | `stopWatching()` calls `clearWatch` and `clearInterval`. Effect cleanup calls `stopWatching()`. Already correct. |
| Important #7: Schedule controller complexity | ✅ **REAL but LOW RISK** | Reschedule logic is dense but self-contained. Extract to service for testability. |
| Minor #8: Magic numbers in map | ✅ **REAL** | Hardcoded zoom levels, distances, intervals scattered in WazeMap. |
| Minor #9: Unused imports | ✅ **CHECK** | Need to verify removed components have no lingering imports. |
| Minor #10: Seed data verification | ✅ **CHECK** | Run `npm run db:seed` to verify. |
| Minor #11: Package cleanup | ✅ **CHECK** | Verify no `@vis.gl/react-google-maps` references remain. |

**Real work = Tasks 1-7 below.**

---

### Task 1: Add Zod Validation to Geocoding Routes

**Files:**
- Create: `backend/src/middleware/geocodingValidation.ts`
- Modify: `backend/src/routes/geocodingRoutes.ts`
- Create: `backend/tests/geocodingValidation.test.ts`

**Step 1: Write the failing test**

Create `backend/tests/geocodingValidation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { geocodeSchema, directionsSchema, reverseGeocodeSchema, routeAlertsSchema } from "../src/middleware/geocodingValidation";

describe("geocodingValidation", () => {
  describe("geocodeSchema", () => {
    it("accepts valid address", () => {
      const result = geocodeSchema.safeParse({ address: "Rua da Paz, 123, Iguatu" });
      expect(result.success).toBe(true);
    });

    it("rejects empty address", () => {
      const result = geocodeSchema.safeParse({ address: "" });
      expect(result.success).toBe(false);
    });

    it("rejects non-string address", () => {
      const result = geocodeSchema.safeParse({ address: 123 });
      expect(result.success).toBe(false);
    });

    it("rejects address longer than 500 chars", () => {
      const result = geocodeSchema.safeParse({ address: "a".repeat(501) });
      expect(result.success).toBe(false);
    });
  });

  describe("reverseGeocodeSchema", () => {
    it("accepts valid lat/lng", () => {
      const result = reverseGeocodeSchema.safeParse({ latitude: -6.3629, longitude: -39.2943 });
      expect(result.success).toBe(true);
    });

    it("rejects latitude out of range", () => {
      const result = reverseGeocodeSchema.safeParse({ latitude: 91, longitude: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects longitude out of range", () => {
      const result = reverseGeocodeSchema.safeParse({ latitude: 0, longitude: 181 });
      expect(result.success).toBe(false);
    });

    it("rejects non-number latitude", () => {
      const result = reverseGeocodeSchema.safeParse({ latitude: "abc", longitude: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe("directionsSchema", () => {
    it("accepts valid origin and destination", () => {
      const result = directionsSchema.safeParse({
        origin: { lat: -6.36, lng: -39.29 },
        destination: { lat: -6.37, lng: -39.30 },
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing destination", () => {
      const result = directionsSchema.safeParse({
        origin: { lat: -6.36, lng: -39.29 },
      });
      expect(result.success).toBe(false);
    });

    it("rejects lat out of range in origin", () => {
      const result = directionsSchema.safeParse({
        origin: { lat: -91, lng: 0 },
        destination: { lat: 0, lng: 0 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("routeAlertsSchema", () => {
    it("accepts valid polyline with default radius", () => {
      const result = routeAlertsSchema.safeParse({
        polyline: [[-6.36, -39.29], [-6.37, -39.30]],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.radius).toBe(200);
      }
    });

    it("rejects polyline with less than 2 points", () => {
      const result = routeAlertsSchema.safeParse({
        polyline: [[-6.36, -39.29]],
      });
      expect(result.success).toBe(false);
    });

    it("rejects radius greater than 5000", () => {
      const result = routeAlertsSchema.safeParse({
        polyline: [[-6.36, -39.29], [-6.37, -39.30]],
        radius: 10000,
      });
      expect(result.success).toBe(false);
    });

    it("rejects polyline with more than 500 points", () => {
      const points = Array.from({ length: 501 }, (_, i) => [-6.36 + i * 0.001, -39.29]);
      const result = routeAlertsSchema.safeParse({ polyline: points });
      expect(result.success).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/geocodingValidation.test.ts`
Expected: FAIL — module not found

**Step 3: Write the validation schemas**

Create `backend/src/middleware/geocodingValidation.ts`:

```ts
import { z } from "zod";

const latitudeSchema = z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90");
const longitudeSchema = z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180");

const latLngSchema = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
});

export const geocodeSchema = z.object({
  address: z.string().min(1, "Address is required").max(500, "Address too long"),
});

export const reverseGeocodeSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const directionsSchema = z.object({
  origin: latLngSchema,
  destination: latLngSchema,
});

export const routeAlertsSchema = z.object({
  polyline: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2, "Polyline must have at least 2 points")
    .max(500, "Polyline must have at most 500 points"),
  radius: z.number().min(50).max(5000).default(200),
});
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/geocodingValidation.test.ts`
Expected: PASS

**Step 5: Apply schemas to routes**

Modify `backend/src/routes/geocodingRoutes.ts` — replace manual validation with Zod:

Each route handler should:
1. Parse `req.body` with the corresponding schema
2. Return 400 with formatted errors on failure
3. Use validated data from the parse result

Replace the manual `if (!address || typeof address !== "string")` checks with:
```ts
const parsed = geocodeSchema.safeParse(req.body);
if (!parsed.success) {
  res.status(400).json({
    success: false,
    message: parsed.error.errors.map(e => e.message).join(", "),
  });
  return;
}
const { address } = parsed.data;
```

Apply the same pattern for all 4 routes: `/geocode`, `/reverse`, `/directions`, `/route-alerts`.

**Step 6: Run all tests**

Run: `cd backend && npx vitest run`
Expected: All PASS

**Step 7: Commit**

```bash
git add backend/src/middleware/geocodingValidation.ts backend/src/routes/geocodingRoutes.ts backend/tests/geocodingValidation.test.ts
git commit -m "feat: add Zod validation schemas for geocoding routes"
```

---

### Task 2: Frontend Geocoding — Propagate Errors Instead of Swallowing

**Files:**
- Modify: `frontend/src/services/geocodingService.ts`
- Modify: `frontend/src/components/map/WazeMap.tsx` (error handling in callers)

**Step 1: Write the approach**

The 4 functions in `geocodingService.ts` all catch errors and return `null`/`[]`. The fix:
- Make `geocode`, `getDirections`, `reverseGeocode` **throw** on network errors instead of returning null
- Keep `getRouteAlerts` returning `[]` on failure (alerts are non-critical, best-effort)
- Update callers in `WazeMap.tsx` to handle errors with try/catch and show toast messages

**Step 2: Update geocodingService.ts**

For `geocode`, `getDirections`, and `reverseGeocode`:
- Remove the try/catch wrapper that silently returns null
- Let errors propagate naturally
- Keep the return type as `T | null` (API can legitimately return "not found")

```ts
export async function geocode(address: string): Promise<GeocodingResult | null> {
  const response = await api.post<ApiResponse<GeocodingResult>>("/geocoding/geocode", { address });
  return extractData(response);
}

export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DirectionsResult | null> {
  const response = await api.post<ApiResponse<DirectionsResult>>("/geocoding/directions", {
    origin,
    destination,
  });
  return extractData(response);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodingResult | null> {
  const response = await api.post<ApiResponse<ReverseGeocodingResult>>("/geocoding/reverse", {
    latitude,
    longitude,
  });
  return extractData(response);
}
```

Keep `getRouteAlerts` and `decodePolyline` unchanged — they are non-critical.

**Step 3: Update WazeMap.tsx callers**

In the geocode destination effect (line ~123):
```ts
const doGeocode = async () => {
  setGeocodingDest(true);
  try {
    const addressStr = `${destinationAddress.street}, ${destinationAddress.number}, ...`;
    const result = await geocode(addressStr);
    if (result) {
      setDestination({ lat: result.lat, lng: result.lng });
    } else {
      setDestination({ lat: -6.3629, lng: -39.2943 }); // fallback
    }
  } catch {
    toast.error("Erro", "Não foi possível localizar o endereço de destino.");
    setDestination({ lat: -6.3629, lng: -39.2943 }); // fallback
  } finally {
    setGeocodingDest(false);
  }
};
```

In the fetch directions effect (line ~193):
```ts
const fetchDirections = async () => {
  try {
    const result = await getDirections(origin, destination);
    if (result) {
      setRouteInfo({ distance: result.distance, duration: result.duration });
      const decoded = decodePolyline(result.polyline);
      setRoutePolyline(decoded);
      if (decoded.length > 0) {
        const routeAlerts = await getRouteAlerts(decoded);
        setAlerts(routeAlerts);
      }
    }
  } catch {
    // Directions are enhancement — don't block the map
    console.warn("Directions fetch failed");
  }
};
```

**Step 4: Also update LocationPicker.tsx if it calls geocoding functions**

Check `frontend/src/components/map/LocationPicker.tsx` for any geocoding calls that swallow errors, and add appropriate error handling.

**Step 5: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add frontend/src/services/geocodingService.ts frontend/src/components/map/WazeMap.tsx frontend/src/components/map/LocationPicker.tsx
git commit -m "fix: propagate geocoding errors to callers with user feedback"
```

---

### Task 3: Extract WazeMap Constants

**Files:**
- Create: `frontend/src/components/map/wazeConstants.ts`
- Modify: `frontend/src/components/map/WazeMap.tsx`

**Step 1: Create constants file**

Create `frontend/src/components/map/wazeConstants.ts`:

```ts
/** Map zoom levels */
export const ZOOM = {
  DEFAULT: 13,
  FLY_TO: 16,
  CLOSE: 18,
} as const;

/** Animation durations in seconds */
export const ANIMATION = {
  FLY_DURATION: 2,
  PAN_DURATION: 0.8,
  CENTER_DURATION: 1,
} as const;

/** Tile providers */
export const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

/** Polling and update intervals in ms */
export const INTERVALS = {
  LOCATION_UPDATE: 5000,
  LOCATION_POLL: 5000,
} as const;

/** Polyline trail settings */
export const TRAIL = {
  /** Number of points behind professional to show fading trail */
  FADING_POINTS: 5,
} as const;

/** Route polyline style */
export const ROUTE_STYLE = {
  REMAINING: {
    color: "#2563eb",
    weight: 5,
    opacity: 0.85,
  },
  FADING: {
    color: "#93c5fd",
    weight: 5,
    opacity: 0.3,
    dashArray: "4 8",
  },
} as const;

/** Default fallback coordinates (Iguatu, CE) */
export const FALLBACK_COORDS = { lat: -6.3629, lng: -39.2943 } as const;

/** Map fit bounds padding */
export const FIT_BOUNDS_PADDING: [number, number] = [60, 60];
```

**Step 2: Replace magic numbers in WazeMap.tsx**

Import from `wazeConstants.ts` and replace all hardcoded values:
- `TILES.light` / `TILES.dark` → `TILES.light` / `TILES.dark` (already named, just move)
- `zoom={13}` → `zoom={ZOOM.DEFAULT}`
- `map.flyTo(target, 16, { duration: 2 })` → `map.flyTo(target, ZOOM.FLY_TO, { duration: ANIMATION.FLY_DURATION })`
- `{ animate: true, duration: 0.8 }` → `{ animate: true, duration: ANIMATION.PAN_DURATION }`
- `{ padding: [60, 60] }` → `{ padding: FIT_BOUNDS_PADDING }`
- `updateInterval: 5000` → `updateInterval: INTERVALS.LOCATION_UPDATE`
- `setInterval(pollLocation, 5000)` → `setInterval(pollLocation, INTERVALS.LOCATION_POLL)`
- `progressIndex - 5` → `progressIndex - TRAIL.FADING_POINTS`
- `{ lat: -6.3629, lng: -39.2943 }` → `FALLBACK_COORDS`
- Polyline style objects → `ROUTE_STYLE.REMAINING` and `ROUTE_STYLE.FADING`

**Step 3: Export from map index**

Add to `frontend/src/components/map/index.ts`:
```ts
export * from "./wazeConstants";
```

**Step 4: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/components/map/wazeConstants.ts frontend/src/components/map/WazeMap.tsx frontend/src/components/map/index.ts
git commit -m "refactor: extract WazeMap magic numbers into named constants"
```

---

### Task 4: Extract WazeMap Custom Hooks

**Files:**
- Create: `frontend/src/hooks/useRouteTracking.ts`
- Modify: `frontend/src/components/map/WazeMap.tsx`

**Step 1: Identify extractable logic**

The WazeMap has these blocks of state + effects that can become hooks:

**Hook: `useRouteTracking`** — manages route state (directions, polyline, alerts, progress):
- State: `routeInfo`, `routePolyline`, `alerts`, `progressIndex`
- Effects: fetch directions, calculate progress index, fetch alerts
- Input: `origin`, `destination`
- Output: `{ routeInfo, routePolyline, alerts, progressIndex, remainingPolyline, fadingPolyline }`

**Step 2: Write `useRouteTracking`**

Create `frontend/src/hooks/useRouteTracking.ts`:

```ts
import { useState, useEffect } from "react";
import { getDirections, decodePolyline, getRouteAlerts } from "../services/geocodingService";
import { TRAIL } from "../components/map/wazeConstants";
import type { RoadAlert } from "../types";

interface RouteInfo {
  distance: string;
  duration: string;
}

interface UseRouteTrackingOptions {
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
}

export function useRouteTracking({ origin, destination }: UseRouteTrackingOptions) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]>>([]);
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [progressIndex, setProgressIndex] = useState(0);

  // Fetch directions when origin/destination change
  useEffect(() => {
    if (!origin || !destination) return;

    const fetchDirections = async () => {
      try {
        const result = await getDirections(origin, destination);
        if (result) {
          setRouteInfo({ distance: result.distance, duration: result.duration });
          const decoded = decodePolyline(result.polyline);
          setRoutePolyline(decoded);

          if (decoded.length > 0) {
            const routeAlerts = await getRouteAlerts(decoded);
            setAlerts(routeAlerts);
          }
        }
      } catch {
        // Directions are enhancement — don't block the map
      }
    };

    fetchDirections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Calculate progress index
  useEffect(() => {
    if (!origin || routePolyline.length === 0) return;

    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < routePolyline.length; i++) {
      const dx = routePolyline[i][0] - origin.lat;
      const dy = routePolyline[i][1] - origin.lng;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        minIdx = i;
      }
    }
    setProgressIndex(minIdx);
  }, [origin, routePolyline]);

  const remainingPolyline = routePolyline.slice(progressIndex);
  const fadingPolyline = routePolyline.slice(
    Math.max(0, progressIndex - TRAIL.FADING_POINTS),
    progressIndex + 1
  );

  const clearRoute = () => {
    setRoutePolyline([]);
    setRouteInfo(null);
    setAlerts([]);
    setProgressIndex(0);
  };

  return {
    routeInfo,
    routePolyline,
    alerts,
    progressIndex,
    remainingPolyline,
    fadingPolyline,
    clearRoute,
  };
}
```

**Step 3: Refactor WazeMap.tsx to use the hook**

Remove the inline state + effects for route tracking and replace with:
```ts
const {
  routeInfo, routePolyline, alerts, progressIndex,
  remainingPolyline, fadingPolyline, clearRoute,
} = useRouteTracking({ origin, destination });
```

Update `handleStopRoute` to call `clearRoute()` instead of manually resetting state.

This should reduce WazeMap.tsx by ~50 lines.

**Step 4: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/hooks/useRouteTracking.ts frontend/src/components/map/WazeMap.tsx
git commit -m "refactor: extract useRouteTracking hook from WazeMap"
```

---

### Task 5: Extract Reschedule Logic to Service Layer

**Files:**
- Create: `backend/src/services/rescheduleService.ts`
- Modify: `backend/src/controllers/service/scheduleController.ts`
- Create: `backend/tests/rescheduleService.test.ts`

**Step 1: Write the failing test**

Create `backend/tests/rescheduleService.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateRescheduleRequest, canReschedule } from "../src/services/rescheduleService";

describe("rescheduleService", () => {
  describe("canReschedule", () => {
    it("allows ACCEPTED orders", () => {
      expect(canReschedule("ACCEPTED")).toBe(true);
    });

    it("allows IN_PROGRESS orders", () => {
      expect(canReschedule("IN_PROGRESS")).toBe(true);
    });

    it("allows PENDING orders", () => {
      expect(canReschedule("PENDING")).toBe(true);
    });

    it("rejects COMPLETED orders", () => {
      expect(canReschedule("COMPLETED")).toBe(false);
    });

    it("rejects CANCELLED orders", () => {
      expect(canReschedule("CANCELLED")).toBe(false);
    });
  });

  describe("validateRescheduleRequest", () => {
    it("accepts valid future date", () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      const result = validateRescheduleRequest(tomorrow);
      expect(result.valid).toBe(true);
    });

    it("rejects missing date", () => {
      const result = validateRescheduleRequest("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("New date is required");
    });

    it("rejects invalid date string", () => {
      const result = validateRescheduleRequest("not-a-date");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid date format");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/rescheduleService.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the service**

Create `backend/src/services/rescheduleService.ts`:

```ts
const RESCHEDULABLE_STATUSES = ["ACCEPTED", "IN_PROGRESS", "PENDING"];

export function canReschedule(status: string): boolean {
  return RESCHEDULABLE_STATUSES.includes(status);
}

export function validateRescheduleRequest(
  newDate: string | undefined | null
): { valid: true; date: Date } | { valid: false; error: string } {
  if (!newDate) {
    return { valid: false, error: "New date is required" };
  }

  const date = new Date(newDate);
  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  return { valid: true, date };
}

export function hasReschedulePermission(
  userId: number,
  userRole: string,
  clientId: number,
  professionalId: number | null
): boolean {
  return (
    userId === clientId ||
    userId === professionalId ||
    userRole === "ADMIN"
  );
}
```

**Step 4: Run tests**

Run: `cd backend && npx vitest run tests/rescheduleService.test.ts`
Expected: PASS

**Step 5: Update scheduleController to use the service**

Replace inline validation in `rescheduleOrder`, `acceptReschedule`, `rejectReschedule` with calls to `canReschedule`, `validateRescheduleRequest`, `hasReschedulePermission`.

**Step 6: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: All PASS

**Step 7: Commit**

```bash
git add backend/src/services/rescheduleService.ts backend/src/controllers/service/scheduleController.ts backend/tests/rescheduleService.test.ts
git commit -m "refactor: extract reschedule validation into service layer with tests"
```

---

### Task 6: Cleanup — Verify No Stale Imports or References

**Files:**
- Check: All frontend files for `@vis.gl/react-google-maps` references
- Check: All frontend files for removed component imports (DestinationMarker, LandmarkMarker, ProfessionalMarker)

**Step 1: Search for stale Google Maps imports**

Run: `cd frontend && grep -r "vis.gl\|react-google-maps\|@googlemaps" src/ --include="*.ts" --include="*.tsx" -l`
Expected: No results (0 files)

**Step 2: Search for removed component imports**

Run: `cd frontend && grep -r "DestinationMarker\|LandmarkMarker\|ProfessionalMarker" src/ --include="*.ts" --include="*.tsx" -l`
Expected: No results (0 files), or only the delete commit. If any found, remove them.

**Step 3: If stale imports found, remove them and commit**

```bash
git add -u
git commit -m "fix: remove stale imports from deleted map components"
```

If no stale imports found, skip this commit.

---

### Task 7: Verify Seed Data Works

**Step 1: Run seed**

Run: `cd backend && npm run db:push && npm run db:seed`
Expected: Successful seed with no errors

**Step 2: Run full test suite**

Run: `cd backend && npx vitest run`
Expected: All PASS

**Step 3: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Final commit if any fixes needed**

If seed or type check revealed issues, fix and commit:
```bash
git commit -m "fix: resolve seed/type issues found during verification"
```

---

## Summary

| Task | Type | Priority | Lines Changed (est.) |
|------|------|----------|---------------------|
| 1. Geocoding Zod validation | Security | 🔴 HIGH | +80 new, +20 modified |
| 2. Geocoding error propagation | UX/Quality | 🟠 MEDIUM | ~30 modified |
| 3. WazeMap constants | Code Quality | 🟡 LOW | +50 new, ~30 modified |
| 4. useRouteTracking hook | Code Quality | 🟡 LOW | +70 new, -50 modified |
| 5. Reschedule service | Testability | 🟠 MEDIUM | +40 new, ~20 modified |
| 6. Stale imports cleanup | Hygiene | 🟡 LOW | 0-10 modified |
| 7. Verify seed + full tests | Verification | 🔴 HIGH | 0 |

**Total estimated: ~250 lines new, ~150 lines modified**
**Estimated time: 30-45 minutes**
