# FazTudo — Project Overview

## Purpose
FazTudo is a Brazilian services marketplace (similar to GetNinjas/Fiverr) connecting:
- **Clients**: hire professionals/companies for services
- **Professionals**: offer services, manage orders, receive payments
- **Companies**: manage teams, assign work, track analytics

## Tech Stack
- **Backend**: Express 5 + TypeScript 5.9 + Prisma 7.4 + SQLite (dev) + Socket.io
- **Frontend**: React 19 + React Router 7 + Vite 7 + TailwindCSS 4 + TypeScript 5.9
- **Auth**: JWT (dual-secret: access + refresh) + httpOnly cookies + bcrypt
- **Payments**: MercadoPago (PIX, credit card, boleto) + Escrow model
- **Maps**: Leaflet + OpenStreetMap + Overpass API
- **Logging**: Pino structured logging (never console.log)
- **Validation**: Zod v4

## Key Architectural Notes
- Tailwind v4: CSS-first config via `@theme {}` in `src/index.css`, NO `tailwind.config.js`
- React Router v7: imports from `"react-router"` (NOT `react-router-dom`)
- Zod v4: generic middleware in `validate.ts`
- Socket.io initialized on same HTTP server
- SQLite dev database at `backend/dev.db`
- Company features: full RBAC, channels, salary automation, teams

## Repo
- git@github.com:levygamer200-ux/faztudo.git
- Main branch: main
