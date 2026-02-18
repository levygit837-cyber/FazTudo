# Security Hardening v2 — FazTudo Marketplace Design

> **Data**: 2026-02-18
> **Status**: Design aprovado, aguardando plano de implementação
> **Baseado em**: Relatório de segurança gerado em 2026-02-18 (28 vulnerabilidades)
> **Escopo**: Todas as 28 vulnerabilidades — CRÍTICA, ALTA, MÉDIA, BAIXA
> **Abordagem**: TDD por domínio (5 fases)

---

## Contexto

Um segundo audit de segurança identificou 28 vulnerabilidades no FazTudo Marketplace,
distribuídas em 5 severidades. Existe um plano anterior (2026-02-17) que cobriu
22+ vulnerabilidades (data leaks de Prisma, CSP, tokenVersion, etc). Este plano
cobre as **novas** vulnerabilidades identificadas, com foco especial nas 3 críticas
de impacto financeiro direto.

---

## Vulnerabilidades Cobertas

### CRÍTICAS (3)

#### CRÍTICA-1: Webhook MercadoPago sem validação HMAC-SHA256
- **Risco**: Qualquer pessoa pode forjar pagamentos aprovados via POST ao webhook
- **Arquivo**: `backend/src/controllers/service/paymentController.ts` (linha ~532)
- **Fix**: Validar header `x-signature` com HMAC-SHA256 usando `MP_WEBHOOK_SECRET`

#### CRÍTICA-2: Double-credit em `confirmProfessionalCompletion`
- **Risco**: Profissional pode receber o valor em dobro (race condition ou fluxo alternativo)
- **Arquivo**: `backend/src/controllers/service/orderController.ts` (~linha 1046)
- **Fix**: Centralizar 100% da lógica de release em `escrowService.releasePaymentFromEscrow()`

#### CRÍTICA-3: Google Maps API key exposta para todos os usuários autenticados
- **Risco**: Chave server-side exposta — uso ilimitado por qualquer usuário logado
- **Arquivo**: `backend/src/controllers/service/locationController.ts` (~linha 252)
- **Fix**: Remover endpoint `/map-config`, usar proxy backend para todas as requisições

---

### ALTAS (6)

#### ALTA-1: Upgrade para profissional sem `requireVerified`
- **Arquivo**: `backend/src/routes/authRoutes.ts` (linha 58)
- **Fix**: Adicionar `requireVerified` à rota `/upgrade-to-professional`

#### ALTA-2: Rate limiting por IP — bypassável via X-Forwarded-For
- **Fix**: `userRateLimiter` para operações autenticadas + Redis store

#### ALTA-3: Tokens JWT access/refresh com mesmo segredo + admin sem `type: 'refresh'`
- **Fix**: `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` separados; admin refresh com `{type: 'refresh'}`

#### ALTA-4: Validação Zod ausente em rotas de transição de estado de orders
- **Fix**: Schemas Zod para accept/start/submit-completion/confirm/cancel/reschedule

#### ALTA-5: Arquivo de upload salvo ANTES de verificar autorização
- **Fix**: Reorganizar middleware — verificação antes do multer + validação magic bytes

#### ALTA-6: Log de reset token com token raw em `development`
- **Fix**: Remover log completamente (nunca logar tokens)

---

### MÉDIAS (9)

#### MÉDIA-1: IDOR via metadata arbitrário em verificationDocument
- **Fix**: Remover `...(metadata || {})` spread

#### MÉDIA-2: `/resend-verification` inacessível (usuário PENDING não tem JWT)
- **Fix**: Endpoint público de reenvio com rate limiting severo

#### MÉDIA-3: Rate limiting admin sem Redis (reinicia com o servidor)
- **Fix**: Redis store para todos os limiters + MFA para admin

#### MÉDIA-4: `createOrderSchema` não verifica `isAvailable: true` do listing
- **Fix**: Adicionar verificação no controller

#### MÉDIA-5: `rating` aceita floats (deveria ser inteiro 1-5)
- **Fix**: `z.number().int()` no schema Zod

#### MÉDIA-6: Tokens JWT em localStorage (XSS → account takeover)
- **Fix**: Migrar para httpOnly cookies com `withCredentials`

#### MÉDIA-7: Cache de escrow sem TTL e sem invalidação após update de config
- **Fix**: TTL de 5min + `invalidateConfigCache()` no `updatePlatformConfig`

#### MÉDIA-8: `attachmentUrl` aceita qualquer string (SSRF futuro)
- **Fix**: Validação de URL com schema de allowlist

#### MÉDIA-9: Operação de saque sem rate limiting por usuário
- **Fix**: `userRateLimiter` nos endpoints financeiros

---

### BAIXAS (5)

#### BAIXA-1: Stack traces em produção se `NODE_ENV=development`
- **Fix**: Guard explícito no error middleware

#### BAIXA-2: IDs sequenciais — enumeração de recursos
- **Fix**: Migrar IDs públicos de orders/payments para CUID2

#### BAIXA-3: Email do usuário pode ser enumerado no registro
- **Fix**: Mensagem genérica no registro

#### BAIXA-4: Ausência de Content-Security-Policy no frontend
- **Fix**: `<meta>` CSP no `index.html` com nonces para scripts externos

#### BAIXA-5: Chat filter bypassável com unicode/leetspeak
- **Fix**: Normalização unicode + variações comuns antes do filter

---

## Arquitetura da Solução

### Novos módulos

```
backend/src/lib/
├── webhookValidator.ts    # HMAC-SHA256 validação de webhooks
├── idempotency.ts         # Chave de idempotência para operações financeiras
└── cookieAuth.ts          # Helpers para httpOnly cookies

backend/tests/security/
├── webhook.test.ts        # Testes de webhook forgery
├── idor.test.ts           # Testes de IDOR em todos os recursos
├── authBypass.test.ts     # Testes de auth bypass e privilege escalation
└── rateLimit.test.ts      # Testes de rate limiting
```

### Variáveis de ambiente novas

```bash
JWT_ACCESS_SECRET    # Segredo exclusivo para access tokens
JWT_REFRESH_SECRET   # Segredo exclusivo para refresh tokens
MP_WEBHOOK_SECRET    # Segredo HMAC do webhook MercadoPago
REDIS_URL            # Redis para rate limiters (opcional em dev)
```

---

## Fases de Implementação

### Fase 1: Pagamentos & Escrow (4 tasks)
T1: Webhook HMAC-SHA256
T2: Double-credit fix (centralizar em escrowService)
T3: Cache de escrow com TTL + invalidação
T4: Idempotência em operações financeiras

### Fase 2: Auth & Tokens (4 tasks)
T5: JWT segredos separados + admin refresh token fix
T6: requireVerified em upgrade-to-professional
T7: Rate limiting por userId
T8: Remover log de reset token

### Fase 3: Rotas & Autorização (5 tasks)
T9: Remover /map-config + criar proxy seguro
T10: Zod schemas em rotas de transição de order
T11: Upload authorization antes do multer
T12: Validação magic bytes em uploads (file-type)
T13: Remover metadata spread em verificationDocument

### Fase 4: Frontend & Tokens (3 tasks)
T14: Migrar para httpOnly cookies (AuthContext + api.ts + backend)
T15: CSP no frontend (index.html)
T16: IDs sequenciais → CUID2

### Fase 5: CI & Suite de Testes (3 tasks)
T17: Security test suite (webhook, IDOR, authBypass, rateLimit)
T18: npm audit + secret scanning no CI
T19: CodeQL SAST no GitHub Actions

---

## Decisões de Design

1. **TDD**: Cada task escreve o teste antes do fix. Protege contra regressão.
2. **httpOnly cookies**: Tokens saem do localStorage. Requer `cookie-parser` no backend e `withCredentials: true` no Axios. CSRF mitigado via `SameSite=Strict`.
3. **CUID2 para IDs**: Prisma 7.x suporta `@default(cuid())`. Migration automática para novos recursos; IDs antigos mantidos para compatibilidade.
4. **Redis para rate limiting**: Opcional em dev (fallback para memória), obrigatório em prod.
5. **Webhook secret**: `MP_WEBHOOK_SECRET` configurado no painel do MercadoPago. Sem ele, o webhook retorna 401 (não 500).

---

## Pontos Positivos Preservados

Os seguintes controles de segurança já existem e serão MANTIDOS:
- Helmet com CSP no backend
- XSS sanitizer global (biblioteca `xss`)
- Rate limiting diferenciado (general, auth, sensitive, financial)
- JWT com token rotation e versioning (tokenVersion)
- bcrypt com 12 rounds
- Zod validation em rotas existentes
- Audit logging em operações admin
- Nenhum raw SQL (exceto health check)
- File upload com whitelist MIME e size limit
