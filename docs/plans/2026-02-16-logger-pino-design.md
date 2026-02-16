# Design: Logger Estruturado com Pino

> **Data**: 2026-02-16
> **Status**: Aprovado
> **Abordagem**: Pino + pino-http + pino-pretty

---

## Problema

Backend usa 128 `console.log/error/warn` em 27 arquivos. Sem estrutura, sem contexto, sem levels padronizados, sem request tracing. Em produção, logs são impossíveis de filtrar ou agregar.

## Solução

Substituir todo `console.log/error` por Pino logger estruturado.

## Arquivos

### Novos
- `backend/src/lib/logger.ts` — Instância Pino configurada
- `backend/src/middleware/requestLog.ts` — pino-http middleware

### Modificados (27 arquivos)
- Todos os controllers, services, middleware e routes que usam `console.log/error`
- `backend/src/index.ts` — Registrar pino-http middleware, substituir console.log no startup

## Configuração

```typescript
// src/lib/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,
});

// Child loggers por módulo
export const createLogger = (module: string) => logger.child({ module });
export default logger;
```

## Padrão de Uso

```typescript
// Em cada arquivo
import { createLogger } from '../lib/logger';
const log = createLogger('orderController');

// Substituir:
console.log('Order created:', orderId);
console.error('Error creating order:', error);

// Por:
log.info({ orderId }, 'Order created');
log.error({ err: error, orderId }, 'Error creating order');
```

## Request Logging

`pino-http` gera automaticamente:
- Request ID (X-Request-Id)
- Método HTTP + URL
- Status code
- Latência (ms)
- User agent

Substitui o `authLogger` manual atual.

## Dependências

```bash
npm install pino pino-http
npm install -D pino-pretty
```

## Variáveis de Ambiente

```
LOG_LEVEL=info  # trace, debug, info, warn, error, fatal
```
