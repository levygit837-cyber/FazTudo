import React, { useState } from "react";
import { Calendar, Check, X, Loader2 } from "lucide-react";
import { acceptReschedule, rejectReschedule } from "../../services/serviceService";
import { useToast } from "../../context/ToastContext";
import { formatDateTime } from "../../utils/formatters";

interface Props {
  orderId: number;
  proposedDate: string;
  reason?: string;
  onResolved: () => void;
}

const RescheduleApprovalBanner: React.FC<Props> = ({ orderId, proposedDate, reason, onResolved }) => {
  const toast = useToast();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);

  const handleAccept = async () => {
    try {
      setLoading("accept");
      await acceptReschedule(orderId);
      toast.success("Reagendamento aceito!");
      onResolved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao aceitar reagendamento");
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    try {
      setLoading("reject");
      await rejectReschedule(orderId);
      toast.info("Reagendamento recusado. Horario original mantido.");
      onResolved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao recusar reagendamento");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15 p-4">
      <div className="flex items-start gap-3">
        <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-300">
            Proposta de reagendamento
          </h4>
          <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-0.5">
            O profissional propôs uma nova data: <strong>{formatDateTime(proposedDate)}</strong>
            {reason && <span> — Motivo: {reason}</span>}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAccept}
              disabled={loading !== null}
              className="btn btn-sm bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5"
            >
              {loading === "accept" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Aceitar
            </button>
            <button
              onClick={handleReject}
              disabled={loading !== null}
              className="btn btn-sm btn-outline text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20 flex items-center gap-1.5"
            >
              {loading === "reject" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Recusar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescheduleApprovalBanner;
