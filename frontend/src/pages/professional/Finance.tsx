import React, { useState, useEffect } from "react";
import {
  Wallet,
  DollarSign,
  Clock,
  ArrowUpCircle,
  Percent,
  TrendingUp,
  Calendar,
  Shield,
} from "lucide-react";
import { StatsCard } from "../../components/dashboard/StatsCard";
import TransactionList from "../../components/wallet/TransactionList";
import WithdrawalModal from "../../components/wallet/WithdrawalModal";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import { formatCurrency, formatDate } from "../../utils/formatters";
import {
  getProfessionalFinancialOverview,
  requestWithdrawal,
  ProfessionalFinancialOverview,
} from "../../services/walletService";

const ProfessionalFinance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfessionalFinancialOverview | null>(null);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const overview = await getProfessionalFinancialOverview();
        setData(overview);
      } catch (error) {
        console.error("Erro ao carregar dados financeiros:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleWithdrawal = async (amount: number) => {
    const result = await requestWithdrawal({ amount });
    if (data) {
      setData({
        ...data,
        balance: result.newBalance,
        totalWithdrawn: data.totalWithdrawn + amount,
      });
    }
  };

  if (loading) return <SkeletonDashboard />;
  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Gestao Financeira
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Controle seus ganhos, taxas e previsoes de saque.
          </p>
        </div>
        <button
          onClick={() => setShowWithdrawalModal(true)}
          disabled={data.balance < 10}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowUpCircle className="w-5 h-5" />
          Solicitar Saque
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-6 h-6 text-emerald-200" />
            <p className="text-sm text-emerald-100">Saldo Disponivel</p>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.balance)}</p>
          <p className="text-sm text-emerald-200 mt-1">Pronto para saque</p>
        </div>

        <div className="card bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-amber-200" />
            <p className="text-sm text-amber-100">Em Escrow</p>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(data.pendingInEscrow)}</p>
          <p className="text-sm text-amber-200 mt-1">
            Aguardando liberacao ({data.releaseForecast.length} pagamento{data.releaseForecast.length !== 1 ? "s" : ""})
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-grid">
        <StatsCard
          title="Total Ganho (liquido)"
          value={formatCurrency(data.totalEarned)}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <StatsCard
          title="Total Sacado"
          value={formatCurrency(data.totalWithdrawn)}
          icon={<ArrowUpCircle className="w-6 h-6" />}
          color="blue"
        />
        <StatsCard
          title="Taxas Pagas"
          value={formatCurrency(data.totalFees)}
          subtitle={`Taxa: ${data.feePercentage}%`}
          icon={<Percent className="w-6 h-6" />}
          color="red"
        />
        <StatsCard
          title="Em Escrow"
          value={formatCurrency(data.pendingInEscrow)}
          icon={<Clock className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      {/* Release Forecast */}
      {data.releaseForecast.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Previsao de Recebimento
            </h2>
          </div>
          <div className="space-y-3">
            {data.releaseForecast.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Pedido #{item.serviceOrderId}
                    </p>
                    <p className="text-xs text-slate-500">
                      Liberacao: {item.releaseDate ? formatDate(item.releaseDate) : "A definir"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">
                    +{formatCurrency(item.netAmount)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Bruto: {formatCurrency(item.grossAmount)} | Taxa: {formatCurrency(item.platformFee)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Historico de Transacoes
        </h2>
        <TransactionList
          transactions={data.recentTransactions}
          loading={false}
          isProfessional={true}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          onFilterChange={() => {}}
          activeFilter={undefined}
        />
      </div>

      {/* Withdrawal Modal */}
      <WithdrawalModal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        onConfirm={handleWithdrawal}
        balance={data.balance}
      />
    </div>
  );
};

export default ProfessionalFinance;
