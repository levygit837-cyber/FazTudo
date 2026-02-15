import { CheckCircle, Clock, AlertCircle, XCircle, ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";

interface Props {
  status: "approved" | "pending" | "in_process" | "rejected" | "cancelled" | string;
  statusDetail?: string;
  orderId?: number;
}

const statusMap: Record<string, {
  icon: typeof CheckCircle;
  title: string;
  description: string;
  color: string;
  bg: string;
  border: string;
}> = {
  approved: {
    icon: CheckCircle,
    title: "Pagamento aprovado!",
    description: "Seu pagamento foi confirmado. O profissional será notificado para iniciar o serviço.",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800/40",
  },
  pending: {
    icon: Clock,
    title: "Pagamento em processamento",
    description: "Estamos processando seu pagamento. Você será notificado quando for confirmado.",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800/40",
  },
  in_process: {
    icon: Clock,
    title: "Pagamento em análise",
    description: "Seu pagamento está sendo analisado. Isso pode levar alguns minutos.",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800/40",
  },
  rejected: {
    icon: XCircle,
    title: "Pagamento recusado",
    description: "Seu pagamento foi recusado. Tente novamente com outro método de pagamento.",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800/40",
  },
  cancelled: {
    icon: AlertCircle,
    title: "Pagamento cancelado",
    description: "O pagamento foi cancelado.",
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-50 dark:bg-slate-800/50",
    border: "border-slate-200 dark:border-slate-700",
  },
};

export default function PaymentStatusBanner({ status, statusDetail, orderId }: Props) {
  const navigate = useNavigate();
  const config = statusMap[status] || statusMap.pending;
  const Icon = config.icon;

  return (
    <div className={clsx("rounded-xl border p-4", config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <Icon className={clsx("w-6 h-6 flex-shrink-0 mt-0.5", config.color)} />
        <div className="flex-1 min-w-0">
          <h4 className={clsx("font-semibold", config.color)}>
            {config.title}
          </h4>
          <p className={clsx("text-sm mt-0.5 opacity-80", config.color)}>
            {config.description}
          </p>
          {statusDetail && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
              Detalhe: {statusDetail}
            </p>
          )}
        </div>
      </div>
      {orderId && (
        <div className="mt-3 pt-3 border-t border-current/10">
          <button
            onClick={() => navigate(`/client/orders/${orderId}`)}
            className="text-sm font-medium flex items-center gap-1.5 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao pedido
          </button>
        </div>
      )}
    </div>
  );
}
