# FazTudo — Code Style & Conventions

## Backend Conventions
- **Response format**: Always `{ success: boolean, message: string, data?: T }`
- **Logger**: `import { createLogger } from "../lib/logger"` → `const log = createLogger("moduleName")`
  - NEVER `console.log/error` — always `log.info/error/warn/debug`
- **Prisma**: `import prisma from "../lib/prisma"` (singleton)
- **Auth chain**: `verifyToken` → `requireRole()` → `requireVerified`
- **New routes**: Create new file in `routes/`, register in `src/index.ts`
- **Validation**: Zod schemas in `middleware/validation.ts`

## Frontend Conventions
- **API calls**: Axios via `import api from "services/api"` (NEVER raw fetch)
- **Types**: Import from `"../types"` (barrel re-export), add new types to domain module NOT index.ts
- **Styling**: TailwindCSS v4 (CSS-first), custom classes: `btn`, `badge`, `card`
- **Imports**: `from "react-router"` (NOT "react-router-dom")
- **Context**: AuthContext, ThemeContext, ToastContext, SocketContext
- **Error handling**: Use `useApiCall` hook for standardized loading/error state

## Naming Conventions
- Backend controllers: `export async function funcName(req, res)`
- Frontend pages: PascalCase, organized by domain (client/, professional/, company/, etc.)
- Commits: semantic `feat:`, `fix:`, `refactor:`, `test:`, `docs:` (English)

## Critical Files (High Conflict Risk)
- `apps/frontend/src/App.tsx` — central router
- `apps/frontend/src/components/Layout.tsx` — global shell
- `apps/backend/prisma/schema.prisma` — DB schema
- `apps/backend/src/index.ts` — entry point
- `apps/backend/src/middleware/validation.ts` — all Zod schemas
