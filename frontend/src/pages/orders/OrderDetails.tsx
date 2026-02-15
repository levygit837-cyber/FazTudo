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
  Send,
  CreditCard,
  CalendarClock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import ProposalComparator from "../../components/orders/ProposalComparator";
import RescheduleModal from "../../components/orders/RescheduleModal";
import OrderTimeline from "../../components/orders/OrderTimeline";
import DisputeModal from "../../components/orders/DisputeModal";
import ServiceFlowStepper from "../../components/orders/ServiceFlowStepper";
import FlowStatusBanner from "../../components/orders/FlowStatusBanner";
import DualConfirmation from "../../components/orders/DualConfirmation";
import ReviewCTA from "../../components/orders/ReviewCTA";
import { SkeletonOrderCard, Skeleton, SkeletonText } from "../../components/common/Skeleton";
import {
  getOrderById,
  acceptOrder,
  startOrder,
  submitOrderCompletion,
  confirmOrderCompletion,
  cancelOrder,
  releasePayment,
  createReview,
  createOrder,
  sendMessage,
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

const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    variant: "danger" | "warning" | "info";
    confirmLabel: string;
    action: () => Promise<any>;
    successMessage?: string;
  } | null>(null);

  // Review state
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Message state
  const [newMessage, setNewMessage] = useState("");

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
      toast.success("Pagamento aprovado! Aguardando confirmação.");
    } else if (paymentStatus === "failure") {
      toast.error("Pagamento", "Pagamento não foi aprovado. Tente novamente.");
    } else if (paymentStatus === "pending") {
      toast.info("Pagamento pendente. Você será notificado quando for confirmado.");
    }
    // Clean URL params
    if (paymentStatus) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleAction = async (action: () => Promise<any>, successMessage?: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await action();
      await loadOrder();
      toast.success(successMessage || "Ação realizada com sucesso!");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao executar ação";
      setError(msg);
      toast.error("Erro", msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    await handleAction(confirmAction.action, confirmAction.successMessage);
    setConfirmAction(null);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !order) return;
    try {
      await sendMessage(order.id, newMessage.trim());
      setNewMessage("");
      await loadOrder();
    } catch (err) {
      setError("Erro ao enviar mensagem");
    }
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8 max-w-4xl animate-pulse space-y-6">
      <Skeleton className="h-6 w-40 rounded" />
      <SkeletonOrderCard />
      <SkeletonText lines={5} />
    </div>
  );
  if (!order) return <div className="text-center py-12 text-slate-600 dark:text-slate-400">Pedido nao encontrado</div>;

  const activePayment = order.payments?.find((p) => p.status === "HELD" || p.status === "RELEASED" || p.status === "PENDING");
  const hasPendingPayment = order.payments?.some((p) => p.status === "HELD");
  const hasReleasedPayment = order.payments?.some((p) => p.status === "RELEASED");
  const needsPayment = !order.payments?.length || order.payments.every((p) => p.status === "FAILED" || p.status === "REFUNDED");

  // Timeline steps
  const timelineSteps = [
    { label: "Pedido Criado", date: order.createdAt, done: true },
    { label: "Aceito", date: order.status !== "PENDING" && order.status !== "CANCELLED" ? order.startedAt || order.createdAt : null, done: ["ACCEPTED", "IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION", "COMPLETED"].includes(order.status) },
    { label: "Pagamento", date: activePayment?.paidAt, done: !!activePayment },
    { label: "Em Andamento", date: order.startedAt, done: ["IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION", "COMPLETED"].includes(order.status) },
    { label: "Aguardando confirmacao", date: order.status === "AWAITING_CLIENT_CONFIRMATION" ? order.updatedAt : null, done: ["AWAITING_CLIENT_CONFIRMATION", "COMPLETED"].includes(order.status) },
    { label: "Concluido", date: order.completedAt, done: order.status === "COMPLETED" },
    { label: "Pagamento Liberado", date: hasReleasedPayment ? activePayment?.releasedAt : null, done: !!hasReleasedPayment },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{order.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pedido #{order.id} - {formatRelativeTime(order.createdAt)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          order.status === "COMPLETED" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
          order.status === "CANCELLED" ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" :
          order.status === "AWAITING_CLIENT_CONFIRMATION" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
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

      {/* Service Flow Stepper */}
      <ServiceFlowStepper
        status={order.status}
        hasPayment={!!activePayment}
        hasReview={reviewSubmitted || (order.reviews && order.reviews.length > 0)}
      />

      {/* Flow Status Banner */}
      <FlowStatusBanner
        status={order.status}
        isClient={isOrderClient}
        isProfessional={isOrderProfessional}
        hasPayment={!!activePayment}
        orderId={order.id}
        onAction={
          order.status === "ACCEPTED" && isOrderClient && needsPayment
            ? () => navigate(`/client/orders/${order.id}/checkout`)
            : order.status === "PENDING" && isOrderProfessional
              ? () => handleAction(() => acceptOrder(order.id), "✅ Pedido aceito! O cliente será notificado.")
              : order.status === "IN_PROGRESS" && isOrderProfessional
                ? () => handleAction(() => submitOrderCompletion(order.id), "🔔 Serviço marcado como concluído! Aguardando confirmação do cliente.")
                : order.status === "AWAITING_CLIENT_CONFIRMATION" && isOrderClient
                  ? () => setConfirmAction({
                      title: "Confirmar conclusao",
                      message: "Ao confirmar, voce atesta que o servico foi entregue conforme combinado.",
                      variant: "warning",
                      confirmLabel: "Confirmar",
                      action: () => confirmOrderCompletion(order.id),
                      successMessage: "✅ Serviço confirmado! O pagamento será liberado ao profissional.",
                    })
                  : undefined
        }
      />

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
                  <p className="font-medium">{formatDate(order.scheduledDate)}</p>
                </div>
              )}
              {order.deadlineDate && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Prazo</span>
                  <p className="font-medium">{formatDate(order.deadlineDate)}</p>
                </div>
              )}
              <div>
                <span className="text-slate-500 dark:text-slate-400">Criado em</span>
                <p className="font-medium">{formatDateTime(order.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Progresso</h2>
            <OrderTimeline steps={timelineSteps} deadlineDate={order.deadlineDate} />
          </div>

          {/* Proposals (visible for PENDING orders) */}
          {order.status === "PENDING" && (
            <ProposalComparator
              orderId={order.id}
              isClient={isOrderClient}
              onProposalAccepted={loadOrder}
            />
          )}

          {/* Dual Confirmation (visible for AWAITING_CLIENT_CONFIRMATION and COMPLETED) */}
          {(order.status === "AWAITING_CLIENT_CONFIRMATION" || order.status === "COMPLETED") && (
            <DualConfirmation
              professionalConfirmedAt={order.professionalConfirmedAt}
              clientConfirmedAt={order.clientConfirmedAt}
              professionalName={order.professional?.name}
              clientName={order.client?.name}
              isClient={isOrderClient}
              onConfirm={
                isOrderClient && order.status === "AWAITING_CLIENT_CONFIRMATION"
                  ? () => handleAction(() => confirmOrderCompletion(order.id), "✅ Serviço confirmado! O pagamento será liberado ao profissional.")
                  : undefined
              }
              loading={actionLoading}
            />
          )}

          {/* Ações */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Acoes</h2>
            <div className="mb-4">
              <button
                onClick={() => navigate(chatRoute)}
                className="btn btn-outline"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Abrir chat do servico
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {/* Profissional: aceitar pedido pendente */}
              {isOrderProfessional && order.status === "PENDING" && (
                <>
                  <button
                    onClick={() => handleAction(() => acceptOrder(order.id), "✅ Pedido aceito! O cliente será notificado.")}
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
                        successMessage: "❌ Pedido recusado. O cliente será notificado.",
                      })
                    }
                    disabled={actionLoading}
                    className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Recusar
                  </button>
                </>
              )}

              {/* Cliente: pagar pedido aceito */}
              {isOrderClient && (order.status === "PENDING" || order.status === "ACCEPTED") && needsPayment && (
                <button
                  onClick={() => navigate(`/client/orders/${order.id}/checkout`)}
                  className="btn btn-primary"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pagar {formatCurrency(order.price)}
                </button>
              )}

              {/* Profissional: iniciar serviço */}
              {isOrderProfessional && order.status === "ACCEPTED" && (
                <button
                  onClick={() => handleAction(() => startOrder(order.id), "🚀 Serviço iniciado! O cliente foi notificado.")}
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Iniciar Servico
                </button>
              )}

              {/* Profissional: concluir serviço */}
              {isOrderProfessional && order.status === "IN_PROGRESS" && (
                <button
                  onClick={() =>
                    handleAction(() => submitOrderCompletion(order.id), "🔔 Serviço marcado como concluído! Aguardando confirmação do cliente.")
                  }
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marcar como Entregue
                </button>
              )}

              {isOrderClient &&
                order.status === "AWAITING_CLIENT_CONFIRMATION" && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Confirmar conclusao",
                        message: "Ao confirmar, voce atesta que o servico foi entregue conforme combinado.",
                        variant: "warning",
                        confirmLabel: "Confirmar",
                        action: () => confirmOrderCompletion(order.id),
                        successMessage: "✅ Serviço confirmado! O pagamento será liberado ao profissional.",
                      })
                    }
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar conclusao do servico
                  </button>
                )}

              {/* Cliente: liberar pagamento */}
              {isOrderClient && order.status === "COMPLETED" && hasPendingPayment && (
                <button
                  onClick={() =>
                    setConfirmAction({
                      title: "Liberar pagamento",
                      message: "Ao liberar, o valor sera transferido ao profissional. Esta acao nao pode ser desfeita.",
                      variant: "warning",
                      confirmLabel: "Liberar",
                      action: () => releasePayment(order.id),
                      successMessage: "💰 Pagamento liberado com sucesso! O profissional será notificado.",
                    })
                  }
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Liberar Pagamento
                </button>
              )}

              {/* Cancelar (ambos, somente pendente/aceito) */}
              {(isOrderClient || isOrderProfessional) &&
                ["PENDING", "ACCEPTED"].includes(order.status) && (
                <button
                  onClick={() =>
                    setConfirmAction({
                      title: "Cancelar pedido",
                      message: "Tem certeza que deseja cancelar este pedido? Esta acao nao pode ser desfeita.",
                      variant: "danger",
                      confirmLabel: "Cancelar pedido",
                      action: () => cancelOrder(order.id, "Cancelado pelo usuario"),
                      successMessage: "🚫 Pedido cancelado. Pagamentos pendentes serão reembolsados.",
                    })
                  }
                  disabled={actionLoading}
                  className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar Pedido
                </button>
              )}

              {/* Reagendar (ambos, aceito ou em andamento) */}
              {(isOrderClient || isOrderProfessional) &&
                ["ACCEPTED", "IN_PROGRESS"].includes(order.status) && order.professionalId && (
                <button
                  onClick={() => setShowReschedule(true)}
                  disabled={actionLoading}
                  className="btn btn-outline"
                >
                  <CalendarClock className="w-4 h-4 mr-2" />
                  Reagendar
                </button>
              )}

              {/* Abrir Disputa (ambos, em andamento ou aguardando confirmação) */}
              {(isOrderClient || isOrderProfessional) &&
                ["IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION"].includes(order.status) && (
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
              {isOrderProfessional &&
                order.status === "AWAITING_CLIENT_CONFIRMATION" && (
                  <p className="text-sm text-amber-600">
                    Aguardando o cliente confirmar para finalizar o pedido.
                  </p>
                )}
              {order.status === "COMPLETED" && hasReleasedPayment && (
                <p className="text-sm text-green-600">Pagamento liberado com sucesso!</p>
              )}
            </div>
          </div>

          {/* Avaliação - ReviewCTA */}
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
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Avaliações</h2>
              <div className="space-y-3">
                {order.reviews.map((review) => (
                  <div key={review.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-4 h-4 ${s <= review.rating ? "text-yellow-500 fill-current" : "text-slate-300 dark:text-slate-600"}`} />
                        ))}
                      </div>
                      <span className="text-sm text-slate-500 dark:text-slate-400">por {review.author?.name}</span>
                    </div>
                    {review.comment && <p className="text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>}
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
                        description: `Recontratação do serviço "${order.title}"`,
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

          {/* Mensagens */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
              <MessageSquare className="w-5 h-5 inline mr-2" />
              Mensagens
            </h2>
            <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
              {(!order.messages || order.messages.length === 0) ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Nenhuma mensagem ainda</p>
              ) : (
                order.messages.map((msg: any) => {
                  const isOwn = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        isOwn
                          ? "bg-primary-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      }`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isOwn ? "text-primary-200" : "text-slate-500 dark:text-slate-400"}`}>
                          {formatRelativeTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {!["CANCELLED", "EXPIRED"].includes(order.status) && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="btn btn-primary px-4"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
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
                      <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">{otherUser.name.charAt(0)}</span>
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

          {/* Pagamento */}
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
              {/* Payment status explanation */}
              {activePayment.status === "HELD" && (
                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                  Pagamento recebido. Sera liberado ao profissional quando voce confirmar a conclusao do servico.
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

          {/* Endereço */}
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
