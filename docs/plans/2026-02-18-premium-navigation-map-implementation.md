# Premium Navigation Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir o WazeMap.tsx (React-Leaflet + tiles raster) por um mapa premium GPU-rendered com MapLibre GL JS, camera que gira com bearing, pitch 3D e HUD glass morphism — sem referencias a "Waze" nos nomes.

**Architecture:** MapLibre GL JS via react-map-gl (wrapper React oficial) com tiles vetoriais do MapTiler (free tier). Toda a logica de negocio existente (polling de localizacao, Google Directions API, useGeolocation, useRouteTracking) e mantida integralmente — apenas a camada de rendering e trocada.

**Tech Stack:** `maplibre-gl` v4, `react-map-gl` v8 (`react-map-gl/maplibre`), MapTiler tiles vetoriais, TypeScript, TailwindCSS

---

## Contexto para o Implementador

### Codebase relevante (leia antes de comecar)
- `frontend/src/components/map/WazeMap.tsx` — componente atual que sera SUBSTITUIDO
- `frontend/src/components/map/wazeConstants.ts` — constantes atuais, serao substituidas
- `frontend/src/components/map/wazeIcons.ts` — icones Leaflet atuais, serao substituidos
- `frontend/src/components/map/WazeInfoBar.tsx` — HUD atual, sera substituido
- `frontend/src/components/map/WazeControls.tsx` — controles atuais, serao substituidos
- `frontend/src/hooks/useGeolocation.ts` — hook de GPS (NAO MODIFICAR)
- `frontend/src/hooks/useRouteTracking.ts` — hook de rota (NAO MODIFICAR)
- `frontend/src/services/geocodingService.ts` — servico de geocoding (NAO MODIFICAR)
- `frontend/src/types/map.ts` — tipos do mapa (adicionar NavigationMapProps)
- `frontend/src/pages/orders/OrderDetails.tsx` — usa WazeMap, linha 26 e 676/792
- `frontend/src/components/map/index.ts` — barrel exports

### Como a autenticacao da API funciona
- MapTiler key: variavel de ambiente `VITE_MAPTILER_KEY` no frontend
- Endpoint de estilo: `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`
- Google Geocoding/Directions: ja funcionam via proxy no backend (NAO MUDAR)

### Estrutura de dados (origin/destination) — NAO MUDA

origin: { lat: number; lng: number; bearing: number | null } | null
destination: { lat: number; lng: number } | null

### Como o routePolyline e desenhado atualmente (Leaflet -> MapLibre)
- Leaflet: Polyline component com positions array
- MapLibre: Source + Layer com GeoJSON LineString — veja Task 6

---

## Task 1: Instalar dependencias e configurar ambiente

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `frontend/.env.example`
- Modify: `frontend/.env` (variavel local)

**Step 1: Instalar maplibre-gl e react-map-gl**

```bash
cd /home/levybonito/faztudo-main/frontend
npm install maplibre-gl react-map-gl
```

Resultado esperado: `added X packages` sem erros.

**Step 2: Adicionar VITE_MAPTILER_KEY ao .env.example**

Editar `frontend/.env.example`, adicionar abaixo de `VITE_ADMIN_URL`:

```
# Map tiles (MapTiler - free tier: 100k loads/month)
# Get key at: https://www.maptiler.com/cloud/
VITE_MAPTILER_KEY=your_maptiler_key_here
```

**Step 3: Adicionar chave real ao .env local**

```bash
# Abrir frontend/.env e adicionar:
# VITE_MAPTILER_KEY=sua_chave_aqui
```

ATENCAO: Voce precisa criar uma conta gratuita em https://www.maptiler.com/cloud/ e gerar uma API key. O plano gratuito tem 100.000 tile loads/mes.

**Step 4: Verificar que maplibre-gl aparece no package.json**

```bash
cat frontend/package.json | grep -E "maplibre|react-map-gl"
```

Resultado esperado:
- "maplibre-gl": "^4.x.x"
- "react-map-gl": "^8.x.x"

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/package.json frontend/package-lock.json frontend/.env.example
git commit -m "feat: install maplibre-gl and react-map-gl dependencies"
```

---

## Task 2: Criar mapConstants.ts (substitui wazeConstants.ts)

**Files:**
- Create: `frontend/src/components/map/mapConstants.ts`

**Step 1: Criar o arquivo com todas as constantes premium**

Criar `frontend/src/components/map/mapConstants.ts` com o seguinte conteudo:

```typescript
/** Map zoom levels */
export const ZOOM = {
  DEFAULT: 13,
  NAVIGATION: 16,
  CLOSE: 18,
} as const;

/** Camera pitch (degrees) */
export const PITCH = {
  FLAT: 0,
  NAVIGATION: 30,
  CLIENT_VIEW: 10,
} as const;

/** Animation durations in ms */
export const ANIMATION = {
  FLY_DURATION: 2000,
  EASE_DURATION: 800,
  CENTER_DURATION: 1000,
} as const;

/** MapLibre GL style URL — uses VITE_MAPTILER_KEY */
export const MAP_STYLE = {
  dark: (key: string) =>
    `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`,
  light: (key: string) =>
    `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`,
} as const;

/** Polling and update intervals in ms */
export const INTERVALS = {
  LOCATION_UPDATE: 5000,
  LOCATION_POLL: 5000,
} as const;

/** Trailing points shown behind professional */
export const TRAIL = {
  FADING_POINTS: 5,
} as const;

/** Route line style for MapLibre GL layers */
export const ROUTE_LAYER_STYLE = {
  REMAINING: {
    "line-color": "#3b82f6",
    "line-width": 6,
    "line-opacity": 0.9,
    "line-cap": "round" as const,
    "line-join": "round" as const,
  },
  FADING: {
    "line-color": "#93c5fd",
    "line-width": 5,
    "line-opacity": 0.35,
    "line-dasharray": [4, 8],
  },
} as const;

/** Default fallback coordinates (Iguatu, CE) */
export const FALLBACK_COORDS = { lat: -6.3629, lng: -39.2943 } as const;

/** Map fit bounds padding */
export const FIT_BOUNDS_PADDING = {
  top: 100,
  bottom: 80,
  left: 60,
  right: 60,
} as const;

/** Easing function for camera animations (easeInOutQuad) */
export const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
```

**Step 2: Verificar TypeScript**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: nenhum erro novo.

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/components/map/mapConstants.ts
git commit -m "feat: add mapConstants for premium navigation map"
```

---

## Task 3: Criar mapStyle.ts (helpers de estilo GL)

**Files:**
- Create: `frontend/src/components/map/mapStyle.ts`

**Step 1: Criar o arquivo**

Criar `frontend/src/components/map/mapStyle.ts`:

```typescript
/**
 * Layer IDs for the route drawn on top of the MapTiler base style.
 */
export const ROUTE_LAYER_IDS = {
  REMAINING: "faztudo-route-remaining",
  FADING: "faztudo-route-fading",
  SOURCE: "faztudo-route-source",
  FADING_SOURCE: "faztudo-route-fading-source",
} as const;

/**
 * Convert an array of [lat, lng] tuples to a GeoJSON LineString Feature.
 * MapLibre expects [lng, lat] order (GeoJSON standard).
 */
export function toGeoJSONLineString(
  points: Array<[number, number]>
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: points.map(([lat, lng]) => [lng, lat]),
    },
  };
}

/**
 * Empty GeoJSON FeatureCollection for clearing sources.
 */
export function emptyGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}
```

**Step 2: Instalar tipos GeoJSON se necessario**

```bash
cd /home/levybonito/faztudo-main/frontend
npm install --save-dev @types/geojson
```

**Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "mapStyle" | head -10
```

**Step 4: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/components/map/mapStyle.ts
git commit -m "feat: add mapStyle helpers for GL route layers"
```

---

## Task 4: Criar mapIcons.ts (marcadores DOM para MapLibre)

**Files:**
- Create: `frontend/src/components/map/mapIcons.ts`

NOTA: No MapLibre GL com react-map-gl, marcadores customizados sao elementos DOM normais.
Diferente do Leaflet que usa L.divIcon, aqui criamos elementos HTMLDivElement.
A rotacao do avatar e aplicada via CSS transform inline e atualizada por useEffect no componente pai.

**Step 1: Criar mapIcons.ts**

Criar `frontend/src/components/map/mapIcons.ts`:

```typescript
/**
 * Creates a DOM element for the professional avatar marker.
 * Rotates based on bearing for navigation feel.
 */
export function createProfessionalMarkerElement(bearing: number | null): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "width: 56px",
    "height: 56px",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "pointer-events: auto",
  ].join("; ");

  const rotation = bearing !== null ? `rotate(${bearing}deg)` : "";

  // Inner container (rotates)
  const inner = document.createElement("div");
  inner.style.cssText = [
    "width: 52px",
    "height: 52px",
    "position: relative",
    `transform: ${rotation}`,
    "transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
  ].join("; ");

  // Arrow (direction indicator above circle)
  if (bearing !== null) {
    const arrow = document.createElement("div");
    arrow.style.cssText = [
      "position: absolute",
      "top: -9px",
      "left: 50%",
      "transform: translateX(-50%)",
      "width: 0",
      "height: 0",
      "border-left: 8px solid transparent",
      "border-right: 8px solid transparent",
      "border-bottom: 11px solid #2563eb",
      "filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
    ].join("; ");
    inner.appendChild(arrow);
  }

  // Avatar circle
  const circle = document.createElement("div");
  circle.style.cssText = [
    "width: 48px",
    "height: 48px",
    "background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    "border: 3px solid white",
    "border-radius: 50%",
    "box-shadow: 0 0 0 6px rgba(59,130,246,0.15), 0 4px 16px rgba(0,0,0,0.35)",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "animation: nav-glow-pulse 2s ease-in-out infinite",
  ].join("; ");

  // Wrench SVG icon
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "white");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z");
  svg.appendChild(path);
  circle.appendChild(svg);

  inner.appendChild(circle);
  wrapper.appendChild(inner);
  return wrapper;
}

/**
 * Creates a DOM element for the destination pin marker.
 * Pin-style (circle + triangle tail) in green.
 */
export function createDestinationMarkerElement(houseNumber?: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "width: 48px",
    "height: 64px",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "pointer-events: auto",
    "position: relative",
  ].join("; ");

  // Container
  const container = document.createElement("div");
  container.style.cssText = [
    "position: relative",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
  ].join("; ");

  // Circle
  const circle = document.createElement("div");
  circle.style.cssText = [
    "width: 44px",
    "height: 44px",
    "background: linear-gradient(135deg, #10b981 0%, #059669 100%)",
    "border: 3px solid white",
    "border-radius: 50%",
    "box-shadow: 0 0 0 4px rgba(16,185,129,0.2), 0 4px 16px rgba(0,0,0,0.3)",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "animation: nav-dest-pulse 3s ease-in-out infinite",
    "position: relative",
  ].join("; ");

  // Home SVG
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "white");
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path1 = document.createElementNS(svgNS, "path");
  path1.setAttribute("d", "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z");
  const polyline = document.createElementNS(svgNS, "polyline");
  polyline.setAttribute("points", "9 22 9 12 15 12 15 22");
  svg.appendChild(path1);
  svg.appendChild(polyline);
  circle.appendChild(svg);

  // House number badge
  if (houseNumber) {
    const badge = document.createElement("span");
    badge.textContent = houseNumber;
    badge.style.cssText = [
      "position: absolute",
      "bottom: -6px",
      "left: 50%",
      "transform: translateX(-50%)",
      "background: white",
      "color: #059669",
      "font-size: 10px",
      "font-weight: 700",
      "padding: 1px 5px",
      "border-radius: 6px",
      "white-space: nowrap",
      "box-shadow: 0 1px 4px rgba(0,0,0,0.2)",
      "line-height: 1.4",
      "font-family: system-ui, -apple-system, sans-serif",
    ].join("; ");
    circle.appendChild(badge);
  }

  // Pin tail (triangle)
  const tail = document.createElement("div");
  tail.style.cssText = [
    "width: 0",
    "height: 0",
    "border-left: 6px solid transparent",
    "border-right: 6px solid transparent",
    "border-top: 10px solid #059669",
    "margin-top: -2px",
  ].join("; ");

  container.appendChild(circle);
  container.appendChild(tail);
  wrapper.appendChild(container);
  return wrapper;
}

/**
 * Alert marker DOM element — small colored circle with SVG icon.
 */
export function createAlertMarkerElement(type: string): HTMLDivElement {
  const bgColors: Record<string, string> = {
    speed_bump: "#f59e0b",
    traffic_signal: "#ef4444",
    curve: "#f59e0b",
    construction: "#f97316",
    roundabout: "#3b82f6",
    flood_prone: "#06b6d4",
    unpaved: "#78716c",
  };

  const bg = bgColors[type] ?? "#6b7280";

  const el = document.createElement("div");
  el.style.cssText = [
    "width: 26px",
    "height: 26px",
    `background: ${bg}`,
    "border: 2px solid white",
    "border-radius: 50%",
    "box-shadow: 0 1px 6px rgba(0,0,0,0.35)",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "cursor: pointer",
  ].join("; ");

  return el;
}
```

**Step 2: Verificar TypeScript**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | grep "mapIcons" | head -10
```

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/components/map/mapIcons.ts
git commit -m "feat: add DOM marker creators for MapLibre (no innerHTML)"
```

---

## Task 5: Criar NavInfoBar.tsx (HUD premium)

**Files:**
- Create: `frontend/src/components/map/NavInfoBar.tsx`

**Step 1: Criar NavInfoBar.tsx**

Criar `frontend/src/components/map/NavInfoBar.tsx`:

```tsx
import React, { useMemo } from "react";
import { Navigation, Clock } from "lucide-react";

interface NavInfoBarProps {
  distance: string;
  duration: string;
  professionalName: string;
  isTracking: boolean;
  isProfessional: boolean;
}

function parseDurationToMinutes(duration: string): number {
  let total = 0;
  const hoursMatch = duration.match(/(\d+)\s*h/i);
  const minsMatch = duration.match(/(\d+)\s*m/i);
  if (hoursMatch) total += parseInt(hoursMatch[1]) * 60;
  if (minsMatch) total += parseInt(minsMatch[1]);
  return total || 0;
}

function formatETA(duration: string): string {
  const minutes = parseDurationToMinutes(duration);
  if (minutes === 0) return duration;
  const eta = new Date(Date.now() + minutes * 60 * 1000);
  return "Chega as " + eta.getHours().toString().padStart(2, "0") + ":" + eta.getMinutes().toString().padStart(2, "0");
}

const NavInfoBar: React.FC<NavInfoBarProps> = ({
  distance,
  duration,
  professionalName,
  isTracking,
  isProfessional,
}) => {
  const eta = useMemo(() => formatETA(duration), [duration]);

  if (!isTracking) return null;

  const glassBg: React.CSSProperties = {
    background: "rgba(10, 15, 25, 0.92)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-sm animate-slide-up">
      <div className="rounded-2xl px-4 py-3 border border-white/10" style={glassBg}>
        {/* Live chip */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
            {isProfessional ? "Navegando" : "Ao vivo"}
          </span>
        </div>

        {/* Professional name (client view only) */}
        {!isProfessional && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
            >
              {professionalName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-white/90">
              {professionalName} esta a caminho
            </span>
          </div>
        )}

        {/* Route stats */}
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(59,130,246,0.15)" }}
            >
              <Navigation className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Distancia</div>
              <div className="text-base font-bold text-white">{distance}</div>
            </div>
          </div>

          <div className="w-px h-9 bg-white/10" />

          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.15)" }}
            >
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Tempo</div>
              <div className="text-base font-bold text-white">{duration}</div>
            </div>
          </div>
        </div>

        {/* ETA (client view only) */}
        {!isProfessional && (
          <div className="mt-3 pt-3 border-t border-white/10 text-center">
            <span className="text-xs text-white/50">{eta}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavInfoBar;
```

**Step 2: Verificar TypeScript**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | grep "NavInfoBar" | head -10
```

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/components/map/NavInfoBar.tsx
git commit -m "feat: add NavInfoBar premium HUD with glass morphism"
```

---

## Task 6: Criar NavControls.tsx

**Files:**
- Create: `frontend/src/components/map/NavControls.tsx`

**Step 1: Criar NavControls.tsx**

Criar `frontend/src/components/map/NavControls.tsx`:

```tsx
import React from "react";
import { Plus, Minus, Crosshair, AlertTriangle, Compass } from "lucide-react";

interface NavControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onToggleAlerts: () => void;
  onNorth?: () => void;
  alertsEnabled: boolean;
}

const NavControls: React.FC<NavControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onCenter,
  onToggleAlerts,
  onNorth,
  alertsEnabled,
}) => {
  const glassBg: React.CSSProperties = {
    background: "rgba(10, 15, 25, 0.75)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
  };

  const alertActiveBg: React.CSSProperties = {
    background: "rgba(245,158,11,0.2)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(245,158,11,0.3)",
  };

  const btnClass =
    "w-11 h-11 rounded-xl flex items-center justify-center text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition-all duration-150 active:scale-90";

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
      <button onClick={onZoomIn} className={btnClass} style={glassBg} title="Aproximar">
        <Plus className="w-5 h-5" />
      </button>
      <button onClick={onZoomOut} className={btnClass} style={glassBg} title="Afastar">
        <Minus className="w-5 h-5" />
      </button>

      <div className="w-6 mx-auto h-px bg-white/10" />

      <button onClick={onCenter} className={btnClass} style={glassBg} title="Centralizar posicao">
        <Crosshair className="w-5 h-5" />
      </button>

      {onNorth && (
        <button onClick={onNorth} className={btnClass} style={glassBg} title="Apontar para o Norte">
          <Compass className="w-5 h-5" />
        </button>
      )}

      <div className="w-6 mx-auto h-px bg-white/10" />

      <button
        onClick={onToggleAlerts}
        className={`${btnClass} ${alertsEnabled ? "text-amber-400 hover:text-amber-300" : ""}`}
        style={alertsEnabled ? alertActiveBg : glassBg}
        title={alertsEnabled ? "Ocultar alertas" : "Mostrar alertas"}
      >
        <AlertTriangle className="w-5 h-5" />
      </button>
    </div>
  );
};

export default NavControls;
```

**Step 2: Verificar TypeScript**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | grep "NavControls" | head -10
```

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/components/map/NavControls.tsx
git commit -m "feat: add NavControls glass morphism map controls"
```

---

## Task 7: Criar hook useMapCamera.ts

**Files:**
- Create: `frontend/src/hooks/useMapCamera.ts`

NOTA: Este hook encapsula toda a logica de camera do MapLibre.
O tipo MapRef vem de react-map-gl/maplibre.

**Step 1: Criar useMapCamera.ts**

Criar `frontend/src/hooks/useMapCamera.ts`:

```typescript
import { useCallback } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import {
  ZOOM,
  PITCH,
  ANIMATION,
  FIT_BOUNDS_PADDING,
  easeInOutQuad,
} from "../components/map/mapConstants";

interface CameraTarget {
  lat: number;
  lng: number;
  bearing?: number | null;
}

interface BoundsTarget {
  points: Array<{ lat: number; lng: number }>;
}

interface UseMapCameraOptions {
  mapRef: React.RefObject<MapRef | null>;
}

export function useMapCamera({ mapRef }: UseMapCameraOptions) {
  const getMap = useCallback(() => mapRef.current?.getMap(), [mapRef]);

  const followTarget = useCallback(
    (target: CameraTarget) => {
      const map = getMap();
      if (!map) return;
      map.easeTo({
        center: [target.lng, target.lat],
        bearing: target.bearing ?? 0,
        pitch: PITCH.NAVIGATION,
        zoom: ZOOM.NAVIGATION,
        duration: ANIMATION.EASE_DURATION,
        easing: easeInOutQuad,
      });
    },
    [getMap]
  );

  const fitBounds = useCallback(
    ({ points }: BoundsTarget) => {
      const map = getMap();
      if (!map || points.length < 2) return;

      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];

      map.fitBounds(bounds, {
        padding: FIT_BOUNDS_PADDING,
        bearing: 0,
        pitch: PITCH.CLIENT_VIEW,
        duration: ANIMATION.FLY_DURATION,
      });
    },
    [getMap]
  );

  const flyToInitial = useCallback(
    (target: CameraTarget) => {
      const map = getMap();
      if (!map) return;
      map.flyTo({
        center: [target.lng, target.lat],
        zoom: ZOOM.NAVIGATION,
        bearing: 0,
        pitch: 0,
        duration: ANIMATION.FLY_DURATION,
        curve: 1.5,
      });
    },
    [getMap]
  );

  const zoomIn = useCallback(() => {
    getMap()?.zoomIn({ duration: 200 });
  }, [getMap]);

  const zoomOut = useCallback(() => {
    getMap()?.zoomOut({ duration: 200 });
  }, [getMap]);

  const centerOn = useCallback(
    (target: CameraTarget) => {
      const map = getMap();
      if (!map) return;
      map.easeTo({
        center: [target.lng, target.lat],
        duration: ANIMATION.CENTER_DURATION,
        easing: easeInOutQuad,
      });
    },
    [getMap]
  );

  const resetNorth = useCallback(() => {
    getMap()?.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }, [getMap]);

  return {
    followTarget,
    fitBounds,
    flyToInitial,
    zoomIn,
    zoomOut,
    centerOn,
    resetNorth,
  };
}
```

**Step 2: Verificar TypeScript**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | grep "useMapCamera" | head -10
```

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/hooks/useMapCamera.ts
git commit -m "feat: add useMapCamera hook for GL camera control"
```

---

## Task 8: Criar NavigationMap.tsx (componente principal)

**Files:**
- Create: `frontend/src/components/map/NavigationMap.tsx`

ATENCAO: Leia WazeMap.tsx inteiro antes de implementar.
A logica de negocio (geocoding, polling, route tracking) e COPIADA INTEGRALMENTE.
Apenas a camada de rendering muda (Leaflet -> MapLibre GL).

Import critico: import Map from "react-map-gl/maplibre" — note o /maplibre no final.
CSS obrigatorio: import "maplibre-gl/dist/maplibre-gl.css"
Ref do mapa: useRef<MapRef>(null) onde MapRef vem de react-map-gl/maplibre

**Step 1: Criar NavigationMap.tsx**

Criar `frontend/src/components/map/NavigationMap.tsx`:

```tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, AlertCircle, Clock, Navigation, X } from "lucide-react";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useRouteTracking } from "../../hooks/useRouteTracking";
import { useMapCamera } from "../../hooks/useMapCamera";
import {
  startRoute as apiStartRoute,
  updateProfessionalLocation,
  getProfessionalLocation,
  clearProfessionalLocation,
} from "../../services/serviceService";
import { geocode } from "../../services/geocodingService";
import {
  createProfessionalMarkerElement,
  createDestinationMarkerElement,
  createAlertMarkerElement,
} from "./mapIcons";
import NavInfoBar from "./NavInfoBar";
import NavControls from "./NavControls";
import {
  ZOOM,
  PITCH,
  INTERVALS,
  ROUTE_LAYER_STYLE,
  FALLBACK_COORDS,
  MAP_STYLE,
} from "./mapConstants";
import { toGeoJSONLineString, emptyGeoJSON, ROUTE_LAYER_IDS } from "./mapStyle";
import { useToast } from "../../context/ToastContext";
import { useTheme } from "../../context/ThemeContext";
import type { NavigationMapProps } from "../../types";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY ?? "";

const NavigationMap: React.FC<NavigationMapProps> = ({
  orderId,
  isProfessional,
  professionalName,
  destinationAddress,
  orderStatus: _orderStatus,
}) => {
  const toast = useToast();
  const { theme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const camera = useMapCamera({ mapRef });
  const avatarElRef = useRef<HTMLDivElement | null>(null);

  const [routeStarted, setRouteStarted] = useState(false);
  const [professionalPos, setProfessionalPos] = useState<{
    lat: number;
    lng: number;
    bearing: number | null;
  } | null>(null);
  const [startingRoute, setStartingRoute] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(
    destinationAddress.latitude && destinationAddress.longitude
      ? { lat: destinationAddress.latitude, lng: destinationAddress.longitude }
      : null
  );
  const [geocodingDest, setGeocodingDest] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Geocode destination if no lat/lng
  useEffect(() => {
    if (destination) return;
    const doGeocode = async () => {
      setGeocodingDest(true);
      try {
        const addressStr = [
          destinationAddress.street,
          destinationAddress.number,
          destinationAddress.neighborhood,
          destinationAddress.city,
          destinationAddress.state,
          "Brasil",
        ].join(", ");
        const result = await geocode(addressStr);
        setDestination(result ?? FALLBACK_COORDS);
      } catch {
        toast.error("Erro", "Nao foi possivel localizar o endereco de destino.");
        setDestination(FALLBACK_COORDS);
      } finally {
        setGeocodingDest(false);
      }
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
        // silent fail
      }
    },
    [orderId, routeStarted]
  );

  const geo = useGeolocation({
    watchPosition: isProfessional && routeStarted,
    enableHighAccuracy: true,
    updateInterval: INTERVALS.LOCATION_UPDATE,
    onUpdate: isProfessional ? handleLocationUpdate : undefined,
  });

  // Client: poll professional location
  useEffect(() => {
    if (isProfessional) return;
    const pollLocation = async () => {
      try {
        const loc = await getProfessionalLocation(orderId);
        if (loc) {
          setProfessionalPos({ lat: loc.lat, lng: loc.lng, bearing: loc.bearing ?? null });
        }
      } catch {
        // silent fail
      }
    };
    pollLocation();
    pollIntervalRef.current = setInterval(pollLocation, INTERVALS.LOCATION_POLL);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isProfessional, orderId]);

  const origin = isProfessional
    ? geo.latitude && geo.longitude
      ? { lat: geo.latitude, lng: geo.longitude, bearing: geo.bearing }
      : null
    : professionalPos;

  const {
    routeInfo,
    routePolyline,
    alerts,
    progressIndex,
    remainingPolyline,
    fadingPolyline,
    clearRoute,
  } = useRouteTracking({ origin, destination });

  // Camera control
  useEffect(() => {
    if (!mapLoaded) return;
    if (routeStarted && origin) {
      camera.followTarget({ lat: origin.lat, lng: origin.lng, bearing: origin.bearing });
    } else if (origin && destination) {
      camera.fitBounds({ points: [origin, destination] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, routeStarted, origin?.lat, origin?.lng, origin?.bearing, destination?.lat, destination?.lng]);

  // Update avatar bearing via DOM mutation
  const avatarBearing = isProfessional ? geo.bearing : professionalPos?.bearing ?? null;
  useEffect(() => {
    if (!avatarElRef.current) return;
    const inner = avatarElRef.current.querySelector("div > div") as HTMLDivElement | null;
    if (!inner) return;
    inner.style.transform = avatarBearing !== null ? `rotate(${avatarBearing}deg)` : "";
  }, [avatarBearing]);

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

  const handleStopRoute = async () => {
    try {
      setRouteStarted(false);
      geo.stopWatching();
      await clearProfessionalLocation(orderId);
      clearRoute();
    } catch {
      // silent fail
    }
  };

  // GeoJSON for route layers
  const remainingGeoJSON =
    remainingPolyline.length > 1 ? toGeoJSONLineString(remainingPolyline) : emptyGeoJSON();
  const fadingGeoJSON =
    fadingPolyline.length > 1 && routeStarted
      ? toGeoJSONLineString(fadingPolyline)
      : emptyGeoJSON();

  // Map style
  const mapStyleUrl = MAPTILER_KEY
    ? theme === "dark"
      ? MAP_STYLE.dark(MAPTILER_KEY)
      : MAP_STYLE.light(MAPTILER_KEY)
    : "https://demotiles.maplibre.org/style.json";

  // Loading states
  if (isProfessional && geo.loading && !geo.latitude) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
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
      <div className="flex items-center justify-center h-48 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Localizando endereco...
      </div>
    );
  }

  const isFollowing = routeStarted && !!origin;
  const destinationLabel = destinationAddress.street + ", " + destinationAddress.number;

  return (
    <div className="space-y-4">
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          height: "420px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
      >
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: destination.lng,
            latitude: destination.lat,
            zoom: ZOOM.DEFAULT,
            pitch: PITCH.FLAT,
            bearing: 0,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyleUrl}
          attributionControl={false}
          onLoad={() => setMapLoaded(true)}
        >
          {/* Fading trail */}
          <Source id={ROUTE_LAYER_IDS.FADING_SOURCE} type="geojson" data={fadingGeoJSON}>
            <Layer
              id={ROUTE_LAYER_IDS.FADING}
              type="line"
              paint={{
                "line-color": ROUTE_LAYER_STYLE.FADING["line-color"],
                "line-width": ROUTE_LAYER_STYLE.FADING["line-width"],
                "line-opacity": ROUTE_LAYER_STYLE.FADING["line-opacity"],
                "line-dasharray": [4, 8],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>

          {/* Remaining route */}
          <Source id={ROUTE_LAYER_IDS.SOURCE} type="geojson" data={remainingGeoJSON}>
            <Layer
              id={ROUTE_LAYER_IDS.REMAINING}
              type="line"
              paint={{
                "line-color": ROUTE_LAYER_STYLE.REMAINING["line-color"],
                "line-width": ROUTE_LAYER_STYLE.REMAINING["line-width"],
                "line-opacity": ROUTE_LAYER_STYLE.REMAINING["line-opacity"],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>

          {/* Road alerts */}
          {alertsEnabled &&
            alerts.map((alert) => (
              <Marker
                key={alert.id}
                longitude={alert.position.lng}
                latitude={alert.position.lat}
                anchor="center"
              >
                <div
                  ref={(el) => {
                    if (el && el.childElementCount === 0) {
                      el.appendChild(createAlertMarkerElement(alert.type));
                    }
                  }}
                  title={alert.description}
                />
              </Marker>
            ))}

          {/* Destination marker */}
          <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
            <div
              ref={(el) => {
                if (el && el.childElementCount === 0) {
                  el.appendChild(createDestinationMarkerElement(destinationAddress.number));
                }
              }}
              title={destinationLabel}
            />
          </Marker>

          {/* Professional avatar */}
          {origin && (
            <Marker
              key={`${origin.lat}-${origin.lng}`}
              longitude={origin.lng}
              latitude={origin.lat}
              anchor="center"
            >
              <div
                ref={(el) => {
                  if (el && el.childElementCount === 0) {
                    const icon = createProfessionalMarkerElement(avatarBearing);
                    el.appendChild(icon);
                    avatarElRef.current = el;
                  }
                }}
                title={professionalName}
              />
            </Marker>
          )}
        </Map>

        {/* HUD overlays */}
        {routeInfo && (
          <NavInfoBar
            distance={routeInfo.distance}
            duration={routeInfo.duration}
            professionalName={professionalName}
            isTracking={routeStarted || !!professionalPos}
            isProfessional={isProfessional}
          />
        )}

        <NavControls
          onZoomIn={camera.zoomIn}
          onZoomOut={camera.zoomOut}
          onCenter={() => origin && camera.centerOn({ lat: origin.lat, lng: origin.lng })}
          onToggleAlerts={() => setAlertsEnabled(!alertsEnabled)}
          onNorth={!isFollowing ? camera.resetNorth : undefined}
          alertsEnabled={alertsEnabled}
        />

        {/* Stop button */}
        {isProfessional && routeStarted && (
          <button
            onClick={handleStopRoute}
            className="absolute bottom-4 right-4 z-[1000] w-11 h-11 rounded-xl text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "rgba(239,68,68,0.9)", backdropFilter: "blur(8px)" }}
            title="Parar rastreamento"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Attribution */}
        <div className="absolute bottom-2 left-2 z-[1000] text-[9px] text-white/30">
          © MapTiler © OpenStreetMap
        </div>
      </div>

      {/* Start route button */}
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

      {/* Client waiting */}
      {!isProfessional && !professionalPos && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-sm text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
          <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
          Aguardando o profissional iniciar o trajeto...
        </div>
      )}
    </div>
  );
};

export default NavigationMap;
```

**Step 2: Verificar TypeScript (vai falhar com NavigationMapProps)**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | grep "NavigationMap" | head -20
```

Resultado esperado: erro sobre NavigationMapProps not found — normal, resolve na Task 9.

**Step 3: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/components/map/NavigationMap.tsx
git commit -m "feat: add NavigationMap MapLibre GL component (types pending)"
```

---

## Task 9: Atualizar tipos e exports

**Files:**
- Modify: `frontend/src/types/map.ts`
- Modify: `frontend/src/components/map/index.ts`

**Step 1: Adicionar NavigationMapProps ao map.ts**

Abrir `frontend/src/types/map.ts` e adicionar APOS a interface WazeMapProps existente:

```typescript
/**
 * Props for NavigationMap component (premium GL-rendered navigation map).
 * Same shape as WazeMapProps for backward compatibility.
 */
export interface NavigationMapProps {
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
```

**Step 2: Verificar que types/index.ts exporta map.ts**

```bash
grep "map" /home/levybonito/faztudo-main/frontend/src/types/index.ts
```

Se nao tiver `export * from "./map"`, adicionar ao arquivo.

**Step 3: Atualizar frontend/src/components/map/index.ts**

Substituir o conteudo por:

```typescript
// Premium navigation map (MapLibre GL)
export { default as NavigationMap } from "./NavigationMap";
export { default as NavInfoBar } from "./NavInfoBar";
export { default as NavControls } from "./NavControls";

// Legacy components (still in use)
export { default as InteractiveMap } from "./InteractiveMap";
export { default as ProfessionalLocationMap } from "./ProfessionalLocationMap";
export { default as MapLegend } from "./MapLegend";
export { default as RouteTracker } from "./RouteTracker";
export { default as LocationPicker } from "./LocationPicker";

// WazeMap kept as alias (backward compat)
export { default as WazeMap } from "./WazeMap";
```

**Step 4: Verificar TypeScript**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | head -30
```

Resultado esperado: sem erros sobre NavigationMapProps.

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/types/map.ts frontend/src/components/map/index.ts
git commit -m "feat: add NavigationMapProps types and update map exports"
```

---

## Task 10: Trocar WazeMap por NavigationMap em OrderDetails

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`

**Step 1: Substituir o import (linha 26)**

De:
```typescript
import { WazeMap } from "../../components/map";
```

Para:
```typescript
import { NavigationMap } from "../../components/map";
```

**Step 2: Substituir os dois usos do componente**

```bash
sed -i 's/<WazeMap/<NavigationMap/g' /home/levybonito/faztudo-main/frontend/src/pages/orders/OrderDetails.tsx
```

**Step 3: Verificar substituicao**

```bash
grep -n "WazeMap\|NavigationMap" /home/levybonito/faztudo-main/frontend/src/pages/orders/OrderDetails.tsx | head -10
```

Resultado esperado: apenas NavigationMap, sem WazeMap.

**Step 4: Verificar TypeScript**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit 2>&1 | head -20
```

Resultado esperado: sem erros.

**Step 5: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: use NavigationMap in OrderDetails"
```

---

## Task 11: Adicionar animacoes CSS globais

**Files:**
- Modify: `frontend/src/index.css` (verificar qual CSS global existe)

**Step 1: Verificar arquivo CSS global**

```bash
ls /home/levybonito/faztudo-main/frontend/src/*.css
```

**Step 2: Adicionar keyframes ao final do CSS global**

```css
/* Navigation Map Animations */
@keyframes nav-glow-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 6px rgba(59, 130, 246, 0.15),
      0 4px 16px rgba(0, 0, 0, 0.35);
  }
  50% {
    box-shadow:
      0 0 0 10px rgba(59, 130, 246, 0.08),
      0 4px 20px rgba(59, 130, 246, 0.3);
  }
}

@keyframes nav-dest-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
```

**Step 3: Verificar build**

```bash
cd /home/levybonito/faztudo-main/frontend
npm run build 2>&1 | tail -10
```

Resultado esperado: build concluido sem erros.

**Step 4: Commit**

```bash
cd /home/levybonito/faztudo-main
git add frontend/src/*.css
git commit -m "feat: add navigation map CSS keyframe animations"
```

---

## Task 12: Verificacao final e teste manual

**Step 1: Iniciar backend**

```bash
cd /home/levybonito/faztudo-main/backend && npm run dev
```

Verificar: Server running on http://localhost:3001

**Step 2: Iniciar frontend (novo terminal)**

```bash
cd /home/levybonito/faztudo-main/frontend && npm run dev
```

Verificar: Local: http://localhost:5173

**Step 3: Seed do banco (se necessario)**

```bash
cd /home/levybonito/faztudo-main/backend && npm run db:seed
```

**Step 4: Checklist de aceitacao**

Login como profissional: profissional@teste.com / Teste@123

```
[ ] Mapa renderiza sem loading infinito
[ ] Estilo dark aplica (fundo escuro, nao cinza Google Maps)
[ ] NavInfoBar aparece quando em tracking
[ ] NavControls (botoes de zoom) aparecem na direita com glass morphism
[ ] Marcador de destino e um pin verde
[ ] Avatar do profissional aparece com cor azul
[ ] TypeScript sem erros: npx tsc --noEmit
[ ] Build producao sem erros: npm run build
[ ] Zero referencias a "Waze" nos imports usados em producao
```

**Step 5: TypeScript final**

```bash
cd /home/levybonito/faztudo-main/frontend
npx tsc --noEmit
```

Resultado esperado: 0 erros novos.

**Step 6: Build de producao**

```bash
cd /home/levybonito/faztudo-main/frontend
npm run build
```

**Step 7: Commit final**

```bash
cd /home/levybonito/faztudo-main
git add -A
git commit -m "feat: premium NavigationMap with MapLibre GL JS, GPU rendering, pitch camera, glass HUD"
```

---

## Troubleshooting

**Mapa nao renderiza (tela preta ou branca)**
Causa: VITE_MAPTILER_KEY nao configurada ou invalida.
Fix: Verificar frontend/.env tem VITE_MAPTILER_KEY=sua_chave.
O componente tem fallback para demotiles.maplibre.org quando a key esta vazia.

**Erro "maplibre-gl/dist/maplibre-gl.css not found"**
Fix: cd frontend && npm install maplibre-gl react-map-gl

**Erro TypeScript sobre react-map-gl/maplibre**
Fix: cd frontend && npm install react-map-gl@latest

**Marcador nao aparece**
Fix: Adicionar key prop ao Marker para forcal remount.
A implementacao ja inclui key no avatar: key={...origin.lat-origin.lng...}

**Camera nao segue o profissional**
Causa: mapLoaded pode estar false quando origin atualiza pela primeira vez.
O useEffect de camera ja tem mapLoaded como dependencia — verificar que onLoad e passado ao Map.

---

## Referencias

- Design doc: docs/plans/2026-02-18-premium-navigation-map-design.md
- MapLibre GL docs: https://maplibre.org/maplibre-gl-js/docs/
- react-map-gl docs: https://visgl.github.io/react-map-gl/docs/get-started
- MapTiler styles: https://docs.maptiler.com/cloud/reference/maps-api/
- WazeMap original: frontend/src/components/map/WazeMap.tsx
