import React, { useMemo } from "react";

export interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 80,
  strokeWidth = 8,
  color = "#3b82f6",
  trackColor,
  label,
  showValue = true,
  className = "",
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const { radius, circumference, offset } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const o = c * (1 - clampedValue / 100);
    return { radius: r, circumference: c, offset: o };
  }, [size, strokeWidth, clampedValue]);

  const center = size / 2;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackColor ? "" : "stroke-slate-200 dark:stroke-slate-700"}
          stroke={trackColor || undefined}
        />

        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{
            "--ring-target": `${offset}`,
            animation: "ring-fill 1s ease-out 0.3s forwards",
          } as React.CSSProperties}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue && (
          <span
            className="font-mono text-slate-900 dark:text-slate-100 font-bold leading-none"
            style={{ fontSize: size * 0.22 }}
          >
            {Math.round(clampedValue)}%
          </span>
        )}
        {label && (
          <span
            className="text-slate-500 dark:text-slate-400 leading-tight mt-0.5 text-center px-1"
            style={{ fontSize: Math.max(9, size * 0.12) }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProgressRing;
