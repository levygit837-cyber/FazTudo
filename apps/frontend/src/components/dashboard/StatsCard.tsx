import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { SparklineChart } from "./SparklineChart";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: "primary" | "green" | "blue" | "yellow" | "red" | "gray";
  highlight?: boolean;
  sparklineData?: number[];
  className?: string;
}

const colorConfig = {
  primary: {
    bg: "bg-primary-100 dark:bg-primary-900/30",
    icon: "text-primary-600",
    sparkColor: "#3b82f6",
    highlightBorder: "border-primary-200 dark:border-primary-800/50",
    highlightGlow: "shadow-glow-blue",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900/30",
    icon: "text-green-600",
    sparkColor: "#22c55e",
    highlightBorder: "border-green-200 dark:border-green-800/50",
    highlightGlow: "shadow-glow-green",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    icon: "text-blue-600",
    sparkColor: "#3b82f6",
    highlightBorder: "border-blue-200 dark:border-blue-800/50",
    highlightGlow: "shadow-glow-blue",
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    icon: "text-yellow-600",
    sparkColor: "#f59e0b",
    highlightBorder: "border-yellow-200 dark:border-yellow-800/50",
    highlightGlow: "shadow-glow-amber",
  },
  red: {
    bg: "bg-red-100 dark:bg-red-900/30",
    icon: "text-red-600",
    sparkColor: "#ef4444",
    highlightBorder: "border-red-200 dark:border-red-800/50",
    highlightGlow: "",
  },
  gray: {
    bg: "bg-slate-100 dark:bg-slate-800",
    icon: "text-slate-600 dark:text-slate-400",
    sparkColor: "#94a3b8",
    highlightBorder: "border-slate-300 dark:border-slate-700",
    highlightGlow: "",
  },
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "primary",
  highlight = false,
  sparklineData,
  className = "",
}) => {
  const colors = colorConfig[color];

  return (
    <div
      className={`
        card relative overflow-hidden
        ${highlight
          ? `${colors.highlightBorder} border-2 min-h-[140px] dark:${colors.highlightGlow}`
          : "min-h-[120px]"
        }
        ${className}
      `}
    >
      {/* Subtle radial highlight for featured cards */}
      {highlight && (
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            background: `radial-gradient(circle at 85% 15%, ${colors.sparkColor} 0%, transparent 60%)`,
          }}
        />
      )}

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>
          <p
            className={`
              font-display font-bold text-slate-900 dark:text-slate-100 mt-2 truncate
              ${highlight ? "text-3xl" : "text-2xl"}
            `}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
              {subtitle}
            </p>
          )}
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-sm ${
                trend.isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="truncate">{trend.value}% vs mes anterior</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {icon && (
            <div
              className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}
            >
              <div className={colors.icon}>{icon}</div>
            </div>
          )}
        </div>
      </div>

      {/* Sparkline at bottom */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-3 -mb-1 -mx-1">
          <SparklineChart
            data={sparklineData}
            width={280}
            height={32}
            color={colors.sparkColor}
            fillOpacity={0.08}
            showDot={false}
          />
        </div>
      )}
    </div>
  );
};

export default StatsCard;
