import { CreditCard, QrCode, FileText, Check } from "lucide-react";
import clsx from "clsx";

interface Props {
  selected: "credit_card" | "pix" | "boleto" | null;
  onSelect: (method: "credit_card" | "pix" | "boleto") => void;
  disabled?: boolean;
}

const methods = [
  {
    id: "credit_card" as const,
    icon: CreditCard,
    title: "Cartão de Crédito",
    subtitle: "Até 12x sem juros",
    accent: "text-blue-500",
    bgAccent: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    id: "pix" as const,
    icon: QrCode,
    title: "PIX",
    subtitle: "Aprovação instantânea",
    accent: "text-emerald-500",
    bgAccent: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    id: "boleto" as const,
    icon: FileText,
    title: "Boleto Bancário",
    subtitle: "Vence em 3 dias úteis",
    accent: "text-amber-500",
    bgAccent: "bg-amber-50 dark:bg-amber-900/20",
  },
];

export default function PaymentMethodSelector({ selected, onSelect, disabled }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        Forma de pagamento
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {methods.map((method) => {
          const isSelected = selected === method.id;
          const Icon = method.icon;
          return (
            <button
              key={method.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(method.id)}
              className={clsx(
                "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                "hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500/50",
                isSelected
                  ? "border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
              <div className={clsx("p-2.5 rounded-lg", isSelected ? method.bgAccent : "bg-slate-100 dark:bg-slate-700")}>
                <Icon className={clsx("w-6 h-6", isSelected ? method.accent : "text-slate-500 dark:text-slate-400")} />
              </div>
              <div className="text-center">
                <p className={clsx("text-sm font-semibold", isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300")}>
                  {method.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {method.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
