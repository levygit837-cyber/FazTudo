# Location Tracking & Order Transition Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the professional's order acceptance experience with compact layout and smooth animations, then add Waze-like location tracking with Google Maps so professionals can navigate to clients and clients can track the professional's route in real-time.

**Architecture:** The system uses Google Maps JavaScript API (`@vis.gl/react-google-maps`) on the frontend to display maps with the Directions API for route visualization. The professional's geolocation is tracked via the browser Geolocation API and sent to the backend via a new `/api/services/orders/:id/location` endpoint. The client polls this endpoint to display the professional's live position on the map. A new `PROFESSIONAL_EN_ROUTE` notification type alerts the client when the professional starts their route.

**Tech Stack:** `@vis.gl/react-google-maps` (React wrapper for Google Maps JS API), Google Directions API, Browser Geolocation API, CSS transitions/keyframes for animations, existing Express + Prisma backend.

---

## Current State Summary

### What exists:
- `OrderDetails.tsx` (869 lines) — Shared page for client/professional with inline `CheckoutStepper` and `OrderProgressStepper`
- Professional accept flow: single button → `POST /orders/:id/accept` → transitions `PENDING → ACCEPTED`
- Address displayed as plain text in sidebar (no map)
- `PLACES_API` key exists in `backend/.env` but is **unused** anywhere
- Prisma Address model has `latitude?`/`longitude?` fields (unused)
- No animation library installed — only Tailwind `transition-*` classes
- 12 order components in `components/orders/` (3 are built but unused: `FlowStatusBanner`, `ServiceFlowStepper`, `DualConfirmation`)

### Key files to modify:
- `frontend/src/pages/orders/OrderDetails.tsx` — Main order page (both roles)
- `backend/src/controllers/service/orderController.ts` — Accept endpoint + new location endpoint
- `backend/src/routes/orderRoutes.ts` — New routes
- `backend/prisma/schema.prisma` — New NotificationType + ServiceOrder fields
- `frontend/src/types/enums.ts` — Mirror new NotificationType
- `frontend/src/services/serviceService.ts` — New API calls
- `backend/src/config/env.ts` — Add PLACES_API to config
- `backend/src/services/notificationService.ts` — New notification helper

### New files to create:
- `frontend/src/components/orders/OrderLocationMap.tsx` — Map component with route display
- `frontend/src/hooks/useGeolocation.ts` — Browser geolocation hook
- `backend/src/routes/locationRoutes.ts` — Location tracking routes
- `backend/src/controllers/service/locationController.ts` — Location endpoints

---

## Task 1: Add PLACES_API to Backend Config

**Files:**
- Modify: `backend/src/config/env.ts:31-85` (EnvConfig interface)
- Modify: `backend/src/config/env.ts:126-180` (getEnvConfig function)

**Step 1: Add PLACES_API to EnvConfig interface**

In `backend/src/config/env.ts`, add to the `EnvConfig` interface after the `FRONTEND_URL` line:

```typescript
  // Google Maps
  PLACES_API_KEY: string;
```

**Step 2: Add PLACES_API to getEnvConfig function**

In the `config` object inside `getEnvConfig()`, add before the `ENABLE_SWAGGER` line:

```typescript
    // Google Maps
    PLACES_API_KEY: process.env.PLACES_API || '',
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/config/env.ts
git commit -m "feat: add PLACES_API_KEY to backend env config"
```

---

## Task 2: Add New NotificationType to Prisma Schema and Frontend Enums

**Files:**
- Modify: `backend/prisma/schema.prisma:44-56` (NotificationType enum)
- Modify: `frontend/src/types/enums.ts:39-51` (NotificationType enum)
- Modify: `backend/src/services/notificationService.ts:10-22` (NotificationType re-export)

**Step 1: Add PROFESSIONAL_EN_ROUTE to Prisma NotificationType enum**

In `backend/prisma/schema.prisma`, inside the `NotificationType` enum, add after `SYSTEM_ALERT`:

```prisma
  PROFESSIONAL_EN_ROUTE
```

**Step 2: Push schema change to database**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

**Step 3: Add to notificationService.ts re-export**

In `backend/src/services/notificationService.ts`, add to the `NotificationType` object after `SYSTEM_ALERT`:

```typescript
  PROFESSIONAL_EN_ROUTE: "PROFESSIONAL_EN_ROUTE" as PrismaNotificationType,
```

**Step 4: Mirror in frontend enums**

In `frontend/src/types/enums.ts`, add to the `NotificationType` enum after `SYSTEM_ALERT`:

```typescript
  PROFESSIONAL_EN_ROUTE = "PROFESSIONAL_EN_ROUTE",
```

**Step 5: Verify both compile**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/services/notificationService.ts frontend/src/types/enums.ts
git commit -m "feat: add PROFESSIONAL_EN_ROUTE notification type"
```

---

## Task 3: Create Location Controller and Routes (Backend)

**Files:**
- Create: `backend/src/controllers/service/locationController.ts`
- Create: `backend/src/routes/locationRoutes.ts`
- Modify: `backend/src/index.ts` (register new route)

**Step 1: Create locationController.ts**

Create `backend/src/controllers/service/locationController.ts`:

```typescript
import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { createLogger } from "../../lib/logger";
import { createNotification } from "../../services/notificationService";
import { NotificationType } from "@prisma/client";

const log = createLogger("locationController");

const successResponse = (data: any, message: string = "Success") => ({
  success: true,
  message,
  data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false,
  message,
  statusCode,
});

// In-memory store for professional locations (per order)
// In production, use Redis. For dev/SQLite this is sufficient.
const locationStore = new Map<
  number,
  { lat: number; lng: number; updatedAt: string }
>();

/**
 * POST /api/services/orders/:id/location
 * Professional updates their current location while en route
 */
export const updateLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const { latitude, longitude } = req.body;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      res.status(400).json(errorResponse("latitude and longitude are required numbers"));
      return;
    }

    // Verify order exists and user is the professional
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, professionalId: true, status: true },
    });

    if (!order) {
      res.status(404).json(errorResponse("Order not found"));
      return;
    }

    if (order.professionalId !== req.user.id) {
      res.status(403).json(errorResponse("Only the assigned professional can update location"));
      return;
    }

    if (!["ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
      res.status(400).json(errorResponse("Can only track location for accepted or in-progress orders"));
      return;
    }

    // Store location in memory
    locationStore.set(orderId, {
      lat: latitude,
      lng: longitude,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json(successResponse({ orderId, latitude, longitude }, "Location updated"));
  } catch (error) {
    log.error({ err: error }, "Update location error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

/**
 * GET /api/services/orders/:id/location
 * Client gets the professional's current location
 */
export const getLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    // Verify order exists and user is client or professional
    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { id: true, clientId: true, professionalId: true, status: true },
    });

    if (!order) {
      res.status(404).json(errorResponse("Order not found"));
      return;
    }

    if (order.clientId !== req.user.id && order.professionalId !== req.user.id) {
      res.status(403).json(errorResponse("Not authorized to view this order's location"));
      return;
    }

    const location = locationStore.get(orderId);

    res.status(200).json(
      successResponse(
        location || null,
        location ? "Location found" : "No location data available"
      )
    );
  } catch (error) {
    log.error({ err: error }, "Get location error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

/**
 * POST /api/services/orders/:id/start-route
 * Professional starts navigating to the client — sends notification
 */
export const startRoute = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { client: { select: { id: true, name: true } } },
    });

    if (!order) {
      res.status(404).json(errorResponse("Order not found"));
      return;
    }

    if (order.professionalId !== req.user.id) {
      res.status(403).json(errorResponse("Only the assigned professional can start route"));
      return;
    }

    if (!["ACCEPTED", "IN_PROGRESS"].includes(order.status)) {
      res.status(400).json(errorResponse("Order must be accepted or in progress to start route"));
      return;
    }

    // Notify client that professional is on the way
    await createNotification(
      order.clientId,
      NotificationType.PROFESSIONAL_EN_ROUTE,
      "Profissional a caminho",
      `${req.user.name} esta a caminho para realizar o servico "${order.title}".`,
      orderId,
      { professionalName: req.user.name }
    );

    res.status(200).json(successResponse({ orderId }, "Route started, client notified"));
  } catch (error) {
    log.error({ err: error }, "Start route error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

/**
 * DELETE /api/services/orders/:id/location
 * Clear location tracking (when arriving or stopping)
 */
export const clearLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const order = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      select: { professionalId: true },
    });

    if (!order || order.professionalId !== req.user.id) {
      res.status(403).json(errorResponse("Not authorized"));
      return;
    }

    locationStore.delete(orderId);

    res.status(200).json(successResponse(null, "Location tracking cleared"));
  } catch (error) {
    log.error({ err: error }, "Clear location error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 2: Create locationRoutes.ts**

Create `backend/src/routes/locationRoutes.ts`:

```typescript
import { Router } from "express";
import { verifyToken, requireRole, requireVerified } from "../middleware/auth";
import {
  updateLocation,
  getLocation,
  startRoute,
  clearLocation,
} from "../controllers/service/locationController";

const router = Router();

// Professional updates location while en route
router.post(
  "/orders/:id/location",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  updateLocation
);

// Get professional's current location (client or professional)
router.get(
  "/orders/:id/location",
  verifyToken,
  getLocation
);

// Professional starts route → notifies client
router.post(
  "/orders/:id/start-route",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  startRoute
);

// Clear location tracking
router.delete(
  "/orders/:id/location",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  clearLocation
);

export default router;
```

**Step 3: Register route in backend index.ts**

In `backend/src/index.ts`, find where other routes are registered (look for `app.use("/api/services"`) and add:

```typescript
import locationRoutes from "./routes/locationRoutes";
```

Then, near the other `/api/services` route registrations:

```typescript
app.use("/api/services", locationRoutes);
```

**Step 4: Verify backend compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add backend/src/controllers/service/locationController.ts backend/src/routes/locationRoutes.ts backend/src/index.ts
git commit -m "feat: add location tracking endpoints for professional route"
```

---

## Task 4: Add Backend Endpoint for Google Maps API Key

**Files:**
- Modify: `backend/src/controllers/service/locationController.ts` (add new export)
- Modify: `backend/src/routes/locationRoutes.ts` (add new route)

**Step 1: Add getMapConfig endpoint to locationController.ts**

Add at the end of `locationController.ts`, before the closing:

```typescript
/**
 * GET /api/services/map-config
 * Returns the Google Maps API key for the frontend
 */
export const getMapConfig = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const { env } = await import("../../config/env");

    res.status(200).json(
      successResponse({
        apiKey: env.PLACES_API_KEY,
      })
    );
  } catch (error) {
    log.error({ err: error }, "Get map config error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 2: Add route in locationRoutes.ts**

Add to `locationRoutes.ts` before the `export default`:

```typescript
import { getMapConfig } from "../controllers/service/locationController";
```

Update the import to include `getMapConfig`, then add the route:

```typescript
// Get Google Maps API key
router.get(
  "/map-config",
  verifyToken,
  getMapConfig
);
```

**Important:** This route must be placed BEFORE any `:id` parameter routes to avoid Express matching `map-config` as an `:id`.

**Step 3: Verify backend compiles**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/controllers/service/locationController.ts backend/src/routes/locationRoutes.ts
git commit -m "feat: add map-config endpoint to serve Google Maps API key"
```

---

## Task 5: Add Frontend API Service Functions

**Files:**
- Modify: `frontend/src/services/serviceService.ts` (add new functions)

**Step 1: Add location and map service functions**

At the end of `frontend/src/services/serviceService.ts`, before the default export (or at the end), add:

```typescript
// ==================== LOCATION TRACKING ====================

export const getMapConfig = async (): Promise<{ apiKey: string }> => {
  return extractData(api.get("/services/map-config"));
};

export const startRoute = async (orderId: number): Promise<any> => {
  return extractData(api.post(`/services/orders/${orderId}/start-route`));
};

export const updateProfessionalLocation = async (
  orderId: number,
  latitude: number,
  longitude: number
): Promise<any> => {
  return extractData(
    api.post(`/services/orders/${orderId}/location`, { latitude, longitude })
  );
};

export const getProfessionalLocation = async (
  orderId: number
): Promise<{ lat: number; lng: number; updatedAt: string } | null> => {
  return extractData(api.get(`/services/orders/${orderId}/location`));
};

export const clearProfessionalLocation = async (
  orderId: number
): Promise<any> => {
  return extractData(api.delete(`/services/orders/${orderId}/location`));
};
```

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/services/serviceService.ts
git commit -m "feat: add location tracking API functions to frontend service"
```

---

## Task 6: Install @vis.gl/react-google-maps in Frontend

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install the library**

Run: `cd /home/levybonito/faztudo-main/frontend && npm install @vis.gl/react-google-maps`

**Step 2: Verify it installed**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add @vis.gl/react-google-maps for map integration"
```

---

## Task 7: Create useGeolocation Hook

**Files:**
- Create: `frontend/src/hooks/useGeolocation.ts`

**Step 1: Create the hook**

Create `frontend/src/hooks/useGeolocation.ts`:

```typescript
import { useState, useEffect, useCallback, useRef } from "react";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  watchPosition?: boolean;
  /** Interval in ms to call onUpdate (default: 5000) */
  updateInterval?: number;
  onUpdate?: (lat: number, lng: number) => void;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    watchPosition = false,
    updateInterval = 5000,
    onUpdate,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const latestPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const handleSuccess = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;
      setState({
        latitude,
        longitude,
        accuracy,
        error: null,
        loading: false,
      });
      latestPositionRef.current = { lat: latitude, lng: longitude };
    },
    []
  );

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = "Erro ao obter localizacao";
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = "Permissao de localizacao negada. Habilite nas configuracoes do navegador.";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = "Localizacao indisponivel.";
        break;
      case error.TIMEOUT:
        errorMessage = "Tempo esgotado ao obter localizacao.";
        break;
    }
    setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
  }, []);

  // Start/stop watching
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Geolocalizacao nao suportada pelo navegador.",
        loading: false,
      }));
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy,
      timeout: 10000,
      maximumAge: 0,
    };

    if (watchPosition) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        geoOptions
      );

      // Periodic callback for sending location to server
      if (onUpdate) {
        intervalRef.current = setInterval(() => {
          const pos = latestPositionRef.current;
          if (pos) {
            onUpdate(pos.lat, pos.lng);
          }
        }, updateInterval);
      }
    } else {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        geoOptions
      );
    }
  }, [enableHighAccuracy, watchPosition, updateInterval, onUpdate, handleSuccess, handleError]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (watchPosition) {
      startWatching();
    } else {
      // Just get current position once
      startWatching();
    }

    return () => {
      stopWatching();
    };
  }, [watchPosition, startWatching, stopWatching]);

  return {
    ...state,
    startWatching,
    stopWatching,
  };
}
```

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/hooks/useGeolocation.ts
git commit -m "feat: add useGeolocation hook for browser location tracking"
```

---

## Task 8: Create OrderLocationMap Component

**Files:**
- Create: `frontend/src/components/orders/OrderLocationMap.tsx`

This is the main Waze-like map component. It shows:
- Professional's current location (blue marker)
- Client's address/destination (red marker)
- Route between the two (polyline via Directions API)
- Distance and estimated time
- "Iniciar Trajeto" button for professional
- Live tracking for client view

**Step 1: Create the component**

Create `frontend/src/components/orders/OrderLocationMap.tsx`:

```tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
  Pin,
} from "@vis.gl/react-google-maps";
import {
  Navigation,
  MapPin,
  Clock,
  Route,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { useGeolocation } from "../../hooks/useGeolocation";
import {
  getMapConfig,
  startRoute as apiStartRoute,
  updateProfessionalLocation,
  getProfessionalLocation,
  clearProfessionalLocation,
} from "../../services/serviceService";
import { useToast } from "../../context/ToastContext";

interface OrderLocationMapProps {
  orderId: number;
  isProfessional: boolean;
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

// Inner component that uses Google Maps hooks (must be inside APIProvider)
const MapContent: React.FC<{
  isProfessional: boolean;
  orderId: number;
  destination: { lat: number; lng: number };
  destinationLabel: string;
  orderStatus: string;
}> = ({ isProfessional, orderId, destination, destinationLabel, orderStatus }) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");
  const toast = useToast();

  const [routeStarted, setRouteStarted] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const [professionalPos, setProfessionalPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [startingRoute, setStartingRoute] = useState(false);

  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Professional: track own position
  const handleLocationUpdate = useCallback(
    async (lat: number, lng: number) => {
      if (!routeStarted) return;
      try {
        await updateProfessionalLocation(orderId, lat, lng);
      } catch {
        // Silent fail — location updates are best-effort
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
          setProfessionalPos({ lat: loc.lat, lng: loc.lng });
        }
      } catch {
        // Silent fail
      }
    };

    // Poll immediately then every 5s
    pollLocation();
    pollIntervalRef.current = setInterval(pollLocation, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isProfessional, orderId]);

  // Determine the "origin" point for the route
  const origin = isProfessional
    ? geo.latitude && geo.longitude
      ? { lat: geo.latitude, lng: geo.longitude }
      : null
    : professionalPos;

  // Render directions route
  useEffect(() => {
    if (!routesLibrary || !map || !origin) return;

    // Create renderer if not exists
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new routesLibrary.DirectionsRenderer({
        map,
        suppressMarkers: true, // We'll render our own markers
        polylineOptions: {
          strokeColor: "#3b82f6",
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });
    }

    const directionsService = new routesLibrary.DirectionsService();

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK" && response) {
          directionsRendererRef.current?.setDirections(response);
          const leg = response.routes[0]?.legs[0];
          if (leg) {
            setRouteInfo({
              distance: leg.distance?.text || "",
              duration: leg.duration?.text || "",
            });
          }
        }
      }
    );
  }, [routesLibrary, map, origin, destination]);

  // Fit map bounds to show both points
  useEffect(() => {
    if (!map || !origin) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(new google.maps.LatLng(origin.lat, origin.lng));
    bounds.extend(new google.maps.LatLng(destination.lat, destination.lng));
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 40, right: 40 });
  }, [map, origin, destination]);

  // Handle "Start Route" click
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
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
      setRouteInfo(null);
    } catch {
      // Silent fail
    }
  };

  // Show loading while getting professional's initial position
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
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        {geo.error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Route info bar */}
      {routeInfo && (
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Route className="w-4 h-4 text-blue-500" />
              {routeInfo.distance}
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-amber-500" />
              {routeInfo.duration}
            </div>
          </div>
          {isProfessional && routeStarted && (
            <button
              onClick={handleStopRoute}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Parar rastreamento
            </button>
          )}
        </div>
      )}

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700" style={{ height: "350px" }}>
        <Map
          defaultCenter={destination}
          defaultZoom={13}
          mapId="faztudo-route-map"
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl={true}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={true}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Destination marker (client's address) */}
          <AdvancedMarker position={destination} title={destinationLabel}>
            <Pin background="#ef4444" glyphColor="#fff" borderColor="#dc2626" />
          </AdvancedMarker>

          {/* Professional's current position */}
          {origin && (
            <AdvancedMarker position={origin} title="Profissional">
              <Pin background="#3b82f6" glyphColor="#fff" borderColor="#2563eb" />
            </AdvancedMarker>
          )}
        </Map>

        {/* Floating legend */}
        <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-400">Profissional</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-slate-600 dark:text-slate-400">Destino</span>
          </div>
        </div>
      </div>

      {/* Action button (Professional only) */}
      {isProfessional && !routeStarted && (
        <button
          onClick={handleStartRoute}
          disabled={startingRoute || !geo.latitude}
          className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
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

      {/* Client waiting message */}
      {!isProfessional && !professionalPos && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm text-amber-700 dark:text-amber-400">
          <Clock className="w-4 h-4 flex-shrink-0" />
          Aguardando o profissional iniciar o trajeto...
        </div>
      )}

      {/* Client: professional is on the way */}
      {!isProfessional && professionalPos && routeInfo && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-sm text-blue-700 dark:text-blue-400 animate-fade-in">
          <Navigation className="w-4 h-4 flex-shrink-0" />
          Profissional a caminho! Estimativa: {routeInfo.duration} ({routeInfo.distance})
        </div>
      )}
    </div>
  );
};

// Main component with APIProvider wrapper
const OrderLocationMap: React.FC<OrderLocationMapProps> = ({
  orderId,
  isProfessional,
  destinationAddress,
  orderStatus,
}) => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);

  // Load API key
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getMapConfig();
        if (config.apiKey) {
          setApiKey(config.apiKey);
        } else {
          setKeyError("Chave do Google Maps nao configurada");
        }
      } catch {
        setKeyError("Erro ao carregar configuracao do mapa");
      } finally {
        setLoadingKey(false);
      }
    };
    loadConfig();
  }, []);

  // Use existing lat/lng or geocode the address
  useEffect(() => {
    if (destinationAddress.latitude && destinationAddress.longitude) {
      setDestination({
        lat: destinationAddress.latitude,
        lng: destinationAddress.longitude,
      });
      return;
    }

    // If no lat/lng, we'll geocode when the map loads (via Google Geocoding API)
    // For now, set a fallback — the Directions component will handle geocoding via address string
    // We'll use the Geocoding API once the map is loaded
    if (apiKey) {
      const addressStr = `${destinationAddress.street}, ${destinationAddress.number}, ${destinationAddress.neighborhood}, ${destinationAddress.city}, ${destinationAddress.state}, Brasil`;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: addressStr }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          setDestination({ lat: loc.lat(), lng: loc.lng() });
        } else {
          // Fallback to center of Sao Paulo
          setDestination({ lat: -23.5505, lng: -46.6333 });
        }
      });
    }
  }, [destinationAddress, apiKey]);

  const destinationLabel = `${destinationAddress.street}, ${destinationAddress.number} - ${destinationAddress.neighborhood}`;

  if (loadingKey) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Carregando mapa...
      </div>
    );
  }

  if (keyError || !apiKey) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        {keyError || "Mapa indisponivel"}
      </div>
    );
  }

  if (!destination) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Localizando endereco...
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <MapContent
        isProfessional={isProfessional}
        orderId={orderId}
        destination={destination}
        destinationLabel={destinationLabel}
        orderStatus={orderStatus}
      />
    </APIProvider>
  );
};

export default OrderLocationMap;
```

**Step 2: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors (may need minor type adjustments — fix any issues)

**Step 3: Commit**

```bash
git add frontend/src/components/orders/OrderLocationMap.tsx
git commit -m "feat: add OrderLocationMap component with Waze-like route tracking"
```

---

## Task 9: Add CSS Animations for Smooth Transitions

**Files:**
- Modify: `frontend/src/index.css` (or wherever Tailwind's `@layer utilities` is defined)

Look for the main CSS file where Tailwind is imported and custom animations are defined (likely `frontend/src/index.css` or similar).

**Step 1: Find the CSS file**

Search for `@tailwind` in `frontend/src/` to locate the main CSS file.

**Step 2: Add animation utilities**

Add these CSS animations to the utilities layer or at the end of the CSS file:

```css
/* Order transition animations */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out both;
}

.animate-slide-up {
  animation: slide-up 0.4s ease-out both;
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out both;
}
```

**Note:** Check if `animate-fade-in` or `animate-soft-pop` already exist (they do — `animate-soft-pop` is used by `ConfirmDialog`). Only add animations that don't already exist.

**Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add CSS animations for order transitions"
```

---

## Task 10: Redesign Professional's PENDING Order View (Compact + Animated)

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`

This is the main task: redesign the professional's view when an order is PENDING to be more compact and add smooth transitions when accepting.

**Step 1: Redesign the professional's PENDING section**

In `OrderDetails.tsx`, replace the professional's action section (lines 440-541) with a more compact, informative design. The current code has:

```tsx
{isOrderProfessional && (
  <div className="card">
    <h2 className="font-semibold ...">Acoes</h2>
    <div className="flex flex-wrap gap-3">
      {order.status === "PENDING" && ( ... buttons ... )}
      ...
```

Replace the PENDING section content to be more compact. Instead of a separate "Acoes" card with just buttons, merge the order info + actions into a cohesive card:

Find the entire `{isOrderProfessional && (` block (lines 440-541) and replace it with:

```tsx
          {/* Professional Actions */}
          {isOrderProfessional && (
            <div className="card animate-fade-in">
              {order.status === "PENDING" && (
                <div className="space-y-4">
                  {/* Compact header */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                        Novo pedido recebido
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Aceite ou recuse para continuar
                      </p>
                    </div>
                  </div>

                  {/* Quick info grid - compact */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary-600">
                        {formatCurrency(order.price)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Valor</p>
                    </div>
                    <div className="text-center border-x border-slate-200 dark:border-slate-700">
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {order.deadlineDays || 7}d
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Prazo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {order.scheduledDate ? formatDate(order.scheduledDate) : "Flexivel"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Data</p>
                    </div>
                  </div>

                  {/* Client info inline */}
                  {order.client && (
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        {order.client.profileImage ? (
                          <img src={order.client.profileImage} alt={order.client.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">{order.client.name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Cliente: <strong className="text-slate-900 dark:text-slate-100">{order.client.name}</strong>
                      </span>
                    </div>
                  )}

                  {/* Action buttons - prominent */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => handleAction(() => acceptOrder(order.id), "Pedido aceito!")}
                      disabled={actionLoading}
                      className="btn btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                    >
                      {actionLoading ? (
                        <span className="loader h-4 w-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Aceitar Pedido
                    </button>
                    <button
                      onClick={() =>
                        setConfirmAction({
                          title: "Recusar pedido",
                          message: "Tem certeza que deseja recusar este pedido?",
                          variant: "danger",
                          confirmLabel: "Recusar",
                          action: () => cancelOrder(order.id, "Recusado pelo profissional"),
                        })
                      }
                      disabled={actionLoading}
                      className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ACCEPTED: Show location map + start service */}
              {order.status === "ACCEPTED" && (
                <div className="space-y-4 animate-slide-up">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">
                        Pedido aceito!
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {paymentApproved
                          ? "Dirija-se ao cliente para iniciar o servico"
                          : "Aguardando pagamento do cliente"}
                      </p>
                    </div>
                  </div>

                  {/* Location map (only after payment) */}
                  {paymentApproved && order.address && (
                    <OrderLocationMap
                      orderId={order.id}
                      isProfessional={true}
                      destinationAddress={order.address}
                      orderStatus={order.status}
                    />
                  )}

                  {/* Start service button */}
                  {paymentApproved && (
                    <button
                      onClick={() => handleAction(() => startOrder(order.id), "Servico iniciado!")}
                      disabled={actionLoading}
                      className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Iniciar Servico
                    </button>
                  )}

                  {/* Reagendar */}
                  {order.professionalId && (
                    <button
                      onClick={() => setShowReschedule(true)}
                      disabled={actionLoading}
                      className="btn btn-outline w-full"
                    >
                      <CalendarClock className="w-4 h-4 mr-2" />
                      Reagendar
                    </button>
                  )}
                </div>
              )}

              {/* IN_PROGRESS */}
              {order.status === "IN_PROGRESS" && (
                <div className="space-y-3 animate-fade-in">
                  <button
                    onClick={() => handleAction(() => submitOrderCompletion(order.id), "Servico marcado como entregue!")}
                    disabled={actionLoading}
                    className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marcar como Entregue
                  </button>
                  {order.professionalId && (
                    <button
                      onClick={() => setShowReschedule(true)}
                      disabled={actionLoading}
                      className="btn btn-outline w-full"
                    >
                      <CalendarClock className="w-4 h-4 mr-2" />
                      Reagendar
                    </button>
                  )}
                  <button
                    onClick={() => setShowDispute(true)}
                    disabled={actionLoading}
                    className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Abrir Disputa
                  </button>
                </div>
              )}

              {/* AWAITING_PROFESSIONAL_CONFIRMATION */}
              {order.status === "AWAITING_PROFESSIONAL_CONFIRMATION" && (
                <div className="animate-fade-in">
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Confirmar conclusao",
                        message: "Confirme que o servico foi concluido conforme combinado.",
                        variant: "warning",
                        confirmLabel: "Confirmar Conclusao",
                        action: () => confirmProfessionalCompletion(order.id),
                      })
                    }
                    disabled={actionLoading}
                    className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Conclusao
                  </button>
                </div>
              )}

              {/* AWAITING_CLIENT_CONFIRMATION */}
              {order.status === "AWAITING_CLIENT_CONFIRMATION" && (
                <div className="animate-fade-in flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Aguardando o cliente confirmar para finalizar o pedido.
                  </p>
                </div>
              )}
            </div>
          )}
```

**Step 2: Add the import for OrderLocationMap at the top of OrderDetails.tsx**

Add with the other imports:

```typescript
import OrderLocationMap from "../../components/orders/OrderLocationMap";
```

**Step 3: Add location map to the CLIENT view too**

In the client's section (after the chat button area), add the map when the order is ACCEPTED or IN_PROGRESS. Find the client actions section and add before it:

```tsx
          {/* Client: Location tracking map (after payment, when professional is en route) */}
          {isOrderClient && paymentApproved && order.address &&
            ["ACCEPTED", "IN_PROGRESS"].includes(order.status) && (
            <div className="card animate-fade-in">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-500" />
                Localizacao do Profissional
              </h2>
              <OrderLocationMap
                orderId={order.id}
                isProfessional={false}
                destinationAddress={order.address}
                orderStatus={order.status}
              />
            </div>
          )}
```

Also add the `Navigation` import from lucide-react at the top.

**Step 4: Verify frontend compiles**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: redesign professional order view with compact layout and location map"
```

---

## Task 11: Visual Testing & Verification

**Files:** None (manual testing)

**Step 1: Start backend**

Run: `cd /home/levybonito/faztudo-main/backend && npm run dev`
Expected: Server starts on port 3001

**Step 2: Start frontend**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run dev`
Expected: Vite dev server starts on port 5173

**Step 3: Test professional's order view**

1. Open `http://localhost:5173`
2. Login as `profissional@teste.com` / `Teste@123`
3. Navigate to a PENDING order
4. Verify the compact layout:
   - Icon + title at top
   - 3-column grid (Price | Deadline | Date)
   - Client info inline
   - Accept/Reject buttons side by side
5. Click "Aceitar Pedido"
6. Verify smooth animation to ACCEPTED view
7. Verify map loads with your current location (blue pin) and destination (red pin)
8. If address has no lat/lng, verify geocoding works

**Step 4: Test client's tracking view**

1. Open another browser/incognito
2. Login as `cliente@teste.com` / `Teste@123`
3. Navigate to the same order
4. Verify the "Localizacao do Profissional" section appears
5. Verify it shows "Aguardando o profissional iniciar o trajeto..."
6. When professional clicks "Iniciar Trajeto", client should see the route

**Step 5: Test backend endpoints directly**

Run: `curl -X GET http://localhost:3001/api/services/map-config -H "Authorization: Bearer <token>"`
Expected: Returns `{ success: true, data: { apiKey: "AIzaSy..." } }`

**Step 6: Commit if no fixes needed**

```bash
git add -A
git commit -m "feat: complete location tracking and order transition improvements"
```

---

## Task 12: Run Backend Tests

**Files:** None

**Step 1: Run existing tests**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: All existing tests pass (we didn't modify test-related code)

**Step 2: Verify TypeScript**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: No errors in either

**Step 3: Final commit**

If all passes, tag the work:

```bash
git add -A
git commit -m "feat: location tracking and order UI improvements complete"
```

---

## Architecture Notes

### Why in-memory location store (not DB)?
- Location data is ephemeral — only needed while professional is en route
- Writing to SQLite every 5 seconds would be too much I/O
- In production with PostgreSQL, could use Redis or a dedicated table with TTL
- The `Map<orderId, location>` is cleared when route ends or server restarts

### Why polling instead of WebSocket?
- The app already uses polling for chat (no WebSocket infrastructure)
- 5-second polling interval is acceptable for route tracking
- Adding WebSocket for just this feature isn't worth the complexity
- Can be upgraded to WebSocket later when chat is also upgraded

### Google Maps API considerations
- The `PLACES_API` key from `.env` is served via an authenticated endpoint (not exposed to public)
- The key should have HTTP referrer restrictions in Google Cloud Console for production
- Directions API has per-request pricing — consider caching routes
- The map uses `mapId` which requires a Map ID configured in Google Cloud (or remove it to use default styling)
