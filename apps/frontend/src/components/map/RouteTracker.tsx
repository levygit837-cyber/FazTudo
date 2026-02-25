// frontend/src/components/map/RouteTracker.tsx
import React from "react";
import {
  Navigation,
  Clock,
  Route,
  X,
} from "lucide-react";
import type { RouteTrackerProps } from "../../types";

/**
 * Floating overlay that displays route information (distance, duration)
 * and controls for starting/stopping live tracking.
 */
const RouteTracker: React.FC<RouteTrackerProps> = ({
  routeInfo,
  isTracking,
  onStartTracking,
  onStopTracking,
  isProfessional,
}) => {
  return (
    <div className="space-y-3">
      {/* Route info bar */}
      {routeInfo && (
        <div className="flex items-center justify-between bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl p-3 shadow-md border border-slate-200 dark:border-slate-700 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Route className="w-4 h-4 text-primary-500" />
              {routeInfo.distance}
            </div>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Clock className="w-4 h-4 text-amber-500" />
              {routeInfo.duration}
            </div>
          </div>

          {isProfessional && isTracking && onStopTracking && (
            <button
              onClick={onStopTracking}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="w-3.5 h-3.5" />
              Parar
            </button>
          )}
        </div>
      )}

      {/* Start tracking button (professional only) */}
      {isProfessional && !isTracking && onStartTracking && (
        <button
          onClick={onStartTracking}
          className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
        >
          <Navigation className="w-5 h-5" />
          Iniciar Trajeto
        </button>
      )}

      {/* Waiting message (client) */}
      {!isProfessional && !routeInfo && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-sm text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
          <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
          Aguardando o profissional iniciar o trajeto...
        </div>
      )}

      {/* Professional is on the way (client) */}
      {!isProfessional && routeInfo && (
        <div className="flex items-center gap-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-sm text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800/30 animate-fade-in">
          <Navigation className="w-4 h-4 flex-shrink-0" />
          <span>
            Profissional a caminho!{" "}
            <span className="font-semibold">
              {routeInfo.duration} ({routeInfo.distance})
            </span>
          </span>
        </div>
      )}
    </div>
  );
};

export default RouteTracker;
