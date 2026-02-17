// frontend/src/components/map/LandmarkMarker.tsx
import React from "react";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { MapPin, Flag, AlertTriangle, Construction } from "lucide-react";
import type { LatLng } from "../../types";

type LandmarkType = "street" | "reference" | "warning" | "construction";

interface LandmarkMarkerProps {
  position: LatLng;
  label: string;
  type?: LandmarkType;
  onClick?: () => void;
}

const LANDMARK_CONFIG: Record<
  LandmarkType,
  { icon: React.ElementType; bgClass: string; arrowClass: string }
> = {
  street: {
    icon: MapPin,
    bgClass: "bg-gradient-to-br from-amber-400 to-amber-600",
    arrowClass: "border-t-amber-500",
  },
  reference: {
    icon: Flag,
    bgClass: "bg-gradient-to-br from-purple-400 to-purple-600",
    arrowClass: "border-t-purple-500",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-gradient-to-br from-orange-400 to-orange-600",
    arrowClass: "border-t-orange-500",
  },
  construction: {
    icon: Construction,
    bgClass: "bg-gradient-to-br from-slate-400 to-slate-600",
    arrowClass: "border-t-slate-500",
  },
};

/**
 * Marker for street signals, reference points, warnings, etc.
 * Uses amber/warning color by default. Compatible with Google Maps API components.
 */
const LandmarkMarker: React.FC<LandmarkMarkerProps> = ({
  position,
  label,
  type = "street",
  onClick,
}) => {
  const config = LANDMARK_CONFIG[type];
  const Icon = config.icon;

  return (
    <AdvancedMarker position={position} title={label} onClick={onClick}>
      <div className="flex flex-col items-center group cursor-pointer">
        {/* Tooltip */}
        <div className="bg-white dark:bg-slate-800 rounded-md px-2 py-1 shadow-md border border-slate-200 dark:border-slate-700 mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          <p className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
            {label}
          </p>
        </div>

        {/* Small marker */}
        <div
          className={`relative w-7 h-7 rounded-full ${config.bgClass} border-2 border-white dark:border-slate-900 shadow-md flex items-center justify-center z-10`}
        >
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>

        {/* Arrow */}
        <div
          className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] ${config.arrowClass} -mt-[1px] z-10`}
        />
      </div>
    </AdvancedMarker>
  );
};

export default LandmarkMarker;
