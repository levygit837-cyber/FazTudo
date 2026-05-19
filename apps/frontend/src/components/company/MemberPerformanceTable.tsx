import React from "react";
import { MemberPerformance } from "../../types";
import { Star } from "lucide-react";
import { formatRating } from "../../utils/formatters";

interface Props { members: MemberPerformance[]; }

const MemberPerformanceTable: React.FC<Props> = ({ members }) => {
  if (members.length === 0) {
    return <p className="text-slate-500 text-sm">Nenhum membro com serviços ainda.</p>;
  }

  return (
    <div className="space-y-3">
      {members.map(m => (
        <div key={m.member.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0"
              style={{ backgroundColor: m.member.role.color ?? "#6366f1" }}
            >
              {m.member.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{m.member.name}</p>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                  style={{ backgroundColor: m.member.role.color ?? "#6366f1" }}
                >
                  {m.member.role.name}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-0.5 text-xs text-amber-500">
                  <Star className="h-3 w-3 fill-current" />
                  {formatRating(m.member.ratingAverage)}
                </span>
                <span className="text-xs text-slate-500">{m.stats.totalAssigned} designações</span>
                {m.stats.ledTotal > 0 && (
                  <span className="text-xs text-blue-500">{m.stats.ledTotal} como líder</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{m.stats.completionRate}%</p>
              <p className="text-xs text-slate-400">{m.stats.completed}/{m.stats.totalAssigned}</p>
            </div>
          </div>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${m.stats.completionRate}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default MemberPerformanceTable;
