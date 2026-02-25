import React from "react";
import { DollarSign, ToggleLeft, ToggleRight } from "lucide-react";
import { CompanySalaryRule } from "../../types";

interface Props {
  rule: CompanySalaryRule;
  onToggle: (ruleId: number, isActive: boolean) => void;
}

const SalaryRuleCard: React.FC<Props> = ({ rule, onToggle }) => (
  <div className="card p-4 flex items-center gap-4">
    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
      <DollarSign className="h-5 w-5 text-green-600" />
    </div>
    <div className="flex-1">
      <p className="font-medium text-slate-900 dark:text-slate-100">
        R$ {rule.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        <span className="text-sm text-slate-500 font-normal ml-2">dia {rule.dayOfMonth}</span>
      </p>
      {rule.description && <p className="text-sm text-slate-500">{rule.description}</p>}
      {rule.role && (
        <span className="text-xs text-blue-600">Cargo: {rule.role.name}</span>
      )}
    </div>
    <button
      onClick={() => onToggle(rule.id, !rule.isActive)}
      className={`flex items-center gap-1 text-sm ${rule.isActive ? "text-green-600" : "text-slate-400"}`}
    >
      {rule.isActive ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
      {rule.isActive ? "Ativa" : "Inativa"}
    </button>
  </div>
);

export default SalaryRuleCard;
