import React from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { ServiceOrderStatus } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatOrderStatus,
  formatRelativeTime,
} from "../../utils/formatters";

interface OrderCardProps {
  id: number;
  title: string;
  status: ServiceOrderStatus;
  price: number;
  scheduledDate?: string;
  deadlineDate?: string;
  createdAt: string;
  professional?: {
    id: number;
    name: string;
    profileImage?: string;
  };
  client?: {
    id: number;
    name: string;
    profileImage?: string;
  };
  isProfessionalView?: boolean;
  className?: string;
}

const statusConfig: Record<
  ServiceOrderStatus,
  { color: string; icon: React.ReactNode; bgColor: string }
> = {
  [ServiceOrderStatus.PENDING]: {
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    icon: <Clock className="w-4 h-4" />,
  },
  [ServiceOrderStatus.ACCEPTED]: {
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  [ServiceOrderStatus.IN_PROGRESS]: {
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    icon: <Clock className="w-4 h-4" />,
  },
  [ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION]: {
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: <Clock className="w-4 h-4" />,
  },
  [ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION]: {
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    icon: <Clock className="w-4 h-4" />,
  },
  [ServiceOrderStatus.COMPLETED]: {
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  [ServiceOrderStatus.CANCELLED]: {
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800",
    icon: <XCircle className="w-4 h-4" />,
  },
  [ServiceOrderStatus.EXPIRED]: {
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  [ServiceOrderStatus.DISPUTED]: {
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

export const OrderCard: React.FC<OrderCardProps> = ({
  id,
  title,
  status,
  price,
  scheduledDate,
  deadlineDate,
  createdAt,
  professional,
  client,
  isProfessionalView = false,
  className = "",
}) => {
  const config = statusConfig[status];
  const otherPerson = isProfessionalView ? client : professional;
  const linkPath = isProfessionalView
    ? `/professional/services/${id}`
    : `/client/orders/${id}`;

  // Verificar se prazo está próximo
  const isDeadlineNear =
    deadlineDate &&
    new Date(deadlineDate) < new Date(Date.now() + 24 * 60 * 60 * 1000);
  const isOverdue = deadlineDate && new Date(deadlineDate) < new Date();

  return (
    <Link to={linkPath} className={`card card-hover block p-4 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pedido #{id} - {formatRelativeTime(createdAt)}
          </p>
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium max-w-[140px] flex-shrink-0 ml-2 ${config.color} ${config.bgColor}`}
        >
          {config.icon}
          <span className="truncate">{formatOrderStatus(status)}</span>
        </div>
      </div>

      {/* Informações */}
      <div className="space-y-2 mb-4">
        {otherPerson && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              {otherPerson.profileImage ? (
                <img
                  src={otherPerson.profileImage}
                  alt={otherPerson.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                  {otherPerson.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {isProfessionalView ? "Cliente:" : "Profissional:"}{" "}
              {otherPerson.name}
            </span>
          </div>
        )}

        {scheduledDate && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>Agendado: {formatDate(scheduledDate)}</span>
          </div>
        )}

        {deadlineDate &&
          (status === ServiceOrderStatus.ACCEPTED ||
            status === ServiceOrderStatus.IN_PROGRESS ||
            status === ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION ||
            status === ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION) && (
            <div
              className={`flex items-center gap-2 text-sm ${isOverdue ? "text-red-600" : isDeadlineNear ? "text-yellow-600" : "text-slate-600 dark:text-slate-400"}`}
            >
              <Clock className="w-4 h-4" />
              <span>
                Prazo: {formatDate(deadlineDate)}
                {isOverdue && " (Atrasado)"}
                {isDeadlineNear && !isOverdue && " (Proximo)"}
              </span>
            </div>
          )}
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
        <span className="text-lg font-bold text-primary-600">
          {formatCurrency(price)}
        </span>
        <span className="text-sm text-primary-600 hover:underline">
          Ver detalhes
        </span>
      </div>
    </Link>
  );
};

export default OrderCard;
