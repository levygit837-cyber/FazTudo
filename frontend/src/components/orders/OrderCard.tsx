import React from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Star,
  MapPin,
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
  description?: string;
  status: ServiceOrderStatus;
  price: number;
  scheduledDate?: string;
  deadlineDate?: string;
  createdAt: string;
  professional?: {
    id: number;
    name: string;
    profileImage?: string;
    ratingAverage?: number;
  };
  client?: {
    id: number;
    name: string;
    profileImage?: string;
    ratingAverage?: number;
  };
  address?: {
    neighborhood?: string;
    city?: string;
  };
  isProfessionalView?: boolean;
  className?: string;
  onAccept?: (id: number) => void;
  onReject?: (id: number) => void;
  loading?: boolean;
}

const statusBorderColors: Record<string, string> = {
  [ServiceOrderStatus.PENDING]: "border-l-amber-400",
  [ServiceOrderStatus.ACCEPTED]: "border-l-emerald-400",
  [ServiceOrderStatus.IN_PROGRESS]: "border-l-blue-400",
  [ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION]: "border-l-purple-400",
  [ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION]: "border-l-indigo-400",
  [ServiceOrderStatus.COMPLETED]: "border-l-emerald-500",
  [ServiceOrderStatus.CANCELLED]: "border-l-red-500",
  [ServiceOrderStatus.EXPIRED]: "border-l-red-400",
  [ServiceOrderStatus.DISPUTED]: "border-l-red-500",
};

const statusConfig: Record<
  ServiceOrderStatus,
  { color: string; icon: React.ReactNode; bgColor: string }
> = {
  [ServiceOrderStatus.PENDING]: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  [ServiceOrderStatus.ACCEPTED]: {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  [ServiceOrderStatus.IN_PROGRESS]: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  [ServiceOrderStatus.AWAITING_CLIENT_CONFIRMATION]: {
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  [ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION]: {
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  [ServiceOrderStatus.COMPLETED]: {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  [ServiceOrderStatus.CANCELLED]: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  [ServiceOrderStatus.EXPIRED]: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  [ServiceOrderStatus.DISPUTED]: {
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
};

export const OrderCard: React.FC<OrderCardProps> = ({
  id,
  title,
  description,
  status,
  price,
  scheduledDate,
  deadlineDate,
  createdAt,
  professional,
  client,
  address,
  isProfessionalView = false,
  className = "",
  onAccept,
  onReject,
  loading = false,
}) => {
  const config = statusConfig[status];
  const borderColor = statusBorderColors[status] || "border-l-slate-300";
  const otherPerson = isProfessionalView ? client : professional;
  const linkPath = isProfessionalView
    ? `/professional/services/${id}`
    : `/client/orders/${id}`;

  const isOverdue = deadlineDate && new Date(deadlineDate) < new Date();

  return (
    <Link
      to={linkPath}
      className={`card card-hover block border-l-4 ${borderColor} p-3 sm:p-4 ${className}`}
    >
      <div className="flex gap-3 sm:gap-4">
        {/* Left: Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Status badge + title */}
          <div className="flex items-start gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${config.color} ${config.bgColor}`}
            >
              {config.icon}
              <span className="hidden sm:inline">{formatOrderStatus(status)}</span>
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-5">
              {title}
            </h3>
          </div>

          {/* Description preview */}
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {description}
            </p>
          )}

          {/* Other user info */}
          {otherPerson && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                {otherPerson.profileImage ? (
                  <img
                    src={otherPerson.profileImage}
                    alt={otherPerson.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    {otherPerson.name.charAt(0)}
                  </div>
                )}
              </div>
              <span className="font-medium truncate">{otherPerson.name}</span>
              {otherPerson.ratingAverage !== undefined && otherPerson.ratingAverage > 0 && (
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  {otherPerson.ratingAverage.toFixed(1)}
                </span>
              )}
            </div>
          )}

          {/* Location */}
          {address && (address.neighborhood || address.city) && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {[address.neighborhood, address.city].filter(Boolean).join(", ")}
            </p>
          )}

          {/* Created time - mobile only, compact */}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 sm:hidden">
            #{id} - {formatRelativeTime(createdAt)}
          </p>
        </div>

        {/* Right: Price + dates + actions */}
        <div className="flex flex-col items-end justify-between text-right flex-shrink-0 min-w-[90px]">
          <p className="text-base font-bold text-primary-600 dark:text-primary-400">
            {formatCurrency(price)}
          </p>

          <div className="space-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <p className="hidden sm:block text-[11px]">
              #{id} - {formatRelativeTime(createdAt)}
            </p>
            {scheduledDate && (
              <p className="flex items-center gap-1 justify-end">
                <Calendar className="w-3 h-3" />
                {formatDate(scheduledDate)}
              </p>
            )}
            {deadlineDate && (
              <p
                className={`flex items-center gap-1 justify-end ${
                  isOverdue ? "text-red-500 font-medium" : ""
                }`}
              >
                <Clock className="w-3 h-3" />
                {formatDate(deadlineDate)}
                {isOverdue && " !"}
              </p>
            )}
          </div>

          {/* Quick actions for PENDING orders (professional only) */}
          {isProfessionalView && status === ServiceOrderStatus.PENDING && onAccept && (
            <div
              className="flex gap-1.5 mt-2"
              onClick={(e) => e.preventDefault()}
            >
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAccept(id);
                }}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {loading ? <span className="loader h-3 w-3 inline-block" /> : "Aceitar"}
              </button>
              {onReject && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onReject(id);
                  }}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Recusar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default OrderCard;
