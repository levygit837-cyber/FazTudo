import {
  FileText,
  CheckCircle,
  CreditCard,
  Play,
  ClipboardCheck,
  ThumbsUp,
  Star,
} from "lucide-react";
import clsx from "clsx";
import type { ServiceOrderStatus } from "../../types";

interface Props {
  status: ServiceOrderStatus;
  hasPayment?: boolean;
  hasReview?: boolean;
}

const steps = [
  { key: "PENDING", label: "Pedido", shortLabel: "Pedido", icon: FileText },
  { key: "ACCEPTED", label: "Aceito", shortLabel: "Aceito", icon: CheckCircle },
  { key: "PAYMENT", label: "Pagamento", shortLabel: "Pago", icon: CreditCard },
  { key: "IN_PROGRESS", label: "Em andamento", shortLabel: "Execução", icon: Play },
  { key: "AWAITING_CLIENT_CONFIRMATION", label: "Confirmação", shortLabel: "Confirmar", icon: ClipboardCheck },
  { key: "COMPLETED", label: "Concluído", shortLabel: "Concluído", icon: ThumbsUp },
  { key: "REVIEW", label: "Avaliação", shortLabel: "Avaliar", icon: Star },
];

const statusOrder: Record<string, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  PAYMENT: 2,
  IN_PROGRESS: 3,
  AWAITING_CLIENT_CONFIRMATION: 4,
  COMPLETED: 5,
  REVIEW: 6,
};

export default function ServiceFlowStepper({ status, hasPayment, hasReview }: Props) {
  // Determine current step index
  let currentIndex = statusOrder[status] ?? 0;

  // If has payment, at least past payment step
  if (hasPayment && currentIndex < 2) currentIndex = 2;

  // If completed and has review, final step
  if (status === "COMPLETED" && hasReview) currentIndex = 6;

  // Skip cancelled/expired/disputed
  if (status === "CANCELLED" || status === "EXPIRED" || status === "DISPUTED") {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-[500px] sm:min-w-0">
        {steps.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Step */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={clsx(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
                    isDone && "bg-emerald-500 text-white shadow-sm",
                    isCurrent && "bg-primary-500 text-white shadow-md shadow-primary-500/30 ring-4 ring-primary-100 dark:ring-primary-900/50",
                    isFuture && "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                  )}
                >
                  {isDone ? (
                    <CheckCircle className="w-4.5 h-4.5" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={clsx(
                    "text-[11px] font-medium text-center whitespace-nowrap",
                    isDone && "text-emerald-600 dark:text-emerald-400",
                    isCurrent && "text-primary-600 dark:text-primary-400 font-semibold",
                    isFuture && "text-slate-400 dark:text-slate-500"
                  )}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.shortLabel}</span>
                </span>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-1.5 h-0.5 rounded-full relative">
                  <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  {isDone && (
                    <div className="absolute inset-0 bg-emerald-400 dark:bg-emerald-500 rounded-full transition-all duration-500" />
                  )}
                  {isCurrent && (
                    <div className="absolute inset-y-0 left-0 w-1/2 bg-primary-400 dark:bg-primary-500 rounded-full transition-all duration-500" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
