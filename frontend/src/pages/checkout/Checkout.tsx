import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useMercadoPago } from "../../hooks/useMercadoPago";
import { getOrderById, createPayment } from "../../services/serviceService";
import type { ServiceOrder, TransparentCheckoutResponse } from "../../types";
import PaymentMethodSelector from "../../components/checkout/PaymentMethodSelector";
import CheckoutSummary from "../../components/checkout/CheckoutSummary";
import CardForm from "../../components/checkout/CardForm";
import PixPayment from "../../components/checkout/PixPayment";
import BoletoPayment from "../../components/checkout/BoletoPayment";
import PaymentStatusBanner from "../../components/checkout/PaymentStatusBanner";

type PaymentMethod = "credit_card" | "pix" | "boleto";

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { mpInstance, loading: mpLoading, error: mpError, createCardToken } = useMercadoPago();

  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<TransparentCheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Payer data
  const [payerEmail, setPayerEmail] = useState(user?.email || "");
  const [payerName, setPayerName] = useState(user?.name || "");
  const [payerCPF, setPayerCPF] = useState(user?.document || "");

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
        toast.warning("Atenção", "Este pedido já possui um pagamento ativo.");
        navigate(`/client/orders/${id}`);
        return;
      }

      // Check if order can be paid
      if (data.status !== "PENDING" && data.status !== "ACCEPTED") {
        toast.error("Erro", "Este pedido não pode receber pagamento no momento.");
        navigate(`/client/orders/${id}`);
      }
    } catch (err: any) {
      setError("Erro ao carregar pedido");
      toast.error("Erro", "Não foi possível carregar os dados do pedido.");
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length > 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    if (digits.length > 6) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    if (digits.length > 3) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    return digits;
  };

  const validatePayerData = (): boolean => {
    if (!payerEmail || !payerEmail.includes("@")) {
      toast.error("Dados incompletos", "Informe um email válido.");
      return false;
    }
    if (!payerName || payerName.trim().length < 2) {
      toast.error("Dados incompletos", "Informe seu nome completo.");
      return false;
    }
    const cpfDigits = payerCPF.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      toast.error("Dados incompletos", "Informe um CPF válido (11 dígitos).");
      return false;
    }
    return true;
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
      // Create card token with MP SDK
      let token = "";
      let paymentMethodId = "visa"; // default

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
          // Try to detect card brand
          const firstDigit = cardData.cardNumber.charAt(0);
          if (firstDigit === "4") paymentMethodId = "visa";
          else if (firstDigit === "5") paymentMethodId = "master";
          else if (firstDigit === "3") paymentMethodId = "amex";
        } catch (tokenError: any) {
          // In dev/sandbox, use fallback token
          console.warn("Card token creation failed, using fallback:", tokenError);
          token = `dev-token-${Date.now()}`;
        }
      } else {
        token = `dev-token-${Date.now()}`;
      }

      const result = await createPayment(order.id, {
        paymentMethod: "credit_card",
        payerEmail,
        payerName,
        payerCPF: payerCPF.replace(/\D/g, ""),
        token,
        paymentMethodId,
        installments: cardData.installments,
      });

      setPaymentResult(result);

      if (result.paymentData.status === "approved") {
        toast.success("Pagamento aprovado!", "O profissional será notificado.");
      } else if (result.paymentData.status === "pending" || result.paymentData.status === "in_process") {
        toast.info("Processando", "Seu pagamento está sendo processado.");
      } else {
        toast.error("Pagamento recusado", result.paymentData.statusDetail || "Tente outro método.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao processar pagamento.";
      setError(msg);
      toast.error("Erro no pagamento", msg);
    } finally {
      setProcessing(false);
    }
  };

  const handlePixOrBoleto = async () => {
    if (!order || !paymentMethod || !validatePayerData()) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await createPayment(order.id, {
        paymentMethod,
        payerEmail,
        payerName,
        payerCPF: payerCPF.replace(/\D/g, ""),
      });

      setPaymentResult(result);

      if (paymentMethod === "pix") {
        toast.success("PIX gerado!", "Escaneie o QR Code ou copie o código.");
      } else {
        toast.success("Boleto gerado!", "Pague até a data de vencimento.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao gerar pagamento.";
      setError(msg);
      toast.error("Erro", msg);
    } finally {
      setProcessing(false);
    }
  };

  // Loading state
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
        <p className="text-slate-500">Pedido não encontrado.</p>
        <button onClick={() => navigate(-1)} className="btn btn-outline mt-4">
          Voltar
        </button>
      </div>
    );
  }

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

      {/* MP Loading indicator */}
      {mpLoading && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
          <Loader2 className="w-4 h-4 animate-spin" />
          Inicializando MercadoPago...
        </div>
      )}

      {mpError && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 text-sm text-amber-700 dark:text-amber-300">
          ⚠️ {mpError} — O checkout funcionará em modo de desenvolvimento.
        </div>
      )}

      {/* Payment result */}
      {paymentResult && (
        <div className="mb-6">
          <PaymentStatusBanner
            status={paymentResult.paymentData.status}
            statusDetail={paymentResult.paymentData.statusDetail}
            orderId={order.id}
          />

          {/* Show PIX/Boleto details after creation */}
          {paymentResult.paymentData.paymentType === "pix" && paymentResult.paymentData.status !== "approved" && (
            <div className="mt-4 card">
              <PixPayment
                qrCode={paymentResult.paymentData.qrCode || ""}
                qrCodeBase64={paymentResult.paymentData.qrCodeBase64 || ""}
                expirationDate={paymentResult.paymentData.expirationDate || ""}
                status={paymentResult.paymentData.status}
                onCopy={() => toast.success("Copiado!", "Código PIX copiado.")}
              />
            </div>
          )}

          {paymentResult.paymentData.paymentType === "boleto" && paymentResult.paymentData.status !== "approved" && (
            <div className="mt-4 card">
              <BoletoPayment
                boletoUrl={paymentResult.paymentData.boletoUrl || ""}
                barcode={paymentResult.paymentData.barcode || ""}
                expirationDate={paymentResult.paymentData.expirationDate || ""}
                status={paymentResult.paymentData.status}
              />
            </div>
          )}
        </div>
      )}

      {/* Main content - only show form if no result yet */}
      {!paymentResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment method selector */}
            <div className="card p-5">
              <PaymentMethodSelector
                selected={paymentMethod}
                onSelect={setPaymentMethod}
                disabled={processing}
              />
            </div>

            {/* Payer data */}
            {paymentMethod && (
              <div className="card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Dados do pagador
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div>
                    <label className="label">Nome completo</label>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Nome como no documento"
                      className="input"
                      disabled={processing}
                    />
                  </div>
                  <div>
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
              </div>
            )}

            {/* Payment form based on method */}
            {paymentMethod === "credit_card" && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                  Dados do cartão
                </h3>
                <CardForm
                  onSubmit={handleCardSubmit}
                  amount={order.price}
                  loading={processing}
                  disabled={processing}
                />
              </div>
            )}

            {paymentMethod === "pix" && (
              <div className="card p-5">
                <div className="text-center space-y-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl inline-flex">
                    <ShieldCheck className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      Pagamento PIX instantâneo
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Ao clicar em "Gerar PIX", será exibido um QR Code para pagamento.
                    </p>
                  </div>
                  <button
                    onClick={handlePixOrBoleto}
                    disabled={processing}
                    className="btn btn-primary w-full py-3 text-base font-semibold"
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
                </div>
              </div>
            )}

            {paymentMethod === "boleto" && (
              <div className="card p-5">
                <div className="text-center space-y-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl inline-flex">
                    <ShieldCheck className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      Boleto bancário
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      O boleto será gerado e o pagamento confirmado em até 2 dias úteis.
                    </p>
                  </div>
                  <button
                    onClick={handlePixOrBoleto}
                    disabled={processing}
                    className="btn btn-primary w-full py-3 text-base font-semibold"
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

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <CheckoutSummary order={order} />
          </div>
        </div>
      )}
    </div>
  );
}
