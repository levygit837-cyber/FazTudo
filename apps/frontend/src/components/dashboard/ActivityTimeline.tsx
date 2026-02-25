import React from "react";
import {
  ShoppingBag,
  DollarSign,
  Star,
  MessageSquare,
  Settings,
} from "lucide-react";

export interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  time: string;
  type: "order" | "payment" | "review" | "message" | "system";
  status?: "success" | "warning" | "info" | "error";
}

export interface ActivityTimelineProps {
  items: ActivityItem[];
  maxItems?: number;
  className?: string;
}

const typeConfig = {
  order: {
    color: "text-blue-500",
    bg: "bg-blue-500",
    icon: <ShoppingBag className="w-3.5 h-3.5" />,
  },
  payment: {
    color: "text-emerald-500",
    bg: "bg-emerald-500",
    icon: <DollarSign className="w-3.5 h-3.5" />,
  },
  review: {
    color: "text-amber-500",
    bg: "bg-amber-500",
    icon: <Star className="w-3.5 h-3.5" />,
  },
  message: {
    color: "text-violet-500",
    bg: "bg-violet-500",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
  },
  system: {
    color: "text-slate-400",
    bg: "bg-slate-400",
    icon: <Settings className="w-3.5 h-3.5" />,
  },
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  items,
  maxItems = 5,
  className = "",
}) => {
  const visibleItems = items.slice(0, maxItems);

  if (visibleItems.length === 0) {
    return (
      <div className={`text-center py-6 ${className}`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma atividade recente
        </p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {visibleItems.map((item, index) => {
        const config = typeConfig[item.type];
        const isFirst = index === 0;
        const isLast = index === visibleItems.length - 1;

        return (
          <div
            key={item.id}
            className="relative flex gap-3 pb-4 last:pb-0"
            style={{
              animation: `staggerFadeIn 250ms ease-out both`,
              animationDelay: `${index * 80}ms`,
            }}
          >
            {/* Vertical line */}
            {!isLast && (
              <div
                className="absolute left-[11px] top-7 bottom-0 w-px bg-slate-200 dark:bg-slate-700"
                aria-hidden="true"
              />
            )}

            {/* Dot */}
            <div className="relative flex-shrink-0 mt-0.5">
              <div
                className={`
                  w-[22px] h-[22px] rounded-full flex items-center justify-center
                  ${config.bg} text-white
                  ${isFirst ? "timeline-dot-pulse" : ""}
                `}
              >
                {config.icon}
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {item.title}
                </p>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 whitespace-nowrap">
                  {item.time}
                </span>
              </div>
              {item.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActivityTimeline;
