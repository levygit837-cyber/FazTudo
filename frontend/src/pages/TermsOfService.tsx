import React from "react";

const TermsOfService: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-8">
        Termos de Uso
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
        Ultima atualizacao: 16 de fevereiro de 2026
      </p>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            1. Aceitacao dos Termos
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Ao acessar e utilizar a plataforma FazTudo, voce concorda com estes
            Termos de Uso e com nossa Politica de Privacidade. Se voce nao
            concordar com qualquer parte destes termos, nao devera utilizar nossos
            servicos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            2. Descricao do Servico
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            O FazTudo e uma plataforma de marketplace que conecta clientes a
            profissionais prestadores de servicos. A plataforma facilita a
            contratacao, pagamento e comunicacao entre as partes, mas nao e parte
            direta na prestacao dos servicos contratados.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            3. Cadastro e Conta
          </h2>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>Voce deve fornecer informacoes verdadeiras e atualizadas no cadastro.</li>
            <li>Voce e responsavel por manter a seguranca de sua conta e senha.</li>
            <li>Menores de 18 anos nao podem utilizar a plataforma.</li>
            <li>Cada pessoa pode ter apenas uma conta ativa.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            4. Pagamentos e Escrow
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            Os pagamentos sao processados atraves do MercadoPago e mantidos em
            escrow (custodia) ate a conclusao do servico:
          </p>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>O cliente realiza o pagamento apos aceite do profissional.</li>
            <li>O valor fica retido ate ambas as partes confirmarem a conclusao.</li>
            <li>A plataforma cobra uma taxa de 10% sobre o valor do servico.</li>
            <li>Em caso de disputa, a plataforma podera mediar a resolucao.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            5. Obrigacoes do Cliente
          </h2>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>Descrever claramente o servico desejado.</li>
            <li>Realizar o pagamento conforme acordado.</li>
            <li>Confirmar a conclusao do servico em ate 7 dias apos a entrega.</li>
            <li>Tratar o profissional com respeito e cordialidade.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            6. Obrigacoes do Profissional
          </h2>
          <ul className="list-disc pl-6 text-slate-600 dark:text-slate-400 space-y-2">
            <li>Prestar o servico conforme descrito e acordado.</li>
            <li>Cumprir os prazos estabelecidos.</li>
            <li>Manter suas informacoes profissionais atualizadas.</li>
            <li>Tratar o cliente com respeito e cordialidade.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            7. Disputas e Cancelamentos
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Em caso de desacordo entre cliente e profissional, qualquer parte pode
            abrir uma disputa pela plataforma. A equipe do FazTudo analisara o
            caso e podera determinar reembolso total ou parcial, conforme as
            circunstancias. Cancelamentos antes do inicio do servico podem ser
            solicitados sem custo adicional.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            8. Limitacao de Responsabilidade
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            O FazTudo atua como intermediario e nao se responsabiliza pela
            qualidade dos servicos prestados pelos profissionais. A plataforma se
            compromete a fornecer mecanismos de avaliacao, escrow e mediacao de
            disputas para proteger ambas as partes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            9. Modificacoes
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Reservamos o direito de modificar estes termos a qualquer momento.
            Alteracoes significativas serao comunicadas por email ou notificacao
            na plataforma. O uso continuado apos alteracoes constitui aceitacao
            dos novos termos.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">
            10. Contato
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Para duvidas sobre estes termos, entre em contato pelo email{" "}
            <span className="text-primary-600 dark:text-primary-400">
              suporte@faztudo.com.br
            </span>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
