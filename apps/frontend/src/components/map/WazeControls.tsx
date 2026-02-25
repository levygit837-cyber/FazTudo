import React from "react";
import { Plus, Minus, Crosshair, AlertTriangle } from "lucide-react";
import type { WazeControlsProps } from "../../types";

const WazeControls: React.FC<WazeControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onCenter,
  onToggleAlerts,
  alertsEnabled,
}) => {
  const btnClass =
    "w-10 h-10 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-md flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-300 dark:hover:border-primary-600 transition-all active:scale-95";

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
      {/* Zoom controls */}
      <button onClick={onZoomIn} className={btnClass} title="Aproximar">
        <Plus className="w-5 h-5" />
      </button>
      <button onClick={onZoomOut} className={btnClass} title="Afastar">
        <Minus className="w-5 h-5" />
      </button>

      {/* Divider */}
      <div className="w-6 mx-auto border-t border-slate-200 dark:border-slate-700" />

      {/* Center on position */}
      <button onClick={onCenter} className={btnClass} title="Centralizar">
        <Crosshair className="w-5 h-5" />
      </button>

      {/* Toggle alerts */}
      <button
        onClick={onToggleAlerts}
        className={`${btnClass} ${alertsEnabled ? "!border-amber-400 !text-amber-500 !bg-amber-50 dark:!bg-amber-900/20" : ""}`}
        title={alertsEnabled ? "Ocultar alertas" : "Mostrar alertas"}
      >
        <AlertTriangle className="w-5 h-5" />
      </button>
    </div>
  );
};

export default WazeControls;
