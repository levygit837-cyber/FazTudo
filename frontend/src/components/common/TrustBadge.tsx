import React from "react";
import {
  Shield,
  BadgeCheck,
  ShieldCheck,
  UserCheck,
  FileCheck,
  Crown,
} from "lucide-react";

type TrustBadgeType =
  | "payment-protected"
  | "verified-professional"
  | "service-guarantee"
  | "identity-verified"
  | "background-checked"
  | "premium";

interface TrustBadgeProps {
  type: TrustBadgeType;
  size?: "sm" | "md" | "lg";
}

const badgeConfig: Record<
  TrustBadgeType,
  {
    icon: React.ElementType;
    label: string;
    colorClass: string;
    bgClass: string;
    darkBgClass: string;
    glowClass: string;
  }
> = {
  "payment-protected": {
    icon: Shield,
    label: "Pagamento Protegido",
    colorClass: "text-primary-600 dark:text-primary-400",
    bgClass: "bg-primary-50",
    darkBgClass: "dark:bg-primary-900/20",
    glowClass: "shadow-glow-blue",
  },
  "verified-professional": {
    icon: BadgeCheck,
    label: "Profissional Verificado",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50",
    darkBgClass: "dark:bg-emerald-900/20",
    glowClass: "shadow-glow-green",
  },
  "service-guarantee": {
    icon: ShieldCheck,
    label: "Garantia de Servico",
    colorClass: "text-primary-600 dark:text-primary-400",
    bgClass: "bg-primary-50",
    darkBgClass: "dark:bg-primary-900/20",
    glowClass: "shadow-glow-blue",
  },
  "identity-verified": {
    icon: UserCheck,
    label: "Identidade Verificada",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50",
    darkBgClass: "dark:bg-emerald-900/20",
    glowClass: "shadow-glow-green",
  },
  "background-checked": {
    icon: FileCheck,
    label: "Antecedentes OK",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50",
    darkBgClass: "dark:bg-emerald-900/20",
    glowClass: "shadow-glow-green",
  },
  premium: {
    icon: Crown,
    label: "Premium",
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50",
    darkBgClass: "dark:bg-amber-900/20",
    glowClass: "shadow-glow-amber",
  },
};

const sizeClasses = {
  sm: {
    container: "px-2 py-0.5 gap-1 text-[0.6875rem]",
    icon: "h-3 w-3",
  },
  md: {
    container: "px-2.5 py-1 gap-1.5 text-xs",
    icon: "h-3.5 w-3.5",
  },
  lg: {
    container: "px-3 py-1.5 gap-2 text-sm",
    icon: "h-4 w-4",
  },
};

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  type,
  size = "md",
}) => {
  const config = badgeConfig[type];
  const sizeConfig = sizeClasses[size];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeConfig.container} ${config.bgClass} ${config.darkBgClass} ${config.colorClass} dark:${config.glowClass}`}
    >
      <Icon className={sizeConfig.icon} />
      {config.label}
    </span>
  );
};

export default TrustBadge;
