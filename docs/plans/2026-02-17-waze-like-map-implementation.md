# Waze-Like Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the FazTudo map system into a Waze-like navigation experience with custom avatar, animated route trail, camera follow, road alerts, and hybrid location picker.

**Architecture:** Evolve existing Leaflet/react-leaflet stack. Replace OpenStreetMap tiles with CartoDB Voyager. Create new WazeMap component tree that replaces OrderLocationMap. Add Overpass API integration for road alerts. Enhance backend location controller with bearing calculation and reverse geocoding.

**Tech Stack:** Leaflet 1.9 + react-leaflet 4.2 (existing), CartoDB Voyager tiles (free), Google Geocoding/Directions API (existing), OpenStreetMap Overpass API (new, free), TypeScript, TailwindCSS.

---

## Task 1: Update Map Types

**Files:**
- Modify: `frontend/src/types/map.ts`

**Step 1: Add new types for the Waze-like map system**

Add these types to `frontend/src/types/map.ts` after the existing types:

```typescript
/**
 * Road alert types available from Overpass API
 */
export type RoadAlertType =
  | "speed_bump"
  | "traffic_signal"
  | "curve"
  | "construction"
  | "roundabout"
  | "flood_prone"
  | "unpaved";

/**
 * A road alert along the route
 */
export interface RoadAlert {
  id: string;
  type: RoadAlertType;
  position: LatLng;
  description: string;
}

/**
 * Extended location data with bearing (direction of movement)
 */
export interface ProfessionalLocation {
  lat: number;
  lng: number;
  bearing: number | null;
  updatedAt: string;
}

/**
 * Props for WazeMap component
 */
export interface WazeMapProps {
  orderId: number;
  isProfessional: boolean;
  professionalName: string;
  destinationAddress: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
  };
  orderStatus: string;
}

/**
 * Props for WazeAvatar marker
 */
export interface WazeAvatarProps {
  position: LatLng;
  bearing: number | null;
  isAnimating: boolean;
}

/**
 * Props for WazeInfoBar overlay
 */
export interface WazeInfoBarProps {
  distance: string;
  duration: string;
  professionalName: string;
  isTracking: boolean;
  isProfessional: boolean;
}

/**
 * Props for WazeControls overlay
 */
export interface WazeControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onToggleAlerts: () => void;
  alertsEnabled: boolean;
}

/**
 * Props for LocationPicker component
 */
export interface LocationPickerProps {
  value: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
  };
  onChange: (address: LocationPickerProps["value"]) => void;
}

/**
 * Reverse geocoding result
 */
export interface ReverseGeocodingResult {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}
```

**Step 2: Verify types compile**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/types/map.ts
git commit -m "feat: add Waze-like map types for avatar, alerts, and location picker"
```

---

## Task 2: Backend — Add bearing calculation to location controller

**Files:**
- Modify: `backend/src/controllers/service/locationController.ts`

**Step 1: Write the test for bearing calculation**

Create `backend/tests/bearing.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Pure function to calculate bearing between two points
function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const x = Math.sin(dLng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = toDeg(Math.atan2(x, y));
  return (bearing + 360) % 360;
}

describe("calculateBearing", () => {
  it("returns 0 for due north", () => {
    const bearing = calculateBearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(bearing).toBeCloseTo(0, 0);
  });

  it("returns 90 for due east", () => {
    const bearing = calculateBearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(bearing).toBeCloseTo(90, 0);
  });

  it("returns 180 for due south", () => {
    const bearing = calculateBearing({ lat: 1, lng: 0 }, { lat: 0, lng: 0 });
    expect(bearing).toBeCloseTo(180, 0);
  });

  it("returns 270 for due west", () => {
    const bearing = calculateBearing({ lat: 0, lng: 1 }, { lat: 0, lng: 0 });
    expect(bearing).toBeCloseTo(270, 0);
  });
});
```

**Step 2: Run the test to verify it passes (pure function, no mocking needed)**

Run: `cd /home/levybonito/faztudo-main/backend && npx vitest run tests/bearing.test.ts`
Expected: PASS (4 tests)

**Step 3: Extract calculateBearing to a shared utils file and update location controller**

Create `backend/src/utils/geo.ts`:

```typescript
/**
 * Calculate bearing (compass direction) between two geographic points.
 * Returns degrees 0-360 where 0=North, 90=East, 180=South, 270=West.
 */
export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const x = Math.sin(dLng) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = toDeg(Math.atan2(x, y));
  return (bearing + 360) % 360;
}
```

**Step 4: Update locationController.ts to store previous position and calculate bearing**

In `backend/src/controllers/service/locationController.ts`:

Change the locationStore type from:
```typescript
const locationStore = new Map<
  number,
  { lat: number; lng: number; updatedAt: string }
>();
```

To:
```typescript
const locationStore = new Map<
  number,
  { lat: number; lng: number; bearing: number | null; updatedAt: string }
>();
```

In the `updateLocation` function, after validating latitude/longitude, before `locationStore.set()`:

```typescript
// Calculate bearing from previous position
const previousLocation = locationStore.get(orderId);
let bearing: number | null = null;
if (previousLocation) {
  bearing = calculateBearing(
    { lat: previousLocation.lat, lng: previousLocation.lng },
    { lat: latitude, lng: longitude }
  );
}

// Store location with bearing
locationStore.set(orderId, {
  lat: latitude,
  lng: longitude,
  bearing,
  updatedAt: new Date().toISOString(),
});
```

Add the import at top:
```typescript
import { calculateBearing } from "../../utils/geo";
```

**Step 5: Run all backend tests**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add backend/src/utils/geo.ts backend/src/controllers/service/locationController.ts backend/tests/bearing.test.ts
git commit -m "feat: add bearing calculation to location tracking"
```

---

## Task 3: Backend — Add reverse geocoding endpoint

**Files:**
- Modify: `backend/src/services/geocodingService.ts`
- Modify: `backend/src/routes/geocodingRoutes.ts`

**Step 1: Add reverseGeocode function to geocodingService.ts**

Add after the `geocodeAddress` function:

```typescript
interface ReverseGeocodingResult {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}

/**
 * Reverse geocode lat/lng to a structured address using Google Geocoding API
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodingResult | null> {
  try {
    const apiKey = env.PLACES_API_KEY;
    if (!apiKey) {
      log.warn("PLACES_API_KEY not configured");
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=pt-BR&result_type=street_address|route`;
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const result = data.results[0];
      const components = result.address_components || [];

      const getComponent = (type: string): string => {
        const comp = components.find((c: any) => c.types.includes(type));
        return comp?.long_name || "";
      };

      return {
        street: getComponent("route"),
        number: getComponent("street_number"),
        neighborhood: getComponent("sublocality_level_1") || getComponent("sublocality"),
        city: getComponent("administrative_area_level_2") || getComponent("locality"),
        state: getComponent("administrative_area_level_1"),
        zipCode: getComponent("postal_code"),
        formattedAddress: result.formatted_address,
        lat,
        lng,
      };
    }

    log.warn({ status: data.status, lat, lng }, "Reverse geocoding failed");
    return null;
  } catch (error) {
    log.error({ err: error, lat, lng }, "Reverse geocoding error");
    return null;
  }
}
```

**Step 2: Add reverse geocode route to geocodingRoutes.ts**

Add after the `/directions` route:

```typescript
// Reverse geocode lat/lng to address (authenticated)
router.post("/reverse", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude } = req.body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      res.status(400).json({ success: false, message: "latitude and longitude are required numbers" });
      return;
    }

    const result = await reverseGeocode(latitude, longitude);

    if (!result) {
      res.status(404).json({ success: false, message: "No address found for coordinates" });
      return;
    }

    res.json({ success: true, message: "Reverse geocoded", data: result });
  } catch (error) {
    log.error({ err: error }, "Reverse geocode endpoint error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
```

Don't forget to add the import of `reverseGeocode`:
```typescript
import { geocodeAddress, getDirections, reverseGeocode } from "../services/geocodingService";
```

**Step 3: Verify backend compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/services/geocodingService.ts backend/src/routes/geocodingRoutes.ts
git commit -m "feat: add reverse geocoding endpoint"
```

---

## Task 4: Backend — Add route alerts endpoint (Overpass API)

**Files:**
- Create: `backend/src/services/overpassService.ts`
- Modify: `backend/src/routes/geocodingRoutes.ts`

**Step 1: Create the Overpass API service**

Create `backend/src/services/overpassService.ts`:

```typescript
import { createLogger } from "../lib/logger";

const log = createLogger("overpass");

const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

interface RoadAlert {
  id: string;
  type: string;
  lat: number;
  lng: number;
  description: string;
}

/**
 * Query Overpass API for road features along a route corridor.
 * Takes a decoded polyline (array of [lat, lng]) and a radius in meters.
 */
export async function getRouteAlerts(
  polyline: Array<[number, number]>,
  radiusMeters: number = 200
): Promise<RoadAlert[]> {
  try {
    // Sample polyline points (every 10th point to reduce query size)
    const sampledPoints = polyline.filter((_, i) => i % 10 === 0);
    if (sampledPoints.length === 0) return [];

    // Build bounding box from sampled points
    const lats = sampledPoints.map((p) => p[0]);
    const lngs = sampledPoints.map((p) => p[1]);
    const margin = radiusMeters / 111000; // rough degrees per meter
    const bbox = `${Math.min(...lats) - margin},${Math.min(...lngs) - margin},${Math.max(...lats) + margin},${Math.max(...lngs) + margin}`;

    const query = `
      [out:json][timeout:10][bbox:${bbox}];
      (
        node["traffic_calming"~"bump|hump|table"];
        node["highway"="traffic_signals"];
        node["hazard"="curve"];
        way["highway"="construction"];
        node["junction"="roundabout"];
        way["junction"="roundabout"];
        node["flood_prone"="yes"];
        way["surface"~"unpaved|gravel|dirt"];
      );
      out center body;
    `;

    const response = await fetch(OVERPASS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      log.warn({ status: response.status }, "Overpass API request failed");
      return [];
    }

    const data: any = await response.json();
    const alerts: RoadAlert[] = [];

    for (const element of data.elements || []) {
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      if (!lat || !lng) continue;

      const tags = element.tags || {};
      let type: string;
      let description: string;

      if (tags.traffic_calming) {
        type = "speed_bump";
        const calming = tags.traffic_calming;
        description = calming === "bump" ? "Quebra-mola" : calming === "hump" ? "Lombada" : "Redutor de velocidade";
      } else if (tags.highway === "traffic_signals") {
        type = "traffic_signal";
        description = "Semaforo";
      } else if (tags.hazard === "curve") {
        type = "curve";
        description = "Curva perigosa";
      } else if (tags.highway === "construction") {
        type = "construction";
        description = "Obra na via";
      } else if (tags.junction === "roundabout") {
        type = "roundabout";
        description = "Rotatoria";
      } else if (tags.flood_prone === "yes") {
        type = "flood_prone";
        description = "Area sujeita a alagamento";
      } else if (tags.surface && ["unpaved", "gravel", "dirt"].includes(tags.surface)) {
        type = "unpaved";
        description = "Via nao pavimentada";
      } else {
        continue;
      }

      alerts.push({
        id: `${element.type}-${element.id}`,
        type,
        lat,
        lng,
        description,
      });
    }

    log.info({ alertCount: alerts.length, bbox }, "Route alerts fetched");
    return alerts;
  } catch (error) {
    log.error({ err: error }, "Overpass API error");
    return [];
  }
}
```

**Step 2: Add route-alerts endpoint to geocodingRoutes.ts**

Add the import:
```typescript
import { getRouteAlerts } from "../services/overpassService";
```

Add the route after `/reverse`:

```typescript
// Get road alerts along a route (authenticated)
router.post("/route-alerts", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { polyline, radius } = req.body;

    if (!Array.isArray(polyline) || polyline.length < 2) {
      res.status(400).json({
        success: false,
        message: "polyline must be an array of [lat, lng] pairs with at least 2 points",
      });
      return;
    }

    const alerts = await getRouteAlerts(polyline, radius || 200);

    res.json({
      success: true,
      message: `Found ${alerts.length} alerts`,
      data: { alerts },
    });
  } catch (error) {
    log.error({ err: error }, "Route alerts endpoint error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});
```

**Step 3: Verify backend compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/services/overpassService.ts backend/src/routes/geocodingRoutes.ts
git commit -m "feat: add Overpass API integration for road alerts"
```

---

## Task 5: Frontend — Add reverse geocode and route alerts to geocodingService

**Files:**
- Modify: `frontend/src/services/geocodingService.ts`

**Step 1: Add reverseGeocode and getRouteAlerts functions**

Add after the `getDirections` function (before `decodePolyline`):

```typescript
/**
 * Reverse geocode lat/lng to structured address via backend proxy
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodingResult | null> {
  try {
    const response = await api.post<ApiResponse<ReverseGeocodingResult>>("/geocoding/reverse", {
      latitude,
      longitude,
    });
    return extractData(response);
  } catch {
    return null;
  }
}

/**
 * Get road alerts along a decoded polyline
 */
export async function getRouteAlerts(
  polyline: Array<[number, number]>,
  radius: number = 200
): Promise<RoadAlert[]> {
  try {
    const response = await api.post<ApiResponse<{ alerts: RoadAlert[] }>>("/geocoding/route-alerts", {
      polyline,
      radius,
    });
    const data = extractData(response);
    return data?.alerts || [];
  } catch {
    return [];
  }
}
```

Also add the needed imports/types at the top of the file:

```typescript
import type { ReverseGeocodingResult, RoadAlert } from "../types";
```

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/services/geocodingService.ts
git commit -m "feat: add reverse geocode and route alerts to frontend API service"
```

---

## Task 6: Frontend — Create custom Waze avatar and destination icons

**Files:**
- Create: `frontend/src/components/map/wazeIcons.ts`

**Step 1: Create the custom Waze-style icons**

Create `frontend/src/components/map/wazeIcons.ts`:

```typescript
import L from "leaflet";

/**
 * Create a Waze-style professional avatar icon.
 * Pin shape with custom FazTudo branding (gradient blue, tool silhouette).
 * Rotates based on bearing.
 */
export function createWazeAvatarIcon(bearing: number | null): L.DivIcon {
  const rotation = bearing !== null ? `transform: rotate(${bearing}deg);` : "";

  return L.divIcon({
    className: "waze-avatar-marker",
    html: `
      <div style="
        width: 56px; height: 56px;
        display: flex; align-items: center; justify-content: center;
        pointer-events: auto;
      ">
        <div style="
          width: 48px; height: 48px;
          position: relative;
          ${rotation}
          transition: transform 0.8s ease;
        ">
          <!-- Direction arrow (top) -->
          <div style="
            position: absolute;
            top: -8px; left: 50%; transform: translateX(-50%);
            width: 0; height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 10px solid #2563eb;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
            ${bearing === null ? 'display: none;' : ''}
          "></div>

          <!-- Main avatar circle -->
          <div style="
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 4px 12px rgba(0,0,0,0.25);
            display: flex; align-items: center; justify-content: center;
            position: relative;
            animation: waze-glow-pulse 2s ease-in-out infinite;
          ">
            <!-- FazTudo tool silhouette -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
        </div>
      </div>

      <style>
        @keyframes waze-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 4px 12px rgba(0,0,0,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(59,130,246,0.15), 0 4px 16px rgba(0,0,0,0.3); }
        }
      </style>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -28],
  });
}

/**
 * Destination marker — house with address number
 */
export function createWazeDestinationIcon(houseNumber?: string): L.DivIcon {
  const numberDisplay = houseNumber
    ? `<span style="
        position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
        background: white; color: #059669; font-size: 10px; font-weight: 700;
        padding: 1px 5px; border-radius: 6px; white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        line-height: 1.2;
      ">${houseNumber}</span>`
    : "";

  return L.divIcon({
    className: "waze-destination-marker",
    html: `
      <div style="
        width: 48px; height: 56px;
        display: flex; flex-direction: column; align-items: center;
        pointer-events: auto;
        position: relative;
      ">
        <div style="
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(16,185,129,0.3), 0 4px 12px rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
          animation: waze-dest-pulse 3s ease-in-out infinite;
          position: relative;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          ${numberDisplay}
        </div>
        <!-- Pin tail -->
        <div style="
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid #059669;
          margin-top: -2px;
        "></div>
      </div>

      <style>
        @keyframes waze-dest-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.3), 0 4px 12px rgba(0,0,0,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.15), 0 4px 16px rgba(0,0,0,0.3); }
        }
      </style>
    `,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    popupAnchor: [0, -56],
  });
}

/**
 * Alert icons for road features (24x24px)
 */
export function createAlertIcon(type: string): L.DivIcon {
  const iconConfigs: Record<string, { bg: string; svg: string }> = {
    speed_bump: {
      bg: "#f59e0b",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2 17h2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4h2v2H2z"/></svg>`,
    },
    traffic_signal: {
      bg: "#ef4444",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><circle cx="12" cy="8" r="2"/><circle cx="12" cy="16" r="2"/></svg>`,
    },
    curve: {
      bg: "#f59e0b",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M4 20c0-8 6-12 16-12"/><path d="M16 4l4 4-4 4"/></svg>`,
    },
    construction: {
      bg: "#f97316",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M2 20l10-18 10 18H2z"/><path d="M12 9v4"/><circle cx="12" cy="16" r="0.5" fill="white"/></svg>`,
    },
    roundabout: {
      bg: "#3b82f6",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="6"/><path d="M12 2v4"/><path d="M12 18v4"/></svg>`,
    },
    flood_prone: {
      bg: "#06b6d4",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2v6l3 3"/><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>`,
    },
    unpaved: {
      bg: "#78716c",
      svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M4 4l16 16"/><path d="M4 12h4"/><path d="M16 12h4"/></svg>`,
    },
  };

  const config = iconConfigs[type] || { bg: "#6b7280", svg: "" };

  return L.divIcon({
    className: "waze-alert-icon",
    html: `
      <div style="
        width: 24px; height: 24px;
        background: ${config.bg};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
      ">
        ${config.svg}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}
```

**Step 2: Export from map index**

Update `frontend/src/components/map/index.ts` to add:
```typescript
export { createWazeAvatarIcon, createWazeDestinationIcon, createAlertIcon } from "./wazeIcons";
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/components/map/wazeIcons.ts frontend/src/components/map/index.ts
git commit -m "feat: add custom Waze-style avatar, destination, and alert icons"
```

---

## Task 7: Frontend — Create WazeInfoBar component

**Files:**
- Create: `frontend/src/components/map/WazeInfoBar.tsx`

**Step 1: Create the floating info bar**

```tsx
import React from "react";
import { Navigation, Clock, Route, User } from "lucide-react";
import type { WazeInfoBarProps } from "../../types";

const WazeInfoBar: React.FC<WazeInfoBarProps> = ({
  distance,
  duration,
  professionalName,
  isTracking,
  isProfessional,
}) => {
  if (!isTracking) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] animate-slide-up w-[90%] max-w-sm">
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl px-4 py-3 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
        {/* Professional name (client view) */}
        {!isProfessional && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {professionalName} esta a caminho
            </span>
          </div>
        )}

        {/* Route stats */}
        <div className="flex items-center justify-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <Route className="w-4 h-4 text-primary-500" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Distancia</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{distance}</div>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tempo est.</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{duration}</div>
            </div>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isProfessional ? "Navegando" : "Ao vivo"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default WazeInfoBar;
```

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/map/WazeInfoBar.tsx
git commit -m "feat: add WazeInfoBar floating overlay component"
```

---

## Task 8: Frontend — Create WazeControls component

**Files:**
- Create: `frontend/src/components/map/WazeControls.tsx`

**Step 1: Create the custom map controls**

```tsx
import React from "react";
import { Plus, Minus, Crosshair, AlertTriangle } from "lucide-react";
import type { WazeControlsProps } from "../../types";

const WazeControls: React.FC<WazeControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onCenter,
  onToggleAlerts,
  alertsEnabled,
}) => {
  const btnClass =
    "w-10 h-10 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-600 transition-all active:scale-95";

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
      {/* Zoom controls */}
      <button onClick={onZoomIn} className={btnClass} title="Aproximar">
        <Plus className="w-5 h-5" />
      </button>
      <button onClick={onZoomOut} className={btnClass} title="Afastar">
        <Minus className="w-5 h-5" />
      </button>

      {/* Divider */}
      <div className="w-6 mx-auto border-t border-slate-200 dark:border-slate-700" />

      {/* Center on position */}
      <button onClick={onCenter} className={btnClass} title="Centralizar">
        <Crosshair className="w-5 h-5" />
      </button>

      {/* Toggle alerts */}
      <button
        onClick={onToggleAlerts}
        className={`${btnClass} ${alertsEnabled ? "!border-amber-400 !text-amber-500 !bg-amber-50 dark:!bg-amber-900/20" : ""}`}
        title={alertsEnabled ? "Ocultar alertas" : "Mostrar alertas"}
      >
        <AlertTriangle className="w-5 h-5" />
      </button>
    </div>
  );
};

export default WazeControls;
```

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/map/WazeControls.tsx
git commit -m "feat: add WazeControls custom map control buttons"
```

---

## Task 9: Frontend — Update useGeolocation hook with bearing support

**Files:**
- Modify: `frontend/src/hooks/useGeolocation.ts`

**Step 1: Add bearing tracking to the hook**

Add a `previousPositionRef` and `bearing` to state:

In the interface `GeolocationState`, add:
```typescript
bearing: number | null;
```

Add `bearing: null` to the initial state.

Add a ref for previous position:
```typescript
const previousPositionRef = useRef<{ lat: number; lng: number } | null>(null);
```

In `handleSuccess`, before `setState(...)`, calculate bearing:
```typescript
let bearing: number | null = null;
const prev = previousPositionRef.current;
if (prev) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(longitude - prev.lng);
  const lat1r = toRad(prev.lat);
  const lat2r = toRad(latitude);
  const x = Math.sin(dLng) * Math.cos(lat2r);
  const y = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLng);
  bearing = (toDeg(Math.atan2(x, y)) + 360) % 360;
}
previousPositionRef.current = { lat: latitude, lng: longitude };
```

Then include `bearing` in the `setState` call.

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/hooks/useGeolocation.ts
git commit -m "feat: add bearing calculation to useGeolocation hook"
```

---

## Task 10: Frontend — Create WazeMap main component

**Files:**
- Create: `frontend/src/components/map/WazeMap.tsx`

**Step 1: Create the main WazeMap component**

This is the largest component. It replaces `OrderLocationMap.tsx`:

```tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation,
  Loader2,
  AlertCircle,
  Clock,
  X,
} from "lucide-react";
import { useGeolocation } from "../../hooks/useGeolocation";
import {
  startRoute as apiStartRoute,
  updateProfessionalLocation,
  getProfessionalLocation,
  clearProfessionalLocation,
} from "../../services/serviceService";
import {
  geocode,
  getDirections,
  decodePolyline,
  getRouteAlerts,
} from "../../services/geocodingService";
import { createWazeAvatarIcon, createWazeDestinationIcon, createAlertIcon } from "./wazeIcons";
import WazeInfoBar from "./WazeInfoBar";
import WazeControls from "./WazeControls";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import type { WazeMapProps, RoadAlert } from "../../types";

// Tile URLs
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

// Camera controller sub-component
const CameraController: React.FC<{
  target: [number, number] | null;
  fitPoints: Array<[number, number]>;
  followMode: boolean;
}> = ({ target, fitPoints, followMode }) => {
  const map = useMap();
  const hasFlownRef = useRef(false);

  useEffect(() => {
    if (followMode && target && !hasFlownRef.current) {
      map.flyTo(target, 16, { duration: 2 });
      hasFlownRef.current = true;
    } else if (followMode && target) {
      map.panTo(target, { animate: true, duration: 0.8 });
    }
  }, [map, target, followMode]);

  // Fit bounds when not in follow mode
  useEffect(() => {
    if (!followMode && fitPoints.length >= 2) {
      const bounds = L.latLngBounds(fitPoints);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [map, fitPoints, followMode]);

  return null;
};

// Map controller for external zoom/center
const MapController = React.forwardRef<{
  zoomIn: () => void;
  zoomOut: () => void;
  center: (pos: [number, number]) => void;
}, Record<string, never>>((_, ref) => {
  const map = useMap();

  React.useImperativeHandle(ref, () => ({
    zoomIn: () => map.zoomIn(),
    zoomOut: () => map.zoomOut(),
    center: (pos: [number, number]) => map.flyTo(pos, map.getZoom(), { duration: 1 }),
  }));

  return null;
});
MapController.displayName = "MapController";

const WazeMap: React.FC<WazeMapProps> = ({
  orderId,
  isProfessional,
  professionalName,
  destinationAddress,
  orderStatus: _orderStatus,
}) => {
  const toast = useToast();
  const { theme } = useTheme();

  // State
  const [routeStarted, setRouteStarted] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]>>([]);
  const [professionalPos, setProfessionalPos] = useState<{ lat: number; lng: number; bearing: number | null } | null>(null);
  const [startingRoute, setStartingRoute] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(
    destinationAddress.latitude && destinationAddress.longitude
      ? { lat: destinationAddress.latitude, lng: destinationAddress.longitude }
      : null
  );
  const [geocodingDest, setGeocodingDest] = useState(false);
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [progressIndex, setProgressIndex] = useState(0);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapControllerRef = useRef<{ zoomIn: () => void; zoomOut: () => void; center: (pos: [number, number]) => void } | null>(null);

  // Geocode destination address if no lat/lng
  useEffect(() => {
    if (destination) return;

    const doGeocode = async () => {
      setGeocodingDest(true);
      const addressStr = `${destinationAddress.street}, ${destinationAddress.number}, ${destinationAddress.neighborhood}, ${destinationAddress.city}, ${destinationAddress.state}, Brasil`;
      const result = await geocode(addressStr);
      if (result) {
        setDestination({ lat: result.lat, lng: result.lng });
      } else {
        setDestination({ lat: -23.5505, lng: -46.6333 });
      }
      setGeocodingDest(false);
    };

    doGeocode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  // Professional: track own position
  const handleLocationUpdate = useCallback(
    async (lat: number, lng: number) => {
      if (!routeStarted) return;
      try {
        await updateProfessionalLocation(orderId, lat, lng);
      } catch {
        // Silent fail — best-effort
      }
    },
    [orderId, routeStarted]
  );

  const geo = useGeolocation({
    watchPosition: isProfessional && routeStarted,
    enableHighAccuracy: true,
    updateInterval: 5000,
    onUpdate: isProfessional ? handleLocationUpdate : undefined,
  });

  // Client: poll professional's location
  useEffect(() => {
    if (isProfessional) return;

    const pollLocation = async () => {
      try {
        const loc = await getProfessionalLocation(orderId);
        if (loc) {
          setProfessionalPos({ lat: loc.lat, lng: loc.lng, bearing: loc.bearing ?? null });
        }
      } catch {
        // Silent fail
      }
    };

    pollLocation();
    pollIntervalRef.current = setInterval(pollLocation, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isProfessional, orderId]);

  // Determine origin
  const origin = isProfessional
    ? geo.latitude && geo.longitude
      ? { lat: geo.latitude, lng: geo.longitude, bearing: geo.bearing }
      : null
    : professionalPos;

  // Fetch directions
  useEffect(() => {
    if (!origin || !destination) return;

    const fetchDirections = async () => {
      const result = await getDirections(origin, destination);
      if (result) {
        setRouteInfo({ distance: result.distance, duration: result.duration });
        const decoded = decodePolyline(result.polyline);
        setRoutePolyline(decoded);

        // Fetch road alerts
        if (decoded.length > 0) {
          const routeAlerts = await getRouteAlerts(decoded);
          setAlerts(routeAlerts);
        }
      }
    };

    fetchDirections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Calculate progress index (closest polyline point to professional)
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

  // Handle "Start Route"
  const handleStartRoute = async () => {
    try {
      setStartingRoute(true);
      await apiStartRoute(orderId);
      setRouteStarted(true);
      toast.success("Trajeto iniciado! O cliente foi notificado.");
    } catch (err: any) {
      toast.error("Erro", err?.response?.data?.message || "Erro ao iniciar trajeto");
    } finally {
      setStartingRoute(false);
    }
  };

  // Handle stop route
  const handleStopRoute = async () => {
    try {
      setRouteStarted(false);
      geo.stopWatching();
      await clearProfessionalLocation(orderId);
      setRoutePolyline([]);
      setRouteInfo(null);
      setAlerts([]);
    } catch {
      // Silent fail
    }
  };

  // Map controls
  const handleZoomIn = () => mapControllerRef.current?.zoomIn();
  const handleZoomOut = () => mapControllerRef.current?.zoomOut();
  const handleCenter = () => {
    if (origin) mapControllerRef.current?.center([origin.lat, origin.lng]);
  };

  // Derived values
  const destinationLabel = `${destinationAddress.street}, ${destinationAddress.number} - ${destinationAddress.neighborhood}`;
  const tileUrl = theme === "dark" ? TILES.dark : TILES.light;
  const isFollowing = routeStarted && !!origin;

  // Remaining polyline (from progress index onward)
  const remainingPolyline = routePolyline.slice(progressIndex);
  // Fading polyline (last 5 points before progress, with opacity)
  const fadingPolyline = routePolyline.slice(Math.max(0, progressIndex - 5), progressIndex + 1);

  // Loading states
  if (isProfessional && geo.loading && !geo.latitude) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Obtendo sua localizacao...
      </div>
    );
  }

  if (isProfessional && geo.error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-700 dark:text-red-400 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        {geo.error}
      </div>
    );
  }

  if (!destination || geocodingDest) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Localizando endereco...
      </div>
    );
  }

  // Fit bounds
  const fitPoints: Array<[number, number]> = [];
  if (origin) fitPoints.push([origin.lat, origin.lng]);
  fitPoints.push([destination.lat, destination.lng]);

  const avatarBearing = isProfessional ? geo.bearing : professionalPos?.bearing ?? null;

  return (
    <div className="space-y-4">
      {/* Map container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg" style={{ height: "420px" }}>
        <MapContainer
          center={[destination.lat, destination.lng]}
          zoom={13}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url={tileUrl}
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          <MapController ref={mapControllerRef} />

          <CameraController
            target={origin ? [origin.lat, origin.lng] : null}
            fitPoints={fitPoints}
            followMode={isFollowing}
          />

          {/* Fading trail (behind professional) */}
          {fadingPolyline.length > 1 && routeStarted && (
            <Polyline
              positions={fadingPolyline}
              pathOptions={{
                color: "#93c5fd",
                weight: 5,
                opacity: 0.3,
                dashArray: "4 8",
              }}
            />
          )}

          {/* Remaining route */}
          {remainingPolyline.length > 1 && (
            <Polyline
              positions={remainingPolyline}
              pathOptions={{
                color: "#2563eb",
                weight: 5,
                opacity: 0.85,
              }}
            />
          )}

          {/* Progress indicator (glowing dot at professional's position on route) */}
          {routeStarted && routePolyline[progressIndex] && (
            <Marker
              position={routePolyline[progressIndex]}
              icon={L.divIcon({
                className: "waze-progress-dot",
                html: `<div style="
                  width: 16px; height: 16px;
                  background: #3b82f6;
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 0 8px rgba(59,130,246,0.6);
                  animation: waze-glow-pulse 1.5s ease-in-out infinite;
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              })}
            />
          )}

          {/* Road alerts */}
          {alertsEnabled && alerts.map((alert) => (
            <Marker
              key={alert.id}
              position={[alert.position.lat, alert.position.lng]}
              icon={createAlertIcon(alert.type)}
            >
              <Popup>
                <div className="text-xs font-medium">{alert.description}</div>
              </Popup>
            </Marker>
          ))}

          {/* Destination marker */}
          <Marker
            position={[destination.lat, destination.lng]}
            icon={createWazeDestinationIcon(destinationAddress.number)}
          >
            <Popup>
              <div className="text-sm font-semibold">{destinationLabel}</div>
              <div className="text-xs text-slate-500">{destinationAddress.city}, {destinationAddress.state}</div>
            </Popup>
          </Marker>

          {/* Professional avatar */}
          {origin && (
            <Marker
              position={[origin.lat, origin.lng]}
              icon={createWazeAvatarIcon(avatarBearing)}
            >
              <Popup>
                <div className="text-sm font-semibold">{professionalName}</div>
                {routeInfo && (
                  <div className="text-xs text-slate-500">
                    {routeInfo.distance} · {routeInfo.duration}
                  </div>
                )}
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* WazeInfoBar */}
        {routeInfo && (
          <WazeInfoBar
            distance={routeInfo.distance}
            duration={routeInfo.duration}
            professionalName={professionalName}
            isTracking={routeStarted || !!professionalPos}
            isProfessional={isProfessional}
          />
        )}

        {/* WazeControls */}
        <WazeControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onCenter={handleCenter}
          onToggleAlerts={() => setAlertsEnabled(!alertsEnabled)}
          alertsEnabled={alertsEnabled}
        />

        {/* Stop button (professional, tracking) */}
        {isProfessional && routeStarted && (
          <button
            onClick={handleStopRoute}
            className="absolute bottom-4 right-4 z-[1000] w-10 h-10 rounded-xl bg-red-500 text-white shadow-lg flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all"
            title="Parar rastreamento"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Floating legend (collapsed) */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md text-[10px] space-y-1 border border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500 ring-2 ring-primary-200" />
            <span className="text-slate-500 dark:text-slate-400">Profissional</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-200" />
            <span className="text-slate-500 dark:text-slate-400">Destino</span>
          </div>
        </div>
      </div>

      {/* Action button / Status messages below map */}
      {isProfessional && !routeStarted && (
        <button
          onClick={handleStartRoute}
          disabled={startingRoute || !geo.latitude}
          className="btn btn-primary w-full py-4 flex items-center justify-center gap-2 text-base font-semibold rounded-2xl shadow-lg shadow-primary-500/20"
        >
          {startingRoute ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Iniciando trajeto...
            </>
          ) : (
            <>
              <Navigation className="w-5 h-5" />
              Iniciar Trajeto
            </>
          )}
        </button>
      )}

      {!isProfessional && !professionalPos && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-sm text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
          <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
          Aguardando o profissional iniciar o trajeto...
        </div>
      )}
    </div>
  );
};

export default WazeMap;
```

**Step 2: Export from map index**

Add to `frontend/src/components/map/index.ts`:
```typescript
export { default as WazeMap } from "./WazeMap";
export { default as WazeInfoBar } from "./WazeInfoBar";
export { default as WazeControls } from "./WazeControls";
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors (may need to adjust imports for `useTheme`)

**Step 4: Commit**

```bash
git add frontend/src/components/map/WazeMap.tsx frontend/src/components/map/index.ts
git commit -m "feat: add WazeMap main component with camera follow, trail, and alerts"
```

---

## Task 11: Frontend — Create LocationPicker component

**Files:**
- Create: `frontend/src/components/map/LocationPicker.tsx`

**Step 1: Create the hybrid location picker**

```tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Loader2, LocateFixed } from "lucide-react";
import { reverseGeocode } from "../../services/geocodingService";
import { useTheme } from "../../context/ThemeContext";
import type { LocationPickerProps } from "../../types";

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

// Draggable marker handler
const DraggableMarker: React.FC<{
  position: [number, number];
  onDragEnd: (lat: number, lng: number) => void;
}> = ({ position, onDragEnd }) => {
  const markerRef = useRef<L.Marker | null>(null);

  const icon = L.divIcon({
    className: "location-picker-pin",
    html: `
      <div style="
        width: 40px; height: 52px;
        display: flex; flex-direction: column; align-items: center;
      ">
        <div style="
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3" fill="#1d4ed8"/>
          </svg>
        </div>
        <div style="
          width: 0; height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid #1d4ed8;
          margin-top: -2px;
        "></div>
      </div>
    `,
    iconSize: [40, 52],
    iconAnchor: [20, 52],
  });

  return (
    <Marker
      position={position}
      icon={icon}
      draggable={true}
      ref={markerRef}
      eventHandlers={{
        dragend: () => {
          const marker = markerRef.current;
          if (marker) {
            const { lat, lng } = marker.getLatLng();
            onDragEnd(lat, lng);
          }
        },
      }}
    />
  );
};

// Click handler to move pin
const ClickHandler: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Pan to position
const PanTo: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, 16, { duration: 1.5 });
  }, [map, position]);
  return null;
};

const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number]>(
    value.latitude && value.longitude
      ? [value.latitude, value.longitude]
      : [-23.5505, -46.6333] // Default: Sao Paulo
  );

  const tileUrl = theme === "dark" ? TILES.dark : TILES.light;

  // Handle GPS button click
  const handleUseGPS = useCallback(async () => {
    if (!navigator.geolocation) return;

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setMapPosition([latitude, longitude]);

        // Reverse geocode
        setLoading(true);
        const result = await reverseGeocode(latitude, longitude);
        if (result) {
          onChange({
            ...value,
            street: result.street,
            number: result.number,
            neighborhood: result.neighborhood,
            city: result.city,
            state: result.state,
            zipCode: result.zipCode,
            latitude: result.lat,
            longitude: result.lng,
          });
        } else {
          onChange({ ...value, latitude, longitude });
        }
        setLoading(false);
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [value, onChange]);

  // Handle map pin drag/click
  const handleMapMove = useCallback(
    async (lat: number, lng: number) => {
      setMapPosition([lat, lng]);
      setLoading(true);

      const result = await reverseGeocode(lat, lng);
      if (result) {
        onChange({
          ...value,
          street: result.street,
          number: result.number,
          neighborhood: result.neighborhood,
          city: result.city,
          state: result.state,
          zipCode: result.zipCode,
          latitude: result.lat,
          longitude: result.lng,
        });
      } else {
        onChange({ ...value, latitude: lat, longitude: lng });
      }
      setLoading(false);
    },
    [value, onChange]
  );

  // Handle form field changes
  const handleFieldChange = (field: string, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <MapPin className="w-4 h-4 text-primary-500" />
        Endereco do Servico
      </label>

      {/* GPS Button */}
      <button
        type="button"
        onClick={handleUseGPS}
        disabled={gpsLoading}
        className="btn btn-outline w-full py-2.5 flex items-center justify-center gap-2 text-sm"
      >
        {gpsLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LocateFixed className="w-4 h-4" />
        )}
        Usar minha localizacao atual
      </button>

      {/* Address fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Rua</label>
          <input
            type="text"
            value={value.street}
            onChange={(e) => handleFieldChange("street", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Nome da rua"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Numero</label>
          <input
            type="text"
            value={value.number}
            onChange={(e) => handleFieldChange("number", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="123"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Complemento</label>
          <input
            type="text"
            value={value.complement || ""}
            onChange={(e) => handleFieldChange("complement", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Apto, bloco..."
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Bairro</label>
          <input
            type="text"
            value={value.neighborhood}
            onChange={(e) => handleFieldChange("neighborhood", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Bairro"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">CEP</label>
          <input
            type="text"
            value={value.zipCode}
            onChange={(e) => handleFieldChange("zipCode", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="00000-000"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Cidade</label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => handleFieldChange("city", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Cidade"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Estado</label>
          <input
            type="text"
            value={value.state}
            onChange={(e) => handleFieldChange("state", e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="UF"
            maxLength={2}
          />
        </div>
      </div>

      {/* Mini map */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm" style={{ height: "220px" }}>
        <MapContainer
          center={mapPosition}
          zoom={15}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url={tileUrl} />
          <PanTo position={mapPosition} />
          <DraggableMarker position={mapPosition} onDragEnd={handleMapMove} />
          <ClickHandler onMapClick={handleMapMove} />
        </MapContainer>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
        Arraste o marcador ou clique no mapa para ajustar a localizacao
      </p>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Buscando endereco...
        </div>
      )}

      {/* Confirmed address display */}
      {value.street && value.number && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800/30">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
            <span className="text-xs font-semibold text-green-700 dark:text-green-400">Endereco confirmado</span>
          </div>
          <p className="text-sm text-green-800 dark:text-green-300">
            {value.street}, {value.number}
            {value.complement ? ` - ${value.complement}` : ""}
            {" - "}
            {value.neighborhood}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">
            {value.city}, {value.state} {value.zipCode && `- ${value.zipCode}`}
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
```

**Step 2: Export from map index**

Add to `frontend/src/components/map/index.ts`:
```typescript
export { default as LocationPicker } from "./LocationPicker";
```

**Step 3: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/components/map/LocationPicker.tsx frontend/src/components/map/index.ts
git commit -m "feat: add LocationPicker component with GPS, manual input, and draggable map"
```

---

## Task 12: Frontend — Integrate WazeMap into OrderDetails

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx` (or wherever OrderLocationMap is currently rendered)

**Step 1: Find where OrderLocationMap is used and replace with WazeMap**

Search for `OrderLocationMap` imports in pages. Replace the import:

From:
```typescript
import OrderLocationMap from "../../components/orders/OrderLocationMap";
```

To:
```typescript
import { WazeMap } from "../../components/map";
```

Replace the component usage. Wherever `<OrderLocationMap ... />` is rendered, change to:
```tsx
<WazeMap
  orderId={order.id}
  isProfessional={isProfessional}
  professionalName={order.professional?.name || "Profissional"}
  destinationAddress={{
    street: order.address?.street || "",
    number: order.address?.number || "",
    neighborhood: order.address?.neighborhood || "",
    city: order.address?.city || "",
    state: order.address?.state || "",
    zipCode: order.address?.zipCode || "",
    latitude: order.address?.latitude,
    longitude: order.address?.longitude,
  }}
  orderStatus={order.status}
/>
```

Note: The exact prop names depend on how the order data is structured in the page. Check the actual code to match field names.

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Test visually**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run dev`

1. Login as `profissional@teste.com` / `Teste@123`
2. Navigate to an accepted/in-progress order
3. Verify the WazeMap renders with CartoDB Voyager tiles
4. Verify custom avatar and destination icons appear
5. Verify controls (zoom, center, alerts toggle) work
6. Click "Iniciar Trajeto" — verify camera flies to location

**Step 4: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: replace OrderLocationMap with WazeMap in order details"
```

---

## Task 13: Frontend — Integrate LocationPicker into order creation

**Files:**
- Modify: `frontend/src/pages/client/NewOrder.tsx` (or the page where clients create orders)

**Step 1: Find the address form in the order creation flow**

Search for the address input fields in the order creation page. Add the `LocationPicker` component:

```tsx
import { LocationPicker } from "../../components/map";
```

Replace the existing address form fields with:
```tsx
<LocationPicker
  value={{
    street: formData.street || "",
    number: formData.number || "",
    complement: formData.complement || "",
    neighborhood: formData.neighborhood || "",
    city: formData.city || "",
    state: formData.state || "",
    zipCode: formData.zipCode || "",
    latitude: formData.latitude,
    longitude: formData.longitude,
  }}
  onChange={(address) => {
    setFormData((prev) => ({
      ...prev,
      ...address,
    }));
  }}
/>
```

Note: Exact field names depend on the form's state structure.

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/pages/client/NewOrder.tsx
git commit -m "feat: integrate LocationPicker into order creation flow"
```

---

## Task 14: Add CSS animations for Waze map

**Files:**
- Modify: `frontend/src/index.css`

**Step 1: Add Waze-specific CSS animations**

Add at the end of the file (before any closing comments):

```css
/* Waze Map Animations */
.waze-avatar-marker,
.waze-destination-marker,
.waze-alert-icon,
.waze-progress-dot,
.location-picker-pin {
  background: transparent !important;
  border: none !important;
}

@keyframes waze-glow-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 4px 12px rgba(0,0,0,0.25); }
  50% { box-shadow: 0 0 0 6px rgba(59,130,246,0.15), 0 4px 16px rgba(0,0,0,0.3); }
}

@keyframes waze-dest-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(16,185,129,0.3), 0 4px 12px rgba(0,0,0,0.25); }
  50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.15), 0 4px 16px rgba(0,0,0,0.3); }
}
```

**Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add CSS animations for Waze map markers"
```

---

## Task 15: Final verification and cleanup

**Step 1: Run all backend tests**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: All pass

**Step 2: Run frontend type check**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Run frontend build**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run build`
Expected: Builds successfully

**Step 4: Run frontend lint**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run lint`
Expected: No errors (or only pre-existing warnings)

**Step 5: Manual smoke test**

Run both servers:
```bash
cd /home/levybonito/faztudo-main/backend && npm run dev &
cd /home/levybonito/faztudo-main/frontend && npm run dev
```

Test as professional:
1. Login as `profissional@teste.com` / `Teste@123`
2. Go to an order → verify WazeMap with CartoDB tiles
3. Click "Iniciar Trajeto" → verify flyTo animation
4. Verify alerts toggle works
5. Verify custom zoom controls work

Test as client:
1. Login as `cliente@teste.com` / `Teste@123`
2. Create new order → verify LocationPicker with GPS + map
3. View existing order → verify WazeMap shows destination

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Waze-like map system with navigation, alerts, and location picker"
```
