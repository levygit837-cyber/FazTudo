import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SparklineChart } from "./SparklineChart";

export interface MoneyCardProps {
  label: string;
  value: string;
  sublabel?: string;
  subvalue?: string;
  icon?: React.ReactNode;
  variant?: "emerald" | "teal" | "blue";
  action?: { label: string; to: string };
  sparklineData?: number[];
  className?: string;
}

const variantConfig = {
  emerald: {
    gradient: "from-emerald-500 to-emerald-600",
    hoverGradient: "hover:from-emerald-600 hover:to-emerald-700",
    sparkColor: "#d1fae5",
    accentBg: "bg-emerald-400/20",
  },
  teal: {
    gradient: "from-teal-500 to-cyan-600",
    hoverGradient: "hover:from-teal-600 hover:to-cyan-700",
    sparkColor: "#ccfbf1",
    accentBg: "bg-teal-400/20",
  },
  blue: {
    gradient: "from-blue-500 to-indigo-600",
    hoverGradient: "hover:from-blue-600 hover:to-indigo-700",
    sparkColor: "#dbeafe",
    accentBg: "bg-blue-400/20",
  },
};

export const MoneyCard: React.FC<MoneyCardProps> = ({
  label,
  value,
  sublabel,
  subvalue,
  icon,
  variant = "emerald",
  action,
  sparklineData,
  className = "",
}) => {
  const config = variantConfig[variant];

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient}
        text-white p-6 transition-all duration-300
        ${className}
      `}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 money-shimmer pointer-events-none" />

      {/* Decorative circle */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full ${config.accentBg}`} />
      <div className={`absolute -bottom-4 -right-4 w-16 h-16 rounded-full ${config.accentBg}`} />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon && <div className="opacity-80">{icon}</div>}
            <p className="text-sm font-medium text-white/80">{label}</p>
          </div>
        </div>

        <p className="font-mono text-3xl font-bold tracking-tight mb-1">{value}</p>

        {(sublabel || subvalue) && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            {sublabel && <span>{sublabel}</span>}
            {subvalue && <span className="font-mono font-medium text-white/90">{subvalue}</span>}
          </div>
        )}

        {action && (
          <Link
            to={action.to}
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-white/90 hover:text-white transition-colors group"
          >
            {action.label}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {/* Sparkline decoration */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="absolute bottom-2 right-3 opacity-20">
          <SparklineChart
            data={sparklineData}
            width={100}
            height={40}
            color="#ffffff"
            fillOpacity={0.15}
            showDot={false}
          />
        </div>
      )}
    </div>
  );
};

export default MoneyCard;
