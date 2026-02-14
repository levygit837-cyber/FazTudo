import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet as WalletIcon,
  DollarSign,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  Receipt,
  Percent,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { StatsCard } from "../components/dashboard/StatsCard";
import BalanceCard from "../components/wallet/BalanceCard";
import TransactionList from "../components/wallet/TransactionList";
import WithdrawalModal from "../components/wallet/WithdrawalModal";
import { SkeletonStatsCard } from "../components/common/Skeleton";
import { formatCurrency } from "../utils/formatters";
import * as walletService from "../services/walletService";
import type { Transaction, TransactionType, WalletSummary } from "../types";

const Wallet: React.FC = () => {
  const { isProfessional } = useAuth();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TransactionType | undefined>();
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryData, txData] = await Promise.all([
        walletService.getSummary().catch(() => null),
        walletService.getTransactions({ page: 1, limit: 20 }).catch(() => ({
          transactions: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        })),
      ]);

      if (summaryData) setSummary(summaryData);
      setTransactions(txData.transactions);
      setTotalPages(txData.pagination.totalPages);
      setPage(1);
    } catch (error) {
      console.error("Erro ao carregar carteira:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadTransactions = useCallback(
    async (newPage: number, filter?: TransactionType) => {
      try {
        const txData = await walletService.getTransactions({
          page: newPage,
          limit: 20,
          type: filter,
        });
        setTransactions(txData.transactions);
        setTotalPages(txData.pagination.totalPages);
        setPage(txData.pagination.page);
      } catch (error) {
        console.error("Erro ao carregar transacoes:", error);
      }
    },
    [],
  );

  const handlePageChange = (newPage: number) => {
    loadTransactions(newPage, typeFilter);
  };

  const handleFilterChange = (type?: TransactionType) => {
    setTypeFilter(type);
    loadTransactions(1, type);
  };

  const handleWithdrawal = async (amount: number) => {
    const result = await walletService.requestWithdrawal({ amount });

    // Update summary with new balance
    if (summary) {
      setSummary({
        ...summary,
        balance: result.newBalance,
        totalWithdrawn: (summary.totalWithdrawn || 0) + amount,
      });
    }

    // Reload transactions to show the new withdrawal
    await loadTransactions(1, typeFilter);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Carteira
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          {isProfessional
            ? "Gerencie seus ganhos, saques e historico financeiro."
            : "Acompanhe seu saldo, pagamentos e historico financeiro."}
        </p>
      </div>

      {/* Balance Card */}
      <BalanceCard
        summary={summary}
        loading={loading}
        isProfessional={isProfessional}
        onRequestWithdrawal={() => setShowWithdrawalModal(true)}
      />

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatsCard key={i} />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-grid">
          {isProfessional ? (
            <>
              <StatsCard
                title="Ganhos Totais"
                value={formatCurrency(summary.totalEarned || 0)}
                icon={<DollarSign className="w-6 h-6" />}
                color="green"
              />
              <StatsCard
                title="Pendente em Escrow"
                value={formatCurrency(summary.pendingInEscrow)}
                icon={<Clock className="w-6 h-6" />}
                color="yellow"
              />
              <StatsCard
                title="Ja Sacado"
                value={formatCurrency(summary.totalWithdrawn || 0)}
                icon={<ArrowUpCircle className="w-6 h-6" />}
                color="blue"
              />
              <StatsCard
                title="Taxas"
                value={formatCurrency(summary.totalFees || 0)}
                icon={<Percent className="w-6 h-6" />}
                color="red"
              />
            </>
          ) : (
            <>
              <StatsCard
                title="Total Gasto"
                value={formatCurrency(summary.totalSpent || 0)}
                icon={<Receipt className="w-6 h-6" />}
                color="blue"
              />
              <StatsCard
                title="Em Escrow"
                value={formatCurrency(summary.pendingInEscrow)}
                icon={<Clock className="w-6 h-6" />}
                color="yellow"
              />
              <StatsCard
                title="Reembolsos"
                value={formatCurrency(summary.totalRefunded || 0)}
                icon={<ArrowDownCircle className="w-6 h-6" />}
                color="green"
              />
              <StatsCard
                title="Saldo Atual"
                value={formatCurrency(summary.balance)}
                icon={<WalletIcon className="w-6 h-6" />}
                color="primary"
              />
            </>
          )}
        </div>
      ) : null}

      {/* Transactions */}
      <TransactionList
        transactions={transactions}
        loading={loading}
        isProfessional={isProfessional}
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        onFilterChange={handleFilterChange}
        activeFilter={typeFilter}
      />

      {/* Withdrawal Modal (Professional only) */}
      {isProfessional && (
        <WithdrawalModal
          isOpen={showWithdrawalModal}
          onClose={() => setShowWithdrawalModal(false)}
          onConfirm={handleWithdrawal}
          balance={summary?.balance || 0}
        />
      )}
    </div>
  );
};

export default Wallet;
