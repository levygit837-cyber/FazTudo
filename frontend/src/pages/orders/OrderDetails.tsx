import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import RescheduleModal from "../../components/orders/RescheduleModal";
import DisputeModal from "../../components/orders/DisputeModal";
import ProposalComparator from "../../components/orders/ProposalComparator";
import ReviewCTA from "../../components/orders/ReviewCTA";
import { SkeletonOrderCard, Skeleton, SkeletonText } from "../../components/common/Skeleton";
import {
  getOrderById,
  acceptOrder,
  startOrder,
  submitOrderCompletion,
  confirmOrderCompletion,
  confirmProfessionalCompletion,
  cancelOrder,
  releasePayment,
  createReview,
  createOrder,
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
              className={`absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] ${
                step.done
                  ? "bg-green-300 dark:bg-green-700"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          )}
          <div
            className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
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
  const [actionLoading, setActionLoading] = useState(false);
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

  const isOrderClient = order?.clientId === user?.id;
  const isOrderProfessional = order?.professionalId === user?.id;
  const chatRoute = isOrderProfessional
    ? `/professional/services/${id}/chat`
    : `/client/orders/${id}/chat`;

  const loadOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
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

  const handleAction = async (action: () => Promise<any>, successMsg?: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await action();
      await loadOrder();
      toast.success(successMsg || "Acao realizada com sucesso");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao executar acao";
      setError(msg);
      toast.error("Erro", msg);
    } finally {
      setActionLoading(false);
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
          order.status === "CANCELLED" ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" :
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

          {/* Acoes do profissional (somente visivel para o profissional) */}
          {isOrderProfessional && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Acoes</h2>
              <div className="flex flex-wrap gap-3">
                {order.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => handleAction(() => acceptOrder(order.id), "Pedido aceito!")}
                      disabled={actionLoading}
                      className="btn btn-primary"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
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
                      disabled={actionLoading}
                      className="btn btn-outline text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Recusar
                    </button>
                  </>
                )}
                {order.status === "ACCEPTED" && (
                  <button
                    onClick={() => handleAction(() => startOrder(order.id), "Servico iniciado!")}
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Iniciar Servico
                  </button>
                )}
                {order.status === "IN_PROGRESS" && (
                  <button
                    onClick={() => handleAction(() => submitOrderCompletion(order.id), "Servico marcado como entregue!")}
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Entregue
                  </button>
                )}
                {order.status === "AWAITING_PROFESSIONAL_CONFIRMATION" && (
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
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar Conclusao
                  </button>
                )}
                {order.status === "AWAITING_CLIENT_CONFIRMATION" && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Aguardando o cliente confirmar para finalizar o pedido.
                  </p>
                )}

                {/* Reagendar (aceito ou em andamento) */}
                {["ACCEPTED", "IN_PROGRESS"].includes(order.status) && order.professionalId && (
                  <button
                    onClick={() => setShowReschedule(true)}
                    disabled={actionLoading}
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
                    disabled={actionLoading}
                    className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Abrir Disputa
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Acoes do cliente */}
          {isOrderClient && (
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

                {/* Cliente confirma conclusao */}
                {order.status === "AWAITING_CLIENT_CONFIRMATION" && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Confirmar conclusao",
                        message: "Ao confirmar, voce atesta que o servico foi entregue conforme combinado.",
                        variant: "warning",
                        confirmLabel: "Confirmar",
                        action: () => confirmOrderCompletion(order.id),
                      })
                    }
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar conclusao do servico
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
                    disabled={actionLoading}
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
                    disabled={actionLoading}
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
                    disabled={actionLoading}
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
                    disabled={actionLoading}
                    className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Abrir Disputa
                  </button>
                )}

                {/* Status finais */}
                {order.status === "CANCELLED" && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Este pedido foi cancelado.</p>
                )}
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
              loading={actionLoading}
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
                      setActionLoading(true);
                      const newOrder = await createOrder({
                        serviceListingId: order.serviceListingId!,
                        title: order.title,
                        description: `Recontratacao do servico "${order.title}"`,
                      });
                      navigate(`/client/orders/${newOrder.id}`);
                    } catch (err: any) {
                      toast.error("Erro", err?.response?.data?.message || "Erro ao recontratar");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
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
        loading={actionLoading}
      />
    </div>
  );
};

export default OrderDetails;
