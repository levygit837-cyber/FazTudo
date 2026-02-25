import React, { useState } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import clsx from "clsx";

interface FixedSwitchCardProps {
  onGoToClients: () => void;
}

const REDIRECT_DELAY_MS = 260;

const FixedSwitchCard: React.FC<FixedSwitchCardProps> = ({ onGoToClients }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  const handleNavigate = () => {
    if (isLeaving) return;
    setIsLeaving(true);
    window.setTimeout(() => {
      onGoToClients();
    }, REDIRECT_DELAY_MS);
  };

  return (
    <aside
      className={clsx(
        "fixed bottom-5 right-5 z-40 w-[min(320px,calc(100vw-2.5rem))] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm transition-all duration-300",
        isLeaving && "card-route-exit pointer-events-none",
      )}
      aria-label="Alternar para landing de clientes"
    >
      <p className="text-sm font-semibold text-slate-900">Não é profissional?</p>
      <p className="mt-1 text-sm text-slate-600">
        Volte para a área de clientes e encontre serviços para contratar.
      </p>
      <button
        className="mt-3 inline-flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        onClick={handleNavigate}
      >
        <span className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Ir para landing de clientes
        </span>
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </aside>
  );
};

export default FixedSwitchCard;
