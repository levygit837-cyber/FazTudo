import { Zap, Star, Award } from "lucide-react";
import type { CompanyTier } from "../../types";

interface TierBadgeProps {
  tier: CompanyTier;
  size?: "sm" | "md" | "lg";
}

const TIER_CONFIG = {
  EMPRESA: {
    label: "Empresa",
    Icon: Zap,
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  PARCEIRO: {
    label: "Parceiro",
    Icon: Star,
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  ELITE: {
    label: "Elite",
    Icon: Award,
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
} as const;

const SIZE_CONFIG = {
  sm: { padding: "px-2 py-0.5", text: "text-xs", icon: 12 },
  md: { padding: "px-3 py-1", text: "text-sm", icon: 14 },
  lg: { padding: "px-4 py-1.5", text: "text-base", icon: 16 },
} as const;

export function TierBadge({ tier, size = "md" }: TierBadgeProps) {
  const { label, Icon, className } = TIER_CONFIG[tier];
  const { padding, text, icon } = SIZE_CONFIG[size];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${padding} ${text} ${className}`}
    >
      <Icon size={icon} />
      {label}
    </span>
  );
}

export default TierBadge;
