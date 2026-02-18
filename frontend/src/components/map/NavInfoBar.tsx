import React, { useMemo } from "react";
import { Navigation, Clock } from "lucide-react";

interface NavInfoBarProps {
  distance: string;
  duration: string;
  professionalName: string;
  isTracking: boolean;
  isProfessional: boolean;
}

function parseDurationToMinutes(duration: string): number {
  let total = 0;
  const hoursMatch = duration.match(/(\d+)\s*h/i);
  const minsMatch = duration.match(/(\d+)\s*m/i);
  if (hoursMatch) total += parseInt(hoursMatch[1]) * 60;
  if (minsMatch) total += parseInt(minsMatch[1]);
  return total || 0;
}

function formatETA(duration: string): string {
  const minutes = parseDurationToMinutes(duration);
  if (minutes === 0) return duration;
  const eta = new Date(Date.now() + minutes * 60 * 1000);
  return "Chega as " + eta.getHours().toString().padStart(2, "0") + ":" + eta.getMinutes().toString().padStart(2, "0");
}

const NavInfoBar: React.FC<NavInfoBarProps> = ({
  distance,
  duration,
  professionalName,
  isTracking,
  isProfessional,
}) => {
  const eta = useMemo(() => formatETA(duration), [duration]);

  if (!isTracking) return null;

  const glassBg: React.CSSProperties = {
    background: "rgba(10, 15, 25, 0.92)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-sm animate-slide-up">
      <div className="rounded-2xl px-4 py-3 border border-white/10" style={glassBg}>
        {/* Live chip */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
            {isProfessional ? "Navegando" : "Ao vivo"}
          </span>
        </div>

        {/* Professional name (client view only) */}
        {!isProfessional && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/10">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
            >
              {professionalName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-white/90">
              {professionalName} esta a caminho
            </span>
          </div>
        )}

        {/* Route stats */}
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(59,130,246,0.15)" }}
            >
              <Navigation className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Distancia</div>
              <div className="text-base font-bold text-white">{distance}</div>
            </div>
          </div>

          <div className="w-px h-9 bg-white/10" />

          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.15)" }}
            >
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Tempo</div>
              <div className="text-base font-bold text-white">{duration}</div>
            </div>
          </div>
        </div>

        {/* ETA (client view only) */}
        {!isProfessional && (
          <div className="mt-3 pt-3 border-t border-white/10 text-center">
            <span className="text-xs text-white/50">{eta}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavInfoBar;
