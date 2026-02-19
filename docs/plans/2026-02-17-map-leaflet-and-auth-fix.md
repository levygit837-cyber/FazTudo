# Migração de Mapa para Leaflet + Correção de Autenticação

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir o mapa do Google Maps por um mapa próprio usando Leaflet/React-Leaflet (mantendo a API do Google apenas para geocoding/directions) e corrigir o bug de desautenticação que ocorre após alguns minutos.

**Architecture:** O mapa atual usa `@vis.gl/react-google-maps` que renderiza o mapa do Google diretamente (incluindo UI, branding e tiles do Google). A migração troca para React-Leaflet com tiles OpenStreetMap, usando apenas a Google Geocoding/Directions API para dados de localização/rota. O bug de auth é causado por falta de endpoint de refresh token no backend — o frontend tenta refresh, falha, e faz logout automático.

**Tech Stack:** React-Leaflet 5, Leaflet 1.9, OpenStreetMap tiles, Google Geocoding API (server-side proxy), jsonwebtoken (refresh tokens)

**Nota de investigação (2026-02-17):** NÃO existe nenhum mapa Leaflet previamente criado no projeto. Leaflet/react-leaflet NÃO está instalado. Todos os 5 componentes de mapa (+ OrderLocationMap) usam exclusivamente `@vis.gl/react-google-maps`. Não há código reutilizável — a migração é do zero.

---

## Diagnóstico Completo

### Problema 1: Mapa do Google aparece diretamente

**Causa raiz:** Todos os componentes de mapa usam `@vis.gl/react-google-maps`:

**Em `frontend/src/components/map/`** (7 arquivos):
- `InteractiveMap.tsx` → `APIProvider` + `Map` + `useMap` + `useMapsLibrary` + `getMapConfig`
- `ProfessionalLocationMap.tsx` → `APIProvider` + `Map` + `AdvancedMarker` + `Pin` + `getMapConfig`
- `ProfessionalMarker.tsx` → `AdvancedMarker` do Google
- `DestinationMarker.tsx` → `AdvancedMarker` do Google
- `LandmarkMarker.tsx` → `AdvancedMarker` do Google
- `MapLegend.tsx` → Componente puro (sem dependência do Google) ✅
- `RouteTracker.tsx` → Componente puro (sem dependência do Google) ✅

**Em `frontend/src/components/orders/`** (1 arquivo — **CRÍTICO, faltava no plano original**):
- `OrderLocationMap.tsx` → `APIProvider` + `Map` + `AdvancedMarker` + `Pin` + `useMap` + `useMapsLibrary` + `getMapConfig` — Este é o componente mais complexo: tem tracking de localização via geolocation, polling, geocoding inline, e route rendering.

**Consumidores:**
- `MapView.tsx` (page) → usa `InteractiveMap` + `RouteTracker` (sem Google direto)
- `ServiceDetails.tsx` (page) → usa `ProfessionalLocationMap`
- `OrderDetails.tsx` (page) → usa `OrderLocationMap`

**Solução:** Migrar para React-Leaflet com tiles OpenStreetMap. Usar a Google API apenas para:
- Geocoding (converter endereço → lat/lng) via backend proxy
- Directions (calcular rota) via backend proxy

### Problema 2: Desautenticação após poucos minutos

**Causa raiz encontrada — FALTA O ENDPOINT `/auth/refresh`:**

1. O frontend (`api.ts` linha 51-68) tenta fazer refresh token quando recebe 401:
   ```typescript
   const refreshToken = localStorage.getItem("refreshToken");
   if (refreshToken) {
     const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
   }
   ```

2. **MAS o backend NÃO TEM esse endpoint.** Busca por "refresh" em `authRoutes.ts` = 0 resultados.

3. O login (`AuthContext.tsx` linha 180) só salva `token` — **nunca salva `refreshToken`:**
   ```typescript
   localStorage.setItem("token", token);
   localStorage.setItem("user", JSON.stringify(user));
   // ← refreshToken NUNCA é salvo!
   ```

4. O backend gera apenas 1 token com `JWT_EXPIRES_IN=7d`, sem gerar refresh token.

**Fluxo do bug:**
1. Usuário faz login → recebe token JWT (7 dias)
2. Após algum tempo, QUALQUER request 401 (ex: recurso não autorizado, race condition) dispara o interceptor
3. Interceptor busca `refreshToken` no localStorage → `null`
4. Como `refreshToken` é falsy, pula o try/catch do refresh
5. Vai direto para: `localStorage.removeItem("token")` + `window.location.href = "/login"`
6. **LOGOUT FORÇADO** mesmo que o token JWT ainda seja válido

**Causa adicional:** O interceptor `isRedirecting` é um flag global que nunca é resetado, então após um redirect, o interceptor para de funcionar para sempre na sessão.

---

## Parte A: Correção de Autenticação (PRIORIDADE ALTA)

### Task 1: Criar endpoint de refresh token no backend

**Files:**
- Modify: `backend/src/controllers/authController.ts`
- Modify: `backend/src/routes/authRoutes.ts`
- Modify: `backend/src/middleware/auth.ts`

**Step 1: Adicionar campo refreshToken no schema Prisma**

Abrir `backend/prisma/schema.prisma` e adicionar no model User (após o campo `tokenVersion`):

```prisma
  refreshToken       String?
```

**Step 2: Aplicar schema no banco**

Run: `cd /home/levybonito/faztudo-main/backend && npx prisma db push`
Expected: Schema atualizado com sucesso

**Step 3: Criar função generateRefreshToken no auth.ts**

Adicionar em `backend/src/middleware/auth.ts`, após a função `generateToken`:

```typescript
// Gerar refresh token (longa duração)
export const generateRefreshToken = (user: {
  id: number;
  email: string;
}): string => {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'refresh' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
  );
};
```

**Step 4: Criar controller refreshToken no authController.ts**

Adicionar em `backend/src/controllers/authController.ts`, antes do `export default`:

```typescript
// Refresh token
export const refreshAccessToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json(errorResponse("Refresh token is required"));
      return;
    }

    // Verify refresh token
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_SECRET);
    } catch {
      res.status(401).json(errorResponse("Invalid or expired refresh token"));
      return;
    }

    if (decoded.type !== 'refresh') {
      res.status(401).json(errorResponse("Invalid token type"));
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tokenVersion: true,
        refreshToken: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      res.status(401).json(errorResponse("User not found or inactive"));
      return;
    }

    // Verify stored refresh token matches
    if (user.refreshToken !== refreshToken) {
      res.status(401).json(errorResponse("Refresh token has been revoked"));
      return;
    }

    // Generate new access token
    const newToken = generateToken(user);

    // Generate new refresh token (rotation)
    const newRefreshToken = generateRefreshToken(user);

    // Update stored refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.status(200).json(
      successResponse(
        { token: newToken, refreshToken: newRefreshToken },
        "Token refreshed successfully",
      ),
    );
  } catch (error) {
    log.error({ err: error }, "Refresh token error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

Adicionar import de `jwt` no topo (se não existir) e adicionar `refreshAccessToken` ao `export default`.

**Step 5: Adicionar rota de refresh no authRoutes.ts**

Adicionar em `backend/src/routes/authRoutes.ts`:

```typescript
router.post("/refresh", authController.refreshAccessToken);
```

**Step 6: Atualizar login para gerar e retornar refresh token**

No `authController.ts`, na função `login`, após gerar o token, adicionar:

```typescript
// Generate refresh token
const newRefreshToken = generateRefreshToken(user);

// Store refresh token in database
await prisma.user.update({
  where: { id: user.id },
  data: { refreshToken: newRefreshToken },
});
```

E alterar o response para incluir o refreshToken:

```typescript
res.status(200).json(
  successResponse(
    { user: userData, token, refreshToken: newRefreshToken },
    "Login successful",
  ),
);
```

Importar `generateRefreshToken` no topo:

```typescript
import { generateToken, generateRefreshToken, hashPassword, comparePassword } from "../middleware/auth";
```

**Step 7: Verificar tipos TypeScript do backend**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: Sem erros

**Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/controllers/authController.ts backend/src/routes/authRoutes.ts backend/src/middleware/auth.ts
git commit -m "feat: add refresh token endpoint and generation"
```

---

### Task 2: Atualizar frontend para usar refresh token

**Files:**
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/services/api.ts`

**Step 1: Salvar refreshToken no login (AuthContext.tsx)**

Na função `login`, após `localStorage.setItem("token", token);`, adicionar:

```typescript
if (response.data.data.refreshToken) {
  localStorage.setItem("refreshToken", response.data.data.refreshToken);
}
```

Fazer o mesmo na função `register`.

**Step 2: Corrigir o interceptor de response (api.ts)**

O interceptor atual tem dois bugs:
1. `isRedirecting` nunca é resetado
2. Se não tem refreshToken, faz logout imediato mesmo com token válido

Substituir o bloco do interceptor de response (linhas 35-80) por:

```typescript
// Response interceptor - trata erros globalmente
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Só tentar refresh se recebeu 401 e tinha token na request
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const hadToken = originalRequest.headers?.Authorization;
    if (!hadToken) {
      return Promise.reject(error);
    }

    // Se já estamos fazendo refresh, enfileirar a request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      // Sem refresh token — NÃO fazer logout automático
      // Apenas rejeitar o erro e deixar o componente decidir
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      });
      const { token, refreshToken: newRefreshToken } = response.data.data;

      localStorage.setItem("token", token);
      if (newRefreshToken) {
        localStorage.setItem("refreshToken", newRefreshToken);
      }

      processQueue(null, token);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
      }
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Refresh falhou — agora sim, limpar e redirecionar
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      window.location.href = "/login";

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
```

**Step 3: Verificar tipos TypeScript do frontend**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros

**Step 4: Commit**

```bash
git add frontend/src/context/AuthContext.tsx frontend/src/services/api.ts
git commit -m "fix: implement proper refresh token flow and fix auto-logout bug"
```

---

### Task 3: Testar fluxo de autenticação

**Step 1: Iniciar backend**

Run: `cd /home/levybonito/faztudo-main/backend && npm run dev`
Expected: Server na porta 3001

**Step 2: Testar login retorna refreshToken**

Run: `curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"cliente@teste.com","password":"Teste@123"}'`
Expected: Response inclui `token` E `refreshToken`

**Step 3: Testar endpoint de refresh**

Pegar o `refreshToken` do step anterior e testar:

Run: `curl -X POST http://localhost:3001/api/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"<token-do-step-anterior>"}'`
Expected: Response com novo `token` e novo `refreshToken`

**Step 4: Rodar testes existentes**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: Todos os testes passam

**Step 5: Commit (se necessário)**

```bash
git commit -m "test: verify refresh token flow works"
```

---

## Parte B: Migração do Mapa para Leaflet

### Task 4: Instalar dependências Leaflet

**Files:**
- Modify: `frontend/package.json`

**Step 1: Instalar React-Leaflet e Leaflet**

Run: `cd /home/levybonito/faztudo-main/frontend && npm install leaflet react-leaflet @types/leaflet`

**Step 2: NÃO remover `@vis.gl/react-google-maps` ainda** (vamos remover ao final)

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add react-leaflet and leaflet dependencies"
```

---

### Task 5: Criar serviço de geocoding/directions via backend proxy

**Files:**
- Create: `backend/src/services/geocodingService.ts`
- Create: `backend/src/routes/geocodingRoutes.ts`
- Modify: `backend/src/index.ts`

**Step 1: Criar serviço de geocoding**

Criar `backend/src/services/geocodingService.ts`:

```typescript
import { env } from "../config/env";
import { createLogger } from "../lib/logger";

const log = createLogger("geocoding");

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface DirectionsResult {
  distance: string;
  duration: string;
  polyline: string; // encoded polyline
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
    startLocation: { lat: number; lng: number };
    endLocation: { lat: number; lng: number };
  }>;
}

/**
 * Geocode an address using Google Geocoding API (server-side)
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const apiKey = env.PLACES_API_KEY;
    if (!apiKey) {
      log.warn("PLACES_API_KEY not configured");
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=pt-BR&region=BR`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }

    log.warn({ status: data.status, address }, "Geocoding failed");
    return null;
  } catch (error) {
    log.error({ err: error, address }, "Geocoding error");
    return null;
  }
}

/**
 * Get directions between two points using Google Directions API (server-side)
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DirectionsResult | null> {
  try {
    const apiKey = env.PLACES_API_KEY;
    if (!apiKey) {
      log.warn("PLACES_API_KEY not configured");
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${apiKey}&language=pt-BR&mode=driving`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        distance: leg.distance.text,
        duration: leg.duration.text,
        polyline: route.overview_polyline.points,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
          distance: step.distance.text,
          duration: step.duration.text,
          startLocation: step.start_location,
          endLocation: step.end_location,
        })),
      };
    }

    log.warn({ status: data.status }, "Directions failed");
    return null;
  } catch (error) {
    log.error({ err: error }, "Directions error");
    return null;
  }
}
```

**Step 2: Criar rotas de geocoding**

Criar `backend/src/routes/geocodingRoutes.ts`:

```typescript
import { Router, Request, Response } from "express";
import { verifyToken } from "../middleware/auth";
import { geocodeAddress, getDirections } from "../services/geocodingService";
import { createLogger } from "../lib/logger";

const log = createLogger("geocodingRoutes");
const router = Router();

// Geocode an address (authenticated)
router.post("/geocode", verifyToken, async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address || typeof address !== "string") {
      res.status(400).json({ success: false, message: "Address is required" });
      return;
    }

    const result = await geocodeAddress(address);

    if (!result) {
      res.status(404).json({ success: false, message: "Address not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    log.error({ err: error }, "Geocode endpoint error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get directions between two points (authenticated)
router.post("/directions", verifyToken, async (req: Request, res: Response) => {
  try {
    const { origin, destination } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      res.status(400).json({
        success: false,
        message: "Origin and destination with lat/lng are required",
      });
      return;
    }

    const result = await getDirections(origin, destination);

    if (!result) {
      res.status(404).json({ success: false, message: "No route found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    log.error({ err: error }, "Directions endpoint error");
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
```

**Step 3: Registrar rotas no index.ts**

Em `backend/src/index.ts`, adicionar import e registrar:

```typescript
import geocodingRoutes from "./routes/geocodingRoutes";
// ...
app.use("/api/geocoding", geocodingRoutes);
```

**Step 4: Verificar tipos**

Run: `cd /home/levybonito/faztudo-main/backend && npx tsc --noEmit`
Expected: Sem erros

**Step 5: Commit**

```bash
git add backend/src/services/geocodingService.ts backend/src/routes/geocodingRoutes.ts backend/src/index.ts
git commit -m "feat: add server-side geocoding and directions proxy"
```

---

### Task 6: Criar serviço de geocoding/directions no frontend

**Files:**
- Create: `frontend/src/services/geocodingService.ts`

**Step 1: Criar serviço frontend**

Criar `frontend/src/services/geocodingService.ts`:

```typescript
import api, { extractData, ApiResponse } from "./api";

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface DirectionsResult {
  distance: string;
  duration: string;
  polyline: string;
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
    startLocation: { lat: number; lng: number };
    endLocation: { lat: number; lng: number };
  }>;
}

/**
 * Geocode an address via backend proxy (does NOT expose Google API key)
 */
export async function geocode(address: string): Promise<GeocodingResult | null> {
  try {
    const response = await api.post<ApiResponse<GeocodingResult>>("/geocoding/geocode", { address });
    return extractData(response);
  } catch {
    return null;
  }
}

/**
 * Get directions via backend proxy
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DirectionsResult | null> {
  try {
    const response = await api.post<ApiResponse<DirectionsResult>>("/geocoding/directions", {
      origin,
      destination,
    });
    return extractData(response);
  } catch {
    return null;
  }
}

/**
 * Decode a Google encoded polyline into lat/lng array
 * (needed to draw route on Leaflet map)
 */
export function decodePolyline(encoded: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}
```

**Step 2: Commit**

```bash
git add frontend/src/services/geocodingService.ts
git commit -m "feat: add frontend geocoding service with polyline decoder"
```

---

### Task 7: Reescrever componentes de mapa com Leaflet

**Files:**
- Rewrite: `frontend/src/components/map/InteractiveMap.tsx`
- Rewrite: `frontend/src/components/map/ProfessionalLocationMap.tsx`
- Delete: `frontend/src/components/map/ProfessionalMarker.tsx` (absorvido no InteractiveMap)
- Delete: `frontend/src/components/map/DestinationMarker.tsx` (absorvido no InteractiveMap)
- Delete: `frontend/src/components/map/LandmarkMarker.tsx` (absorvido no InteractiveMap)
- Keep: `frontend/src/components/map/MapLegend.tsx` (sem mudanças — componente puro ✅)
- Keep: `frontend/src/components/map/RouteTracker.tsx` (sem mudanças — componente puro ✅)
- Modify: `frontend/src/components/map/index.ts`

**NOTA:** Os componentes `MapLegend` e `RouteTracker` são puros (sem dependência do Google Maps). Não precisam de alterações.

**Step 1: Criar utilitário compartilhado de ícones Leaflet**

Criar `frontend/src/components/map/leafletIcons.ts` (DRY — reutilizado por InteractiveMap, ProfessionalLocationMap e OrderLocationMap):

```typescript
import L from "leaflet";

// Fix Leaflet default icon issue with bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Professional marker — blue circle with person icon */
export const professionalIcon = L.divIcon({
  className: "faztudo-marker",
  html: `<div style="
    width: 40px; height: 40px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

/** Small professional marker (for location-only maps) */
export const professionalIconSmall = L.divIcon({
  className: "faztudo-marker",
  html: `<div style="
    width: 36px; height: 36px;
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

/** Destination marker — red circle with house icon */
export const destinationIcon = L.divIcon({
  className: "faztudo-marker",
  html: `<div style="
    width: 40px; height: 40px;
    background: linear-gradient(135deg, #f87171, #dc2626);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

/** Landmark marker — small amber circle with pin icon */
export const landmarkIcon = L.divIcon({
  className: "faztudo-marker",
  html: `<div style="
    width: 28px; height: 28px;
    background: #f59e0b;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    display: flex; align-items: center; justify-content: center;
  ">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});
```

**Step 2: Reescrever ProfessionalLocationMap.tsx com Leaflet**

```tsx
import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import clsx from "clsx";
import { professionalIconSmall } from "./leafletIcons";

interface ProfessionalLocationMapProps {
  latitude: number;
  longitude: number;
  label?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  className?: string;
  height?: number;
}

const ProfessionalLocationMap: React.FC<ProfessionalLocationMapProps> = ({
  latitude,
  longitude,
  label,
  neighborhood,
  city,
  state,
  className,
  height = 220,
}) => {
  const position: [number, number] = [latitude, longitude];
  const locationParts = [neighborhood, city, state].filter(Boolean);
  const locationText = locationParts.join(", ");

  return (
    <div className={clsx("space-y-2", className)}>
      {locationText && (
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-primary-500" />
          <span>{locationText}</span>
        </div>
      )}

      <div
        className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
        style={{ height }}
      >
        <MapContainer
          center={position}
          zoom={14}
          scrollWheelZoom={false}
          style={{ width: "100%", height: "100%" }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={position} icon={professionalIconSmall}>
            <Popup>
              <div className="text-sm font-medium">
                {label || "Localização do profissional"}
              </div>
              {locationText && (
                <div className="text-xs text-slate-500 mt-0.5">{locationText}</div>
              )}
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
        Localização aproximada da região de atuação
      </p>
    </div>
  );
};

export default ProfessionalLocationMap;
```

**Step 3: Reescrever InteractiveMap.tsx com Leaflet**

```tsx
import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import MapLegend from "./MapLegend";
import { professionalIcon, destinationIcon, landmarkIcon } from "./leafletIcons";
import type { InteractiveMapProps, RouteInfo, LatLng } from "../../types";
import { getDirections, decodePolyline } from "../../services/geocodingService";

// Component to fit map bounds
const FitBounds: React.FC<{ bounds: L.LatLngBoundsExpression }> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);
  return null;
};

// Main InteractiveMap with Leaflet
const InteractiveMap: React.FC<InteractiveMapProps> = ({
  professionalMarker,
  destinationMarker,
  landmarkMarkers = [],
  showRoute = true,
  onRouteInfo,
  height = 450,
  className,
}) => {
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch route from backend proxy
  useEffect(() => {
    if (!showRoute) return;

    const fetchRoute = async () => {
      setLoading(true);
      try {
        const result = await getDirections(
          professionalMarker.position,
          destinationMarker.position,
        );

        if (result) {
          const info: RouteInfo = {
            distance: result.distance,
            duration: result.duration,
          };
          setRouteInfo(info);
          onRouteInfo?.(info);
          setRoutePolyline(decodePolyline(result.polyline));
        }
      } catch {
        setError("Erro ao calcular rota");
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [
    showRoute,
    professionalMarker.position.lat,
    professionalMarker.position.lng,
    destinationMarker.position.lat,
    destinationMarker.position.lng,
    onRouteInfo,
  ]);

  // Calculate bounds
  const allPoints: LatLng[] = [
    professionalMarker.position,
    destinationMarker.position,
    ...landmarkMarkers.map((m) => m.position),
  ];

  const bounds = L.latLngBounds(
    allPoints.map((p) => [p.lat, p.lng] as [number, number]),
  );

  const center: [number, number] = [
    (professionalMarker.position.lat + destinationMarker.position.lat) / 2,
    (professionalMarker.position.lng + destinationMarker.position.lng) / 2,
  ];

  if (error) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/30",
          className,
        )}
        style={{ height: Math.min(height, 200) }}
      >
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md relative",
        className,
      )}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <FitBounds bounds={bounds} />

        {/* Route polyline */}
        {routePolyline.length > 0 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{
              color: "#2563eb",
              weight: 5,
              opacity: 0.85,
            }}
          />
        )}

        {/* Professional marker */}
        <Marker
          position={[professionalMarker.position.lat, professionalMarker.position.lng]}
          icon={professionalIcon}
        >
          <Popup>
            <div className="text-sm font-semibold">{professionalMarker.label}</div>
            {professionalMarker.subtitle && (
              <div className="text-xs text-slate-500">{professionalMarker.subtitle}</div>
            )}
          </Popup>
        </Marker>

        {/* Destination marker */}
        <Marker
          position={[destinationMarker.position.lat, destinationMarker.position.lng]}
          icon={destinationIcon}
        >
          <Popup>
            <div className="text-sm font-semibold">{destinationMarker.label}</div>
            {destinationMarker.subtitle && (
              <div className="text-xs text-slate-500">{destinationMarker.subtitle}</div>
            )}
          </Popup>
        </Marker>

        {/* Landmark markers */}
        {landmarkMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            icon={landmarkIcon}
          >
            <Popup>
              <div className="text-xs font-medium">{marker.label}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating legend */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <MapLegend />
      </div>

      {/* Route info floating card */}
      {routeInfo && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[1000] animate-fade-in">
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

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-[1001]">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Calculando rota...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveMap;
```

**Step 4: Atualizar barrel export (index.ts)**

Reescrever `frontend/src/components/map/index.ts`:

```typescript
export { default as InteractiveMap } from "./InteractiveMap";
export { default as ProfessionalLocationMap } from "./ProfessionalLocationMap";
export { default as MapLegend } from "./MapLegend";
export { default as RouteTracker } from "./RouteTracker";
```

**Step 5: Deletar componentes de marker antigos**

Run:
```bash
rm frontend/src/components/map/ProfessionalMarker.tsx
rm frontend/src/components/map/DestinationMarker.tsx
rm frontend/src/components/map/LandmarkMarker.tsx
```

**Step 6: Verificar tipos TypeScript do frontend**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Podem haver erros de imports nos consumidores — corrigir no próximo task

**Step 7: Commit**

```bash
git add frontend/src/components/map/
git commit -m "feat: replace Google Maps with Leaflet in map/* components"
```

---

### Task 8: Reescrever OrderLocationMap com Leaflet (NOVO — faltava no plano original)

**Files:**
- Rewrite: `frontend/src/components/orders/OrderLocationMap.tsx`

**IMPORTANTE:** Este componente é complexo — tem tracking de geolocalização, polling de posição do profissional, geocoding de endereço, route rendering, e botões de ação. Precisamos manter toda essa funcionalidade.

**Step 1: Reescrever OrderLocationMap.tsx com Leaflet**

A migração deve:
1. Trocar `APIProvider`/`Map`/`AdvancedMarker`/`Pin` por `MapContainer`/`TileLayer`/`Marker`/`Popup`
2. Trocar `useMapsLibrary("routes")` + `DirectionsService` por `getDirections()` do backend proxy + `decodePolyline()`
3. Trocar `useMapsLibrary("geocoding")` + `Geocoder` por `geocode()` do backend proxy
4. Remover chamada a `getMapConfig()` (não precisa mais de API key no frontend)
5. Trocar `google.maps.LatLngBounds` por `L.latLngBounds`
6. Manter o hook `useGeolocation` inalterado (não depende do Google)
7. Manter toda lógica de polling (`getProfessionalLocation`) inalterada
8. Manter toda lógica de ações (`startRoute`, `clearProfessionalLocation`) inalterada

```tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation,
  Clock,
  Route,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { useGeolocation } from "../../hooks/useGeolocation";
import {
  startRoute as apiStartRoute,
  updateProfessionalLocation,
  getProfessionalLocation,
  clearProfessionalLocation,
} from "../../services/serviceService";
import { geocode, getDirections, decodePolyline } from "../../services/geocodingService";
import { professionalIcon, destinationIcon } from "../map/leafletIcons";
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

// Component to fit map bounds dynamically
const FitBounds: React.FC<{ points: Array<[number, number]> }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, points]);
  return null;
};

const OrderLocationMap: React.FC<OrderLocationMapProps> = ({
  orderId,
  isProfessional,
  destinationAddress,
  orderStatus: _orderStatus,
}) => {
  const toast = useToast();

  const [routeStarted, setRouteStarted] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const [routePolyline, setRoutePolyline] = useState<Array<[number, number]>>([]);
  const [professionalPos, setProfessionalPos] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [startingRoute, setStartingRoute] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(
    destinationAddress.latitude && destinationAddress.longitude
      ? { lat: destinationAddress.latitude, lng: destinationAddress.longitude }
      : null
  );
  const [geocodingDest, setGeocodingDest] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Geocode address if no lat/lng via backend proxy
  useEffect(() => {
    if (destination) return;

    const doGeocode = async () => {
      setGeocodingDest(true);
      const addressStr = `${destinationAddress.street}, ${destinationAddress.number}, ${destinationAddress.neighborhood}, ${destinationAddress.city}, ${destinationAddress.state}, Brasil`;
      const result = await geocode(addressStr);
      if (result) {
        setDestination({ lat: result.lat, lng: result.lng });
      } else {
        // Fallback to center of Sao Paulo
        setDestination({ lat: -23.5505, lng: -46.6333 });
      }
      setGeocodingDest(false);
    };

    doGeocode();
  }, [destination, destinationAddress]);

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

  // Fetch directions from backend proxy (replaces Google DirectionsService)
  useEffect(() => {
    if (!origin || !destination) return;

    const fetchDirections = async () => {
      const result = await getDirections(origin, destination);
      if (result) {
        setRouteInfo({
          distance: result.distance,
          duration: result.duration,
        });
        setRoutePolyline(decodePolyline(result.polyline));
      }
    };

    fetchDirections();
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

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
      setRoutePolyline([]);
      setRouteInfo(null);
    } catch {
      // Silent fail
    }
  };

  const destinationLabel = `${destinationAddress.street}, ${destinationAddress.number} - ${destinationAddress.neighborhood}`;

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

  if (!destination || geocodingDest) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Localizando endereco...
      </div>
    );
  }

  // Compute fit bounds points
  const fitPoints: Array<[number, number]> = [];
  if (origin) fitPoints.push([origin.lat, origin.lng]);
  fitPoints.push([destination.lat, destination.lng]);

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
        <MapContainer
          center={[destination.lat, destination.lng]}
          zoom={13}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {fitPoints.length >= 2 && <FitBounds points={fitPoints} />}

          {/* Route polyline */}
          {routePolyline.length > 0 && (
            <Polyline
              positions={routePolyline}
              pathOptions={{
                color: "#3b82f6",
                weight: 5,
                opacity: 0.8,
              }}
            />
          )}

          {/* Destination marker (client's address) */}
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
            <Popup>
              <div className="text-sm font-medium">{destinationLabel}</div>
            </Popup>
          </Marker>

          {/* Professional's current position */}
          {origin && (
            <Marker position={[origin.lat, origin.lng]} icon={professionalIcon}>
              <Popup>
                <div className="text-sm font-medium">Profissional</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Floating legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs space-y-1">
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

export default OrderLocationMap;
```

**Step 2: Verificar tipos TypeScript**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros (OrderLocationMap não é exportado no barrel, não afeta outros)

**Step 3: Commit**

```bash
git add frontend/src/components/orders/OrderLocationMap.tsx
git commit -m "feat: migrate OrderLocationMap from Google Maps to Leaflet"
```

---

### Task 9: Atualizar consumidores dos componentes de mapa

**Step 1: Buscar todos os imports dos componentes deletados**

Run: Buscar por `ProfessionalMarker`, `DestinationMarker`, `LandmarkMarker` em todo o frontend.

Esses componentes eram usados DENTRO do InteractiveMap (que foi reescrito), então não devem ter consumidores externos. Mas verificar.

**Step 2: Verificar que `MapView.tsx` funciona sem alteração**

`MapView.tsx` importa `InteractiveMap` e `RouteTracker` via barrel. A interface `InteractiveMapProps` não mudou. Verificar.

**Step 3: Verificar que `ServiceDetails.tsx` funciona com novo `ProfessionalLocationMap`**

A interface `ProfessionalLocationMapProps` não mudou. Verificar que não há erros.

**Step 4: Remover chamada a `getMapConfig` nos componentes de mapa**

Os componentes de mapa antigos chamavam `getMapConfig()` para obter a API key do Google. Com Leaflet + OSM tiles, isso não é mais necessário no frontend. A API key é usada apenas no backend para geocoding/directions.

Buscar por `getMapConfig` no frontend e verificar que nenhum componente migrado ainda chama essa função.

**NOTA:** O endpoint `GET /api/services/map-config` no backend (`locationRoutes.ts` / `locationController.ts`) pode ser mantido por enquanto — não causa problemas e pode ser útil se quisermos reintroduzir funcionalidade baseada em API key.

**Step 5: Remover `mapId` da interface `InteractiveMapProps`**

Abrir `frontend/src/types/map.ts` e remover o campo `mapId` da interface (era específico do Google Maps):

```typescript
// REMOVER esta linha:
/** Google Maps Map ID for custom styling (optional) */
mapId?: string;
```

**Step 6: Verificar tipos TypeScript**

Run: `cd /home/levybonito/faztudo-main/frontend && npx tsc --noEmit`
Expected: Sem erros

**Step 7: Commit**

```bash
git add -A
git commit -m "fix: update map component consumers after Leaflet migration"
```

---

### Task 10: Remover dependência do Google Maps

**Files:**
- Modify: `frontend/package.json`

**Step 1: Desinstalar @vis.gl/react-google-maps**

Run: `cd /home/levybonito/faztudo-main/frontend && npm uninstall @vis.gl/react-google-maps`

**Step 2: Verificar que não há mais imports do pacote**

Run: Buscar por `@vis.gl/react-google-maps` em todo o frontend.
Expected: 0 resultados

**Step 3: Verificar build completo**

Run: `cd /home/levybonito/faztudo-main/frontend && npm run build`
Expected: Build sem erros

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "refactor: remove @vis.gl/react-google-maps dependency"
```

---

### Task 11: Teste completo end-to-end

**Step 1: Iniciar backend e frontend**

Run:
```bash
cd /home/levybonito/faztudo-main/backend && npm run dev &
cd /home/levybonito/faztudo-main/frontend && npm run dev &
```

**Step 2: Testar login + refresh token**

1. Abrir http://localhost:5173
2. Login com `cliente@teste.com` / `Teste@123`
3. Navegar por diferentes páginas
4. Esperar 5+ minutos
5. Verificar que NÃO é deslogado

**Step 3: Testar mapa (se houver profissional com localização)**

1. Login como profissional
2. Verificar que o mapa usa tiles OpenStreetMap (não Google)
3. Verificar que markers customizados aparecem
4. Verificar que rotas são calculadas e desenhadas

**Step 4: Rodar testes do backend**

Run: `cd /home/levybonito/faztudo-main/backend && npm test`
Expected: Todos passam

**Step 5: Commit final**

```bash
git add -A
git commit -m "feat: complete map migration to Leaflet and auth fix"
```

---

## Resumo das Mudanças

### Backend
| Arquivo | Ação |
|---------|------|
| `prisma/schema.prisma` | Adicionar campo `refreshToken` no User |
| `src/middleware/auth.ts` | Adicionar `generateRefreshToken` |
| `src/controllers/authController.ts` | Adicionar `refreshAccessToken`, atualizar `login` |
| `src/routes/authRoutes.ts` | Adicionar rota `/refresh` |
| `src/services/geocodingService.ts` | **NOVO** - Proxy para Google Geocoding/Directions |
| `src/routes/geocodingRoutes.ts` | **NOVO** - Endpoints `/geocode` e `/directions` |
| `src/index.ts` | Registrar rotas de geocoding |

### Frontend
| Arquivo | Ação |
|---------|------|
| `src/services/api.ts` | Reescrever interceptor com queue de refresh |
| `src/context/AuthContext.tsx` | Salvar refreshToken no login/register |
| `src/services/geocodingService.ts` | **NOVO** - Cliente para geocoding + polyline decoder |
| `src/components/map/leafletIcons.ts` | **NOVO** - Ícones compartilhados DRY |
| `src/components/map/InteractiveMap.tsx` | **REESCRITO** - React-Leaflet |
| `src/components/map/ProfessionalLocationMap.tsx` | **REESCRITO** - React-Leaflet |
| `src/components/map/ProfessionalMarker.tsx` | **DELETADO** (absorvido em leafletIcons) |
| `src/components/map/DestinationMarker.tsx` | **DELETADO** (absorvido em leafletIcons) |
| `src/components/map/LandmarkMarker.tsx` | **DELETADO** (absorvido em leafletIcons) |
| `src/components/map/index.ts` | Atualizado exports |
| `src/components/orders/OrderLocationMap.tsx` | **REESCRITO** - React-Leaflet (NOVO no plano!) |
| `src/types/map.ts` | Remover `mapId` |
| `package.json` | Adicionar leaflet/react-leaflet, remover @vis.gl |

### Dependências
| Adicionadas | Removidas |
|-------------|-----------|
| `leaflet` | `@vis.gl/react-google-maps` |
| `react-leaflet` | |
| `@types/leaflet` | |
