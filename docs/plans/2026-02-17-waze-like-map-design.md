# Mapa Waze-Like FazTudo — Design Document

> **Data**: 2026-02-17
> **Status**: Aprovado
> **Autor**: Claude + Levy

---

## Objetivo

Refatorar completamente o sistema de mapas do FazTudo para criar uma experiencia Waze-like propria, com:
- Avatar custom unico do profissional (nao humano, identidade FazTudo)
- Navegacao imersiva com avatar movel e camera follow
- Rastro com progress indicator que desaparece conforme avanca
- Alertas de sinalizacoes de rua (quebra-molas, semaforos, obras)
- Seletor hibrido de localizacao (GPS + manual + mapa) para clientes
- Visual distinto usando CartoDB Voyager tiles (nao parecer Google Maps)

---

## Decisoes de Design

| Decisao | Escolha | Motivo |
|---------|---------|--------|
| Map Tiles | CartoDB Voyager (light) + Dark Matter (dark) | Gratuito, moderno, dark mode nativo |
| Map Library | Leaflet + react-leaflet (manter) | Ja instalado, zero custo, controle total |
| Avatar | SVG custom unico FazTudo | Identidade propria, nao humano |
| Navegacao | Imersiva com avatar movel | Waze-like maximo |
| Rastro | Progress indicator + fade-out | Limpo, inovador |
| Localizacao cliente | Hibrido (GPS + manual + mapa) | Maxima flexibilidade |
| Backend APIs | Google Geocoding + Directions (proxy) | Ja implementado |
| Road Alerts | Overpass API (OpenStreetMap) | Gratuito, rico em dados |

---

## Secao 1: Tiles & Estilo Visual

- Light: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
- Dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Cantos arredondados `rounded-2xl`
- Controles de zoom nativos removidos, substituidos por controles custom
- Controles flutuantes com design system FazTudo (glow effects)

---

## Secao 2: Avatar Custom do Profissional

**Forma**: Pingo invertido (pin de mapa) com silhueta estilizada dentro
**Cor**: Gradient azul (primary-500 → primary-600) com glow pulse animado
**Interior**: Silhueta minimalista de pessoa com ferramenta (nao humano, sugere profissional)
**Borda**: Ring branco 2px + drop-shadow
**Rotacao**: Gira conforme direcao de movimento (bearing calculado entre posicoes)
**Tamanho**: 48x48px no mapa, area de toque 56x56px

**Marcador de destino (casa do cliente)**:
- Forma: Casa estilizada em SVG dentro de circulo
- Cor: Gradient verde (secondary-500) com pulse suave
- Interior: Numero da residencia se disponivel

---

## Secao 3: Experiencia "Iniciar Trajeto" (Professional View)

### Estado IDLE
- Mapa zoom-out mostrando overview com profissional e destino
- Card de informacoes: endereco completo + distancia + ETA
- Botao grande "Iniciar Trajeto" no rodape

### Estado TRACKING (apos clicar "Iniciar")
1. Botao muda para loading com spinner
2. Backend notificado (PROFESSIONAL_EN_ROUTE)
3. Camera faz flyTo suave ate profissional (zoom 16, duration 2s)
4. Rota desenhada com animacao de "construcao" (polyline cresce)
5. Progress indicator posicionado na posicao atual
6. GPS watch inicia, avatar se move suavemente
7. Top bar flutuante com ETA + distancia restante
8. Botao parar no canto

---

## Secao 4: Experiencia do Cliente (Client View)

### Estado AGUARDANDO
- Mapa mostrando destino (casa do cliente)
- Mensagem "Aguardando profissional iniciar trajeto..."

### Estado PROFISSIONAL A CAMINHO
- Avatar do profissional aparece e se move em tempo real
- Interpolacao suave entre polls (5s)
- Camera fitBounds ambos marcadores
- Info bar: nome do profissional + ETA + distancia

---

## Secao 5: Sistema de Localizacao do Cliente (Hibrido)

Na criacao do pedido:
1. Botao "Usar minha localizacao atual" → GPS + reverse geocode → preenche campos
2. Campos editaveis: rua, numero, complemento, bairro, CEP, cidade, estado
3. Mini mapa com pin arrastavel
4. Ao mover pin → reverse geocode atualiza campos
5. lat/lng salvos no Address model (campos ja existem)

---

## Secao 6: Componentes Novos e Refatorados

| Componente | Status | Descricao |
|-----------|--------|-----------|
| `WazeMap.tsx` | Novo | Container principal do mapa Waze-like |
| `WazeAvatar.tsx` | Novo | Avatar SVG custom animado com rotacao |
| `WazeRouteTrail.tsx` | Novo | Polyline com progress indicator + fade-out |
| `WazeControls.tsx` | Novo | Controles flutuantes custom |
| `WazeInfoBar.tsx` | Novo | Barra superior com ETA, distancia, nome |
| `WazeAlertIcon.tsx` | Novo | Icones SVG de alertas de rua |
| `WazeAlertToast.tsx` | Novo | Toast notification para alertas proximos |
| `LocationPicker.tsx` | Novo | Seletor hibrido GPS+manual+mapa |
| `leafletIcons.ts` | Refatorar | Adicionar avatar e marcador casa |
| `useGeolocation.ts` | Refatorar | Adicionar bearing (direcao) |
| `InteractiveMap.tsx` | Refatorar | CartoDB tiles, remover zoom nativo |
| `OrderLocationMap.tsx` | Substituir | Migrar logica para WazeMap |

---

## Secao 7: Dados e Backend

### Mudancas necessarias:
1. Location storage: Migrar de Map<> in-memory para cache com TTL
2. Bearing: Backend calcula direcao entre posicoes consecutivas
3. Reverse Geocode: Novo endpoint `POST /api/geocoding/reverse`
4. Route Alerts: Novo endpoint `POST /api/geocoding/route-alerts` (Overpass API)
5. Address com lat/lng: Fluxo de criacao de order preenche lat/lng

### Schema Prisma: SEM mudancas (Address ja tem latitude? e longitude?)

---

## Secao 8: Alertas e Sinalizacoes de Rota

### Fontes de dados

| Fonte | Dado | API |
|-------|------|-----|
| Google Directions | Avisos de trafego (warnings[]) | Ja temos |
| OpenStreetMap Overpass | Quebra-molas (traffic_calming=bump/hump) | Gratuito |
| OpenStreetMap Overpass | Semaforos (highway=traffic_signals) | Gratuito |
| OpenStreetMap Overpass | Curvas perigosas (hazard=curve) | Gratuito |
| OpenStreetMap Overpass | Vias nao pavimentadas (surface=unpaved) | Gratuito |
| OpenStreetMap Overpass | Obras (highway=construction) | Gratuito |
| OpenStreetMap Overpass | Rotatorias (junction=roundabout) | Gratuito |
| OpenStreetMap Overpass | Areas alagaveis (flood_prone=yes) | Gratuito |

### Icones de alerta no mapa (SVG custom, 24x24px)
- Quebra-mola: Triangulo amarelo com ondulacao
- Semaforo: Icone semaforo estilizado
- Curva perigosa: Seta curva amarela
- Obra: Cone de obra laranja
- Rotatoria: Seta circular azul
- Area alagavel: Gota d'agua azul

### UX de alertas
1. Ao iniciar trajeto: Backend consulta Overpass para corredor de ~200m da rota
2. Icones aparecem no mapa sobre a rota (24x24px)
3. Ao clicar: tooltip com detalhes
4. Alertas proximos (<300m): toast notification temporaria
5. Toggle para ligar/desligar alertas

### Limitacoes
- OSM nao e real-time (dados podem estar desatualizados)
- Cobertura varia por regiao
- Exibido como "informativo", nao garantido

---

## Arquitetura de Componentes

```
OrderDetails.tsx
  └── WazeMap.tsx (container principal)
        ├── MapContainer (react-leaflet)
        │   ├── TileLayer (CartoDB Voyager/Dark Matter)
        │   ├── WazeAvatar (marker custom animado)
        │   ├── WazeRouteTrail (polyline + progress + fade)
        │   ├── WazeAlertIcon[] (alertas de rua)
        │   └── Destination Marker (casa custom)
        ├── WazeInfoBar (ETA, distancia, nome)
        ├── WazeControls (zoom, centralizar)
        ├── WazeAlertToast (alerta proximo)
        └── Action Button (iniciar/parar)

NewOrder.tsx / CreateOrder
  └── LocationPicker.tsx
        ├── GPS Button
        ├── Address Form Fields
        ├── Mini MapContainer
        │   ├── TileLayer
        │   └── Draggable Marker
        └── Confirmed Address Display
```

---

## Endpoints Backend (novos/modificados)

| Metodo | Path | Descricao |
|--------|------|-----------|
| POST | `/api/geocoding/reverse` | lat/lng → endereco completo |
| POST | `/api/geocoding/route-alerts` | Consulta Overpass API ao longo da rota |
| POST | `/api/services/orders/:id/location` | Atualizado: retorna bearing |
| GET | `/api/services/orders/:id/location` | Atualizado: retorna bearing |
