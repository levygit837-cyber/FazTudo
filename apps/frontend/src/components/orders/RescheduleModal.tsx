import React, { useState } from "react";
import { X, Calendar, Loader2 } from "lucide-react";
import AvailabilityCalendar from "./AvailabilityCalendar";
import { rescheduleOrder } from "../../services/serviceService";
import { useToast } from "../../context/ToastContext";

const RESCHEDULE_REASONS = [
  "Compromisso pessoal",
  "Condições climáticas",
  "Indisponibilidade do profissional",
  "Solicitação do cliente",
  "Outro",
];

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  professionalId: number;
  onRescheduled?: () => void;
}

const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  orderId,
  professionalId,
  onRescheduled,
}) => {
  const toast = useToast();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSlotSelect = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
  };

  const handleSubmit = async () => {
    if (!selectedDate) {
      toast.error("Erro", "Selecione uma data");
      return;
    }

    const finalReason = reason === "Outro" ? customReason : reason;

    try {
      setSubmitting(true);
      const newDate = selectedTime
        ? `${selectedDate}T${selectedTime}:00`
        : `${selectedDate}T09:00:00`;
      await rescheduleOrder(orderId, { newDate, reason: finalReason || undefined });
      toast.success("Pedido reagendado com sucesso!");
      onRescheduled?.();
      onClose();
    } catch (err: any) {
      toast.error("Erro", err?.response?.data?.message || "Erro ao reagendar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reagendar Pedido</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Reason */}
          <div>
            <label className="label">Motivo</label>
            <div className="flex flex-wrap gap-2">
              {RESCHEDULE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    reason === r
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === "Outro" && (
              <textarea
                className="input mt-2 min-h-16"
                placeholder="Descreva o motivo..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          {/* Calendar */}
          <AvailabilityCalendar
            professionalId={professionalId}
            onSlotSelect={handleSlotSelect}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button onClick={onClose} className="btn btn-outline flex-1">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!selectedDate || submitting}
            className="btn btn-primary flex-1"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reagendando...</>
            ) : (
              "Confirmar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
