# Security Audit Design — FazTudo Marketplace

> **Data**: 2026-02-17
> **Escopo**: Auditoria completa de seguranca (backend + frontend + testes + CI)
> **Status**: Design aprovado, aguardando plano de implementacao

---

## Resumo Executivo

Auditoria de seguranca abrangente realizada com 5 agentes em paralelo cobrindo:
- 23 route files, 11 middlewares, 28+ controllers
- 21 modelos Prisma + configuracao do banco
- Frontend completo (auth, rotas, XSS, CSP, tokens)
- Testes existentes e CI pipeline

---

## Vulnerabilidades Encontradas

### CRITICAS (3)

#### C1. JWT e Refresh Token em localStorage (Frontend)
- **Arquivo**: `frontend/src/services/api.ts`, `frontend/src/context/AuthContext.tsx`
- **Risco**: XSS leva a roubo de tokens e account takeover
- **Fix**: Migrar para httpOnly cookies ou in-memory + silent refresh

#### C2. include client/professional true retorna senha e tokens
- **Arquivos**: `orderController.ts:528-529`, `reviewController.ts:88-89`, `paymentController.ts:143-144`
- **Risco**: Objetos User completos (com password hash, refreshToken, resetToken) sao carregados
- **Fix**: Substituir include true por select explicito em todas as ocorrencias

#### C3. resetPassword sem select clause
- **Arquivo**: `authController.ts:588-595`
- **Risco**: User completo em memoria durante operacao sensivel
- **Fix**: Adicionar select clause com apenas campos necessarios

---

### ALTAS (5)

#### H1. Sem Content Security Policy no Frontend
- **Arquivo**: `frontend/index.html` (sem meta CSP)
- **Nota**: Backend tem CSP via Helmet, mas frontend serve via Vite/CDN separado

#### H2. tokenVersion exposto em respostas de registro/login
- **Arquivo**: `authController.ts` (register/login responses)
- **Fix**: Remover tokenVersion do select nas respostas ao cliente

#### H3. CPF/CNPJ (document) sobre-exposto
- **Arquivos**: Multiplos endpoints retornam document sem necessidade
- **Fix**: Modelo de visibilidade por camadas (owner vs. outros)

#### H4. balance exposto no admin listUsers
- **Arquivo**: `adminController.ts:191`
- **Fix**: Mover para endpoint financeiro dedicado

#### H5. COMPANY role nao funciona no ProtectedRoute
- **Arquivo**: `frontend/src/components/ProtectedRoute.tsx`
- **Fix**: Adicionar case para UserRole.COMPANY

---

### MEDIAS (8)

#### M1. MercadoPago SDK sem Subresource Integrity
- **Arquivo**: `frontend/src/hooks/useMercadoPago.ts`

#### M2. User object de localStorage aceito sem revalidacao
- **Arquivo**: `frontend/src/context/AuthContext.tsx`

#### M3. /uploads/chat/ servido sem autenticacao
- **Arquivo**: `backend/src/index.ts:83` — express.static antes do auth

#### M4. Rotas sem rate limiting especifico
- Geocoding, location, session routes faltam rate limiters dedicados

#### M5. Missing composite indexes (DoS via slow queries)
- Payment, Message, Notification, ServiceOrder queries sem indexes compostos

#### M6. Float para valores monetarios
- User.balance, Payment.amount, etc. usam Float em vez de Decimal

#### M7. Prisma client sem configuracao explicita de logging
- Risco de log acidental de queries com dados sensiveis

#### M8. refreshToken armazenado em plaintext no banco
- Deveria ser hashed como o resetPasswordToken

---

### BAIXAS (6)

#### L1. console.error em producao no frontend
#### L2. phone exposto em orders (ambas partes)
#### L3. Source maps nao explicitamente desabilitados
#### L4. User data sensivel (CPF, balance) em localStorage
#### L5. Sem onDelete constraints em modelos enterprise
#### L6. Coordenadas do profissional expostas em listing publico

---

## Pontos Positivos (Security Already Done Right)

1. Helmet com CSP configurado no backend
2. XSS sanitizer global (xss library)
3. Rate limiting diferenciado (general, auth, sensitive, financial)
4. JWT com token rotation e versioning
5. Timing-safe login (bcrypt dummy compare quando user nao encontrado)
6. Zod validation em rotas criticas
7. Audit logging em operacoes admin
8. rel noopener noreferrer em links externos
9. Nenhum raw SQL (exceto health check)
10. Nenhum uso inseguro de innerHTML no frontend
11. Anti-enumeration no forgotPassword
12. File upload com whitelist de MIME types e size limit

---

## Cobertura de Testes (Gap Analysis)

### Existentes (11 arquivos):
- Integration: orderFlow, chat, calendar, CRM, finance, reputation, systemMessage, email, password
- Unit: emailService, env, scheduler
- Middleware: chatFilter, sanitize
- Security: xss, validation

### Gaps Criticos:
- 0 testes de IDOR (acesso a recursos de outro usuario)
- 0 testes de auth bypass (rotas protegidas sem token/role errado)
- 0 testes de rate limiting (verificar que limites funcionam)
- 0 testes de input validation completos (SQL injection, XSS payloads)
- 0 testes no frontend
- CI sem: dependency audit, SAST, secret scanning, coverage report

---

## Proximos Passos

Invocar writing-plans para criar plano de implementacao detalhado com:
1. Correcoes de seguranca por prioridade (C, H, M, L)
2. Suite de testes de seguranca
3. Melhorias no CI/CD pipeline
