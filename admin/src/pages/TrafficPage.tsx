import React from "react";
import { BarChart3 } from "lucide-react";

const TrafficPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Trafego
        </h2>
      </div>
      <div className="card">
        <p className="text-slate-500 dark:text-slate-400">
          Pagina de trafego em construcao. Aqui serao exibidos os dados de
          visitacao e metricas de uso da plataforma.
        </p>
      </div>
    </div>
  );
};

export default TrafficPage;
