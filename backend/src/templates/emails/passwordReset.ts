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
