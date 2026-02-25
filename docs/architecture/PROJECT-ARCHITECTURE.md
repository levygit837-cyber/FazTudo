# PROJECT ARCHITECTURE

## Objetivo

Manter o repositório fácil de evoluir, com separação clara entre apps, documentação, planos e histórico.

## Organização de pastas

```text
apps/
  backend/
    src/
      config/        # Configurações de ambiente e integrações externas
      controllers/   # Handlers HTTP por domínio
      routes/        # Definição de rotas por domínio
      services/      # Regras de domínio e integrações
      middleware/    # Cross-cutting concerns HTTP
      lib/           # Infra compartilhada (logger, prisma, metrics, etc.)
      queues/        # Definição de filas e producers
      workers/       # Processamento assíncrono
      templates/     # Templates de e-mail
      utils/         # Funções utilitárias puras
    prisma/          # Schema, migrations e seed
    tests/           # Unitário, integração, segurança

  frontend/
    src/
      pages/         # Páginas/rotas
      components/    # Componentes visuais por domínio
      services/      # Camada HTTP da aplicação
      context/       # Providers globais
      hooks/         # Hooks reutilizáveis
      types/         # Tipos de domínio
      utils/         # Utilitários puros

  admin/
    src/
      pages/
      components/
      services/
      context/

docs/
  architecture/      # Estado atual da arquitetura e convenções
  plans/             # Planos de implementação (com data)
  changelog/legacy/  # Snapshots e históricos antigos
  reference/         # Documentação extensa de referência
```

## Convenções de evolução

1. Toda feature relevante nasce com um plano em `docs/plans/`.
2. Mudança estrutural deve atualizar este arquivo e o `README.md`.
3. Dependências são geridas por app (não no root), exceto tooling de monorepo.
4. O root só orquestra scripts entre apps (sem dependências de runtime).
5. Arquivos gerados (`dist`, `node_modules`, DB local temporário) não entram em versionamento.

## Estratégia de versionamento

- Commits semânticos: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- Branches curtas por objetivo.
- PR deve conter:
  - escopo da mudança
  - impacto por app (`backend/frontend/admin`)
  - evidências de validação (build/test/typecheck)

## Checklist de PR

- [ ] Planejamento atualizado (quando aplicável)
- [ ] Build da app alterada
- [ ] Typecheck da app alterada
- [ ] Testes do backend (se houve mudança de API/domínio)
- [ ] Documentação atualizada (se houve mudança de arquitetura)
