// frontend/src/components/map/MapLegend.tsx
import React, { useState } from "react";
import clsx from "clsx";
import { ChevronUp, ChevronDown } from "lucide-react";

interface LegendItem {
  color: string;
  label: string;
}

interface MapLegendProps {
  items?: LegendItem[];
  className?: string;
}

const DEFAULT_LEGEND: LegendItem[] = [
  { color: "bg-primary-600", label: "Profissional" },
  { color: "bg-red-500", label: "Destino do Servico" },
  { color: "bg-amber-500", label: "Sinalizacao" },
  { color: "bg-primary-500", label: "Rota" },
];

/**
 * Floating legend for the interactive map.
 * Collapsible on mobile. Positioned bottom-left by default.
 */
const MapLegend: React.FC<MapLegendProps> = ({
  items = DEFAULT_LEGEND,
  className,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={clsx(
        "bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 dark:border-slate-700 transition-all duration-200",
        className
      )}
    >
      {/* Header (clickable to toggle on mobile) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-1.5 sm:hidden"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Legenda
        </span>
        {collapsed ? (
          <ChevronUp className="w-3 h-3 text-slate-400" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        )}
      </button>

      {/* Legend items */}
      <div
        className={clsx(
          "px-3 py-2 space-y-1.5 transition-all duration-200",
          collapsed ? "hidden sm:block" : "block"
        )}
      >
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            {item.label === "Rota" ? (
              <div className={`w-5 h-[3px] rounded-full ${item.color}`} />
            ) : (
              <span
                className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0`}
              />
            )}
            <span className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;
