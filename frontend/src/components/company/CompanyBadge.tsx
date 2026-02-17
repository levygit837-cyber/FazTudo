import React from "react";
import { Building2, Clock } from "lucide-react";

interface Props {
  isVerified: boolean;
  size?: "sm" | "md";
}

const CompanyBadge: React.FC<Props> = ({ isVerified, size = "md" }) => (
  <span className={`inline-flex items-center gap-1 rounded-full font-medium ${
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
  } ${
    isVerified
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
  }`}>
    {isVerified ? <Building2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
    {isVerified ? "Empresa Verificada" : "Verificação Pendente"}
  </span>
);

export default CompanyBadge;
