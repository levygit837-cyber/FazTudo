import React, { useMemo, useId } from "react";

export interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  showDot?: boolean;
  className?: string;
}

export const SparklineChart: React.FC<SparklineChartProps> = ({
  data,
  width = 120,
  height = 40,
  color = "#3b82f6",
  fillOpacity = 0.1,
  showDot = true,
  className = "",
}) => {
  const gradientId = useId();

  const { path, areaPath, lastPoint, pathLength } = useMemo(() => {
    if (data.length < 2) return { path: "", areaPath: "", lastPoint: null, pathLength: 0 };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 4;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const points = data.map((v, i) => ({
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - ((v - min) / range) * h,
    }));

    // Build smooth curve using cardinal spline
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    const areaD = `${d} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;
    const last = points[points.length - 1];

    // Estimate path length
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }

    return { path: d, areaPath: areaD, lastPoint: last, pathLength: len * 1.2 };
  }, [data, width, height]);

  if (data.length < 2) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path
        d={areaPath}
        fill={`url(#spark-fill-${gradientId})`}
        className="opacity-0 animate-fade-in"
        style={{ animationDelay: "0.6s", animationFillMode: "forwards" }}
      />

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={pathLength}
        style={{
          animation: `draw-in 1.2s ease-out 0.2s forwards`,
        }}
      />

      {/* Last point dot */}
      {showDot && lastPoint && (
        <>
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={3}
            fill={color}
            className="opacity-0 animate-fade-in"
            style={{ animationDelay: "1s", animationFillMode: "forwards" }}
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={3}
            fill={color}
            className="opacity-0"
            style={{
              animationDelay: "1.2s",
              animationFillMode: "forwards",
              animation: "pulse-soft 2s ease-in-out 1.2s infinite, fade-in 0.3s ease-out 1s forwards",
            }}
          >
            <animate
              attributeName="r"
              values="3;6;3"
              dur="2s"
              repeatCount="indefinite"
              begin="1.2s"
            />
            <animate
              attributeName="opacity"
              values="0.6;0;0.6"
              dur="2s"
              repeatCount="indefinite"
              begin="1.2s"
            />
          </circle>
        </>
      )}
    </svg>
  );
};

export default SparklineChart;
