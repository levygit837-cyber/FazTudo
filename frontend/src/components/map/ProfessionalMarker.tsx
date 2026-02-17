// frontend/src/components/map/ProfessionalMarker.tsx
import React from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { Wrench } from "lucide-react";
import type { LatLng } from "../../types";

interface ProfessionalMarkerProps {
  position: LatLng;
  label: string;
  subtitle?: string;
  onClick?: () => void;
}

/**
 * Custom marker for the professional on the interactive map.
 * Uses FazTudo primary-600 (blue) color scheme with pulsing animation.
 */
const ProfessionalMarker: React.FC<ProfessionalMarkerProps> = ({
  position,
  label,
  subtitle,
  onClick,
}) => {
  return (
    <AdvancedMarker position={position} title={label} onClick={onClick}>
      <div className="flex flex-col items-center group cursor-pointer">
        {/* Label tooltip (above marker) */}
        <div className="bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 shadow-lg border border-slate-200 dark:border-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {label}
          </p>
          {subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        {/* Pulsing glow ring */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary-500/30 animate-ping" />
          <div className="absolute -inset-1 rounded-full bg-primary-500/20 animate-pulse" />

          {/* Marker body */}
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 border-[3px] border-white dark:border-slate-900 shadow-lg flex items-center justify-center z-10">
            <Wrench className="w-4.5 h-4.5 text-white" />
          </div>
        </div>

        {/* Pointer arrow */}
        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary-600 -mt-[2px] z-10" />
      </div>
    </AdvancedMarker>
  );
};

export default ProfessionalMarker;
