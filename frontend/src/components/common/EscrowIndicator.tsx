import React, { useState } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

type EscrowStatus = "held" | "released" | "disputed";

interface EscrowIndicatorProps {
  status: EscrowStatus;
  amount?: number;
  compact?: boolean;
}

const statusConfig: Record<
  EscrowStatus,
  {
    icon: React.ElementType;
    label: string;
    colorClass: string;
    bgClass: string;
    darkBgClass: string;
    borderClass: string;
  }
> = {
  held: {
    icon: Clock,
    label: "Pagamento retido",
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50",
    darkBgClass: "dark:bg-amber-900/20",
    borderClass: "border-amber-200 dark:border-amber-800/50",
  },
  released: {
    icon: CheckCircle2,
    label: "Pagamento liberado",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50",
    darkBgClass: "dark:bg-emerald-900/20",
    borderClass: "border-emerald-200 dark:border-emerald-800/50",
  },
  disputed: {
    icon: AlertTriangle,
    label: "Em disputa",
    colorClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-50",
    darkBgClass: "dark:bg-red-900/20",
    borderClass: "border-red-200 dark:border-red-800/50",
  },
};

export const EscrowIndicator: React.FC<EscrowIndicatorProps> = ({
  status,
  amount,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = statusConfig[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bgClass} ${config.darkBgClass} ${config.colorClass}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {config.label}
        {amount != null && (
          <span className="font-bold">{formatCurrency(amount)}</span>
        )}
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 ${config.bgClass} ${config.darkBgClass} ${config.borderClass} dark:backdrop-blur-xl`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgClass} ${config.darkBgClass}`}
          >
            <Icon className={`h-5 w-5 ${config.colorClass}`} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${config.colorClass}`}>
              {config.label}
            </p>
            {amount != null && (
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(amount)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Expandable info */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <Shield className="h-3 w-3" />
        Como funciona o pagamento seguro?
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 rounded-lg bg-white/50 dark:bg-slate-900/50 p-3 text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <p>
            <strong className="text-slate-700 dark:text-slate-300">1.</strong> O
            pagamento e retido de forma segura na plataforma.
          </p>
          <p>
            <strong className="text-slate-700 dark:text-slate-300">2.</strong> O
            profissional realiza o servico conforme combinado.
          </p>
          <p>
            <strong className="text-slate-700 dark:text-slate-300">3.</strong>{" "}
            Voce confirma a conclusao e o pagamento e liberado.
          </p>
        </div>
      )}
    </div>
  );
};

export default EscrowIndicator;
