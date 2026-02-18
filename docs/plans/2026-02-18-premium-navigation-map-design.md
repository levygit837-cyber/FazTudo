# FazTudo Premium Navigation Map — Design Document

> **Data:** 2026-02-18
> **Status:** Aprovado
> **Escopo:** Refatoração visual do componente de mapa de navegação em tempo real

---

## Problema

O mapa atual (`WazeMap.tsx`) usa **React-Leaflet com tiles raster da CartoCDN (Voyager)**. Tiles raster são imagens PNG pré-renderizadas: não permitem customização de estilo, não têm rendering GPU, não suportam rotação de câmera com bearing, e visualmente entregam o mesmo look genérico do Google Maps com outra cor.

## Objetivo

Substituir a stack de mapa do componente principal de navegação por uma solução **vetorial GPU-rendered**, com:
- Estilo visual completamente customizado (paleta FazTudo)
- Câmera que gira com o bearing do profissional (igual apps de navegação premium)
- Pitch 3D leve (30°) durante navegação
- HUD moderno com glass morphism
- 60fps suave via WebGL
- Zero custo adicional

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Renderer de mapa | **MapLibre GL JS v4** (open-source, GPU/WebGL) |
| Wrapper React | **react-map-gl v8** (`react-map-gl/maplibre`) |
| Tiles vetoriais | **MapTiler** — endpoint `streets-v2` (free: 100k tile loads/mês) |
| Estilo base | MapTiler JSON com overrides de paleta FazTudo |
| Geocoding | Google Geocoding API via backend proxy (SEM MUDANÇA) |
| Directions | Google Directions API via backend proxy (SEM MUDANÇA) |
| Location tracking | In-memory store + polling 5s (SEM MUDANÇA) |

### Dependências a instalar
```bash
cd frontend && npm install maplibre-gl react-map-gl
```

---

## Arquivos Afetados

### Novos (substituem os com "waze" no nome)
```
frontend/src/components/map/NavigationMap.tsx        (substitui WazeMap.tsx)
frontend/src/components/map/mapConstants.ts          (substitui wazeConstants.ts)
frontend/src/components/map/mapIcons.ts              (substitui wazeIcons.ts — DOM elements)
frontend/src/components/map/NavInfoBar.tsx           (substitui WazeInfoBar.tsx)
frontend/src/components/map/NavControls.tsx          (substitui WazeControls.tsx)
frontend/src/components/map/mapStyle.ts              (NOVO — JSON de estilo GL)
frontend/src/components/map/useMapCamera.ts          (NOVO — hook de câmera)
```

### Modificados
```
frontend/src/components/map/index.ts                 (re-exportar NavigationMap)
frontend/src/pages/orders/OrderDetails.tsx           (trocar import WazeMap → NavigationMap)
frontend/src/types/components.ts                     (renomear WazeMapProps → NavigationMapProps)
```

### Sem mudança (mantidos integralmente)
```
frontend/src/hooks/useGeolocation.ts
frontend/src/hooks/useRouteTracking.ts
frontend/src/services/geocodingService.ts
backend/src/services/geocodingService.ts
backend/src/controllers/service/locationController.ts
backend/src/routes/locationRoutes.ts
```

---

## Design Visual

### Paleta do Mapa (Dark Mode — foco principal)

```
Fundo geral (background):        #0f1623
Terra/área urbana:                #1a2332
Ruas secundárias:                 #1e2d45 com stroke #2a3a5c
Ruas arteriais:                   #2a3a5c com stroke #3d5a8a
Rodovias (highways):              #f59e0b (âmbar — destaque visual)
Área de parques/verde:            #152a1e
Área de água:                     #0d1927
Edifícios (fill):                 #1f2d40
Labels de rua:                    #64748b, fonte Inter 10px
Labels de bairro/cidade:          #94a3b8, fonte Inter Bold 12px
```

### Paleta do Mapa (Light Mode)

```
Fundo geral:                      #f0f4f8
Terra/área urbana:                #e8eef4
Ruas secundárias:                 #ffffff
Ruas arteriais:                   #f1f5f9
Rodovias:                         #f59e0b
Labels:                           #1e293b
```

### HUD — NavInfoBar

- Aparece: somente quando `isTracking = true`
- Posição: `absolute top-4 left-1/2 -translate-x-1/2` com `z-[1000]`
- Largura: `w-[90%] max-w-sm`
- Fundo: `rgba(15, 22, 35, 0.95)` + `backdrop-blur-xl`
- Borda: `border border-white/10`
- Sombra: `shadow-2xl shadow-black/40`
- Border-radius: `rounded-2xl`
- Conteúdo:
  - Chip "AO VIVO" com dot verde pulsante + uppercase tracking-wider
  - Distância em fonte grande bold (`text-2xl font-bold text-white`)
  - ETA formatado como "Chega às HH:MM" (calcular a partir de agora + duration)
  - Nome do profissional com avatar inicial (client view)

### HUD — NavControls

- Posição: `absolute right-3 top-1/2 -translate-y-1/2`
- Botões: `44×44px`, `rounded-xl`
- Estilo: `bg-black/40 backdrop-blur-md border border-white/10`
- Hover: `bg-white/10`
- Active: `scale(0.92)` com `transition-transform duration-100`
- Botões: zoom+, zoom−, divisor, centralizar, toggle alertas

### Marcador do Profissional

```
Elemento DOM: 56×56px div
Avatar: círculo 48px com gradient linear(135deg, #3b82f6, #1d4ed8)
Borda: 3px solid white
Anel externo: box-shadow 0 0 0 6px rgba(59,130,246,0.15)
Glow pulse: animation 2s ease-in-out infinite
Seta: CSS triangle 10px acima do círculo, rotacionada com bearing
Rotação: CSS transform rotate(bearing) com transition 0.8s cubic-bezier(0.4,0,0.2,1)
```

### Marcador de Destino

```
Elemento DOM: 48×64px div
Forma: círculo 44px (verde) + triângulo CSS abaixo (pin tail)
Circle: gradient(135deg, #10b981, #059669)
Borda: 3px solid white
Ring: box-shadow 0 0 0 4px rgba(16,185,129,0.2)
Badge: número da rua em badge branco abaixo do círculo
Pulse: animation 3s ease-in-out infinite (scale 1.0 → 1.05 → 1.0)
```

### Linha de Rota (MapLibre Layer — GPU rendered)

```
Rota restante:
  type: "line"
  color: #3b82f6
  width: 6px
  cap: "round"
  join: "round"
  opacity: 0.9

Trail percorrido:
  color: #93c5fd
  width: 5px
  opacity: 0.3
  dasharray: [4, 8]
  animation: dashoffset decrement (efeito "formiga")
```

---

## Comportamento de Câmera

### Hook `useMapCamera`

```typescript
// Durante navegação (follow mode)
mapRef.current.easeTo({
  center: [origin.lng, origin.lat],
  bearing: origin.bearing ?? 0,
  pitch: 30,
  zoom: 16,
  duration: 800,
  easing: (t) => t < 0.5 ? 2*t*t : -1+(4-2*t)*t // easeInOutQuad
})

// View mode (não navegando, mostra origem + destino)
mapRef.current.fitBounds(bounds, {
  padding: { top: 100, bottom: 80, left: 60, right: 60 },
  bearing: 0,
  pitch: 0,
  duration: 1200
})

// Fly inicial
mapRef.current.flyTo({
  center: [...],
  zoom: 16,
  duration: 2000,
  curve: 1.5
})
```

### Estados de câmera

| Estado | Bearing | Pitch | Zoom | Modo |
|--------|---------|-------|------|------|
| Inicial (sem origem) | 0° | 0° | 13 | fitBounds |
| Aguardando (tem origem+dest) | 0° | 0° | auto | fitBounds |
| Navegando | heading do GPS | 30° | 16 | followMode easeTo |
| Cliente vendo | 0° | 10° | auto | fitBounds suave |

---

## Integração com APIs (Sem Mudança)

O backend proxy continua operando como hoje:

```
POST /api/geocoding/geocode       → Google Geocoding API
POST /api/geocoding/directions    → Google Directions API
POST /api/geocoding/reverse       → Google Reverse Geocoding
POST /api/geocoding/route-alerts  → Overpass API (alertas de rota)

PUT  /api/services/orders/:id/location       → in-memory location store
GET  /api/services/orders/:id/location       → client polling
DELETE /api/services/orders/:id/location     → clear on stop
```

A polyline retornada pelo Directions API (encoded polyline Google) continua sendo decodificada no frontend via `decodePolyline()` e desenhada no mapa — agora como Layer do MapLibre (GeoJSON LineString) em vez de `<Polyline>` do Leaflet.

---

## Variável de Ambiente Nova

```env
# frontend/.env
VITE_MAPTILER_KEY=your_maptiler_api_key_here
```

MapTiler free tier: 100.000 tile loads/mês — suficiente para dev e early prod.
Cadastro em: https://www.maptiler.com/cloud/

---

## Critérios de Aceitação

- [ ] Mapa renderiza com estilo dark FazTudo (paleta definida acima)
- [ ] Câmera gira com bearing do profissional durante navegação
- [ ] Pitch 30° ativo durante follow mode
- [ ] Câmera faz `fitBounds` quando não está em follow mode
- [ ] Marcador do profissional rotaciona suavemente com heading
- [ ] NavInfoBar mostra distância, ETA e nome (client view)
- [ ] NavControls funcionais (zoom, centralizar, toggle alertas)
- [ ] Linha de rota desenhada como Layer GL (não Polyline Leaflet)
- [ ] Trail com dasharray animado
- [ ] Lógica de localização/polling mantida integralmente
- [ ] Zero referências a "Waze" nos nomes de componentes/arquivos
- [ ] TypeScript sem erros (`npx tsc --noEmit`)
- [ ] Funciona em dark mode e light mode

---

## O Que NÃO Muda

- `InteractiveMap.tsx` — fica para próxima sprint
- `ProfessionalLocationMap.tsx` — fica para próxima sprint
- `LocationPicker.tsx` — fica para próxima sprint
- Todo o backend (geocoding, directions, location tracking)
- Todos os hooks (`useGeolocation`, `useRouteTracking`, `useGeolocation`)
- Todos os serviços frontend (`geocodingService.ts`, `serviceService.ts`)
