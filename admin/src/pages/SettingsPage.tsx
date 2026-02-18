import React from "react";
import { Settings } from "lucide-react";

const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Configuracoes
        </h2>
      </div>
      <div className="card">
        <p className="text-slate-500 dark:text-slate-400">
          Pagina de configuracoes em construcao. Aqui sera possivel ajustar as
          configuracoes da plataforma (taxas, escrow, manutencao, etc.).
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
