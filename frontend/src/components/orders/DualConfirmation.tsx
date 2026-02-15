import { CheckCircle, Clock, UserCheck, Wrench } from "lucide-react";
import clsx from "clsx";

interface Props {
  professionalConfirmedAt?: string | null;
  clientConfirmedAt?: string | null;
  professionalName?: string;
  clientName?: string;
  isClient: boolean;
  onConfirm?: () => void;
  loading?: boolean;
}

export default function DualConfirmation({
  professionalConfirmedAt,
  clientConfirmedAt,
  professionalName = "Profissional",
  clientName = "Cliente",
  isClient,
  onConfirm,
  loading,
}: Props) {
  const professionalDone = !!professionalConfirmedAt;
  const clientDone = !!clientConfirmedAt;
  const bothDone = professionalDone && clientDone;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        Confirmação de conclusão
      </h3>

      {/* Progress bar */}
      <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={clsx(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
            bothDone
              ? "w-full bg-emerald-500"
              : professionalDone || clientDone
                ? "w-1/2 bg-primary-500"
                : "w-0"
          )}
        />
      </div>

      {/* Confirmation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Professional */}
        <div
          className={clsx(
            "flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-300",
            professionalDone
              ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10"
              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30"
          )}
        >
          <div
            className={clsx(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              professionalDone
                ? "bg-emerald-100 dark:bg-emerald-900/30"
                : "bg-slate-100 dark:bg-slate-800"
            )}
          >
            {professionalDone ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <Wrench className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            )}
          </div>
          <div className="min-w-0">
            <p
              className={clsx(
                "text-sm font-semibold truncate",
                professionalDone
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-600 dark:text-slate-400"
              )}
            >
              {professionalName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {professionalDone
                ? `Confirmou em ${formatDate(professionalConfirmedAt!)}`
                : "Aguardando confirmação"}
            </p>
          </div>
        </div>

        {/* Client */}
        <div
          className={clsx(
            "flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-300",
            clientDone
              ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10"
              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/30"
          )}
        >
          <div
            className={clsx(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              clientDone
                ? "bg-emerald-100 dark:bg-emerald-900/30"
                : "bg-slate-100 dark:bg-slate-800"
            )}
          >
            {clientDone ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <UserCheck className="w-5 h-5 text-slate-400 dark:text-slate-500" />
            )}
          </div>
          <div className="min-w-0">
            <p
              className={clsx(
                "text-sm font-semibold truncate",
                clientDone
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-600 dark:text-slate-400"
              )}
            >
              {clientName}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {clientDone
                ? `Confirmou em ${formatDate(clientConfirmedAt!)}`
                : "Aguardando confirmação"}
            </p>
          </div>
        </div>
      </div>

      {/* Status message and action */}
      {bothDone ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            Ambas as partes confirmaram! O pagamento foi liberado.
          </p>
        </div>
      ) : professionalDone && !clientDone && isClient ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              O profissional confirmou a conclusão. Verifique se o serviço foi realizado corretamente e confirme.
            </p>
          </div>
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={loading}
              className="btn btn-primary w-full py-2.5 font-semibold"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Confirmando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Confirmar conclusão e liberar pagamento
                </span>
              )}
            </button>
          )}
        </div>
      ) : professionalDone && !clientDone && !isClient ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30">
          <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Você confirmou a conclusão. Aguardando o cliente confirmar para liberar o pagamento.
          </p>
        </div>
      ) : null}
    </div>
  );
}
