import React, { useState } from "react";
import { Link } from "react-router";
import { UserCheck, Briefcase, TrendingUp, Star, X, CheckCircle2, Circle } from "lucide-react";

interface ProfessionalOnboardingProps {
  onDismiss: () => void;
}

interface ChecklistItem {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  impact: string;
  action: { label: string; to: string };
  color: string;
}

const CHECKLIST: ChecklistItem[] = [
  {
    id: "profile",
    icon: UserCheck,
    title: "Complete seu perfil",
    description: "Foto, bio e experiências",
    impact: "3x mais pedidos",
    action: { label: "Completar", to: "/profile" },
    color: "text-indigo-500",
  },
  {
    id: "service",
    icon: Briefcase,
    title: "Crie seu primeiro serviço",
    description: "Defina preço e descrição",
    impact: "Comece a receber pedidos",
    action: { label: "Criar", to: "/professional/create-service" },
    color: "text-primary-500",
  },
  {
    id: "verify",
    icon: Star,
    title: "Verifique sua conta",
    description: "Documentos e certificações",
    impact: "Selo de verificado",
    action: { label: "Verificar", to: "/verify-account" },
    color: "text-amber-500",
  },
  {
    id: "schedule",
    icon: TrendingUp,
    title: "Configure sua agenda",
    description: "Horários disponíveis",
    impact: "Mais controle",
    action: { label: "Configurar", to: "/professional/agenda" },
    color: "text-emerald-500",
  },
];

export const ProfessionalOnboarding: React.FC<ProfessionalOnboardingProps> = ({ onDismiss }) => {
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(JSON.parse(localStorage.getItem("faztudo_pro_checklist") || "[]"))
  );

  const toggleItem = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("faztudo_pro_checklist", JSON.stringify([...next]));
      return next;
    });
  };

  const progress = Math.round((completed.size / CHECKLIST.length) * 100);

  return (
    <div className="rounded-2xl mb-6 border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl relative overflow-hidden">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 rounded"
        aria-label="Fechar guia de configuração"
      >
        <X size={18} />
      </button>

      <div className="p-5">
        <div className="flex items-start justify-between mb-4 pr-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Briefcase size={20} className="text-indigo-500" aria-hidden="true" />
              Configure sua conta
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {completed.size}/{CHECKLIST.length} tarefas concluídas
            </p>
          </div>
          <span className="text-2xl font-black text-indigo-500" aria-hidden="true">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-5">
          <div
            className="h-2 bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${progress}% concluído — ${completed.size} de ${CHECKLIST.length} tarefas`}
          />
        </div>

        {/* Checklist items */}
        <div className="space-y-2">
          {CHECKLIST.map((item) => {
            const done = completed.has(item.id);
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                  done
                    ? "bg-slate-50 dark:bg-slate-800/40 opacity-60"
                    : "bg-slate-50 dark:bg-slate-800/60"
                }`}
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500 rounded-full ${
                    done
                      ? "text-emerald-500"
                      : "text-slate-300 dark:text-slate-600 hover:text-slate-400"
                  }`}
                  aria-label={done ? `Desmarcar: ${item.title}` : `Marcar como concluído: ${item.title}`}
                  aria-pressed={done}
                >
                  {done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>

                <div className={`flex items-center gap-2 flex-shrink-0 ${item.color}`}>
                  <Icon size={16} aria-hidden="true" />
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      done
                        ? "line-through text-slate-400 dark:text-slate-500"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="hidden sm:inline text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                    {item.impact}
                  </span>
                  {!done && (
                    <Link
                      to={item.action.to}
                      className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    >
                      {item.action.label} →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {progress === 100 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Perfil completo! Você está pronto para receber pedidos.
            </p>
            <button
              onClick={onDismiss}
              className="ml-auto text-xs text-emerald-600 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalOnboarding;
