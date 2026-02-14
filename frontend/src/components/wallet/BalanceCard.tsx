import React from "react";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { formatCurrency } from "../../utils/formatters";
import { Skeleton } from "../common/Skeleton";
import type { WalletSummary } from "../../types";

interface BalanceCardProps {
  summary: WalletSummary;
  loading: boolean;
  isProfessional: boolean;
  onRequestWithdrawal?: () => void;
}

const BalanceCard: React.FC<BalanceCardProps> = ({
  summary,
  loading,
  isProfessional,
  onRequestWithdrawal,
}) => {
  if (loading) {
    return (
      <div className="card bg-gradient-to-br from-primary-600 to-primary-800 text-white p-6">
        <div className="space-y-4">
          <Skeleton className="h-5 w-32 rounded !bg-white/20" />
          <Skeleton className="h-10 w-48 rounded !bg-white/20" />
          <div className="flex gap-6 mt-4">
            <Skeleton className="h-4 w-28 rounded !bg-white/20" />
            <Skeleton className="h-4 w-28 rounded !bg-white/20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-gradient-to-br from-primary-600 to-primary-800 text-white p-6 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-white/5 rounded-full" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary-200" />
            <span className="text-sm font-medium text-primary-200">Saldo disponivel</span>
          </div>
          {isProfessional && onRequestWithdrawal && (
            <button
              onClick={onRequestWithdrawal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Solicitar Saque
            </button>
          )}
        </div>

        {/* Balance */}
        <p className="text-3xl font-bold mb-6">
          {formatCurrency(summary.balance)}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {isProfessional ? (
            <>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-300 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-primary-200">Ganhos Totais</p>
                  <p className="text-sm font-semibold truncate">
                    {formatCurrency(summary.totalEarned || 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-primary-200">Em Escrow</p>
                  <p className="text-sm font-semibold truncate">
                    {formatCurrency(summary.pendingInEscrow)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-primary-200 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-primary-200">Ja Sacado</p>
                  <p className="text-sm font-semibold truncate">
                    {formatCurrency(summary.totalWithdrawn || 0)}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary-200 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-primary-200">Total Gasto</p>
                  <p className="text-sm font-semibold truncate">
                    {formatCurrency(summary.totalSpent || 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-primary-200">Em Escrow</p>
                  <p className="text-sm font-semibold truncate">
                    {formatCurrency(summary.pendingInEscrow)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-green-300 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-primary-200">Reembolsos</p>
                  <p className="text-sm font-semibold truncate">
                    {formatCurrency(summary.totalRefunded || 0)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BalanceCard;
