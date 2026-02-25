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
