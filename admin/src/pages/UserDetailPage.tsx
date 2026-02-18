import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  FileText,
  Calendar,
  Shield,
  Star,
  DollarSign,
  AlertCircle,
  Loader2,
  LogOut,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Briefcase,
  MessageSquare,
} from "lucide-react";
import {
  getUserDetails,
  updateUserStatus,
  forceLogout,
  type UserDetails,
} from "../services/adminService";

// ==================== Helpers ====================

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  INACTIVE: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

const ROLE_BADGE: Record<string, string> = {
  CLIENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  PROFESSIONAL: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// ==================== Component ====================

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = Number(id);

  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!userId || isNaN(userId)) {
      setError("ID de usuario invalido");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getUserDetails(userId);
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar usuario");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const handleStatusChange = async (newStatus: string) => {
    if (!user) return;
    setStatusLoading(true);
    setStatusMessage(null);
    try {
      const updated = await updateUserStatus(user.id, newStatus);
      setUser(updated);
      setStatusMessage(`Status alterado para ${newStatus}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage(
        `Erro: ${err instanceof Error ? err.message : "Falha ao alterar status"}`
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const handleForceLogout = async () => {
    if (!user) return;
    setLogoutLoading(true);
    try {
      await forceLogout(user.id);
      setShowLogoutConfirm(false);
      setStatusMessage("Logout forcado com sucesso");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage(
        `Erro: ${err instanceof Error ? err.message : "Falha no logout"}`
      );
    } finally {
      setLogoutLoading(false);
    }
  };

  // ==================== Loading ====================

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate("/users")}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ArrowLeft size={16} />
          Voltar para usuarios
        </button>
        <div className="card animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
            <div className="space-y-3 flex-1">
              <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== Error ====================

  if (error || !user) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate("/users")}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ArrowLeft size={16} />
          Voltar para usuarios
        </button>
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={48} className="text-red-400 mb-4" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            {error ?? "Usuario nao encontrado"}
          </p>
          <button
            onClick={() => void fetchUser()}
            className="btn bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg mt-2"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate("/users")}
        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Voltar para usuarios
      </button>

      {/* Status message toast */}
      {statusMessage && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            statusMessage.startsWith("Erro")
              ? "bg-red-500 text-white"
              : "bg-emerald-500 text-white"
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* Header card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 text-2xl font-bold shrink-0">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {user.name}
              </h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  ROLE_BADGE[user.role] ?? ROLE_BADGE.CLIENT
                }`}
              >
                {user.role}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_BADGE[user.status] ?? STATUS_BADGE.PENDING
                }`}
              >
                {user.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {user.email}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={user.status}
              onChange={(e) => void handleStatusChange(e.target.value)}
              disabled={statusLoading}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-50"
            >
              <option value="ACTIVE">Ativo</option>
              <option value="PENDING">Pendente</option>
              <option value="SUSPENDED">Suspenso</option>
              <option value="INACTIVE">Inativo</option>
            </select>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
            >
              <LogOut size={14} />
              Forcar Logout
            </button>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoCard
          icon={<Mail size={16} className="text-slate-400" />}
          label="Email"
          value={user.email}
        />
        <InfoCard
          icon={<Phone size={16} className="text-slate-400" />}
          label="Telefone"
          value={user.phone ?? "Nao informado"}
        />
        <InfoCard
          icon={<FileText size={16} className="text-slate-400" />}
          label="Documento"
          value={user.document ?? "Nao informado"}
        />
        <InfoCard
          icon={
            user.isVerified ? (
              <CheckCircle size={16} className="text-emerald-500" />
            ) : (
              <XCircle size={16} className="text-red-400" />
            )
          }
          label="Verificado"
          value={user.isVerified ? "Sim" : "Nao"}
        />
        <InfoCard
          icon={<Calendar size={16} className="text-slate-400" />}
          label="Criado em"
          value={formatDate(user.createdAt)}
        />
        <InfoCard
          icon={<DollarSign size={16} className="text-slate-400" />}
          label="Saldo"
          value={formatCurrency(user.balance)}
        />
        <InfoCard
          icon={<Star size={16} className="text-amber-400" />}
          label="Avaliacao"
          value={`${user.ratingAverage.toFixed(1)} (${user.totalReviews} avaliacoes)`}
        />
        <InfoCard
          icon={<Shield size={16} className="text-slate-400" />}
          label="Role"
          value={user.role}
        />
        <InfoCard
          icon={<User size={16} className="text-slate-400" />}
          label="Bio"
          value={user.bio ?? "Sem bio"}
        />
      </div>

      {/* Activity summary */}
      <div className="card">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Resumo de Atividade
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ActivityStat
            icon={<ShoppingCart size={20} className="text-blue-500" />}
            label="Pedidos"
            value={user.totalReviews}
          />
          <ActivityStat
            icon={<Briefcase size={20} className="text-violet-500" />}
            label="Servicos Prestados"
            value={0}
          />
          <ActivityStat
            icon={<Star size={20} className="text-amber-500" />}
            label="Avaliacoes"
            value={user.totalReviews}
          />
          <ActivityStat
            icon={<MessageSquare size={20} className="text-emerald-500" />}
            label="Mensagens"
            value={0}
          />
        </div>
      </div>

      {/* Force Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <LogOut size={20} className="text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Confirmar Logout Forcado
              </h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Tem certeza de que deseja forcar o logout do usuario{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {user.name}
              </strong>
              ? O usuario sera desconectado imediatamente.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleForceLogout()}
                disabled={logoutLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {logoutLoading && <Loader2 size={14} className="animate-spin" />}
                Confirmar Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== Sub-components ====================

const InfoCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <div className="card flex items-start gap-3">
    <div className="mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
        {value}
      </p>
    </div>
  </div>
);

const ActivityStat: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
}> = ({ icon, label, value }) => (
  <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
    <div className="flex justify-center mb-2">{icon}</div>
    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
      {value}
    </p>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
      {label}
    </p>
  </div>
);

export default UserDetailPage;
