import React, { useState, useCallback } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onClear?: () => void;
  className?: string;
  autoFocus?: boolean;
  debounceMs?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Buscar...",
  value: controlledValue,
  onChange,
  onSearch,
  onClear,
  className = "",
  autoFocus = false,
  debounceMs = 300,
}) => {
  const [internalValue, setInternalValue] = useState("");
  const [debounceTimeout, setDebounceTimeout] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      if (controlledValue === undefined) {
        setInternalValue(newValue);
      }

      onChange?.(newValue);

      // Debounce para onSearch
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      if (onSearch && debounceMs > 0) {
        const timeout = setTimeout(() => {
          onSearch(newValue);
        }, debounceMs);
        setDebounceTimeout(timeout);
      }
    },
    [controlledValue, onChange, onSearch, debounceMs, debounceTimeout],
  );

  const handleClear = useCallback(() => {
    if (controlledValue === undefined) {
      setInternalValue("");
    }
    onChange?.("");
    onClear?.();
    onSearch?.("");
  }, [controlledValue, onChange, onClear, onSearch]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch?.(value);
    },
    [value, onSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleClear],
  );

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Limpar busca"
          >
            <X className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </button>
        )}
      </div>
    </form>
  );
};

export default SearchBar;
