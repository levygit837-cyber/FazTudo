import React from "react";
import { Plus, Minus, Crosshair, AlertTriangle, Compass } from "lucide-react";

interface NavControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onToggleAlerts: () => void;
  onNorth?: () => void;
  alertsEnabled: boolean;
}

const NavControls: React.FC<NavControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onCenter,
  onToggleAlerts,
  onNorth,
  alertsEnabled,
}) => {
  const glassBg: React.CSSProperties = {
    background: "rgba(10, 15, 25, 0.75)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
  };

  const alertActiveBg: React.CSSProperties = {
    background: "rgba(245,158,11,0.2)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(245,158,11,0.3)",
  };

  const btnClass =
    "w-11 h-11 rounded-xl flex items-center justify-center text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition-all duration-150 active:scale-90";

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
      <button onClick={onZoomIn} className={btnClass} style={glassBg} title="Aproximar">
        <Plus className="w-5 h-5" />
      </button>
      <button onClick={onZoomOut} className={btnClass} style={glassBg} title="Afastar">
        <Minus className="w-5 h-5" />
      </button>

      <div className="w-6 mx-auto h-px bg-white/10" />

      <button onClick={onCenter} className={btnClass} style={glassBg} title="Centralizar posicao">
        <Crosshair className="w-5 h-5" />
      </button>

      {onNorth && (
        <button onClick={onNorth} className={btnClass} style={glassBg} title="Apontar para o Norte">
          <Compass className="w-5 h-5" />
        </button>
      )}

      <div className="w-6 mx-auto h-px bg-white/10" />

      <button
        onClick={onToggleAlerts}
        className={`${btnClass} ${alertsEnabled ? "text-amber-400 hover:text-amber-300" : ""}`}
        style={alertsEnabled ? alertActiveBg : glassBg}
        title={alertsEnabled ? "Ocultar alertas" : "Mostrar alertas"}
      >
        <AlertTriangle className="w-5 h-5" />
      </button>
    </div>
  );
};

export default NavControls;
