import React from "react";
import { LayoutDashboard } from "lucide-react";

const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Dashboard
        </h2>
      </div>
      <div className="card">
        <p className="text-slate-500 dark:text-slate-400">
          Dashboard em construcao. Aqui serao exibidas as metricas e estatisticas
          da plataforma.
        </p>
      </div>
    </div>
  );
};

export default DashboardPage;
