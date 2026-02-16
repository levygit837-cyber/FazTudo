import React from "react";

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-8">
        Politica de Privacidade
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
        Ultima atualizacao: 16 de fevereiro de 2026
      </p>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            1. Informacoes que Coletamos
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            Coletamos as seguintes informacoes quando voce utiliza o FazTudo:
          </p>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>
              <strong>Dados de cadastro:</strong> nome, email, telefone, CPF/CNPJ e
              senha (armazenada de forma criptografada).
            </li>
            <li>
              <strong>Dados profissionais:</strong> categorias de servico,
              certificacoes, experiencia e portfolio (para profissionais).
            </li>
            <li>
              <strong>Dados de pagamento:</strong> informacoes de pagamento
              processadas pelo MercadoPago. Nao armazenamos dados de cartao de
              credito em nossos servidores.
            </li>
            <li>
              <strong>Dados de uso:</strong> enderecos IP, tipo de navegador,
              paginas visitadas e acoes realizadas na plataforma.
            </li>
            <li>
              <strong>Comunicacoes:</strong> mensagens trocadas entre clientes e
              profissionais atraves do chat da plataforma.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            2. Como Usamos suas Informacoes
          </h2>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>Fornecer e melhorar nossos servicos.</li>
            <li>Processar pagamentos e transacoes.</li>
            <li>Enviar notificacoes sobre pedidos e servicos.</li>
            <li>Prevenir fraudes e garantir a seguranca da plataforma.</li>
            <li>Gerar estatisticas anonimizadas sobre o uso da plataforma.</li>
            <li>Mediar disputas entre clientes e profissionais.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            3. Compartilhamento de Dados
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            Seus dados podem ser compartilhados nas seguintes situacoes:
          </p>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>
              <strong>Entre partes de um pedido:</strong> nome, telefone e
              informacoes relevantes ao servico sao compartilhados entre cliente
              e profissional envolvidos em um pedido.
            </li>
            <li>
              <strong>Processadores de pagamento:</strong> MercadoPago para
              processar transacoes financeiras.
            </li>
            <li>
              <strong>Obrigacoes legais:</strong> quando exigido por lei ou
              ordem judicial.
            </li>
          </ul>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mt-3">
            Nao vendemos seus dados pessoais a terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            4. Seguranca dos Dados
          </h2>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>Senhas armazenadas com hash bcrypt.</li>
            <li>Comunicacao criptografada via HTTPS.</li>
            <li>Protecao contra XSS, CSRF e injecao de SQL.</li>
            <li>Limitacao de taxa de requisicoes (rate limiting).</li>
            <li>Sanitizacao de todos os dados de entrada.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            5. Seus Direitos (LGPD)
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            De acordo com a Lei Geral de Protecao de Dados (LGPD), voce tem
            direito a:
          </p>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>Acessar seus dados pessoais armazenados.</li>
            <li>Corrigir dados incompletos ou desatualizados.</li>
            <li>Solicitar a exclusao de seus dados (quando aplicavel).</li>
            <li>Revogar o consentimento de uso dos dados.</li>
            <li>Solicitar a portabilidade dos dados.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            6. Cookies
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Utilizamos cookies e armazenamento local (localStorage) para manter
            sua sessao ativa e suas preferencias (como tema claro/escuro). Nao
            utilizamos cookies de rastreamento de terceiros.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            7. Retencao de Dados
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Seus dados sao retidos enquanto sua conta estiver ativa. Apos
            solicitacao de exclusao, dados pessoais serao removidos em ate 30
            dias, exceto informacoes necessarias para cumprimento de obrigacoes
            legais ou resolucao de disputas pendentes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            8. Alteracoes nesta Politica
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Esta politica pode ser atualizada periodicamente. Alteracoes
            significativas serao comunicadas por email ou notificacao na
            plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            9. Contato
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Para exercer seus direitos ou esclarecer duvidas sobre esta politica,
            entre em contato pelo email{" "}
            <span className="text-primary-600 dark:text-primary-400">
              privacidade@faztudo.com.br
            </span>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
