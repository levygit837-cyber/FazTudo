import React from "react";
import { Navigation, Clock, User } from "lucide-react";
import type { WazeInfoBarProps } from "../../types";

const WazeInfoBar: React.FC<WazeInfoBarProps> = ({
  distance,
  duration,
  professionalName,
  isTracking,
  isProfessional,
}) => {
  if (!isTracking) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] animate-slide-up w-[90%] max-w-sm">
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl px-4 py-3 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
        {/* Professional name (client view) */}
        {!isProfessional && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {professionalName} esta a caminho
            </span>
          </div>
        )}

        {/* Route stats */}
        <div className="flex items-center justify-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-primary-500" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Distancia</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{distance}</div>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Tempo est.</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{duration}</div>
            </div>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isProfessional ? "Navegando" : "Ao vivo"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default WazeInfoBar;
