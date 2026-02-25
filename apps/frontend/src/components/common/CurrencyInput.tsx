import { useCallback, useId, useRef, useState, useEffect } from "react";

interface CurrencyInputProps {
  value: number;
  onChange: (valueInReais: number) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  helperText?: string;
}

const MAX_CENTAVOS = 99_999_999; // R$ 999.999,99

const formatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function centavosToReais(centavos: number): number {
  return centavos / 100;
}

function formatCentavos(centavos: number): string {
  return formatter.format(centavosToReais(centavos));
}

export function CurrencyInput({
  value,
  onChange,
  label,
  error,
  disabled = false,
  className = "",
  id,
  name,
  required = false,
  helperText,
}: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEmittedRef = useRef<number | null>(null);

  // Internal state in centavos to avoid floating-point round-trip corruption
  const [centavos, setCentavos] = useState<number>(() =>
    Math.round(value * 100),
  );

  // Sync internal state from prop when value changes externally
  useEffect(() => {
    const externalCentavos = Math.round(value * 100);
    if (lastEmittedRef.current !== externalCentavos) {
      setCentavos(externalCentavos);
    }
  }, [value]);

  const emitChange = useCallback(
    (newCentavos: number) => {
      setCentavos(newCentavos);
      lastEmittedRef.current = newCentavos;
      onChange(centavosToReais(newCentavos));
    },
    [onChange],
  );

  const displayValue = formatCentavos(centavos);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow Tab, arrow keys, Home, End for navigation
      if (
        e.key === "Tab" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Home" ||
        e.key === "End"
      ) {
        return;
      }

      // Prevent all default behavior for handled keys
      e.preventDefault();

      if (e.key === "Backspace") {
        const newCentavos = Math.floor(centavos / 10);
        emitChange(newCentavos);
        return;
      }

      // Only allow digits 0-9
      if (!/^[0-9]$/.test(e.key)) {
        return;
      }

      const digit = parseInt(e.key, 10);
      const newCentavos = centavos * 10 + digit;

      if (newCentavos > MAX_CENTAVOS) {
        return;
      }

      emitChange(newCentavos);
    },
    [centavos, emitChange],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
  }, []);

  // Prevent manual editing via onChange — all input goes through keyDown
  const handleChange = useCallback(() => {
    // no-op: input is fully controlled via onKeyDown
  }, []);

  const uid = useId();
  const inputId = id || name || uid;

  const borderClass = error
    ? "border-red-500 focus-within:ring-red-500 focus-within:border-red-500"
    : "border-slate-300 dark:border-slate-600 focus-within:ring-primary-500 focus-within:border-primary-500";

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div
        className={`flex items-center w-full rounded-lg border ${borderClass} bg-white dark:bg-slate-900 focus-within:ring-2 transition-colors ${
          disabled ? "opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-800" : ""
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        <span className="pl-3 text-slate-500 dark:text-slate-400 select-none font-medium text-sm">
          R$
        </span>
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          required={required}
          autoComplete="off"
          className="flex-1 py-2.5 pr-3 pl-1.5 text-right font-mono text-slate-900 dark:text-slate-100 bg-transparent border-none outline-none focus:ring-0 disabled:cursor-not-allowed"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-helper`
                : undefined
          }
        />
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          className="text-xs text-red-500 mt-1"
          role="alert"
        >
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          id={`${inputId}-helper`}
          className="text-xs text-slate-400 dark:text-slate-500 mt-1"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

export default CurrencyInput;
