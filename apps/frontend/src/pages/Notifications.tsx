import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  CheckCheck,
  ShoppingCart,
  CreditCard,
  MessageSquare,
  Star,
  AlertTriangle,
  Clock,
  Info,
} from "lucide-react";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  NotificationListResponse,
} from "../services/notificationService";
import { Notification, NotificationStatus, NotificationType } from "../types";
import { Skeleton, SkeletonText } from "../components/common/Skeleton";
import { EmptyState } from "../components/common/EmptyState";

type FilterTab = "all" | "unread" | "read";

const notificationConfig: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
  [NotificationType.ORDER_CREATED]: {
    icon: <ShoppingCart className="w-5 h-5" />,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  },
  [NotificationType.ORDER_ACCEPTED]: {
    icon: <CheckCheck className="w-5 h-5" />,
    color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  },
  [NotificationType.ORDER_COMPLETED]: {
    icon: <CheckCheck className="w-5 h-5" />,
    color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  },
  [NotificationType.ORDER_CANCELLED]: {
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  },
  [NotificationType.PAYMENT_RECEIVED]: {
    icon: <CreditCard className="w-5 h-5" />,
    color: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  },
  [NotificationType.PAYMENT_RELEASED]: {
    icon: <CreditCard className="w-5 h-5" />,
    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  },
  [NotificationType.DEADLINE_WARNING]: {
    icon: <Clock className="w-5 h-5" />,
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
  },
  [NotificationType.DEADLINE_EXPIRED]: {
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  },
  [NotificationType.NEW_MESSAGE]: {
    icon: <MessageSquare className="w-5 h-5" />,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  },
  [NotificationType.REVIEW_RECEIVED]: {
    icon: <Star className="w-5 h-5" />,
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
  },
  [NotificationType.SYSTEM_ALERT]: {
    icon: <Info className="w-5 h-5" />,
    color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  },
};

const Notifications: React.FC = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<NotificationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const statusFilter =
        activeTab === "unread"
          ? NotificationStatus.UNREAD
          : activeTab === "read"
            ? NotificationStatus.READ
            : undefined;

      const result = await getNotifications({
        status: statusFilter,
        limit: 50,
      });
      setData(result);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Erro ao carregar notificacoes",
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.status === NotificationStatus.READ) return;

    try {
      await markAsRead(notification.id);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
          notifications: prev.notifications.map((n) =>
            n.id === notification.id
              ? { ...n, status: NotificationStatus.READ, readAt: new Date().toISOString() }
              : n,
          ),
        };
      });
    } catch {
      // silently fail
    }
  };

  const handleMarkAllRead = async () => {
    if (!data || data.unreadCount === 0) return;

    setMarkingAllRead(true);
    try {
      await markAllAsRead();
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unreadCount: 0,
          notifications: prev.notifications.map((n) => ({
            ...n,
            status: NotificationStatus.READ,
            readAt: n.readAt || new Date().toISOString(),
          })),
        };
      });
    } catch {
      // silently fail
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification);

    // Navigate based on notification type
    if (notification.serviceOrderId) {
      const basePath = window.location.pathname.startsWith("/professional")
        ? "/professional/services"
        : "/client/orders";
      navigate(`${basePath}/${notification.serviceOrderId}`);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Agora";
    if (diffMinutes < 60) return `${diffMinutes}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "unread", label: "Nao lidas" },
    { key: "read", label: "Lidas" },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-slate-900 dark:text-slate-100" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notificacoes</h1>
          {data && data.unreadCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
              {data.unreadCount} nova{data.unreadCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {data && data.unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
            className="btn btn-outline btn-sm flex items-center gap-2 disabled:opacity-70"
          >
            <CheckCheck className="w-4 h-4" />
            {markingAllRead ? "Marcando..." : "Marcar todas como lidas"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <SkeletonText lines={2} />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card text-center py-8">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <button onClick={loadNotifications} className="btn btn-primary">
            Tentar novamente
          </button>
        </div>
      ) : !data || data.notifications.length === 0 ? (
        <EmptyState
          icon="package"
          title={
            activeTab === "unread"
              ? "Nenhuma notificacao nao lida"
              : activeTab === "read"
                ? "Nenhuma notificacao lida"
                : "Nenhuma notificacao"
          }
          description="Quando houver atualizacoes nos seus pedidos, voce sera notificado aqui."
        />
      ) : (
        <div className="space-y-2">
          {data.notifications.map((notification) => {
            const config = notificationConfig[notification.type] || {
              icon: <Bell className="w-5 h-5" />,
              color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
            };
            const isUnread = notification.status === NotificationStatus.UNREAD;

            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full text-left p-4 rounded-xl border transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  isUnread
                    ? "bg-primary-50/50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.color}`}
                  >
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className={`text-sm ${isUnread ? "font-semibold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300"}`}
                      >
                        {notification.title}
                      </h3>
                      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                  </div>
                  {isUnread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
