# Mapa Interativo FazTudo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar um componente de mapa interativo standalone usando Google Maps que mostra profissionais e destinos com marcadores customizados no design system do FazTudo, rastro de caminho, e sinalizadores de rua — com dados de teste em Iguatu-CE.

**Architecture:** Novo componente `InteractiveMap` totalmente desacoplado do `OrderLocationMap` existente. Usa `@vis.gl/react-google-maps` (já instalado). Componente wrapper `MapProvider` gerencia API key. Marcadores customizados SVG com cores do design system (blue-600 pro profissional, red-500 pro destino). Direções via Google Directions API. Dados mockados de Iguatu-CE para demonstração.

**Tech Stack:** React 18, TypeScript, `@vis.gl/react-google-maps` v1.7.1 (já no package.json), Google Maps Directions/Geocoding/Places APIs, Lucide icons, TailwindCSS com design tokens existentes.

---

## Contexto Crucial (leia antes de implementar)

### Design System — Cores e Tokens

| Token | Hex | Uso no mapa |
|-------|-----|-------------|
| `primary-600` | `#2563eb` | Marcador profissional, rota principal |
| `primary-700` | `#1d4ed8` | Hover/borda do marcador profissional |
| `primary-400` | `#60a5fa` | Glow do profissional (dark mode) |
| `error` / red-500 | `#ef4444` | Marcador destino |
| `secondary-500` / green-500 | `#22c55e` | Status "a caminho" |
| `warning` / amber-500 | `#f59e0b` | Sinalizadores de rua |
| `slate-800` | `#1e293b` | Fundo controles dark mode |
| `slate-50` | `#f8fafc` | Fundo controles light mode |

### Padrões do Frontend

- CSS classes: `.btn`, `.card`, `.badge`, `.glass-card` (definidos em `index.css`)
- Dark mode: classe `dark` no `<html>`, usar `dark:` prefix no Tailwind
- Icons: sempre `lucide-react`
- Classes condicionais: `clsx` (não classnames)
- API calls: via `services/api.ts` → `api.get/post`
- Tipos: em `types/` por domínio, barrel export via `types/index.ts`
- Componentes: arquivo próprio em `components/` por feature

### Componente Existente a NÃO Modificar

O `OrderLocationMap.tsx` em `components/orders/` é o mapa de rastreamento de pedidos.
**NÃO altere este arquivo.** O novo componente será independente.

### API de Mapa Existente

```
GET  /api/services/map-config → { apiKey: string }   ← Reutilizar
POST /api/services/orders/:id/location                ← Não usar (order-specific)
GET  /api/services/orders/:id/location                ← Não usar (order-specific)
POST /api/services/orders/:id/start-route             ← Não usar (order-specific)
```

### Coordenadas de Teste (Iguatu-CE, ~5km de distância)

| Ponto | Endereço | Lat | Lng |
|-------|----------|-----|-----|
| **Profissional** | Centro de Iguatu, Praça da Matriz | `-6.3599` | `-39.2984` |
| **Destino (cliente)** | Bairro Vila Centenário, Iguatu | `-6.3780` | `-39.3260` |

Distância real: ~4.8km por rota de carro. O mapa centrará automaticamente nesses dois pontos.

---

## Task 1: Criar tipos do mapa

**Files:**
- Create: `frontend/src/types/map.ts`
- Modify: `frontend/src/types/index.ts` (adicionar re-export)

**Step 1: Criar `frontend/src/types/map.ts`**

```typescript
// frontend/src/types/map.ts

/**
 * Represents a geographic coordinate pair
 */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A custom marker on the interactive map
 */
export interface MapMarker {
  id: string;
  position: LatLng;
  type: "professional" | "destination" | "landmark";
  label: string;
  /** Optional subtitle shown below the label */
  subtitle?: string;
  /** Custom icon name from lucide-react */
  icon?: string;
}

/**
 * Route information between two points
 */
export interface RouteInfo {
  distance: string;
  duration: string;
  /** Encoded polyline from Google Directions (for fallback) */
  polyline?: string;
}

/**
 * Props for the InteractiveMap component
 */
export interface InteractiveMapProps {
  /** Marker for the professional's current position */
  professionalMarker: MapMarker;
  /** Marker for the service destination */
  destinationMarker: MapMarker;
  /** Additional landmark/street markers */
  landmarkMarkers?: MapMarker[];
  /** Whether to show the route (directions) between professional and destination */
  showRoute?: boolean;
  /** Map height in pixels (default: 450) */
  height?: number;
  /** Callback when route info is computed */
  onRouteInfo?: (info: RouteInfo) => void;
  /** Extra CSS class for the container */
  className?: string;
  /** Google Maps Map ID for custom styling (optional) */
  mapId?: string;
}

/**
 * Props for the RouteTracker overlay that shows distance/duration
 */
export interface RouteTrackerProps {
  routeInfo: RouteInfo | null;
  isTracking: boolean;
  onStartTracking?: () => void;
  onStopTracking?: () => void;
  isProfessional: boolean;
}
```

**Step 2: Adicionar re-export em `frontend/src/types/index.ts`**

Abrir `frontend/src/types/index.ts` e adicionar no final:

```typescript
// Map types
export * from "./map";
```

**Step 3: Verificar que não há erros de tipo**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: nenhum erro relacionado a `map.ts`

**Step 4: Commit**

```bash
git add frontend/src/types/map.ts frontend/src/types/index.ts
git commit -m "feat: add TypeScript types for interactive map component"
```

---

## Task 2: Criar componente de marcador customizado do profissional

**Files:**
- Create: `frontend/src/components/map/ProfessionalMarker.tsx`

**Step 1: Criar o diretório e componente**

Criar `frontend/src/components/map/ProfessionalMarker.tsx`:

```typescript
// frontend/src/components/map/ProfessionalMarker.tsx
import React from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { Wrench } from "lucide-react";
import type { LatLng } from "../../types";

interface ProfessionalMarkerProps {
  position: LatLng;
  label: string;
  subtitle?: string;
  onClick?: () => void;
}

/**
 * Custom marker for the professional on the interactive map.
 * Uses FazTudo primary-600 (blue) color scheme with pulsing animation.
 */
const ProfessionalMarker: React.FC<ProfessionalMarkerProps> = ({
  position,
  label,
  subtitle,
  onClick,
}) => {
  return (
    <AdvancedMarker position={position} title={label} onClick={onClick}>
      <div className="flex flex-col items-center group cursor-pointer">
        {/* Label tooltip (above marker) */}
        <div className="bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 shadow-lg border border-slate-200 dark:border-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {label}
          </p>
          {subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        {/* Pulsing glow ring */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary-500/30 animate-ping" />
          <div className="absolute -inset-1 rounded-full bg-primary-500/20 animate-pulse" />

          {/* Marker body */}
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 border-[3px] border-white dark:border-slate-900 shadow-lg flex items-center justify-center z-10">
            <Wrench className="w-4.5 h-4.5 text-white" />
          </div>
        </div>

        {/* Pointer arrow */}
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary-600 -mt-[2px] z-10" />
      </div>
    </AdvancedMarker>
  );
};

export default ProfessionalMarker;
```

**Step 2: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "ProfessionalMarker\|map/" | head -10`
Expected: sem erros

**Step 3: Commit**

```bash
git add frontend/src/components/map/ProfessionalMarker.tsx
git commit -m "feat: add custom ProfessionalMarker component for interactive map"
```

---

## Task 3: Criar componente de marcador customizado do destino

**Files:**
- Create: `frontend/src/components/map/DestinationMarker.tsx`

**Step 1: Criar componente**

Criar `frontend/src/components/map/DestinationMarker.tsx`:

```typescript
// frontend/src/components/map/DestinationMarker.tsx
import React from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { Home, MapPin } from "lucide-react";
import type { LatLng } from "../../types";

interface DestinationMarkerProps {
  position: LatLng;
  label: string;
  subtitle?: string;
  onClick?: () => void;
}

/**
 * Custom marker for the service destination (client's address).
 * Uses FazTudo error/red-500 color scheme with a flag/house icon.
 */
const DestinationMarker: React.FC<DestinationMarkerProps> = ({
  position,
  label,
  subtitle,
  onClick,
}) => {
  return (
    <AdvancedMarker position={position} title={label} onClick={onClick}>
      <div className="flex flex-col items-center group cursor-pointer">
        {/* Label tooltip */}
        <div className="bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 shadow-lg border border-slate-200 dark:border-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap max-w-[200px]">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
            {label}
          </p>
          {subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Flag pin design */}
        <div className="relative">
          {/* Outer glow */}
          <div className="absolute -inset-1 rounded-full bg-red-500/20 animate-pulse" />

          {/* Pin body */}
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 border-[3px] border-white dark:border-slate-900 shadow-lg flex items-center justify-center z-10">
            <Home className="w-4.5 h-4.5 text-white" />
          </div>
        </div>

        {/* Pointer arrow */}
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 -mt-[2px] z-10" />

        {/* Ground shadow */}
        <div className="w-4 h-1 bg-slate-900/20 dark:bg-slate-100/10 rounded-full mt-0.5 blur-[1px]" />
      </div>
    </AdvancedMarker>
  );
};

export default DestinationMarker;
```

**Step 2: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "DestinationMarker\|map/" | head -10`
Expected: sem erros

**Step 3: Commit**

```bash
git add frontend/src/components/map/DestinationMarker.tsx
git commit -m "feat: add custom DestinationMarker component for interactive map"
```

---

## Task 4: Criar componente de marcador de sinalização (landmark)

**Files:**
- Create: `frontend/src/components/map/LandmarkMarker.tsx`

**Step 1: Criar componente**

Criar `frontend/src/components/map/LandmarkMarker.tsx`:

```typescript
// frontend/src/components/map/LandmarkMarker.tsx
import React from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { MapPin, Flag, AlertTriangle, Construction } from "lucide-react";
import type { LatLng } from "../../types";

type LandmarkType = "street" | "reference" | "warning" | "construction";

interface LandmarkMarkerProps {
  position: LatLng;
  label: string;
  type?: LandmarkType;
  onClick?: () => void;
}

const LANDMARK_CONFIG: Record<
  LandmarkType,
  { icon: React.ElementType; bgClass: string; arrowClass: string }
> = {
  street: {
    icon: MapPin,
    bgClass: "bg-gradient-to-br from-amber-400 to-amber-600",
    arrowClass: "border-t-amber-500",
  },
  reference: {
    icon: Flag,
    bgClass: "bg-gradient-to-br from-purple-400 to-purple-600",
    arrowClass: "border-t-purple-500",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-gradient-to-br from-orange-400 to-orange-600",
    arrowClass: "border-t-orange-500",
  },
  construction: {
    icon: Construction,
    bgClass: "bg-gradient-to-br from-slate-400 to-slate-600",
    arrowClass: "border-t-slate-500",
  },
};

/**
 * Marker for street signals, reference points, warnings, etc.
 * Uses amber/warning color by default. Compatible with Google Maps API components.
 */
const LandmarkMarker: React.FC<LandmarkMarkerProps> = ({
  position,
  label,
  type = "street",
  onClick,
}) => {
  const config = LANDMARK_CONFIG[type];
  const Icon = config.icon;

  return (
    <AdvancedMarker position={position} title={label} onClick={onClick}>
      <div className="flex flex-col items-center group cursor-pointer">
        {/* Tooltip */}
        <div className="bg-white dark:bg-slate-800 rounded-md px-2 py-1 shadow-md border border-slate-200 dark:border-slate-700 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          <p className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
            {label}
          </p>
        </div>

        {/* Small marker */}
        <div
          className={`relative w-7 h-7 rounded-full ${config.bgClass} border-2 border-white dark:border-slate-900 shadow-md flex items-center justify-center z-10`}
        >
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>

        {/* Arrow */}
        <div
          className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] ${config.arrowClass} -mt-[1px] z-10`}
        />
      </div>
    </AdvancedMarker>
  );
};

export default LandmarkMarker;
```

**Step 2: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "LandmarkMarker\|map/" | head -10`
Expected: sem erros

**Step 3: Commit**

```bash
git add frontend/src/components/map/LandmarkMarker.tsx
git commit -m "feat: add LandmarkMarker component for street signals and reference points"
```

---

## Task 5: Criar componente RouteTracker (overlay de distância/tempo)

**Files:**
- Create: `frontend/src/components/map/RouteTracker.tsx`

**Step 1: Criar componente**

Criar `frontend/src/components/map/RouteTracker.tsx`:

```typescript
// frontend/src/components/map/RouteTracker.tsx
import React from "react";
import clsx from "clsx";
import {
  Navigation,
  Clock,
  Route,
  Loader2,
  X,
  MapPin,
} from "lucide-react";
import type { RouteTrackerProps } from "../../types";

/**
 * Floating overlay that displays route information (distance, duration)
 * and controls for starting/stopping live tracking.
 */
const RouteTracker: React.FC<RouteTrackerProps> = ({
  routeInfo,
  isTracking,
  onStartTracking,
  onStopTracking,
  isProfessional,
}) => {
  return (
    <div className="space-y-3">
      {/* Route info bar */}
      {routeInfo && (
        <div className="flex items-center justify-between bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl p-3 shadow-md border border-slate-200 dark:border-slate-700 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Route className="w-4 h-4 text-primary-500" />
              {routeInfo.distance}
            </div>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-amber-500" />
              {routeInfo.duration}
            </div>
          </div>

          {isProfessional && isTracking && onStopTracking && (
            <button
              onClick={onStopTracking}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="w-3.5 h-3.5" />
              Parar
            </button>
          )}
        </div>
      )}

      {/* Start tracking button (professional only) */}
      {isProfessional && !isTracking && onStartTracking && (
        <button
          onClick={onStartTracking}
          className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
        >
          <Navigation className="w-5 h-5" />
          Iniciar Trajeto
        </button>
      )}

      {/* Waiting message (client) */}
      {!isProfessional && !routeInfo && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
          <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
          Aguardando o profissional iniciar o trajeto...
        </div>
      )}

      {/* Professional is on the way (client) */}
      {!isProfessional && routeInfo && (
        <div className="flex items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-sm text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800/30 animate-fade-in">
          <Navigation className="w-4 h-4 flex-shrink-0" />
          <span>
            Profissional a caminho!{" "}
            <span className="font-semibold">
              {routeInfo.duration} ({routeInfo.distance})
            </span>
          </span>
        </div>
      )}
    </div>
  );
};

export default RouteTracker;
```

**Step 2: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "RouteTracker\|map/" | head -10`
Expected: sem erros

**Step 3: Commit**

```bash
git add frontend/src/components/map/RouteTracker.tsx
git commit -m "feat: add RouteTracker overlay component for distance and duration display"
```

---

## Task 6: Criar componente MapLegend (legenda do mapa)

**Files:**
- Create: `frontend/src/components/map/MapLegend.tsx`

**Step 1: Criar componente**

Criar `frontend/src/components/map/MapLegend.tsx`:

```typescript
// frontend/src/components/map/MapLegend.tsx
import React, { useState } from "react";
import clsx from "clsx";
import { ChevronUp, ChevronDown } from "lucide-react";

interface LegendItem {
  color: string;
  label: string;
}

interface MapLegendProps {
  items?: LegendItem[];
  className?: string;
}

const DEFAULT_LEGEND: LegendItem[] = [
  { color: "bg-primary-600", label: "Profissional" },
  { color: "bg-red-500", label: "Destino do Servico" },
  { color: "bg-amber-500", label: "Sinalizacao" },
  { color: "bg-primary-500", label: "Rota" },
];

/**
 * Floating legend for the interactive map.
 * Collapsible on mobile. Positioned bottom-left by default.
 */
const MapLegend: React.FC<MapLegendProps> = ({
  items = DEFAULT_LEGEND,
  className,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={clsx(
        "bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-200",
        className
      )}
    >
      {/* Header (clickable to toggle on mobile) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-1.5 sm:hidden"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Legenda
        </span>
        {collapsed ? (
          <ChevronUp className="w-3 h-3 text-slate-400" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        )}
      </button>

      {/* Legend items */}
      <div
        className={clsx(
          "px-3 py-2 space-y-1.5 transition-all duration-200",
          collapsed ? "hidden sm:block" : "block"
        )}
      >
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            {item.label === "Rota" ? (
              <div className={`w-5 h-[3px] rounded-full ${item.color}`} />
            ) : (
              <span
                className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}
              />
            )}
            <span className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;
```

**Step 2: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "MapLegend\|map/" | head -10`
Expected: sem erros

**Step 3: Commit**

```bash
git add frontend/src/components/map/MapLegend.tsx
git commit -m "feat: add MapLegend component with collapsible mobile support"
```

---

## Task 7: Criar componente principal InteractiveMap

**Files:**
- Create: `frontend/src/components/map/InteractiveMap.tsx`

Este é o componente central que compõe todos os sub-componentes.

**Step 1: Criar o componente**

Criar `frontend/src/components/map/InteractiveMap.tsx`:

```typescript
// frontend/src/components/map/InteractiveMap.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import ProfessionalMarker from "./ProfessionalMarker";
import DestinationMarker from "./DestinationMarker";
import LandmarkMarker from "./LandmarkMarker";
import MapLegend from "./MapLegend";
import type {
  InteractiveMapProps,
  RouteInfo,
  LatLng,
  MapMarker,
} from "../../types";
import { getMapConfig } from "../../services/serviceService";

// ==========================================
// Inner map content (must be inside APIProvider)
// ==========================================
const MapContent: React.FC<
  Omit<InteractiveMapProps, "mapId" | "className" | "height"> & {
    mapId?: string;
  }
> = ({
  professionalMarker,
  destinationMarker,
  landmarkMarkers = [],
  showRoute = true,
  onRouteInfo,
  mapId,
}) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(
    null
  );

  // Render directions route between professional and destination
  useEffect(() => {
    if (!showRoute || !routesLibrary || !map) return;

    const origin = professionalMarker.position;
    const dest = destinationMarker.position;

    // Create renderer if not exists
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new routesLibrary.DirectionsRenderer({
        map,
        suppressMarkers: true, // We render our own custom markers
        polylineOptions: {
          strokeColor: "#2563eb", // primary-600
          strokeWeight: 5,
          strokeOpacity: 0.85,
        },
      });
    }

    const directionsService = new routesLibrary.DirectionsService();

    directionsService.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(dest.lat, dest.lng),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK" && response) {
          directionsRendererRef.current?.setDirections(response);
          const leg = response.routes[0]?.legs[0];
          if (leg) {
            const info: RouteInfo = {
              distance: leg.distance?.text || "",
              duration: leg.duration?.text || "",
            };
            setRouteInfo(info);
            onRouteInfo?.(info);
          }
        }
      }
    );

    // Cleanup renderer on unmount
    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
    };
  }, [
    showRoute,
    routesLibrary,
    map,
    professionalMarker.position.lat,
    professionalMarker.position.lng,
    destinationMarker.position.lat,
    destinationMarker.position.lng,
    onRouteInfo,
  ]);

  // Fit map bounds to show all markers
  useEffect(() => {
    if (!map) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(
      new google.maps.LatLng(
        professionalMarker.position.lat,
        professionalMarker.position.lng
      )
    );
    bounds.extend(
      new google.maps.LatLng(
        destinationMarker.position.lat,
        destinationMarker.position.lng
      )
    );

    landmarkMarkers.forEach((m) => {
      bounds.extend(new google.maps.LatLng(m.position.lat, m.position.lng));
    });

    map.fitBounds(bounds, { top: 60, bottom: 80, left: 40, right: 40 });
  }, [map, professionalMarker, destinationMarker, landmarkMarkers]);

  // Calculate center between the two main markers
  const center: LatLng = {
    lat:
      (professionalMarker.position.lat + destinationMarker.position.lat) / 2,
    lng:
      (professionalMarker.position.lng + destinationMarker.position.lng) / 2,
  };

  return (
    <div className="relative w-full h-full">
      <Map
        defaultCenter={center}
        defaultZoom={13}
        mapId={mapId || "faztudo-interactive-map"}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl={true}
        streetViewControl={true}
        mapTypeControl={false}
        fullscreenControl={true}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Professional marker */}
        <ProfessionalMarker
          position={professionalMarker.position}
          label={professionalMarker.label}
          subtitle={professionalMarker.subtitle}
        />

        {/* Destination marker */}
        <DestinationMarker
          position={destinationMarker.position}
          label={destinationMarker.label}
          subtitle={destinationMarker.subtitle}
        />

        {/* Landmark markers (street signs, reference points) */}
        {landmarkMarkers.map((marker) => (
          <LandmarkMarker
            key={marker.id}
            position={marker.position}
            label={marker.label}
            type={
              (marker.icon as "street" | "reference" | "warning" | "construction") ||
              "street"
            }
          />
        ))}
      </Map>

      {/* Floating legend */}
      <div className="absolute bottom-3 left-3 z-10">
        <MapLegend />
      </div>

      {/* Route info floating card (top-center) */}
      {routeInfo && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10 animate-fade-in">
          <div className="flex items-center gap-3 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {routeInfo.distance}
              </span>
            </div>
            <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {routeInfo.duration}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Main component with APIProvider wrapper
// ==========================================
const InteractiveMap: React.FC<InteractiveMapProps> = ({
  height = 450,
  className,
  mapId,
  ...contentProps
}) => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load API key from backend
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getMapConfig();
        if (config.apiKey) {
          setApiKey(config.apiKey);
        } else {
          setError("Chave do Google Maps nao configurada");
        }
      } catch {
        setError("Erro ao carregar configuracao do mapa");
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl",
          className
        )}
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando mapa...</span>
        </div>
      </div>
    );
  }

  if (error || !apiKey) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/30",
          className
        )}
        style={{ height: Math.min(height, 200) }}
      >
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error || "Mapa indisponivel"}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md",
        className
      )}
      style={{ height }}
    >
      <APIProvider apiKey={apiKey}>
        <MapContent mapId={mapId} {...contentProps} />
      </APIProvider>
    </div>
  );
};

export default InteractiveMap;
```

**Step 2: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "InteractiveMap\|map/" | head -20`
Expected: sem erros (ou warnings aceitáveis)

**Step 3: Commit**

```bash
git add frontend/src/components/map/InteractiveMap.tsx
git commit -m "feat: add InteractiveMap main component with route, markers, and legend"
```

---

## Task 8: Criar barrel export para componentes do mapa

**Files:**
- Create: `frontend/src/components/map/index.ts`

**Step 1: Criar barrel export**

Criar `frontend/src/components/map/index.ts`:

```typescript
// frontend/src/components/map/index.ts
export { default as InteractiveMap } from "./InteractiveMap";
export { default as ProfessionalMarker } from "./ProfessionalMarker";
export { default as DestinationMarker } from "./DestinationMarker";
export { default as LandmarkMarker } from "./LandmarkMarker";
export { default as MapLegend } from "./MapLegend";
export { default as RouteTracker } from "./RouteTracker";
```

**Step 2: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "map/index" | head -10`
Expected: sem erros

**Step 3: Commit**

```bash
git add frontend/src/components/map/index.ts
git commit -m "feat: add barrel export for map components"
```

---

## Task 9: Criar página de demonstração do mapa com dados de Iguatu-CE

**Files:**
- Create: `frontend/src/pages/services/MapView.tsx`

Esta página demonstra o mapa interativo com dados mockados de Iguatu.

**Step 1: Criar a página**

Criar `frontend/src/pages/services/MapView.tsx`:

```typescript
// frontend/src/pages/services/MapView.tsx
import React, { useState } from "react";
import { Map as MapIcon, ArrowLeft, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { InteractiveMap, RouteTracker } from "../../components/map";
import type { MapMarker, RouteInfo } from "../../types";

// ========================================
// Iguatu-CE test coordinates (~5km apart)
// ========================================

/** Profissional: Centro de Iguatu, próximo à Praça da Matriz */
const PROFESSIONAL_MARKER: MapMarker = {
  id: "pro-1",
  position: { lat: -6.3599, lng: -39.2984 },
  type: "professional",
  label: "João Silva",
  subtitle: "Eletricista • 4.8 ★",
};

/** Destino: Bairro Vila Centenário, Iguatu */
const DESTINATION_MARKER: MapMarker = {
  id: "dest-1",
  position: { lat: -6.3780, lng: -39.3260 },
  type: "destination",
  label: "R. Jose de Alencar, 245",
  subtitle: "Vila Centenario, Iguatu-CE",
};

/** Sinalizadores de rua ao longo da rota */
const LANDMARK_MARKERS: MapMarker[] = [
  {
    id: "landmark-1",
    position: { lat: -6.3640, lng: -39.3050 },
    type: "landmark",
    label: "Av. Perimetral Sul",
    icon: "street",
  },
  {
    id: "landmark-2",
    position: { lat: -6.3700, lng: -39.3120 },
    type: "landmark",
    label: "Rotatoria CE-292",
    icon: "reference",
  },
  {
    id: "landmark-3",
    position: { lat: -6.3750, lng: -39.3200 },
    type: "landmark",
    label: "Escola Municipal",
    icon: "reference",
  },
];

/**
 * MapView — Full-page interactive map demonstration.
 * Shows a professional in Centro de Iguatu navigating to
 * Vila Centenário (~5km), with street landmarks along the route.
 */
const MapView: React.FC = () => {
  const navigate = useNavigate();
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [viewMode, setViewMode] = useState<"client" | "professional">(
    "client"
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 backdrop-blur-sm">
        <div className="container-responsive py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <div className="flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Mapa do Servico
                </h1>
              </div>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode("client")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === "client"
                    ? "bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Visao Cliente
              </button>
              <button
                onClick={() => setViewMode("professional")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === "professional"
                    ? "bg-white dark:bg-slate-700 text-secondary-600 dark:text-secondary-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Visao Profissional
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="container-responsive py-4 space-y-4">
        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800/30 text-sm text-primary-700 dark:text-primary-400">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Demonstracao — Iguatu, CE</p>
            <p className="text-xs mt-0.5 opacity-80">
              Profissional no Centro de Iguatu → Destino na Vila Centenario
              (~5km). Sinalizadores marcam pontos de referencia na rota.
            </p>
          </div>
        </div>

        {/* Interactive Map */}
        <InteractiveMap
          professionalMarker={PROFESSIONAL_MARKER}
          destinationMarker={DESTINATION_MARKER}
          landmarkMarkers={LANDMARK_MARKERS}
          showRoute={true}
          height={500}
          onRouteInfo={setRouteInfo}
          className="shadow-lg"
        />

        {/* Route tracker overlay */}
        <RouteTracker
          routeInfo={routeInfo}
          isTracking={viewMode === "professional"}
          isProfessional={viewMode === "professional"}
        />

        {/* Marker details cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Professional card */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">J</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {PROFESSIONAL_MARKER.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {PROFESSIONAL_MARKER.subtitle}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                  {PROFESSIONAL_MARKER.position.lat.toFixed(4)},{" "}
                  {PROFESSIONAL_MARKER.position.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {/* Destination card */}
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">D</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {DESTINATION_MARKER.label}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {DESTINATION_MARKER.subtitle}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                  {DESTINATION_MARKER.position.lat.toFixed(4)},{" "}
                  {DESTINATION_MARKER.position.lng.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
```

**Step 2: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | grep -i "MapView\|map/" | head -10`
Expected: sem erros

**Step 3: Commit**

```bash
git add frontend/src/pages/services/MapView.tsx
git commit -m "feat: add MapView demo page with Iguatu-CE test data"
```

---

## Task 10: Adicionar rota no App.tsx para a página do mapa

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Adicionar import e rota**

Abrir `frontend/src/App.tsx`.

**Adicionar import** (junto com os outros imports de pages):

```typescript
import MapView from "./pages/services/MapView";
```

**Adicionar rota** dentro do `<Layout>`, na seção de rotas públicas (junto com `/services` e `/services/:id`):

```typescript
<Route path="/mapa" element={<MapView />} />
```

Posicionar logo depois da rota `/services/:id` e antes das rotas protegidas.

Também adicionar rota dentro de `/client/*` (para clientes verem o mapa do pedido):

```typescript
<Route path="orders/:id/mapa" element={<MapView />} />
```

E dentro de `/professional/*`:

```typescript
<Route path="services/:id/mapa" element={<MapView />} />
```

**Step 2: Verificar que o app compila**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: sem erros

**Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add map routes for public demo, client, and professional views"
```

---

## Task 11: Atualizar o seed para usar endereços de Iguatu-CE

**Files:**
- Modify: `backend/prisma/seed.ts`

**Step 1: Identificar o trecho de endereço no seed**

O seed atual cria um endereço com coordenadas de São Paulo (`-23.5631, -46.6544`).
Alterar para Iguatu-CE com as coordenadas corretas.

Encontrar o bloco que contém `latitude: -23.5631` e substituir os dados:

**Antes:**
```typescript
street: "Rua Augusta",
number: "1200",
complement: "Apto 45",
neighborhood: "Consolacao",
city: "Sao Paulo",
state: "SP",
zipCode: "01304-001",
latitude: -23.5631,
longitude: -46.6544,
```

**Depois:**
```typescript
street: "Rua Floriano Peixoto",
number: "320",
complement: "Casa",
neighborhood: "Centro",
city: "Iguatu",
state: "CE",
zipCode: "63500-065",
latitude: -6.3599,
longitude: -39.2984,
```

**Step 2: Adicionar um segundo endereço** (destino ~5km)

Se possível, criar mais um endereço para o segundo profissional de teste:

Procurar se existe um segundo endereço criado no seed. Se não, adicionar após a criação do primeiro endereço:

```typescript
// Second address for destination (Vila Centenário, Iguatu)
let proAddress = await prisma.address.findFirst({
  where: { userId: professional.id },
});
if (!proAddress) {
  proAddress = await prisma.address.create({
    data: {
      street: "Rua Jose de Alencar",
      number: "245",
      complement: "",
      neighborhood: "Vila Centenario",
      city: "Iguatu",
      state: "CE",
      zipCode: "63502-000",
      latitude: -6.3780,
      longitude: -39.3260,
      userId: professional.id,
    },
  });
}
```

**Step 3: Testar o seed**

Run: `cd /home/levybonito/faztudo-main/backend && npm run db:seed 2>&1 | tail -20`
Expected: seed roda sem erros

**Step 4: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: update seed addresses to Iguatu-CE with coordinates for map demo"
```

---

## Task 12: Testar build completo e verificar integração

**Files:** Nenhum novo — apenas verificação.

**Step 1: Type check do frontend**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: sem erros

**Step 2: Lint do frontend**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run lint 2>&1 | tail -20`
Expected: sem erros novos (warnings existentes são OK)

**Step 3: Type check do backend**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: sem erros

**Step 4: Testes do backend**

Run: `cd /home/levybonito/faztudo-main/backend && npm test 2>&1 | tail -30`
Expected: todos os testes passam (nenhuma regressão)

**Step 5: Build de produção do frontend**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run build 2>&1 | tail -20`
Expected: build completa sem erros

**Step 6: Commit final (se houve ajustes)**

Se foi necessário ajustar algo nos passos acima, commitar:

```bash
git add -A
git commit -m "fix: resolve build/lint issues in map components"
```

---

## Resumo da Estrutura Final

```
frontend/src/
├── components/
│   └── map/                          ← NOVO
│       ├── index.ts                  # Barrel export
│       ├── InteractiveMap.tsx        # Componente principal (APIProvider + Map)
│       ├── ProfessionalMarker.tsx    # Marcador azul animado do profissional
│       ├── DestinationMarker.tsx     # Marcador vermelho do destino (casa)
│       ├── LandmarkMarker.tsx        # Sinalizadores (rua, referência, aviso)
│       ├── MapLegend.tsx             # Legenda flutuante colapsável
│       └── RouteTracker.tsx          # Overlay de distância/tempo + controles
│
├── pages/
│   └── services/
│       └── MapView.tsx               ← NOVO (demo page, Iguatu-CE)
│
├── types/
│   ├── map.ts                        ← NOVO (LatLng, MapMarker, RouteInfo, etc.)
│   └── index.ts                      ← MODIFICADO (+ export map)
│
└── App.tsx                           ← MODIFICADO (+ rotas /mapa)

backend/
└── prisma/
    └── seed.ts                       ← MODIFICADO (endereços Iguatu-CE)
```

**Total de arquivos novos:** 8
**Total de arquivos modificados:** 3 (types/index.ts, App.tsx, seed.ts)
