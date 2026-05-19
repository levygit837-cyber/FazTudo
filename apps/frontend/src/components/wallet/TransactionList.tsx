import React, { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Receipt,
  Percent,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";
import Tabs from "../common/Tabs";
import { SkeletonTable } from "../common/Skeleton";
import {
  formatCurrency,
  formatRelativeTime,
  formatTransactionType,
  getTransactionTypeColor,
} from "../../utils/formatters";
import type { Transaction, TransactionType } from "../../types";

interface TransactionListProps {
  transactions: Transaction[];
  loading: boolean;
  isProfessional: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onFilterChange: (type?: TransactionType) => void;
  activeFilter?: TransactionType;
}

const typeIcons: Record<string, React.ReactNode> = {
  DEPOSIT: <ArrowDownCircle className="w-5 h-5" />,
  WITHDRAWAL: <ArrowUpCircle className="w-5 h-5" />,
  PAYMENT: <Receipt className="w-5 h-5" />,
  REFUND: <RefreshCw className="w-5 h-5" />,
  FEE: <Percent className="w-5 h-5" />,
};

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  loading,
  isProfessional,
  page,
  totalPages,
  onPageChange,
  onFilterChange,
  activeFilter,
}) => {
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const tabs = [
    { id: "ALL", label: "Todos" },
    { id: "PAYMENT", label: "Pagamentos" },
    ...(isProfessional
      ? [{ id: "WITHDRAWAL", label: "Saques" }]
      : []),
    { id: "REFUND", label: "Reembolsos" },
    { id: "DEPOSIT", label: "Depositos" },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onFilterChange(tabId === "ALL" ? undefined : (tabId as TransactionType));
  };

  const isPositiveAmount = (type: string): boolean => {
    return type === "DEPOSIT" || type === "REFUND" || type === "PAYMENT";
  };

  if (loading) {
    return (
      <div className="card !p-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Historico de Transacoes
          </h3>
        </div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  return (
    <div className="card !p-0">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Historico de Transacoes
        </h3>
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="pill"
        />
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-slate-400" />
          </div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
            Nenhuma transacao encontrada
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            {activeFilter
              ? "Nao ha transacoes com este filtro."
              : "Suas transacoes aparecerão aqui."}
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {transactions.map((tx) => {
              const colorClass = getTransactionTypeColor(tx.type);
              const positive = isPositiveAmount(tx.type);

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}
                  >
                    {typeIcons[tx.type] || <Receipt className="w-5 h-5" />}
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {tx.description}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatTransactionType(tx.type)} &middot;{" "}
                      {formatRelativeTime(tx.createdAt)}
                    </p>
                  </div>

                  {/* Amount & Balance */}
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-sm font-semibold ${
                        positive
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {positive ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Saldo: {formatCurrency(tx.balanceAfter)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Pagina {page} de {totalPages}
              </span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Proxima
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TransactionList;
