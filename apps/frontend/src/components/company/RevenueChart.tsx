import React, { useState } from "react";
import { RevenueDataPoint } from "../../types";
import { formatCurrency } from "../../utils/formatters";

interface Props { data: RevenueDataPoint[]; }

const MONTH_NAMES: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

const RevenueChart: React.FC<Props> = ({ data }) => {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-8">Sem dados de receita ainda.</p>;
  }

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="relative">
      <div className="flex items-end gap-2 h-40">
        {data.map((d, i) => {
          const height = Math.max((d.revenue / maxRevenue) * 128, 4);
          const month = d.month.slice(5);
          return (
            <div
              key={d.month}
              className="flex-1 flex flex-col items-center gap-1 cursor-pointer group relative"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {formatCurrency(d.revenue)}
                </div>
              )}
              <div
                className={`w-full rounded-t transition-colors ${hovered === i ? "bg-blue-600" : "bg-blue-400 dark:bg-blue-500"}`}
                style={{ height: `${height}px` }}
              />
              <span className="text-xs text-slate-400">{MONTH_NAMES[month] ?? month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RevenueChart;
