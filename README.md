# FazTudo Monorepo

Marketplace de serviços com três aplicações separadas no mesmo repositório:
- `backend` (API + filas + integrações)
- `frontend` (app principal do usuário)
- `admin` (painel administrativo)

## Estrutura

```text
faztudo-main/
├── apps/
│   ├── backend/         # API Express + Prisma + filas BullMQ
│   ├── frontend/        # SPA React/Vite para cliente/profissional/empresa
│   └── admin/           # SPA React/Vite para administração
├── docs/
│   ├── architecture/    # Arquitetura atual e convenções
│   ├── plans/           # Planos de implementação
│   ├── changelog/       # Histórico técnico e snapshots antigos
│   └── reference/       # Documentos de referência
├── docker-compose.yml
└── package.json         # Scripts raiz de orquestração
```

## Padrões adotados

- Monorepo com orquestração de scripts via `npm --prefix`
- Frontend e backend isolados em apps diferentes
- Documentação operacional separada de planos e histórico
- CI por aplicação (`backend`, `frontend`, `admin`)
- Dependências de tipagem em `devDependencies`

## Pré-requisitos

- Node.js 20+
- npm 10+
- Docker + Docker Compose (opcional, para PostgreSQL/Redis)

## Setup rápido

```bash
# 1) Dependências por app
cd apps/backend && npm ci
cd ../frontend && npm ci
cd ../admin && npm ci

# 2) Infra local (opcional)
cd ../../
docker compose up postgres redis -d

# 3) Banco (backend)
cd apps/backend
npx prisma generate
npm run db:push
npm run db:seed
```

## Execução (desenvolvimento)

Em terminais separados:

```bash
# API
npm run dev:backend

# Frontend
npm run dev:frontend

# Admin
npm run dev:admin
```

## Scripts úteis na raiz

```bash
npm run build
npm run typecheck
npm run test
npm run lint
npm run db:push
npm run db:seed
npm run db:studio
```

## Docker Compose

O `docker-compose.yml` já está alinhado com a nova estrutura em `apps/*`.

```bash
docker compose up
```

## Versionamento e evolução

Fluxo recomendado:

1. Criar branch por feature (`feat/...`, `fix/...`, `refactor/...`).
2. Atualizar plano em `docs/plans/` antes da implementação relevante.
3. Validar no mínimo `typecheck` + `build` da app impactada.
4. Usar commits semânticos.
5. Registrar decisões de arquitetura em `docs/architecture/`.

## Atualização de dependências

Quando houver acesso à internet no ambiente:

```bash
cd apps/backend && npm outdated
cd ../frontend && npm outdated
cd ../admin && npm outdated
```

Atualize por aplicação e valide com `build/test/typecheck` antes de merge.

## Documentação

- Arquitetura atual: `docs/architecture/PROJECT-ARCHITECTURE.md`
- Planos de execução: `docs/plans/`
- Histórico técnico legado: `docs/changelog/legacy/`
- Referências complementares: `docs/reference/`
