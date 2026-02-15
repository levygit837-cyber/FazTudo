import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useMercadoPago } from "../../hooks/useMercadoPago";
import {
  getOrderById,
  createPayment,
  rescheduleOrder,
  cancelOrder,
} from "../../services/serviceService";
import type { ServiceOrder, TransparentCheckoutResponse } from "../../types";
import PaymentMethodSelector from "../../components/checkout/PaymentMethodSelector";
import CheckoutSummary from "../../components/checkout/CheckoutSummary";
import CardForm from "../../components/checkout/CardForm";
import PixPayment from "../../components/checkout/PixPayment";
import BoletoPayment from "../../components/checkout/BoletoPayment";
import PaymentStatusBanner from "../../components/checkout/PaymentStatusBanner";
import AvailabilityCalendar from "../../components/orders/AvailabilityCalendar";
import ConfirmDialog from "../../components/common/ConfirmDialog";

type PaymentMethod = "credit_card" | "pix" | "boleto";

// =====================================
// UNIFIED STEPPER
// =====================================
const STEPS = [
  { label: "Horarios", icon: Calendar },
  { label: "Pagamento", icon: CreditCard },
];

function UnifiedStepper({
  currentStep,
  scheduleCompleted,
}: {
  currentStep: 0 | 1;
  scheduleCompleted: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isCompleted =
          (index === 0 && scheduleCompleted) || index < currentStep;
        const isActive = index === currentStep && !isCompleted;

        return (
          <div key={step.label} className="flex items-center gap-3 flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isCompleted
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 animate-stepComplete"
                    : isActive
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 animate-pulse-soft"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCompleted
                    ? "text-green-600 dark:text-green-400"
                    : isActive
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-5">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-700 ease-out"
                  style={{ width: scheduleCompleted ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =====================================
// MAIN CHECKOUT COMPONENT
// =====================================
export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const {
    mpInstance,
    loading: mpLoading,
    error: mpError,
    createCardToken,
  } = useMercadoPago();

  // Order
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);

  // Stepper
  const [currentStep, setCurrentStep] = useState<0 | 1>(0);
  const [scheduleCompleted, setScheduleCompleted] = useState(false);

  // Step 0 — Schedule
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Step 1 — Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<TransparentCheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Payer data (split first/last name)
  const [payerFirstName, setPayerFirstName] = useState(() => {
    const parts = (user?.name || "").split(" ");
    return parts[0] || "";
  });
  const [payerLastName, setPayerLastName] = useState(() => {
    const parts = (user?.name || "").split(" ");
    return parts.slice(1).join(" ") || "";
  });
  const [payerEmail, setPayerEmail] = useState(user?.email || "");
  const [payerCPF, setPayerCPF] = useState(user?.document || "");

  // Card sub-step
  const [cardSubStep, setCardSubStep] = useState<"payer" | "card">("payer");

  // Cancel
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Address data for card payments
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZipCode, setAddressZipCode] = useState("");

  // Load order
  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getOrderById(parseInt(id));
      setOrder(data);

      // Check if order already has active payment
      const hasActivePayment = data.payments?.some(
        (p) => p.status === "HELD" || p.status === "PENDING"
      );
      if (hasActivePayment) {
        toast.warning("Atencao", "Este pedido ja possui um pagamento ativo.");
        navigate(`/client/orders/${id}`);
        return;
      }

      // Check if order can be paid
      if (data.status !== "PENDING" && data.status !== "ACCEPTED") {
        toast.error("Erro", "Este pedido nao pode receber pagamento no momento.");
        navigate(`/client/orders/${id}`);
        return;
      }

      // Auto-skip to step 1 if scheduledDate already set
      if (data.scheduledDate) {
        setScheduleCompleted(true);
        setCurrentStep(1);
      }

      // Pre-fill address if order has one
      if (data.address) {
        setAddressStreet(data.address.street || "");
        setAddressNumber(data.address.number || "");
        setAddressComplement(data.address.complement || "");
        setAddressNeighborhood(data.address.neighborhood || "");
        setAddressCity(data.address.city || "");
        setAddressState(data.address.state || "");
        setAddressZipCode(data.address.zipCode || "");
      }
    } catch (err: any) {
      setError("Erro ao carregar pedido");
      toast.error("Erro", "Nao foi possivel carregar os dados do pedido.");
    } finally {
      setLoading(false);
    }
  };

  // ===== SCHEDULE HANDLERS =====
  const handleSlotSelect = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
  };

  const handleConfirmSchedule = async () => {
    if (!order || !selectedDate || !selectedTime) return;

    setSavingSchedule(true);
    try {
      await rescheduleOrder(order.id, {
        newDate: `${selectedDate}T${selectedTime}:00`,
      });

      setScheduleCompleted(true);

      // Reload order to get updated scheduledDate
      const updatedOrder = await getOrderById(order.id);
      setOrder(updatedOrder);

      // Animate then advance
      setTimeout(() => {
        setCurrentStep(1);
      }, 400);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao agendar horario.";
      toast.error("Erro", msg);
    } finally {
      setSavingSchedule(false);
    }
  };

  // ===== PAYMENT HELPERS =====
  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length > 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    if (digits.length > 6)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    if (digits.length > 3)
      return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    return digits;
  };

  const validatePayerData = (): boolean => {
    if (!payerFirstName || payerFirstName.trim().length < 2) {
      toast.error("Dados incompletos", "Informe seu nome.");
      return false;
    }
    if (!payerLastName || payerLastName.trim().length < 2) {
      toast.error("Dados incompletos", "Informe seu sobrenome.");
      return false;
    }
    if (!payerEmail || !payerEmail.includes("@")) {
      toast.error("Dados incompletos", "Informe um email valido.");
      return false;
    }
    const cpfDigits = payerCPF.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      toast.error("Dados incompletos", "Informe um CPF valido (11 digitos).");
      return false;
    }
    return true;
  };

  const validateAddress = (): boolean => {
    if (!addressStreet.trim()) {
      toast.error("Endereco incompleto", "Informe a rua.");
      return false;
    }
    if (!addressNumber.trim()) {
      toast.error("Endereco incompleto", "Informe o numero.");
      return false;
    }
    if (!addressNeighborhood.trim()) {
      toast.error("Endereco incompleto", "Informe o bairro.");
      return false;
    }
    if (!addressCity.trim()) {
      toast.error("Endereco incompleto", "Informe a cidade.");
      return false;
    }
    if (!addressState.trim()) {
      toast.error("Endereco incompleto", "Informe o estado.");
      return false;
    }
    if (addressZipCode.replace(/\D/g, "").length < 8) {
      toast.error("Endereco incompleto", "Informe o CEP.");
      return false;
    }
    return true;
  };

  // ===== CARD PAYMENT =====
  const handleCardPayerContinue = () => {
    if (!validatePayerData()) return;
    if (!validateAddress()) return;
    setCardSubStep("card");
  };

  const handleCardSubmit = async (cardData: {
    cardNumber: string;
    cardholderName: string;
    expirationMonth: string;
    expirationYear: string;
    securityCode: string;
    installments: number;
  }) => {
    if (!order || !validatePayerData()) return;

    setProcessing(true);
    setError(null);

    try {
      let token = "";
      let paymentMethodId = "visa";

      if (mpInstance) {
        try {
          const tokenResult = await createCardToken({
            cardNumber: cardData.cardNumber,
            cardholderName: cardData.cardholderName,
            expirationMonth: cardData.expirationMonth,
            expirationYear: cardData.expirationYear,
            securityCode: cardData.securityCode,
            identificationNumber: payerCPF.replace(/\D/g, ""),
          });
          token = tokenResult.id;
          const firstDigit = cardData.cardNumber.charAt(0);
          if (firstDigit === "4") paymentMethodId = "visa";
          else if (firstDigit === "5") paymentMethodId = "master";
          else if (firstDigit === "3") paymentMethodId = "amex";
        } catch (tokenError: any) {
          console.warn("Card token creation failed, using fallback:", tokenError);
          token = `dev-token-${Date.now()}`;
        }
      } else {
        token = `dev-token-${Date.now()}`;
      }

      const result = await createPayment(order.id, {
        paymentMethod: "credit_card",
        payerEmail,
        payerName: `${payerFirstName} ${payerLastName}`,
        payerCPF: payerCPF.replace(/\D/g, ""),
        token,
        paymentMethodId,
        installments: cardData.installments,
      });

      setPaymentResult(result);

      if (result.paymentData.status === "approved") {
        toast.success("Pagamento aprovado!", "O profissional sera notificado.");
      } else if (
        result.paymentData.status === "pending" ||
        result.paymentData.status === "in_process"
      ) {
        toast.info("Processando", "Seu pagamento esta sendo processado.");
      } else {
        toast.error(
          "Pagamento recusado",
          result.paymentData.statusDetail || "Tente outro metodo."
        );
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao processar pagamento.";
      setError(msg);
      toast.error("Erro no pagamento", msg);
    } finally {
      setProcessing(false);
    }
  };

  // ===== PIX / BOLETO =====
  const handlePixOrBoleto = async () => {
    if (!order || !paymentMethod || !validatePayerData()) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await createPayment(order.id, {
        paymentMethod,
        payerEmail,
        payerName: `${payerFirstName} ${payerLastName}`,
        payerCPF: payerCPF.replace(/\D/g, ""),
      });

      setPaymentResult(result);

      if (paymentMethod === "pix") {
        toast.success("PIX gerado!", "Escaneie o QR Code ou copie o codigo.");
      } else {
        toast.success("Boleto gerado!", "Pague ate a data de vencimento.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao gerar pagamento.";
      setError(msg);
      toast.error("Erro", msg);
    } finally {
      setProcessing(false);
    }
  };

  // ===== CANCEL =====
  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      await cancelOrder(order.id, "Cancelado pelo cliente no checkout");
      toast.success("Pedido cancelado com sucesso.");
      navigate("/client/orders");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao cancelar pedido.";
      toast.error("Erro", msg);
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  // ===== LOADING STATE =====
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          <p className="text-sm text-slate-500">Carregando checkout...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-slate-500">Pedido nao encontrado.</p>
        <button onClick={() => navigate(-1)} className="btn btn-outline mt-4">
          Voltar
        </button>
      </div>
    );
  }

  // ===== RENDER =====
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/client/orders/${order.id}`)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            Checkout
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pedido #{order.id} — {order.title}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="card mb-6 p-5">
        <UnifiedStepper
          currentStep={currentStep}
          scheduleCompleted={scheduleCompleted}
        />
      </div>

      {/* MP Loading */}
      {currentStep === 1 && mpLoading && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Inicializando MercadoPago...
        </div>
      )}

      {currentStep === 1 && mpError && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ {mpError} — O checkout funcionara em modo de desenvolvimento.
        </div>
      )}

      {/* Payment result */}
      {paymentResult && (
        <div className="mb-6 animate-fadeIn">
          <PaymentStatusBanner
            status={paymentResult.paymentData.status}
            statusDetail={paymentResult.paymentData.statusDetail}
            orderId={order.id}
          />

          {paymentResult.paymentData.paymentType === "pix" &&
            paymentResult.paymentData.status !== "approved" && (
              <div className="mt-4 card">
                <PixPayment
                  qrCode={paymentResult.paymentData.qrCode || ""}
                  qrCodeBase64={paymentResult.paymentData.qrCodeBase64 || ""}
                  expirationDate={paymentResult.paymentData.expirationDate || ""}
                  status={paymentResult.paymentData.status}
                  onCopy={() => toast.success("Copiado!", "Codigo PIX copiado.")}
                />
              </div>
            )}

          {paymentResult.paymentData.paymentType === "boleto" &&
            paymentResult.paymentData.status !== "approved" && (
              <div className="mt-4 card">
                <BoletoPayment
                  boletoUrl={paymentResult.paymentData.boletoUrl || ""}
                  barcode={paymentResult.paymentData.barcode || ""}
                  expirationDate={paymentResult.paymentData.expirationDate || ""}
                  status={paymentResult.paymentData.status}
                />
              </div>
            )}

          {/* Go to order details */}
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate(`/client/orders/${order.id}`)}
              className="btn btn-primary py-3 px-8"
            >
              Acompanhar pedido
            </button>
          </div>
        </div>
      )}

      {/* Main content - only show form if no result yet */}
      {!paymentResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step content */}
          <div className="lg:col-span-2 space-y-6">
            {/* ===== STEP 0: SCHEDULE ===== */}
            {currentStep === 0 && (
              <div className="animate-fadeIn space-y-6">
                <div className="card p-5">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Escolha um horario
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Selecione uma data e horario disponivel para o servico.
                  </p>

                  <AvailabilityCalendar
                    professionalId={order.professionalId || 0}
                    onSlotSelect={handleSlotSelect}
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                  />

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleConfirmSchedule}
                      disabled={
                        !selectedDate || !selectedTime || savingSchedule
                      }
                      className="btn btn-primary py-3 flex-1 disabled:opacity-50"
                    >
                      {savingSchedule ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Salvando...
                        </span>
                      ) : (
                        "Confirmar horario"
                      )}
                    </button>

                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={cancelling}
                      className="btn border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-3"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar pedido
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== STEP 1: PAYMENT ===== */}
            {currentStep === 1 && (
              <div className="animate-fadeIn space-y-6">
                {/* Payment method selector */}
                <div className="card p-5">
                  <PaymentMethodSelector
                    selected={paymentMethod}
                    onSelect={(method) => {
                      setPaymentMethod(method);
                      setCardSubStep("payer");
                    }}
                    disabled={processing}
                  />
                </div>

                {/* Payer data section */}
                {paymentMethod && (
                  <div className="card p-5 space-y-4 animate-slide-up">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Dados do pagador
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Nome</label>
                        <input
                          type="text"
                          value={payerFirstName}
                          onChange={(e) => setPayerFirstName(e.target.value)}
                          placeholder="Primeiro nome"
                          className="input"
                          disabled={processing}
                        />
                      </div>
                      <div>
                        <label className="label">Sobrenome</label>
                        <input
                          type="text"
                          value={payerLastName}
                          onChange={(e) => setPayerLastName(e.target.value)}
                          placeholder="Sobrenome"
                          className="input"
                          disabled={processing}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Email</label>
                        <input
                          type="email"
                          value={payerEmail}
                          onChange={(e) => setPayerEmail(e.target.value)}
                          placeholder="seu@email.com"
                          className="input"
                          disabled={processing}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">CPF</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={payerCPF}
                          onChange={(e) => setPayerCPF(formatCPF(e.target.value))}
                          placeholder="000.000.000-00"
                          className="input font-mono"
                          disabled={processing}
                        />
                      </div>
                    </div>

                    {/* Address section for card payments */}
                    {paymentMethod === "credit_card" && (
                      <div className="animate-fadeIn space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Endereco de cobranca
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <label className="label">Rua</label>
                            <input
                              type="text"
                              value={addressStreet}
                              onChange={(e) => setAddressStreet(e.target.value)}
                              placeholder="Nome da rua"
                              className="input"
                              disabled={processing}
                            />
                          </div>
                          <div>
                            <label className="label">Numero</label>
                            <input
                              type="text"
                              value={addressNumber}
                              onChange={(e) => setAddressNumber(e.target.value)}
                              placeholder="123"
                              className="input"
                              disabled={processing}
                            />
                          </div>
                          <div>
                            <label className="label">Complemento</label>
                            <input
                              type="text"
                              value={addressComplement}
                              onChange={(e) => setAddressComplement(e.target.value)}
                              placeholder="Apto, bloco..."
                              className="input"
                              disabled={processing}
                            />
                          </div>
                          <div>
                            <label className="label">Bairro</label>
                            <input
                              type="text"
                              value={addressNeighborhood}
                              onChange={(e) => setAddressNeighborhood(e.target.value)}
                              placeholder="Bairro"
                              className="input"
                              disabled={processing}
                            />
                          </div>
                          <div>
                            <label className="label">Cidade</label>
                            <input
                              type="text"
                              value={addressCity}
                              onChange={(e) => setAddressCity(e.target.value)}
                              placeholder="Cidade"
                              className="input"
                              disabled={processing}
                            />
                          </div>
                          <div>
                            <label className="label">Estado</label>
                            <input
                              type="text"
                              value={addressState}
                              onChange={(e) => setAddressState(e.target.value)}
                              placeholder="UF"
                              className="input"
                              maxLength={2}
                              disabled={processing}
                            />
                          </div>
                          <div>
                            <label className="label">CEP</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={addressZipCode}
                              onChange={(e) => setAddressZipCode(e.target.value)}
                              placeholder="00000-000"
                              className="input font-mono"
                              disabled={processing}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== CARD FLOW ===== */}
                {paymentMethod === "credit_card" && (
                  <>
                    {cardSubStep === "payer" && (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={handleCardPayerContinue}
                          disabled={processing}
                          className="btn btn-primary py-3 flex-1"
                        >
                          Continuar para dados do cartao
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(true)}
                          disabled={cancelling}
                          className="btn border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-3"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar pedido
                        </button>
                      </div>
                    )}

                    {cardSubStep === "card" && (
                      <div className="card p-5 animate-slideInFromRight">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Dados do cartao
                          </h3>
                          <button
                            onClick={() => setCardSubStep("payer")}
                            className="text-sm text-primary-600 dark:text-primary-400 hover:underline animate-slideInFromLeft"
                          >
                            ← Voltar aos dados pessoais
                          </button>
                        </div>
                        <CardForm
                          onSubmit={handleCardSubmit}
                          amount={order.price}
                          loading={processing}
                          disabled={processing}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* ===== PIX FLOW ===== */}
                {paymentMethod === "pix" && (
                  <div className="card p-5">
                    <div className="text-center space-y-4">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl inline-flex">
                        <ShieldCheck className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          Pagamento PIX instantaneo
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          Ao clicar em "Gerar PIX", sera exibido um QR Code para pagamento.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={handlePixOrBoleto}
                          disabled={processing}
                          className="btn btn-primary flex-1 py-3 text-base font-semibold"
                        >
                          {processing ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Gerando PIX...
                            </span>
                          ) : (
                            `Gerar PIX — R$ ${order.price.toFixed(2)}`
                          )}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(true)}
                          disabled={cancelling}
                          className="btn border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-3"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar pedido
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== BOLETO FLOW ===== */}
                {paymentMethod === "boleto" && (
                  <div className="card p-5">
                    <div className="text-center space-y-4">
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl inline-flex">
                        <ShieldCheck className="w-8 h-8 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          Boleto bancario
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          O boleto sera gerado e o pagamento confirmado em ate 2 dias uteis.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={handlePixOrBoleto}
                          disabled={processing}
                          className="btn btn-primary flex-1 py-3 text-base font-semibold"
                        >
                          {processing ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Gerando boleto...
                            </span>
                          ) : (
                            `Gerar boleto — R$ ${order.price.toFixed(2)}`
                          )}
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(true)}
                          disabled={cancelling}
                          className="btn border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 py-3"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar pedido
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error display */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <CheckoutSummary order={order} />
          </div>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelOrder}
        title="Cancelar pedido"
        message="Tem certeza que deseja cancelar este pedido? Esta acao nao pode ser desfeita."
        confirmLabel="Cancelar pedido"
        variant="danger"
        loading={cancelling}
      />
    </div>
  );
}
