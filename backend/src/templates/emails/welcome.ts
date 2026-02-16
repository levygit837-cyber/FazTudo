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
