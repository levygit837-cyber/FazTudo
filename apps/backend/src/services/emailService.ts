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
