import React from "react";
import { ShieldCheck } from "lucide-react";

const VerificationsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Verificacoes
        </h2>
      </div>
      <div className="card">
        <p className="text-slate-500 dark:text-slate-400">
          Pagina de verificacoes em construcao. Aqui sera possivel aprovar ou
          rejeitar submissoes de verificacao de identidade dos profissionais.
        </p>
      </div>
    </div>
  );
};

export default VerificationsPage;
