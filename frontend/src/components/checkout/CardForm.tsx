import { useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import clsx from "clsx";

interface Props {
  onSubmit: (data: {
    cardNumber: string;
    cardholderName: string;
    expirationMonth: string;
    expirationYear: string;
    securityCode: string;
    installments: number;
  }) => void;
  amount: number;
  loading?: boolean;
  disabled?: boolean;
}

export default function CardForm({ onSubmit, amount, loading, disabled }: Props) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const cleanCard = cardNumber.replace(/\s/g, "");
    if (cleanCard.length < 13 || cleanCard.length > 19) newErrors.cardNumber = "Número de cartão inválido";
    if (!cardholderName.trim()) newErrors.cardholderName = "Nome é obrigatório";
    const parts = expiry.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1] || parseInt(parts[0]) < 1 || parseInt(parts[0]) > 12)
      newErrors.expiry = "Validade inválida";
    if (cvv.length < 3) newErrors.cvv = "CVV inválido";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const [month, year] = expiry.split("/");
    onSubmit({
      cardNumber: cardNumber.replace(/\s/g, ""),
      cardholderName,
      expirationMonth: month,
      expirationYear: `20${year}`,
      securityCode: cvv,
      installments,
    });
  };

  const maxInstallments = Math.min(12, Math.max(1, Math.floor(amount / 5)));
  const installmentOptions = Array.from({ length: maxInstallments }, (_, i) => i + 1);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Card Number */}
      <div>
        <label className="label">Número do cartão</label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="0000 0000 0000 0000"
            className={clsx("input pl-10 font-mono", errors.cardNumber && "input-error")}
            disabled={disabled}
          />
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
        {errors.cardNumber && <p className="form-error">{errors.cardNumber}</p>}
      </div>

      {/* Cardholder Name */}
      <div>
        <label className="label">Nome no cartão</label>
        <input
          type="text"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
          placeholder="NOME COMO NO CARTÃO"
          className={clsx("input uppercase", errors.cardholderName && "input-error")}
          disabled={disabled}
        />
        {errors.cardholderName && <p className="form-error">{errors.cardholderName}</p>}
      </div>

      {/* Expiry + CVV */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Validade</label>
          <input
            type="text"
            inputMode="numeric"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder="MM/AA"
            className={clsx("input font-mono text-center", errors.expiry && "input-error")}
            disabled={disabled}
          />
          {errors.expiry && <p className="form-error">{errors.expiry}</p>}
        </div>
        <div>
          <label className="label">CVV</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="•••"
              className={clsx("input font-mono text-center pr-9", errors.cvv && "input-error")}
              disabled={disabled}
            />
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          {errors.cvv && <p className="form-error">{errors.cvv}</p>}
        </div>
      </div>

      {/* Installments */}
      <div>
        <label className="label">Parcelas</label>
        <select
          value={installments}
          onChange={(e) => setInstallments(Number(e.target.value))}
          className="input"
          disabled={disabled}
        >
          {installmentOptions.map((n) => (
            <option key={n} value={n}>
              {n}x de R$ {(amount / n).toFixed(2)} {n === 1 ? "(à vista)" : "sem juros"}
            </option>
          ))}
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || disabled}
        className="btn btn-primary w-full py-3 text-base font-semibold"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processando...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            Pagar R$ {amount.toFixed(2)}
          </span>
        )}
      </button>
    </form>
  );
}
