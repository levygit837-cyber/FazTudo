import {
  Clock,
  CheckCircle,
  CreditCard,
  Hammer,
  AlertCircle,
  XCircle,
  ThumbsUp,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import type { ServiceOrderStatus } from "../../types";

interface Props {
  status: ServiceOrderStatus;
  isClient: boolean;
  isProfessional: boolean;
  hasPayment?: boolean;
  orderId?: number;
  onAction?: () => void;
}

interface BannerConfig {
  icon: typeof Clock;
  title: string;
  description: string;
  actionLabel?: string;
  color: string;
  bg: string;
  border: string;
}

const getConfig = (
  status: ServiceOrderStatus,
  isClient: boolean,
  isProfessional: boolean,
  hasPayment?: boolean
): BannerConfig | null => {
  switch (status) {
    case "PENDING":
      if (isClient) {
        return {
          icon: Clock,
          title: "Aguardando aceitação",
          description: "O profissional ainda não aceitou seu pedido. Você será notificado quando ele responder.",
          color: "text-amber-700 dark:text-amber-300",
          bg: "bg-amber-50 dark:bg-amber-900/15",
          border: "border-amber-200 dark:border-amber-800/40",
        };
      }
      return {
        icon: AlertCircle,
        title: "Novo pedido recebido",
        description: "Aceite ou recuse este pedido para continuar.",
        actionLabel: "Aceitar pedido",
        color: "text-blue-700 dark:text-blue-300",
        bg: "bg-blue-50 dark:bg-blue-900/15",
        border: "border-blue-200 dark:border-blue-800/40",
      };

    case "ACCEPTED":
      if (isClient && !hasPayment) {
        return {
          icon: CreditCard,
          title: "Pagamento pendente",
          description: "O profissional aceitou! Realize o pagamento para iniciar o serviço.",
          actionLabel: "Pagar agora",
          color: "text-blue-700 dark:text-blue-300",
          bg: "bg-blue-50 dark:bg-blue-900/15",
          border: "border-blue-200 dark:border-blue-800/40",
        };
      }
      if (isProfessional) {
        return {
          icon: CheckCircle,
          title: "Pedido aceito",
          description: hasPayment
            ? "O pagamento foi confirmado. Inicie o serviço quando estiver pronto."
            : "Aguardando o pagamento do cliente para iniciar o serviço.",
          actionLabel: hasPayment ? "Iniciar serviço" : undefined,
          color: "text-emerald-700 dark:text-emerald-300",
          bg: "bg-emerald-50 dark:bg-emerald-900/15",
          border: "border-emerald-200 dark:border-emerald-800/40",
        };
      }
      return null;

    case "IN_PROGRESS":
      if (isClient) {
        return {
          icon: Hammer,
          title: "Serviço em andamento",
          description: "O profissional está trabalhando no seu serviço. Quando concluído, confirme a realização.",
          actionLabel: "Confirmar que foi realizado",
          color: "text-blue-700 dark:text-blue-300",
          bg: "bg-blue-50 dark:bg-blue-900/15",
          border: "border-blue-200 dark:border-blue-800/40",
        };
      }
      return {
        icon: Hammer,
        title: "Serviço em andamento",
        description: "Aguarde o cliente confirmar que o serviço foi realizado.",
        color: "text-blue-700 dark:text-blue-300",
        bg: "bg-blue-50 dark:bg-blue-900/15",
        border: "border-blue-200 dark:border-blue-800/40",
      };

    case "AWAITING_CLIENT_CONFIRMATION":
      // Legacy status — kept for backward compatibility with existing orders
      if (isClient) {
        return {
          icon: ThumbsUp,
          title: "Confirme a conclusão",
          description: "O profissional marcou o serviço como concluído. Confirme para liberar o pagamento.",
          actionLabel: "Confirmar conclusão",
          color: "text-emerald-700 dark:text-emerald-300",
          bg: "bg-emerald-50 dark:bg-emerald-900/15",
          border: "border-emerald-200 dark:border-emerald-800/40",
        };
      }
      return {
        icon: Clock,
        title: "Aguardando confirmação do cliente",
        description: "Aguardando a confirmação do cliente para liberar o pagamento.",
        color: "text-amber-700 dark:text-amber-300",
        bg: "bg-amber-50 dark:bg-amber-900/15",
        border: "border-amber-200 dark:border-amber-800/40",
      };

    case "COMPLETED":
      return {
        icon: CheckCircle,
        title: "Serviço concluído!",
        description: isClient
          ? "O serviço foi concluído e o pagamento liberado. Avalie o profissional!"
          : "O serviço foi concluído e o pagamento foi creditado na sua carteira.",
        color: "text-emerald-700 dark:text-emerald-300",
        bg: "bg-emerald-50 dark:bg-emerald-900/15",
        border: "border-emerald-200 dark:border-emerald-800/40",
      };

    case "CANCELLED":
      return {
        icon: XCircle,
        title: "Pedido cancelado",
        description: "Este pedido foi cancelado. Pagamentos pendentes serão reembolsados.",
        color: "text-red-700 dark:text-red-300",
        bg: "bg-red-50 dark:bg-red-900/15",
        border: "border-red-200 dark:border-red-800/40",
      };

    default:
      return null;
  }
};

export default function FlowStatusBanner({ status, isClient, isProfessional, hasPayment, onAction }: Props) {
  const config = getConfig(status, isClient, isProfessional, hasPayment);

  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className={clsx("rounded-xl border p-4", config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <Icon className={clsx("w-5 h-5 flex-shrink-0 mt-0.5", config.color)} />
        <div className="flex-1 min-w-0">
          <h4 className={clsx("font-semibold text-sm", config.color)}>
            {config.title}
          </h4>
          <p className={clsx("text-sm mt-0.5 opacity-80", config.color)}>
            {config.description}
          </p>
        </div>
        {config.actionLabel && onAction && (
          <button
            onClick={onAction}
            className="btn btn-primary btn-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            {config.actionLabel}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
