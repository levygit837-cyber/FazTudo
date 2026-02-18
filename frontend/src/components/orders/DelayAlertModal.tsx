import React, { useState } from "react";
import {
  Clock,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DelayAlertModalProps {
  orderId: number;
  orderTitle: string;
  professionalName: string;
  onRespond: (
    orderId: number,
    arrived: boolean,
    action?: "message" | "dispute",
  ) => Promise<void>;
  onClose: () => void;
}

type Step = "question" | "options";

const DelayAlertModal: React.FC<DelayAlertModalProps> = ({
  orderId,
  orderTitle,
  professionalName,
  onRespond,
  onClose,
}) => {
  const [step, setStep] = useState<Step>("question");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleArrived = async () => {
    setLoading(true);
    try {
      await onRespond(orderId, true);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleNotArrived = () => {
    setStep("options");
  };

  const handleMessage = async () => {
    setLoading(true);
    try {
      await onRespond(orderId, false, "message");
      onClose();
      // Navigate to chat
      navigate(`/client/orders/${orderId}/chat`);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    setLoading(true);
    try {
      await onRespond(orderId, false, "dispute");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {step === "question" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Clock size={32} className="text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Ei! Tudo bem por ai?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              O horario agendado para{" "}
              <strong>"{orderTitle}"</strong> ja passou e ainda
              nao temos confirmacao de que{" "}
              <strong>{professionalName}</strong> esta a caminho. O
              profissional ja chegou?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleArrived}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle size={18} />
                )}
                Sim, ja chegou
              </button>
              <button
                onClick={handleNotArrived}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-100 py-3 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 disabled:opacity-50"
              >
                <X size={18} />
                Nao
              </button>
            </div>
          </div>
        )}

        {step === "options" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <AlertTriangle size={32} className="text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Que pena!
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Vamos notificar{" "}
              <strong>{professionalName}</strong> para entender o que
              aconteceu. O que voce gostaria de fazer?
            </p>
            <div className="space-y-3">
              <button
                onClick={handleMessage}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <MessageCircle size={18} />
                )}
                Enviar mensagem e aguardar
              </button>
              <button
                onClick={handleDispute}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <AlertTriangle size={18} />
                )}
                Abrir disputa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DelayAlertModal;
