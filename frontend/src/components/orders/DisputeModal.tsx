import React, { useState } from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "../../context/ToastContext";

const DISPUTE_REASONS = [
  "Serviço não entregue",
  "Qualidade insatisfatória",
  "Profissional não compareceu",
  "Outro",
];

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
  onDisputeCreated?: () => void;
}

const DisputeModal: React.FC<DisputeModalProps> = ({
  isOpen,
  onClose,
  orderId,
  onDisputeCreated,
}) => {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Erro", "Selecione um motivo para a disputa");
      return;
    }
    if (!description.trim()) {
      toast.error("Erro", "Descreva o problema encontrado");
      return;
    }

    try {
      setSubmitting(true);

      const { createDispute } = await import("../../services/serviceService");
      await createDispute(orderId, { reason, description: description.trim() });

      toast.success("Disputa aberta com sucesso. Nossa equipe irá analisar.");
      onDisputeCreated?.();
      onClose();
    } catch (err: any) {
      toast.error("Erro", err?.response?.data?.message || "Erro ao abrir disputa");
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
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Abrir Disputa</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Ao abrir uma disputa, nossa equipe irá analisar o caso. Tente resolver diretamente com o profissional antes de abrir uma disputa.
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="label">Motivo da disputa</label>
            <div className="flex flex-wrap gap-2">
              {DISPUTE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    reason === r
                      ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Descreva o problema</label>
            <textarea
              className="input min-h-24"
              placeholder="Explique detalhadamente o que aconteceu..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button onClick={onClose} className="btn btn-outline flex-1">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!reason || !description.trim() || submitting}
            className="btn flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Abrindo...</>
            ) : (
              "Abrir Disputa"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisputeModal;
