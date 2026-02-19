# Email Verification Service - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar serviço de email para verificação de conta, reset de senha e notificações, usando Brevo (SMTP gratuito) em produção e Ethereal/console em desenvolvimento — removendo todas as referências ao Resend.

**Architecture:** Nodemailer como transport layer universal com estratégia multi-ambiente: Ethereal (dev) → Brevo SMTP (produção). O emailService.ts será o módulo central que encapsula toda lógica de envio, templates HTML, e retry. O fluxo de verificação usa tokens criptográficos hasheados (mesmo padrão já usado no password reset). O sistema de notificações existente será estendido para disparar emails opcionalmente.

**Tech Stack:** Nodemailer (SMTP transport), Brevo Free Tier (300 emails/dia, forever free), crypto (tokens), Pino (logging)

---

## Análise de Alternativas — Por que Brevo?

| Critério | Brevo | ~~Resend~~ | Amazon SES | Gmail SMTP | Self-hosted |
|----------|-------|------------|------------|------------|-------------|
| **Custo** | ✅ 300/dia GRÁTIS para sempre | 100/dia grátis | 3K/mês grátis (12 meses) | 500/dia grátis | VPS $5-20/mês |
| **Latência** | ⚡ 1-3s | ⚡ <1s | ⚡ <1s | ⚡ 1-3s | Variável |
| **Segurança** | ✅ DKIM/SPF/DMARC, GDPR | ✅ SOC 2 | ✅✅ IAM, SOC/ISO | ⚠️ Risco de ban | ⚠️ Você gerencia tudo |
| **Alto tráfego** | ✅ 9K/mês grátis | ❌ 3K/mês, 100/dia | ✅✅✅ Melhor | ❌ 500/dia, risco ban | Depende do server |
| **Setup Node.js** | Fácil (SMTP) | Fácil (SDK) | Moderado (AWS) | Fácil | Difícil |

**Decisão:** Brevo vence em todos os critérios:
- **Zero custo** permanente (300/dia = ~9.000/mês)
- **Segurança** adequada (DKIM, SPF, DMARC, TLS, GDPR compliant)
- **Latência baixa** (~1-3 segundos)
- **Alto tráfego** suportado (300/dia cobre estágio inicial; upgrade barato quando necessário: $9/mês para 5K/mês)
- **Sem risco de ban** (diferente do Gmail SMTP)
- **Sem expiração** (diferente do SES free tier de 12 meses)

**Estratégia de escala futura:** Quando ultrapassar 300/dia → migrar para Amazon SES ($0.10/1.000 emails). A abstração via Nodemailer torna a troca trivial (mudar apenas host/porta/credenciais no .env).

---

## Estado Atual do Codebase

### ✅ Já existe
- Password reset com tokens hasheados (SHA256) em `authController.ts:437-503`
- Stub de `verifyEmail` retornando 501 em `authController.ts:574-603`
- Rota `POST /api/auth/verify-email` registrada em `authRoutes.ts:32`
- `ENABLE_EMAIL_NOTIFICATIONS` em `env.ts:66` (não usada)
- `RESEND_APIKEY` em `.env.example:40` (referência a remover)
- Notification service completo (in-app only) em `notificationService.ts`
- Frontend de password reset funcional (`ForgotPassword.tsx`, `ResetPassword.tsx`)

### ❌ Não existe
- Nenhuma lib de email instalada (sem nodemailer, sem resend)
- Nenhum template de email HTML
- Campos de verificação de email no User model (só tem `isVerified` para KYC)
- Email service module
- Página frontend de verificação de email
- Integração de email no notification service

---

## Arquivos que serão criados/modificados

### Criar
- `backend/src/services/emailService.ts` — Módulo central de envio de emails
- `backend/src/templates/emails/verification.ts` — Template de verificação
- `backend/src/templates/emails/passwordReset.ts` — Template de reset
- `backend/src/templates/emails/welcome.ts` — Template de boas-vindas
- `backend/src/templates/emails/base.ts` — Layout base HTML compartilhado
- `backend/tests/unit/emailService.test.ts` — Testes do email service
- `backend/tests/integration/emailVerification.test.ts` — Testes do fluxo de verificação
- `frontend/src/pages/VerifyEmail.tsx` — Página de verificação de email

### Modificar
- `backend/prisma/schema.prisma` — Adicionar campos de verificação ao User
- `backend/src/config/env.ts` — Adicionar variáveis SMTP, remover RESEND
- `backend/.env.example` — Atualizar variáveis de ambiente
- `backend/src/controllers/authController.ts` — Implementar verifyEmail, modificar register
- `backend/src/routes/authRoutes.ts` — Adicionar rota resend-verification
- `backend/src/services/notificationService.ts` — Integrar email opcional
- `frontend/src/App.tsx` — Adicionar rota /verify-email/:token
- `backend/package.json` — Adicionar nodemailer

---

## Task 1: Instalar Nodemailer e remover referências ao Resend

**Files:**
- Modify: `backend/package.json` (instalar nodemailer)
- Modify: `backend/.env.example:39-40` (remover RESEND_APIKEY, adicionar SMTP vars)

**Step 1: Instalar nodemailer e tipos**

Run:
```bash
cd backend && npm install nodemailer && npm install -D @types/nodemailer
```

**Step 2: Remover referência ao Resend do .env.example**

Em `backend/.env.example`, substituir:
```
# Email (Resend)
RESEND_APIKEY=
```

Por:
```
# Email (SMTP - Brevo em produção, Ethereal em dev)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=FazTudo
SMTP_FROM_EMAIL=noreply@faztudo.com.br
```

**Step 3: Verificar que não há outras referências ao Resend**

Run:
```bash
cd backend && grep -ri "resend" --include="*.ts" --include="*.json" --include="*.env*" .
```
Expected: Nenhum resultado (ou apenas o .env.example que acabamos de limpar)

**Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/.env.example
git commit -m "feat: add nodemailer, remove Resend references"
```

---

## Task 2: Atualizar configuração de ambiente (env.ts)

**Files:**
- Modify: `backend/src/config/env.ts` (adicionar SMTP config, remover RESEND)

**Step 1: Escrever teste para a nova config**

Criar `backend/tests/unit/envSmtp.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("SMTP Environment Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should have SMTP fields in config interface", async () => {
    process.env.NODE_ENV = "test";
    const { env } = await import("../../src/config/env");

    expect(env).toHaveProperty("SMTP_HOST");
    expect(env).toHaveProperty("SMTP_PORT");
    expect(env).toHaveProperty("SMTP_USER");
    expect(env).toHaveProperty("SMTP_PASS");
    expect(env).toHaveProperty("SMTP_FROM_NAME");
    expect(env).toHaveProperty("SMTP_FROM_EMAIL");
  });

  it("should default SMTP_PORT to 587", async () => {
    process.env.NODE_ENV = "test";
    const { env } = await import("../../src/config/env");
    expect(env.SMTP_PORT).toBe(587);
  });

  it("should default SMTP_FROM_NAME to FazTudo", async () => {
    process.env.NODE_ENV = "test";
    const { env } = await import("../../src/config/env");
    expect(env.SMTP_FROM_NAME).toBe("FazTudo");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/envSmtp.test.ts`
Expected: FAIL — SMTP fields not in config

**Step 3: Adicionar campos SMTP ao EnvConfig**

Em `backend/src/config/env.ts`, na interface `EnvConfig`, após a linha `ENABLE_EMAIL_NOTIFICATIONS: boolean;`, adicionar:

```typescript
  // Email (SMTP)
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM_NAME: string;
  SMTP_FROM_EMAIL: string;
```

E no objeto `config` dentro de `getEnvConfig()`, após a linha `ENABLE_EMAIL_NOTIFICATIONS:...`, adicionar:

```typescript
    // Email (SMTP)
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'FazTudo',
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || 'noreply@faztudo.com.br',
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/unit/envSmtp.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/config/env.ts backend/tests/unit/envSmtp.test.ts
git commit -m "feat: add SMTP config to env, remove Resend references"
```

---

## Task 3: Adicionar campos de verificação de email ao User model

**Files:**
- Modify: `backend/prisma/schema.prisma:82-130` (User model)

**Step 1: Adicionar campos ao User model**

Em `backend/prisma/schema.prisma`, no model User, após a linha `resetPasswordExpires DateTime?`, adicionar:

```prisma
  emailVerified          Boolean   @default(false)
  emailVerifyToken       String?   @unique
  emailVerifyExpires     DateTime?
```

**Nota:** `isVerified` continua existindo para KYC (verificação documental). `emailVerified` é especificamente para verificação de email.

**Step 2: Aplicar schema no banco**

Run:
```bash
cd backend && npx prisma db push
```
Expected: Schema aplicado com sucesso

**Step 3: Verificar que o Prisma client foi atualizado**

Run:
```bash
cd backend && npx prisma generate
```
Expected: Prisma Client generated

**Step 4: Verificar tipos gerados**

Run:
```bash
cd backend && npx tsc --noEmit
```
Expected: Sem erros de tipo

**Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add email verification fields to User model"
```

---

## Task 4: Criar template base de email HTML

**Files:**
- Create: `backend/src/templates/emails/base.ts`

**Step 1: Criar diretório de templates**

Run:
```bash
mkdir -p backend/src/templates/emails
```

**Step 2: Criar template base**

Criar `backend/src/templates/emails/base.ts`:

```typescript
/**
 * Template base HTML para todos os emails do FazTudo.
 * Responsivo, compatível com clientes de email (Gmail, Outlook, etc.).
 * Usa inline styles (requisito de email HTML).
 */
export function baseTemplate(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FazTudo</title>
  <!--[if mso]>
  <style>table,td,div,p{font-family:Arial,sans-serif;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">FazTudo</h1>
              <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Marketplace de Serviços</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                Este email foi enviado automaticamente pelo FazTudo.<br>
                Se você não solicitou esta ação, ignore este email.
              </p>
              <p style="margin:8px 0 0;color:#cbd5e1;font-size:11px;">
                &copy; ${new Date().getFullYear()} FazTudo. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Gera um botão CTA (call-to-action) estilizado para email.
 */
export function ctaButton(text: string, url: string, color: string = '#2563eb'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
  <tr>
    <td align="center" style="border-radius:8px;background-color:${color};">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}
```

**Step 3: Verificar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: Sem erros

**Step 4: Commit**

```bash
git add backend/src/templates/emails/base.ts
git commit -m "feat: add base HTML email template"
```

---

## Task 5: Criar templates de verificação e reset de senha

**Files:**
- Create: `backend/src/templates/emails/verification.ts`
- Create: `backend/src/templates/emails/passwordReset.ts`
- Create: `backend/src/templates/emails/welcome.ts`

**Step 1: Criar template de verificação de email**

Criar `backend/src/templates/emails/verification.ts`:

```typescript
import { baseTemplate, ctaButton } from './base';

export function verificationEmailTemplate(name: string, verifyUrl: string): string {
  const content = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Olá, ${name}! 👋</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
      Obrigado por se cadastrar no <strong>FazTudo</strong>! Para ativar sua conta e começar a usar todos os recursos, confirme seu endereço de email clicando no botão abaixo:
    </p>
    ${ctaButton('Verificar meu email', verifyUrl)}
    <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.5;">
      Ou copie e cole este link no seu navegador:
    </p>
    <p style="margin:0 0 16px;padding:12px;background-color:#f1f5f9;border-radius:6px;word-break:break-all;color:#2563eb;font-size:13px;">
      ${verifyUrl}
    </p>
    <p style="margin:0;color:#94a3b8;font-size:13px;">
      ⏰ Este link expira em <strong>24 horas</strong>.
    </p>`;

  return baseTemplate(content, 'Confirme seu email para ativar sua conta no FazTudo');
}
```

**Step 2: Criar template de reset de senha**

Criar `backend/src/templates/emails/passwordReset.ts`:

```typescript
import { baseTemplate, ctaButton } from './base';

export function passwordResetEmailTemplate(name: string, resetUrl: string): string {
  const content = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Redefinição de senha</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
      Olá, <strong>${name}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta no FazTudo.
    </p>
    ${ctaButton('Redefinir minha senha', resetUrl, '#dc2626')}
    <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.5;">
      Ou copie e cole este link no seu navegador:
    </p>
    <p style="margin:0 0 16px;padding:12px;background-color:#f1f5f9;border-radius:6px;word-break:break-all;color:#2563eb;font-size:13px;">
      ${resetUrl}
    </p>
    <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">
      ⏰ Este link expira em <strong>1 hora</strong>.
    </p>
    <p style="margin:0;color:#ef4444;font-size:13px;font-weight:500;">
      ⚠️ Se você não solicitou esta redefinição, ignore este email. Sua senha não será alterada.
    </p>`;

  return baseTemplate(content, 'Solicitação de redefinição de senha - FazTudo');
}
```

**Step 3: Criar template de boas-vindas**

Criar `backend/src/templates/emails/welcome.ts`:

```typescript
import { baseTemplate, ctaButton } from './base';

export function welcomeEmailTemplate(name: string, loginUrl: string): string {
  const content = `
    <h2 style="margin:0 0 8px;color:#1e293b;font-size:22px;">Bem-vindo ao FazTudo! 🎉</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">
      Olá, <strong>${name}</strong>! Sua conta foi verificada com sucesso. Agora você pode aproveitar todos os recursos do nosso marketplace de serviços.
    </p>
    <div style="margin:16px 0;padding:16px;background-color:#f0fdf4;border-radius:8px;border-left:4px solid #22c55e;">
      <p style="margin:0 0 8px;color:#15803d;font-size:14px;font-weight:600;">O que você pode fazer agora:</p>
      <ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
        <li>Buscar e contratar serviços profissionais</li>
        <li>Criar seu catálogo de serviços (profissionais)</li>
        <li>Conversar diretamente com profissionais</li>
        <li>Pagamentos seguros via MercadoPago</li>
      </ul>
    </div>
    ${ctaButton('Acessar minha conta', loginUrl, '#22c55e')}`;

  return baseTemplate(content, 'Sua conta FazTudo está pronta!');
}
```

**Step 4: Verificar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: Sem erros

**Step 5: Commit**

```bash
git add backend/src/templates/emails/verification.ts backend/src/templates/emails/passwordReset.ts backend/src/templates/emails/welcome.ts
git commit -m "feat: add email templates for verification, reset and welcome"
```

---

## Task 6: Criar o Email Service

**Files:**
- Create: `backend/src/services/emailService.ts`
- Create: `backend/tests/unit/emailService.test.ts`

**Step 1: Escrever testes para o email service**

Criar `backend/tests/unit/emailService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nodemailer before importing emailService
const mockSendMail = vi.fn().mockResolvedValue({
  messageId: "test-message-id",
  accepted: ["test@test.com"],
  rejected: [],
});

const mockCreateTransport = vi.fn().mockReturnValue({
  sendMail: mockSendMail,
  verify: vi.fn().mockResolvedValue(true),
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
    createTestAccount: vi.fn().mockResolvedValue({
      user: "ethereal-user",
      pass: "ethereal-pass",
    }),
    getTestMessageUrl: vi.fn().mockReturnValue("https://ethereal.email/message/123"),
  },
}));

// Mock env
vi.mock("../../src/config/env", () => ({
  env: {
    NODE_ENV: "test",
    SMTP_HOST: "",
    SMTP_PORT: 587,
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM_NAME: "FazTudo",
    SMTP_FROM_EMAIL: "noreply@faztudo.com.br",
    ENABLE_EMAIL_NOTIFICATIONS: true,
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));

describe("EmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export sendEmail function", async () => {
    const { sendEmail } = await import("../../src/services/emailService");
    expect(typeof sendEmail).toBe("function");
  });

  it("should send email with correct parameters", async () => {
    const { sendEmail } = await import("../../src/services/emailService");

    const result = await sendEmail({
      to: "test@test.com",
      subject: "Test Subject",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@test.com",
        subject: "Test Subject",
        html: "<p>Test</p>",
      })
    );
  });

  it("should export sendVerificationEmail function", async () => {
    const { sendVerificationEmail } = await import("../../src/services/emailService");
    expect(typeof sendVerificationEmail).toBe("function");
  });

  it("should export sendPasswordResetEmail function", async () => {
    const { sendPasswordResetEmail } = await import("../../src/services/emailService");
    expect(typeof sendPasswordResetEmail).toBe("function");
  });

  it("should export sendWelcomeEmail function", async () => {
    const { sendWelcomeEmail } = await import("../../src/services/emailService");
    expect(typeof sendWelcomeEmail).toBe("function");
  });

  it("should handle send failure gracefully", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP connection failed"));

    const { sendEmail } = await import("../../src/services/emailService");

    const result = await sendEmail({
      to: "test@test.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/emailService.test.ts`
Expected: FAIL — module not found

**Step 3: Criar o email service**

Criar `backend/src/services/emailService.ts`:

```typescript
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env, isDevelopment, isTest } from "../config/env";
import { createLogger } from "../lib/logger";
import { verificationEmailTemplate } from "../templates/emails/verification";
import { passwordResetEmailTemplate } from "../templates/emails/passwordReset";
import { welcomeEmailTemplate } from "../templates/emails/welcome";

const log = createLogger("emailService");

// ==================== TRANSPORTER ====================

let transporter: Transporter | null = null;

/**
 * Obtém ou cria o transporter Nodemailer.
 * - Produção: usa SMTP configurado (Brevo ou outro)
 * - Dev/Test sem SMTP: usa Ethereal (emails capturados, não entregues)
 */
async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER) {
    // Produção: SMTP configurado (Brevo, SES, etc.)
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // true para porta 465, false para 587
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    log.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, "SMTP transport configured");
  } else {
    // Dev/Test: Ethereal (catch-all email service)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    log.info("Ethereal transport configured (emails won't be delivered)");
  }

  return transporter;
}

// ==================== TIPOS ====================

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | null;
  error?: string;
}

// ==================== ENVIO GENÉRICO ====================

/**
 * Envia um email. Retorna resultado sem lançar exceção.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const transport = await getTransporter();
    const from = `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`;

    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    // Em dev/test com Ethereal, mostra URL de preview
    const previewUrl = isDevelopment || isTest
      ? nodemailer.getTestMessageUrl(info) || null
      : null;

    if (previewUrl) {
      log.info({ previewUrl, to: options.to }, "Email preview URL (Ethereal)");
    }

    log.info(
      { messageId: info.messageId, to: options.to, subject: options.subject },
      "Email sent successfully"
    );

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error({ err: error, to: options.to, subject: options.subject }, "Failed to send email");

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ==================== EMAILS ESPECÍFICOS ====================

/**
 * Envia email de verificação de conta.
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  verifyUrl: string
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: "Verifique seu email - FazTudo",
    html: verificationEmailTemplate(name, verifyUrl),
  });
}

/**
 * Envia email de reset de senha.
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: "Redefinição de senha - FazTudo",
    html: passwordResetEmailTemplate(name, resetUrl),
  });
}

/**
 * Envia email de boas-vindas após verificação.
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  loginUrl: string
): Promise<SendEmailResult> {
  return sendEmail({
    to: email,
    subject: "Bem-vindo ao FazTudo! 🎉",
    html: welcomeEmailTemplate(name, loginUrl),
  });
}

// ==================== RESET TRANSPORTER (para testes) ====================

/**
 * Reseta o transporter. Útil apenas para testes.
 */
export function _resetTransporter(): void {
  transporter = null;
}

export default {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/unit/emailService.test.ts`
Expected: All tests PASS

**Step 5: Verificar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: Sem erros

**Step 6: Commit**

```bash
git add backend/src/services/emailService.ts backend/tests/unit/emailService.test.ts
git commit -m "feat: add email service with Nodemailer (Brevo SMTP + Ethereal dev)"
```

---

## Task 7: Implementar verificação de email no registro

**Files:**
- Modify: `backend/src/controllers/authController.ts:70-170` (register)
- Modify: `backend/src/controllers/authController.ts:574-603` (verifyEmail)
- Modify: `backend/src/routes/authRoutes.ts` (adicionar resend-verification)
- Create: `backend/tests/integration/emailVerification.test.ts`

**Step 1: Escrever testes de integração**

Criar `backend/tests/integration/emailVerification.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";

// Mock emailService antes de importar o app
vi.mock("../../src/services/emailService", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "test-id" }),
  default: {
    sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
    sendWelcomeEmail: vi.fn().mockResolvedValue({ success: true }),
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import app from "../../src/index";
import prisma from "../../src/lib/prisma";
import { sendVerificationEmail, sendWelcomeEmail } from "../../src/services/emailService";

describe("Email Verification Flow", () => {
  const testEmail = `emailverify_${Date.now()}@test.com`;
  const testPassword = "TestPassword123!";
  let verifyToken: string;

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: "emailverify_" } },
    });
  });

  it("should send verification email on registration", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: testEmail,
        password: testPassword,
        name: "Test Verify User",
        role: "CLIENT",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verificar que sendVerificationEmail foi chamado
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      testEmail,
      "Test Verify User",
      expect.stringContaining("/verify-email/")
    );

    // Verificar que user foi criado com emailVerified = false
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user?.emailVerified).toBe(false);
    expect(user?.emailVerifyToken).toBeTruthy();
    expect(user?.emailVerifyExpires).toBeTruthy();
  });

  it("should verify email with valid token", async () => {
    // Buscar o token hasheado do banco
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
      select: { emailVerifyToken: true },
    });

    // Precisamos do token original (não hasheado) — para o teste,
    // vamos gerar um novo token e salvar o hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.user.update({
      where: { email: testEmail },
      data: {
        emailVerifyToken: hashedToken,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: rawToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verificar que emailVerified = true
    const updatedUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(updatedUser?.emailVerified).toBe(true);
    expect(updatedUser?.emailVerifyToken).toBeNull();
    expect(updatedUser?.emailVerifyExpires).toBeNull();

    // Verificar que email de boas-vindas foi enviado
    expect(sendWelcomeEmail).toHaveBeenCalledWith(
      testEmail,
      expect.any(String),
      expect.stringContaining("/login")
    );
  });

  it("should reject expired verification token", async () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Criar novo user com token expirado
    const expiredEmail = `emailverify_expired_${Date.now()}@test.com`;
    await prisma.user.create({
      data: {
        email: expiredEmail,
        password: "hashed",
        name: "Expired User",
        role: "CLIENT",
        emailVerifyToken: hashedToken,
        emailVerifyExpires: new Date(Date.now() - 1000), // expirado
      },
    });

    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: rawToken });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should reject invalid verification token", async () => {
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: "invalid-token-12345" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/integration/emailVerification.test.ts`
Expected: FAIL (verifyEmail retorna 501)

**Step 3: Modificar register para enviar email de verificação**

Em `backend/src/controllers/authController.ts`, adicionar import no topo:

```typescript
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../services/emailService";
```

No `register`, após criar o user (após `prisma.user.create`), e ANTES de `res.status(201).json(...)`, adicionar a geração de token e envio de email:

```typescript
    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedVerifyToken = crypto
      .createHash("sha256")
      .update(verifyToken)
      .digest("hex");

    // Save hashed token + 24h expiration
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: hashedVerifyToken,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // Send verification email (fire and forget — don't block registration)
    const { env: envConfig } = await import("../config/env");
    const verifyUrl = `${envConfig.FRONTEND_URL}/verify-email/${verifyToken}`;

    sendVerificationEmail(user.email, user.name, verifyUrl).catch((err) => {
      log.error({ err, email: user.email }, "Failed to send verification email");
    });
```

**Step 4: Implementar verifyEmail (substituir o stub 501)**

Substituir TODO o conteúdo da função `verifyEmail` em `authController.ts`:

```typescript
export const verifyEmail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json(errorResponse("Verification token is required"));
      return;
    }

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find user with this token and check expiration
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: hashedToken,
        emailVerifyExpires: { gt: new Date() },
      },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      res.status(400).json(errorResponse("Invalid or expired verification token"));
      return;
    }

    // Mark email as verified and clear token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        status: "ACTIVE", // Ativar conta após verificação
      },
    });

    // Send welcome email (fire and forget)
    const { env: envConfig } = await import("../config/env");
    const loginUrl = `${envConfig.FRONTEND_URL}/login`;

    sendWelcomeEmail(user.email, user.name, loginUrl).catch((err) => {
      log.error({ err, email: user.email }, "Failed to send welcome email");
    });

    log.info({ userId: user.id, email: user.email }, "Email verified successfully");

    res.status(200).json(
      successResponse(null, "Email verificado com sucesso! Sua conta está ativa.")
    );
  } catch (error) {
    log.error({ err: error }, "Verify email error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 5: Adicionar endpoint de reenvio de verificação**

Em `authController.ts`, adicionar nova função ANTES de `submitDocumentVerification`:

```typescript
// Resend verification email
export const resendVerificationEmail = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json(errorResponse("Authentication required", 401));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user) {
      res.status(404).json(errorResponse("User not found", 404));
      return;
    }

    if (user.emailVerified) {
      res.status(400).json(errorResponse("Email already verified"));
      return;
    }

    // Generate new token
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(verifyToken)
      .digest("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: hashedToken,
        emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const { env: envConfig } = await import("../config/env");
    const verifyUrl = `${envConfig.FRONTEND_URL}/verify-email/${verifyToken}`;

    const result = await sendVerificationEmail(user.email, user.name, verifyUrl);

    if (result.success) {
      res.status(200).json(
        successResponse(null, "Verification email sent. Check your inbox.")
      );
    } else {
      res.status(500).json(errorResponse("Failed to send verification email", 500));
    }
  } catch (error) {
    log.error({ err: error }, "Resend verification email error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 6: Registrar nova rota em authRoutes.ts**

Em `backend/src/routes/authRoutes.ts`, após a linha `router.post("/verify-email", ...)`, adicionar:

```typescript
router.post("/resend-verification", verifyToken, sensitiveLimiter, authController.resendVerificationEmail);
```

**Step 7: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/integration/emailVerification.test.ts`
Expected: All tests PASS

**Step 8: Run all existing tests to check for regressions**

Run: `cd backend && npx vitest run`
Expected: All tests PASS (exceto o bug conhecido de validation.test.ts)

**Step 9: Verificar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: Sem erros

**Step 10: Commit**

```bash
git add backend/src/controllers/authController.ts backend/src/routes/authRoutes.ts backend/tests/integration/emailVerification.test.ts
git commit -m "feat: implement email verification on registration with token flow"
```

---

## Task 8: Integrar email no password reset

**Files:**
- Modify: `backend/src/controllers/authController.ts:437-503` (forgotPassword)

**Step 1: Modificar forgotPassword para enviar email**

Em `authController.ts`, na função `forgotPassword`, substituir o bloco de TODO (linhas ~478-484):

```typescript
      // Log the reset link in development (replace with email in production)
      if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
        log.info({ resetUrl, email: user.email }, "Password reset link generated (dev mode)");
      }

      // TODO: Send email with resetUrl when email service is configured
      // Example: await sendResetEmail(user.email, resetUrl);
```

Por:

```typescript
      // Send password reset email
      sendPasswordResetEmail(user.email, user.name || "Usuário", resetUrl).catch((err) => {
        log.error({ err, email: user.email }, "Failed to send password reset email");
      });

      if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
        log.info({ resetUrl, email: user.email }, "Password reset link generated (dev mode)");
      }
```

**Nota:** O `user.name` precisa ser incluído no `select` da query. Verificar se `select: { id: true, email: true }` está no `forgotPassword` e adicionar `name: true`:

```typescript
      select: { id: true, email: true, name: true },
```

**Step 2: Run existing password reset tests**

Run: `cd backend && npx vitest run tests/integration/passwordReset.test.ts`
Expected: All tests PASS

**Step 3: Run all tests**

Run: `cd backend && npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add backend/src/controllers/authController.ts
git commit -m "feat: send password reset email via email service"
```

---

## Task 9: Criar página de verificação de email no frontend

**Files:**
- Create: `frontend/src/pages/VerifyEmail.tsx`
- Modify: `frontend/src/App.tsx` (adicionar rota)

**Step 1: Criar a página VerifyEmail**

Criar `frontend/src/pages/VerifyEmail.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token de verificação não encontrado.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.post('/auth/verify-email', { token });
        if (response.data.success) {
          setStatus('success');
          setMessage(response.data.message || 'Email verificado com sucesso!');
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Falha na verificação.');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(
          err.response?.data?.message ||
          'Token inválido ou expirado. Solicite um novo email de verificação.'
        );
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="mx-auto w-16 h-16 mb-4 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Verificando seu email...
            </h2>
            <p className="text-gray-500 dark:text-gray-400">Aguarde um momento.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto w-16 h-16 mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Email verificado! ✅
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fazer login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Falha na verificação
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                to="/login"
                className="block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Ir para login
              </Link>
              <p className="text-sm text-gray-400">
                Faça login para solicitar um novo email de verificação.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Adicionar rota no App.tsx**

Em `frontend/src/App.tsx`, adicionar o import:

```typescript
import VerifyEmail from './pages/VerifyEmail';
```

E adicionar a rota junto com as outras rotas públicas (perto de `/forgot-password` e `/reset-password/:token`):

```tsx
<Route path="/verify-email/:token" element={<VerifyEmail />} />
```

**Step 3: Verificar tipos do frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: Sem erros

**Step 4: Commit**

```bash
git add frontend/src/pages/VerifyEmail.tsx frontend/src/App.tsx
git commit -m "feat: add email verification page in frontend"
```

---

## Task 10: Integrar email opcional no notification service

**Files:**
- Modify: `backend/src/services/notificationService.ts`

**Step 1: Adicionar integração de email ao createNotification**

Em `backend/src/services/notificationService.ts`, adicionar imports no topo:

```typescript
import { env } from "../config/env";
import { sendEmail } from "./emailService";
import { createLogger } from "../lib/logger";

const log = createLogger("notificationService");
```

Substituir os TODOs no `createNotification` (linhas 46-47):

```typescript
  // TODO: Integrar com sistema de push notifications (Firebase, OneSignal, etc.)
  // TODO: Integrar com sistema de email se configurado
```

Por:

```typescript
  // Enviar email se habilitado
  if (env.ENABLE_EMAIL_NOTIFICATIONS) {
    // Buscar email do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      sendEmail({
        to: user.email,
        subject: `FazTudo - ${title}`,
        html: `<div style="font-family:sans-serif;padding:16px;">
          <h2 style="color:#1e293b;">${title}</h2>
          <p style="color:#475569;">${message}</p>
          <hr style="border-color:#e2e8f0;" />
          <p style="color:#94a3b8;font-size:12px;">FazTudo - Marketplace de Serviços</p>
        </div>`,
      }).catch((err) => {
        log.error({ err, userId, type }, "Failed to send notification email");
      });
    }
  }
```

**Step 2: Run all tests**

Run: `cd backend && npx vitest run`
Expected: All tests PASS

**Step 3: Verificar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: Sem erros

**Step 4: Commit**

```bash
git add backend/src/services/notificationService.ts
git commit -m "feat: integrate email sending in notification service (optional)"
```

---

## Task 11: Atualizar .env.example e CLAUDE.md

**Files:**
- Modify: `backend/.env.example`
- Modify: `CLAUDE.md`

**Step 1: Atualizar .env.example**

O .env.example já foi atualizado na Task 1 (remoção do RESEND e adição do SMTP).
Verificar que está correto.

**Step 2: Atualizar CLAUDE.md**

Remover a referência "Resend/SendGrid" da seção "O Que Precisa Ser Melhorado/Corrigido", item 12. Atualizar para refletir que o email foi implementado.

No CLAUDE.md, na seção de prioridade BAIXA, substituir:

```markdown
12. **Sem email**: Notificações existem apenas in-app. Integrar com serviço de email (Resend/SendGrid).
```

Por:

```markdown
12. **Email implementado**: Verificação de email, reset de senha e notificações opcionais via Brevo SMTP (Nodemailer). Ver `backend/src/services/emailService.ts`.
```

Também atualizar a seção de Variáveis de Ambiente do backend para incluir as variáveis SMTP.

**Step 3: Commit**

```bash
git add CLAUDE.md backend/.env.example
git commit -m "docs: update CLAUDE.md and .env.example for email service"
```

---

## Task 12: Type-check final e testes completos

**Files:** Nenhum arquivo novo

**Step 1: Type-check backend**

Run: `cd backend && npx tsc --noEmit`
Expected: Sem erros

**Step 2: Type-check frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: Sem erros

**Step 3: Rodar todos os testes do backend**

Run: `cd backend && npx vitest run`
Expected: All tests PASS (exceto bug conhecido de validation.test.ts com 'PIX')

**Step 4: Verificar que o backend inicia sem erros**

Run: `cd backend && timeout 10 npm run dev || true`
Expected: Server inicia em http://localhost:3001 sem erros

**Step 5: Verificar que o frontend builda sem erros**

Run: `cd frontend && npm run build`
Expected: Build de produção sem erros

**Step 6: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore: final adjustments for email verification feature"
```

---

## Resumo dos Arquivos

| # | Ação | Arquivo | Descrição |
|---|------|---------|-----------|
| 1 | Instalar | `backend/package.json` | Adicionar nodemailer |
| 2 | Remover | `backend/.env.example` | Remover RESEND_APIKEY |
| 3 | Criar | `backend/.env.example` | Adicionar SMTP_* vars |
| 4 | Modificar | `backend/src/config/env.ts` | Adicionar SMTP config |
| 5 | Modificar | `backend/prisma/schema.prisma` | Campos emailVerify* no User |
| 6 | Criar | `backend/src/templates/emails/base.ts` | Template base HTML |
| 7 | Criar | `backend/src/templates/emails/verification.ts` | Template verificação |
| 8 | Criar | `backend/src/templates/emails/passwordReset.ts` | Template reset senha |
| 9 | Criar | `backend/src/templates/emails/welcome.ts` | Template boas-vindas |
| 10 | Criar | `backend/src/services/emailService.ts` | Módulo central de email |
| 11 | Criar | `backend/tests/unit/emailService.test.ts` | Testes do email service |
| 12 | Criar | `backend/tests/integration/emailVerification.test.ts` | Testes do fluxo |
| 13 | Modificar | `backend/src/controllers/authController.ts` | register + verifyEmail + resend |
| 14 | Modificar | `backend/src/routes/authRoutes.ts` | Rota resend-verification |
| 15 | Modificar | `backend/src/services/notificationService.ts` | Email opcional |
| 16 | Criar | `frontend/src/pages/VerifyEmail.tsx` | Página de verificação |
| 17 | Modificar | `frontend/src/App.tsx` | Rota /verify-email/:token |
| 18 | Modificar | `CLAUDE.md` | Documentação atualizada |

## Configuração Brevo (Produção)

Quando for configurar o Brevo para produção:

1. Criar conta gratuita em https://www.brevo.com
2. Ir em Settings → SMTP & API → SMTP
3. Copiar credenciais para o `.env`:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=seu-email@brevo.com
SMTP_PASS=sua-smtp-key
SMTP_FROM_NAME=FazTudo
SMTP_FROM_EMAIL=noreply@seudominio.com.br
ENABLE_EMAIL_NOTIFICATIONS=true
```

4. Configurar domínio (DNS): Adicionar registros DKIM e SPF conforme instruções do Brevo
5. Validar domínio no painel do Brevo

**Limite gratuito:** 300 emails/dia (≈9.000/mês) — sem expiração.
