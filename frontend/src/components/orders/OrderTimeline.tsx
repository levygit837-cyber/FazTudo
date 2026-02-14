import React from "react";
import {
  Clock,
  CheckCircle,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { formatDateTime } from "../../utils/formatters";

interface TimelineStep {
  label: string;
  date: string | null | undefined;
  done: boolean;
}

interface OrderTimelineProps {
  steps: TimelineStep[];
  deadlineDate?: string | null;
}

const OrderTimeline: React.FC<OrderTimelineProps> = ({ steps, deadlineDate }) => {
  // Calculate SLA status
  const getSlaStatus = () => {
    if (!deadlineDate) return null;

    const now = new Date();
    const deadline = new Date(deadlineDate);
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        label: `Atrasado ${overdueDays} dia${overdueDays !== 1 ? "s" : ""}`,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
        icon: <AlertTriangle className="w-4 h-4" />,
      };
    } else if (diffHours < 48) {
      return {
        label: diffDays > 0 ? `${diffDays} dia${diffDays !== 1 ? "s" : ""} restante${diffDays !== 1 ? "s" : ""}` : `${Math.floor(diffHours)} horas restantes`,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
        icon: <Clock className="w-4 h-4" />,
      };
    } else {
      return {
        label: `${diffDays} dias restantes`,
        color: "text-green-600 dark:text-green-400",
        bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
        icon: <CheckCircle className="w-4 h-4" />,
      };
    }
  };

  const sla = getSlaStatus();

  const getStepIcon = (step: TimelineStep, _index: number) => {
    if (step.label.toLowerCase().includes("pagamento")) {
      return <DollarSign className="w-4 h-4" />;
    }
    if (step.done) {
      return <CheckCircle className="w-4 h-4" />;
    }
    return <Clock className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      {/* SLA Indicator */}
      {sla && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${sla.bg} ${sla.color}`}>
          {sla.icon}
          <span>Prazo: {sla.label}</span>
        </div>
      )}

      {/* Timeline Steps */}
      <div className="relative">
        {steps.map((step, index) => (
          <div key={index} className="relative flex items-start gap-3 pb-6 last:pb-0">
            {/* Vertical connector line */}
            {index < steps.length - 1 && (
              <div className={`absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] ${
                step.done ? "bg-green-300 dark:bg-green-700" : "bg-slate-200 dark:bg-slate-700"
              }`} />
            )}
            {/* Step circle */}
            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              step.done
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
            }`}>
              {getStepIcon(step, index)}
            </div>
            {/* Step content */}
            <div className="flex-1 min-w-0 pt-1">
              <p className={`text-sm font-medium ${
                step.done
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500"
              }`}>
                {step.label}
              </p>
              {step.date && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(step.date)}
                </p>
              )}
              {!step.done && !step.date && (
                <p className="text-xs text-slate-400 dark:text-slate-500">Aguardando</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderTimeline;
