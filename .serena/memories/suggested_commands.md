# FazTudo — Suggested Commands

## Backend
```bash
cd apps/backend && npm run dev           # Dev server http://localhost:3001
cd apps/backend && npm test              # Run all tests (Vitest)
cd apps/backend && npm run test:watch    # Tests in watch mode
cd apps/backend && npm run test:security # Security tests only
cd apps/backend && npx tsc --noEmit      # Type check
cd apps/backend && npm run db:seed       # Seed test data
cd apps/backend && npm run db:push       # Apply schema to DB
cd apps/backend && npm run db:studio     # Prisma Studio UI
```

## Frontend
```bash
cd apps/frontend && npm run dev          # Vite dev http://localhost:5173
cd apps/frontend && npm run build        # Production build
cd apps/frontend && npm run lint         # ESLint
cd apps/frontend && npx tsc --noEmit     # Type check
```

## Docker
```bash
docker compose up                   # All services
docker compose up backend           # Backend only
docker compose up frontend          # Frontend only
```

## Git
```bash
git pull origin main
git checkout -b feat/nome-da-feature
git add <specific-files>
git commit -m "feat: description"
git rebase origin/main
git push origin feat/nome
```
