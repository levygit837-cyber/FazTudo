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
