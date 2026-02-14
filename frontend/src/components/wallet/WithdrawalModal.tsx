import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, ArrowUpCircle } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import { handleApiError } from "../../services/api";

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
  balance: number;
}

const QUICK_AMOUNTS = [50, 100, 500];

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  balance,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setAmount("");
      setLoading(false);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Escape handler
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  const numericAmount = parseFloat(amount) || 0;
  const isValidAmount = numericAmount >= 10 && numericAmount <= balance;
  const resultingBalance = balance - numericAmount;

  const handleQuickAmount = (value: number) => {
    if (value <= balance) {
      setAmount(value.toString());
      setError(null);
    }
  };

  const handleAllBalance = () => {
    setAmount(balance.toString());
    setError(null);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and one decimal point
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      setAmount(value);
      setError(null);
    }
  };

  const handleProceed = () => {
    if (numericAmount < 10) {
      setError("Valor minimo para saque e R$ 10,00");
      return;
    }
    if (numericAmount > balance) {
      setError("Valor excede o saldo disponivel");
      return;
    }
    setStep(2);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(numericAmount);
      onClose();
    } catch (err) {
      setError(handleApiError(err));
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdrawal-modal-title"
    >
      <div
        ref={dialogRef}
        className="modal-content max-w-md animate-soft-pop"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <ArrowUpCircle className="w-5 h-5 text-primary-600" />
              </div>
              <h3
                id="withdrawal-modal-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {step === 1 ? "Solicitar Saque" : "Confirmar Saque"}
              </h3>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {step === 1 ? (
            <>
              {/* Balance info */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Saldo disponivel</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(balance)}
                </p>
              </div>

              {/* Amount input */}
              <div className="mb-4">
                <label
                  htmlFor="withdrawal-amount"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Valor do saque
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    R$
                  </span>
                  <input
                    ref={inputRef}
                    id="withdrawal-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Minimo R$ 10,00</p>
              </div>

              {/* Quick amounts */}
              <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_AMOUNTS.map((val) => (
                  <button
                    key={val}
                    onClick={() => handleQuickAmount(val)}
                    disabled={val > balance}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 dark:text-slate-300"
                  >
                    R$ {val}
                  </button>
                ))}
                <button
                  onClick={handleAllBalance}
                  className="px-3 py-1.5 text-sm rounded-lg border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  Tudo
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleProceed}
                  disabled={!isValidAmount}
                  className="btn btn-primary disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Confirmation summary */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Valor do saque</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(numericAmount)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Saldo atual</span>
                  <span className="text-sm text-slate-900 dark:text-slate-100">
                    {formatCurrency(balance)}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Saldo resultante</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(resultingBalance)}
                  </span>
                </div>
              </div>

              {/* Notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm mb-6">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Funcionalidade de transferencia bancaria em desenvolvimento.
                  O saque sera registrado e processado manualmente.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="btn btn-outline"
                >
                  Voltar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="btn btn-primary disabled:opacity-70"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="loader h-4 w-4" />
                      Processando...
                    </span>
                  ) : (
                    "Confirmar Saque"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WithdrawalModal;
