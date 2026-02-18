import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  MessageSquare,
  Star,
  ArrowLeft,
  CreditCard,
  Calendar,
  AlertCircle,
  User,
  CalendarClock,
  AlertTriangle,
  RotateCcw,
  Navigation,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSocket, useOrderRoom } from "../../hooks/useSocket";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import RescheduleModal from "../../components/orders/RescheduleModal";
import DisputeModal from "../../components/orders/DisputeModal";
import RescheduleApprovalBanner from "../../components/orders/RescheduleApprovalBanner";
import DelayAlertModal from "../../components/orders/DelayAlertModal";
import { WazeMap } from "../../components/map";
import ProposalComparator from "../../components/orders/ProposalComparator";
import ReviewCTA from "../../components/orders/ReviewCTA";
import { SkeletonOrderCard, Skeleton, SkeletonText } from "../../components/common/Skeleton";
import {
  getOrderById,
  acceptOrder,
  startOrder,
  submitOrderCompletion,
  confirmProfessionalCompletion,
  cancelOrder,
  releasePayment,
  createReview,
  createOrder,
  markEnRoute,
  delayResponse,
} from "../../services/serviceService";
import { ServiceOrder } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatOrderStatus,
  formatPaymentStatus,
} from "../../utils/formatters";

// =====================================
// CHECKOUT STEPPER (pedidos sem pagamento)
// =====================================
interface CheckoutStepperProps {
  currentStep: number; // 0=criado, 1=horario, 2=pagamento
}

const CHECKOUT_STEPS = [
  { label: "Pedido Criado", icon: <CheckCircle className="w-4 h-4" /> },
  { label: "Horario", icon: <Calendar className="w-4 h-4" /> },
  { label: "Pagamento", icon: <CreditCard className="w-4 h-4" /> },
];

const CheckoutStepper: React.FC<CheckoutStepperProps> = ({ currentStep }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      {CHECKOUT_STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                    : isCurrent
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                }`}
              >
                {isCompleted ? <CheckCircle className="w-5 h-5" /> : step.icon}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCompleted || isCurrent
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < CHECKOUT_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  isCompleted
                    ? "bg-green-300 dark:bg-green-700"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// =====================================
// ORDER PROGRESS STEPPER (pedidos pagos - acompanhamento)
// =====================================
interface OrderProgressStepperProps {
  order: ServiceOrder;
}

const OrderProgressStepper: React.FC<OrderProgressStepperProps> = ({ order }) => {
  const getSteps = () => {
    const steps = [
      {
        label: "Servico Iniciado",
        description: "Pagamento aprovado",
        done: true, // Sempre verde pois pagamento ja foi aprovado
        icon: <CheckCircle className="w-4 h-4" />,
      },
      {
        label: "Aguardando Profissional",
        description: "Profissional precisa confirmar o servico",
        done: [
          "ACCEPTED", "IN_PROGRESS",
          "AWAITING_CLIENT_CONFIRMATION",
          "AWAITING_PROFESSIONAL_CONFIRMATION",
          "COMPLETED",
        ].includes(order.status),
        icon: <User className="w-4 h-4" />,
      },
      {
        label: "Servico em Andamento",
        description: "Profissional esta realizando o servico",
        done: [
          "IN_PROGRESS",
          "AWAITING_CLIENT_CONFIRMATION",
          "AWAITING_PROFESSIONAL_CONFIRMATION",
          "COMPLETED",
        ].includes(order.status),
        icon: <Clock className="w-4 h-4" />,
      },
      {
        label: "Aguardando Confirmacao",
        description: order.status === "AWAITING_CLIENT_CONFIRMATION"
          ? "Confirme que o servico foi concluido"
          : order.status === "AWAITING_PROFESSIONAL_CONFIRMATION"
          ? "Aguardando profissional confirmar"
          : "Cliente e profissional confirmam conclusao",
        done: ["AWAITING_PROFESSIONAL_CONFIRMATION", "COMPLETED"].includes(order.status),
        icon: <CheckCircle className="w-4 h-4" />,
      },
      {
        label: "Concluido",
        description: "Servico finalizado com sucesso",
        done: order.status === "COMPLETED",
        icon: <Star className="w-4 h-4" />,
      },
    ];
    return steps;
  };

  const steps = getSteps();

  return (
    <div className="relative">
      {steps.map((step, index) => (
        <div key={index} className="relative flex items-start gap-3 pb-6 last:pb-0">
          {index < steps.length - 1 && (
            <div
              className={`absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] z-0 ${
                step.done
                  ? "bg-green-300 dark:bg-green-700"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          )}
          <div
            className={`relative z-10 w-8 h-8 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center flex-shrink-0 transition-colors ${
              step.done
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
            }`}
          >
            {step.icon}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p
              className={`text-sm font-medium ${
                step.done
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {step.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

// =====================================
// MAIN ORDER DETAILS COMPONENT
// =====================================
const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    variant: "danger" | "warning" | "info";
    confirmLabel: string;
    action: () => Promise<any>;
  } | null>(null);

  // Review state
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);

  // Dispute state
  const [showDispute, setShowDispute] = useState(false);

  // Delay alert state
  const [delayAlert, setDelayAlert] = useState<{
    orderId: number;
    orderTitle: string;
    professionalName: string;
  } | null>(null);

  const isOrderClient = order?.clientId === user?.id;
  const isOrderProfessional = order?.professionalId === user?.id;
  const chatRoute = isOrderProfessional
    ? `/professional/services/${id}/chat`
    : `/client/orders/${id}/chat`;

  // Socket.io: join order room for real-time updates
  useOrderRoom(order?.id);

  // Socket.io: listen for status changes
  const handleStatusChanged = useCallback(
    (data: { orderId: number; status: string }) => {
      if (!order || data.orderId !== order.id) return;
      setOrder((prev) => (prev ? { ...prev, status: data.status as any } : prev));
    },
    [order?.id],
  );
  useSocket("order:statusChanged", handleStatusChanged);

  // Socket.io: listen for delay alerts (client only)
  const handleDelayAlert = useCallback(
    (data: { orderId: number; orderTitle: string; professionalName: string }) => {
      if (order && data.orderId === order.id) {
        setDelayAlert(data);
      }
    },
    [order?.id],
  );
  useSocket("order:delayAlert", handleDelayAlert);

  // Socket.io: listen for en-route notification (client only)
  const handleEnRoute = useCallback(
    (data: { orderId: number; professionalName: string; enRouteAt: string }) => {
      if (order && data.orderId === order.id) {
        setOrder((prev) => (prev ? { ...prev, enRouteAt: data.enRouteAt } : prev));
        toast.success(`${data.professionalName} esta a caminho!`);
      }
    },
    [order?.id, toast],
  );
  useSocket("order:enRoute", handleEnRoute);

  const loadOrder = async (showSpinner = true) => {
    if (!id) return;
    try {
      if (showSpinner) setLoading(true);
      const orderData = await getOrderById(parseInt(id));
      setOrder(orderData);
      if (orderData.reviews && orderData.reviews.length > 0) {
        const myReview = orderData.reviews.find((r: any) => r.authorId === user?.id);
        if (myReview) setReviewSubmitted(true);
      }
    } catch (err) {
      setError("Erro ao carregar pedido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  // Handle payment return from MercadoPago
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    if (paymentStatus === "success") {
      toast.success("Pagamento aprovado! Aguardando confirmacao.");
    } else if (paymentStatus === "failure") {
      toast.error("Pagamento", "Pagamento nao foi aprovado. Tente novamente.");
    } else if (paymentStatus === "pending") {
      toast.info("Pagamento pendente. Voce sera notificado quando for confirmado.");
    }
    if (paymentStatus) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleAction = async (
    action: () => Promise<any>,
    successMsg?: string,
    optimisticStatus?: string,
  ) => {
    const actionId = String(Date.now());
    const previousOrder = order;
    try {
      setActionLoading(actionId);
      setError(null);
      // Optimistic update: apply new status immediately
      if (optimisticStatus && order) {
        setOrder({ ...order, status: optimisticStatus as any });
      }
      await action();
      // Background refresh (no spinner)
      await loadOrder(false);
      toast.success(successMsg || "Acao realizada com sucesso");
    } catch (err: any) {
      // Revert optimistic update on failure
      if (optimisticStatus && previousOrder) {
        setOrder(previousOrder);
      }
      const msg = err?.response?.data?.message || "Erro ao executar acao";
      setError(msg);
      toast.error("Erro", msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    await handleAction(confirmAction.action);
    setConfirmAction(null);
  };

  const handlePayment = () => {
    if (!order) return;
    // Redirect to checkout page with the full MercadoPago flow
    navigate(`/client/orders/${order.id}/checkout`);
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8 max-w-4xl animate-pulse space-y-6">
      <Skeleton className="h-6 w-40 rounded" />
      <SkeletonOrderCard />
      <SkeletonText lines={5} />
    </div>
  );

  if (!order) return (
    <div className="text-center py-12 text-slate-600 dark:text-slate-400">
      Pedido nao encontrado
    </div>
  );

  const activePayment = order.payments?.find((p) => p.status === "HELD" || p.status === "RELEASED");
  const hasPendingPayment = order.payments?.some((p) => p.status === "HELD");
  const hasReleasedPayment = order.payments?.some((p) => p.status === "RELEASED");
  const needsPayment = !order.payments?.length || order.payments.every((p) => p.status === "FAILED" || p.status === "REFUNDED");
  const paymentApproved = !!activePayment;

  const isCheckoutPhase = isOrderClient && needsPayment && ["PENDING", "ACCEPTED"].includes(order.status);
  const isTrackingPhase = paymentApproved || ["IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION", "AWAITING_PROFESSIONAL_CONFIRMATION", "COMPLETED"].includes(order.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{order.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pedido #{order.id} - {formatRelativeTime(order.createdAt)}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          order.status === "COMPLETED" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
          order.status === "CANCELLED" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
          order.status === "AWAITING_CLIENT_CONFIRMATION" || order.status === "AWAITING_PROFESSIONAL_CONFIRMATION" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
          order.status === "IN_PROGRESS" ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" :
          order.status === "PENDING" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" :
          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
        }`}>
          {formatOrderStatus(order.status)}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Reschedule approval (client only) */}
      {isOrderClient && order.rescheduleStatus === "PENDING" && order.rescheduleProposedDate && (
        <RescheduleApprovalBanner
          orderId={order.id}
          proposedDate={order.rescheduleProposedDate}
          reason={order.rescheduleReason}
          onResolved={loadOrder}
        />
      )}

      {/* Countdown banner — time until scheduled date */}
      {order.scheduledDate && ["ACCEPTED", "IN_PROGRESS"].includes(order.status) && (() => {
        const now = new Date();
        const scheduled = new Date(order.scheduledDate!);
        const diffMs = scheduled.getTime() - now.getTime();
        const isLate = diffMs < 0;
        const absDiff = Math.abs(diffMs);
        const hours = Math.floor(absDiff / (1000 * 60 * 60));
        const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        let timeLabel: string;
        if (days > 0) {
          timeLabel = `${days}d ${remainingHours}h`;
        } else if (hours > 0) {
          timeLabel = `${hours}h ${minutes}min`;
        } else {
          timeLabel = `${minutes}min`;
        }

        return (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
              isLate
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
            }`}
          >
            <Clock
              className={`w-5 h-5 flex-shrink-0 ${
                isLate ? "text-red-500" : "text-blue-500"
              }`}
            />
            <p
              className={`text-sm font-medium ${
                isLate
                  ? "text-red-700 dark:text-red-400"
                  : "text-blue-700 dark:text-blue-400"
              }`}
            >
              {isLate
                ? `Atrasado por ${timeLabel} — o horario agendado ja passou`
                : `Faltam ${timeLabel} para o horario agendado`}
            </p>
          </div>
        );
      })()}

      {/* Cancelled order banner */}
      {order.status === "CANCELLED" && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 dark:text-red-300 text-sm">
                Pedido Cancelado
              </h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                Este pedido foi cancelado e não pode mais ser alterado.
                {order.cancelledAt && (
                  <span> Cancelado em {formatDateTime(order.cancelledAt)}.</span>
                )}
              </p>
              {isOrderClient && order.serviceListingId && (
                <button
                  onClick={() => navigate(`/services/${order.serviceListingId}`)}
                  className="mt-3 text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 underline underline-offset-2"
                >
                  Ver serviço original →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT STEPPER (pre-pagamento) */}
      {isCheckoutPhase && (
        <div className="card">
          <CheckoutStepper currentStep={order.scheduledDate ? 2 : 1} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info do pedido */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Detalhes do Pedido</h2>
            {order.description && (
              <p className="text-slate-600 dark:text-slate-400 mb-4">{order.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Valor</span>
                <p className="font-semibold text-lg text-primary-600">{formatCurrency(order.price)}</p>
              </div>
              {order.scheduledDate && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Agendado para</span>
                  <p className="font-medium">{formatDateTime(order.scheduledDate)}</p>
                </div>
              )}
              <div>
                <span className="text-slate-500 dark:text-slate-400">Criado em</span>
                <p className="font-medium">{formatDateTime(order.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Order Brief — instructions for professional */}
          {order.brief && isOrderProfessional && (
            <div className="card border-l-4 border-l-blue-400">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500" />
                Instruções do Cliente
              </h2>
              {order.brief.notes && (
                <p className="text-slate-600 dark:text-slate-400 mb-3">{order.brief.notes}</p>
              )}
              {order.brief.urgencyLevel && order.brief.urgencyLevel !== "NORMAL" && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Urgência:</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    order.brief.urgencyLevel === "URGENT"
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      : order.brief.urgencyLevel === "HIGH"
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  }`}>
                    {order.brief.urgencyLevel === "URGENT" ? "Urgente" :
                     order.brief.urgencyLevel === "HIGH" ? "Alta" :
                     order.brief.urgencyLevel === "LOW" ? "Baixa" : order.brief.urgencyLevel}
                  </span>
                </div>
              )}
              {order.brief.briefData && Object.keys(order.brief.briefData).length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2">
                  {Object.entries(order.brief.briefData).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400 capitalize">
                        {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {order.brief.category && (
                <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  Categoria: {order.brief.category.name}
                </div>
              )}
            </div>
          )}

          {/* CHECKOUT: Pagamento (apenas se esta na fase de checkout) */}
          {isCheckoutPhase && isOrderClient && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                <CreditCard className="w-5 h-5 inline mr-2" />
                Pagamento
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Complete o checkout para confirmar seu pedido.
              </p>
              <button
                onClick={handlePayment}
                className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Ir para checkout
              </button>
            </div>
          )}

          {/* Proposals (visible for PENDING orders) */}
          {order.status === "PENDING" && (
            <ProposalComparator
              orderId={order.id}
              isClient={isOrderClient}
              onProposalAccepted={loadOrder}
            />
          )}

          {/* TRACKING: Progresso do servico (apos pagamento) */}
          {isTrackingPhase && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Progresso do Servico</h2>
              <OrderProgressStepper order={order} />
            </div>
          )}

          {/* CANCELLED: Historico do pedido cancelado */}
          {order.status === "CANCELLED" && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Histórico do Pedido</h2>
              <div className="relative">
                {/* Pedido criado */}
                <div className="relative flex items-start gap-3 pb-6">
                  <div className="absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] z-0 bg-green-300 dark:bg-green-700" />
                  <div className="relative z-10 w-8 h-8 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Pedido Criado</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatDateTime(order.createdAt)}</p>
                  </div>
                </div>

                {/* Aceito (se startedAt existe, o pedido passou por aceito) */}
                {order.startedAt && (
                  <div className="relative flex items-start gap-3 pb-6">
                    <div className="absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] z-0 bg-green-300 dark:bg-green-700" />
                    <div className="relative z-10 w-8 h-8 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Pedido Aceito</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Profissional aceitou o pedido</p>
                    </div>
                  </div>
                )}

                {/* Iniciado */}
                {order.startedAt && (
                  <div className="relative flex items-start gap-3 pb-6">
                    <div className="absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] z-0 bg-red-300 dark:bg-red-700" />
                    <div className="relative z-10 w-8 h-8 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Serviço Iniciado</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatDateTime(order.startedAt)}</p>
                    </div>
                  </div>
                )}

                {/* Cancelado */}
                <div className="relative flex items-start gap-3">
                  <div className="relative z-10 w-8 h-8 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center flex-shrink-0 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">Pedido Cancelado</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {order.cancelledAt ? formatDateTime(order.cancelledAt) : "Data não registrada"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Acoes pos-cancelamento */}
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-3">
                {paymentApproved && (
                  <button
                    onClick={() => navigate(chatRoute)}
                    className="btn btn-outline flex items-center gap-2 text-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Ver mensagens
                  </button>
                )}
                {isOrderClient && order.serviceListingId && (
                  <button
                    onClick={() => navigate(`/services/${order.serviceListingId}`)}
                    className="btn btn-outline flex items-center gap-2 text-sm"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Recontratar serviço
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Professional Actions */}
          {isOrderProfessional && (
            <div className="card animate-fade-in">
              {order.status === "PENDING" && (
                <div className="space-y-4">
                  {/* Compact header */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                        Novo pedido recebido
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Aceite ou recuse para continuar
                      </p>
                    </div>
                  </div>

                  {/* Quick info grid - compact */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary-600">
                        {formatCurrency(order.price)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Valor</p>
                    </div>
                    <div className="text-center border-x border-slate-200 dark:border-slate-700">
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {order.deadlineDays || 7}d
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Prazo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {order.scheduledDate ? formatDate(order.scheduledDate) : "Flexivel"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Data</p>
                    </div>
                  </div>

                  {/* Client info inline */}
                  {order.client && (
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        {order.client.profileImage ? (
                          <img src={order.client.profileImage} alt={order.client.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">{order.client.name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        Cliente: <strong className="text-slate-900 dark:text-slate-100">{order.client.name}</strong>
                      </span>
                    </div>
                  )}

                  {/* Action buttons - prominent */}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => handleAction(() => acceptOrder(order.id), "Pedido aceito!", "ACCEPTED")}
                      disabled={!!actionLoading}
                      className="btn btn-primary flex-1 py-2.5 flex items-center justify-center gap-2"
                    >
                      {!!actionLoading ? (
                        <span className="loader h-4 w-4" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Aceitar Pedido
                    </button>
                    <button
                      onClick={() =>
                        setConfirmAction({
                          title: "Recusar pedido",
                          message: "Tem certeza que deseja recusar este pedido?",
                          variant: "danger",
                          confirmLabel: "Recusar",
                          action: () => cancelOrder(order.id, "Recusado pelo profissional"),
                        })
                      }
                      disabled={!!actionLoading}
                      className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ACCEPTED: Show location map + start service */}
              {order.status === "ACCEPTED" && (
                <div className="space-y-4 animate-slide-up">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">
                        Pedido aceito!
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {paymentApproved
                          ? "Dirija-se ao cliente para iniciar o servico"
                          : "Aguardando pagamento do cliente"}
                      </p>
                    </div>
                  </div>

                  {/* Location map (only after payment) */}
                  {paymentApproved && order.address && (
                    <WazeMap
                      orderId={order.id}
                      isProfessional={true}
                      professionalName={order.professional?.name || "Profissional"}
                      destinationAddress={{
                        street: order.address.street || "",
                        number: order.address.number || "",
                        neighborhood: order.address.neighborhood || "",
                        city: order.address.city || "",
                        state: order.address.state || "",
                        zipCode: order.address.zipCode || "",
                        latitude: order.address.latitude,
                        longitude: order.address.longitude,
                      }}
                      orderStatus={order.status}
                    />
                  )}

                  {/* En-route button (professional, before starting service) */}
                  {paymentApproved && !order.enRouteAt && (
                    <button
                      onClick={async () => {
                        setActionLoading("enroute");
                        try {
                          await markEnRoute(order.id);
                          setOrder((prev) =>
                            prev ? { ...prev, enRouteAt: new Date().toISOString() } : prev,
                          );
                          toast.success("Trajeto iniciado! O cliente foi notificado.");
                        } catch (err: any) {
                          toast.error(
                            err?.response?.data?.message || "Erro ao iniciar trajeto",
                          );
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={!!actionLoading}
                      className="btn bg-blue-600 hover:bg-blue-700 text-white w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      {actionLoading === "enroute" ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Navigation className="w-4 h-4" />
                      )}
                      Iniciar trajeto
                    </button>
                  )}

                  {/* En-route confirmed badge */}
                  {paymentApproved && order.enRouteAt && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <Navigation className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        Voce esta a caminho — o cliente foi notificado.
                      </p>
                    </div>
                  )}

                  {/* Start service button */}
                  {paymentApproved && (
                    <button
                      onClick={() => handleAction(() => startOrder(order.id), "Servico iniciado!", "IN_PROGRESS")}
                      disabled={!!actionLoading}
                      className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Iniciar Servico
                    </button>
                  )}

                  {/* Reagendar */}
                  {order.professionalId && (
                    <button
                      onClick={() => setShowReschedule(true)}
                      disabled={!!actionLoading}
                      className="btn btn-outline w-full"
                    >
                      <CalendarClock className="w-4 h-4 mr-2" />
                      Reagendar
                    </button>
                  )}
                </div>
              )}

              {/* IN_PROGRESS */}
              {order.status === "IN_PROGRESS" && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      Serviço em andamento. Aguarde o cliente confirmar que o serviço foi realizado.
                    </p>
                  </div>
                  {order.professionalId && (
                    <button
                      onClick={() => setShowReschedule(true)}
                      disabled={!!actionLoading}
                      className="btn btn-outline w-full"
                    >
                      <CalendarClock className="w-4 h-4 mr-2" />
                      Reagendar
                    </button>
                  )}
                  <button
                    onClick={() => setShowDispute(true)}
                    disabled={!!actionLoading}
                    className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Abrir Disputa
                  </button>
                </div>
              )}

              {/* AWAITING_PROFESSIONAL_CONFIRMATION */}
              {order.status === "AWAITING_PROFESSIONAL_CONFIRMATION" && (
                <div className="animate-fade-in">
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Confirmar conclusao",
                        message: "Confirme que o servico foi concluido conforme combinado.",
                        variant: "warning",
                        confirmLabel: "Confirmar Conclusao",
                        action: () => confirmProfessionalCompletion(order.id),
                      })
                    }
                    disabled={!!actionLoading}
                    className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar Conclusao
                  </button>
                </div>
              )}

              {/* AWAITING_CLIENT_CONFIRMATION */}
              {order.status === "AWAITING_CLIENT_CONFIRMATION" && (
                <div className="animate-fade-in flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Aguardando o cliente confirmar para finalizar o pedido.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Client: Location tracking map (after payment, when professional is en route) */}
          {isOrderClient && paymentApproved && order.address &&
            ["ACCEPTED", "IN_PROGRESS"].includes(order.status) && (
            <div className="card animate-fade-in">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-500" />
                Localizacao do Profissional
              </h2>
              <WazeMap
                orderId={order.id}
                isProfessional={false}
                professionalName={order.professional?.name || "Profissional"}
                destinationAddress={{
                  street: order.address.street || "",
                  number: order.address.number || "",
                  neighborhood: order.address.neighborhood || "",
                  city: order.address.city || "",
                  state: order.address.state || "",
                  zipCode: order.address.zipCode || "",
                  latitude: order.address.latitude,
                  longitude: order.address.longitude,
                }}
                orderStatus={order.status}
              />
            </div>
          )}

          {/* Acoes do cliente */}
          {isOrderClient && !["CANCELLED", "EXPIRED"].includes(order.status) && (
            <div className="card">
              <div className="flex flex-wrap gap-3">
                {/* Botao de Chat - so aparece apos pagamento aprovado */}
                {paymentApproved && !["CANCELLED", "EXPIRED"].includes(order.status) && (
                  <button
                    onClick={() => navigate(chatRoute)}
                    className="btn btn-outline flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Abrir chat do servico
                  </button>
                )}

                {/* Cliente confirma que o serviço foi realizado */}
                {order.status === "IN_PROGRESS" && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Confirmar conclusão do serviço",
                        message: "Confirme que o serviço foi realizado conforme combinado. Após sua confirmação, o profissional poderá finalizar o pedido e o pagamento será liberado.",
                        variant: "warning",
                        confirmLabel: "Confirmar que foi realizado",
                        action: () => submitOrderCompletion(order.id),
                      })
                    }
                    disabled={!!actionLoading}
                    className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirmar que o serviço foi realizado
                  </button>
                )}

                {/* Aguardando confirmacao do profissional */}
                {order.status === "AWAITING_PROFESSIONAL_CONFIRMATION" && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Voce ja confirmou! Aguardando o profissional confirmar a conclusao do servico.
                    </p>
                  </div>
                )}

                {/* Liberar pagamento */}
                {order.status === "COMPLETED" && hasPendingPayment && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Liberar pagamento",
                        message: "Ao liberar, o valor sera transferido ao profissional. Esta acao nao pode ser desfeita.",
                        variant: "warning",
                        confirmLabel: "Liberar",
                        action: () => releasePayment(order.id),
                      })
                    }
                    disabled={!!actionLoading}
                    className="btn btn-primary"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Liberar Pagamento
                  </button>
                )}

                {/* Cancelar pedido (somente pre-pagamento) */}
                {["PENDING", "ACCEPTED"].includes(order.status) && needsPayment && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Cancelar pedido",
                        message: "Tem certeza que deseja cancelar este pedido?",
                        variant: "danger",
                        confirmLabel: "Cancelar pedido",
                        action: () => cancelOrder(order.id, "Cancelado pelo cliente"),
                      })
                    }
                    disabled={!!actionLoading}
                    className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar Pedido
                  </button>
                )}

                {/* Reagendar (aceito ou em andamento) */}
                {["ACCEPTED", "IN_PROGRESS"].includes(order.status) && order.professionalId && (
                  <button
                    onClick={() => setShowReschedule(true)}
                    disabled={!!actionLoading}
                    className="btn btn-outline"
                  >
                    <CalendarClock className="w-4 h-4 mr-2" />
                    Reagendar
                  </button>
                )}

                {/* Abrir Disputa (em andamento ou aguardando confirmacao) */}
                {["IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION"].includes(order.status) && (
                  <button
                    onClick={() => setShowDispute(true)}
                    disabled={!!actionLoading}
                    className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Abrir Disputa
                  </button>
                )}

                {/* Status finais */}
                {order.status === "COMPLETED" && hasReleasedPayment && (
                  <p className="text-sm text-green-600">Pagamento liberado com sucesso!</p>
                )}
              </div>
            </div>
          )}

          {/* Avaliacao - ReviewCTA (apenas apos conclusao, apenas cliente) */}
          {order.status === "COMPLETED" && isOrderClient && (
            <ReviewCTA
              onSubmit={async (data) => {
                await createReview(order.id, data);
                setReviewSubmitted(true);
                await loadOrder();
              }}
              professionalName={order.professional?.name}
              alreadyReviewed={reviewSubmitted || (order.reviews?.some((r: any) => r.authorId === user?.id) ?? false)}
              loading={!!actionLoading}
            />
          )}

          {/* Existing reviews display */}
          {order.status === "COMPLETED" && order.reviews && order.reviews.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Avaliacoes</h2>
              <div className="space-y-3">
                {order.reviews.map((review) => (
                  <div key={review.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-4 h-4 ${s <= review.rating ? "text-yellow-500 fill-current" : "text-slate-300 dark:text-slate-600"}`} />
                        ))}
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        por {review.author?.name}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Re-hire button */}
              {isOrderClient && order.serviceListingId && (
                <button
                  onClick={async () => {
                    try {
                      setActionLoading("rehire");
                      const newOrder = await createOrder({
                        serviceListingId: order.serviceListingId!,
                        title: order.title,
                        description: `Recontratacao do servico "${order.title}"`,
                      });
                      navigate(`/client/orders/${newOrder.id}`);
                    } catch (err: any) {
                      toast.error("Erro", err?.response?.data?.message || "Erro ao recontratar");
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  disabled={!!actionLoading}
                  className="btn btn-primary mt-4 w-full"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Recontratar profissional
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info do outro usuario */}
          <div className="card">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {isOrderClient ? "Profissional" : "Cliente"}
            </h3>
            {(() => {
              const otherUser = isOrderClient ? order.professional : order.client;
              if (!otherUser) return <p className="text-sm text-slate-500 dark:text-slate-400">Nao atribuido</p>;
              return (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    {otherUser.profileImage ? (
                      <img src={otherUser.profileImage} alt={otherUser.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                        {otherUser.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{otherUser.name}</p>
                    {(otherUser as any).ratingAverage !== undefined && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {(otherUser as any).ratingAverage?.toFixed(1)} ({(otherUser as any).totalReviews})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Pagamento info (apos pago) */}
          {activePayment && (
            <div className="card">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Pagamento</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Valor</span>
                  <span className="font-medium">{formatCurrency(activePayment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <span className={`font-medium ${
                    activePayment.status === "HELD" ? "text-yellow-600 dark:text-yellow-400" :
                    activePayment.status === "RELEASED" ? "text-green-600 dark:text-green-400" :
                    "text-slate-600 dark:text-slate-400"
                  }`}>
                    {formatPaymentStatus(activePayment.status)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Metodo</span>
                  <span className="font-medium capitalize">{activePayment.paymentMethod}</span>
                </div>
                {activePayment.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Pago em</span>
                    <span className="font-medium">{formatDate(activePayment.paidAt)}</span>
                  </div>
                )}
                {activePayment.releasedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Liberado em</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatDate(activePayment.releasedAt)}</span>
                  </div>
                )}
              </div>
              {activePayment.status === "HELD" && (
                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                  Pagamento recebido. Sera liberado ao profissional quando ambos confirmarem a conclusao do servico.
                </div>
              )}
              {activePayment.status === "RELEASED" && (
                <div className="mt-3 p-2.5 bg-green-50 dark:bg-green-900/10 rounded-lg text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Pagamento liberado para o profissional.
                </div>
              )}
            </div>
          )}

          {/* Endereco */}
          {order.address && (
            <div className="card">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Endereco</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {order.address.street}, {order.address.number}
                {order.address.complement && ` - ${order.address.complement}`}
                <br />
                {order.address.neighborhood} - {order.address.city}/{order.address.state}
                <br />
                CEP: {order.address.zipCode}
              </p>
              {order.addressNotes && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Obs: {order.addressNotes}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {order.professionalId && (
        <RescheduleModal
          isOpen={showReschedule}
          onClose={() => setShowReschedule(false)}
          orderId={order.id}
          professionalId={order.professionalId}
          onRescheduled={loadOrder}
        />
      )}

      <DisputeModal
        isOpen={showDispute}
        onClose={() => setShowDispute(false)}
        orderId={order.id}
        onDisputeCreated={loadOrder}
      />

      <ConfirmDialog
        isOpen={confirmAction !== null}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmedAction}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirmar"}
        variant={confirmAction?.variant || "danger"}
        loading={!!actionLoading}
      />

      {/* Delay alert modal (client only) */}
      {delayAlert && (
        <DelayAlertModal
          orderId={delayAlert.orderId}
          orderTitle={delayAlert.orderTitle}
          professionalName={delayAlert.professionalName}
          onRespond={async (orderId, arrived, action) => {
            await delayResponse(orderId, { arrived, action });
          }}
          onClose={() => setDelayAlert(null)}
        />
      )}
    </div>
  );
};

export default OrderDetails;
