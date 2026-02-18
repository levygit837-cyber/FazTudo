import React from "react";
import { AlertTriangle } from "lucide-react";

const DisputesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Disputas
        </h2>
      </div>
      <div className="card">
        <p className="text-slate-500 dark:text-slate-400">
          Pagina de disputas em construcao. Aqui sera possivel visualizar e
          resolver disputas entre clientes e profissionais.
        </p>
      </div>
    </div>
  );
};

export default DisputesPage;
