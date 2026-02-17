// frontend/src/components/map/DestinationMarker.tsx
import React from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { Home } from "lucide-react";
import type { LatLng } from "../../types";

interface DestinationMarkerProps {
  position: LatLng;
  label: string;
  subtitle?: string;
  onClick?: () => void;
}

/**
 * Custom marker for the service destination (client's address).
 * Uses FazTudo error/red-500 color scheme with a house icon.
 */
const DestinationMarker: React.FC<DestinationMarkerProps> = ({
  position,
  label,
  subtitle,
  onClick,
}) => {
  return (
    <AdvancedMarker position={position} title={label} onClick={onClick}>
      <div className="flex flex-col items-center group cursor-pointer">
        {/* Label tooltip */}
        <div className="bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 shadow-lg border border-slate-200 dark:border-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap max-w-[200px]">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
            {label}
          </p>
          {subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          )}
        </div>

        {/* Flag pin design */}
        <div className="relative">
          {/* Outer glow */}
          <div className="absolute -inset-1 rounded-full bg-red-500/20 animate-pulse" />

          {/* Pin body */}
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 border-[3px] border-white dark:border-slate-900 shadow-lg flex items-center justify-center z-10">
            <Home className="w-4.5 h-4.5 text-white" />
          </div>
        </div>

        {/* Pointer arrow */}
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 -mt-[2px] z-10" />

        {/* Ground shadow */}
        <div className="w-4 h-1 bg-slate-900/20 dark:bg-slate-100/10 rounded-full mt-0.5 blur-[1px]" />
      </div>
    </AdvancedMarker>
  );
};

export default DestinationMarker;
