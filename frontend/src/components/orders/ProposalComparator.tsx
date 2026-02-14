import React, { useState, useEffect, useMemo } from "react";
import {
  Star,
  Clock,
  Shield,
  CheckCircle,
  XCircle,
  Award,
  Zap,
  TrendingDown,
  Loader2,
  ArrowUpDown,
} from "lucide-react";
import { getProposals, acceptProposal, rejectProposal } from "../../services/serviceService";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";

interface Proposal {
  id: number;
  price: number;
  estimatedDays?: number;
  estimatedHours?: number;
  description: string;
  guaranteeDays?: number;
  status: string;
  createdAt: string;
  professional: {
    id: number;
    name: string;
    profileImage?: string;
    ratingAverage: number;
    totalReviews: number;
    bio?: string;
  };
}

interface ProposalComparatorProps {
  orderId: number;
  isClient: boolean;
  onProposalAccepted?: () => void;
}

const ProposalComparator: React.FC<ProposalComparatorProps> = ({
  orderId,
  isClient,
  onProposalAccepted,
}) => {
  const toast = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"price" | "rating" | "deadline" | null>(null);

  const loadProposals = async () => {
    try {
      setLoading(true);
      const data = await getProposals(orderId);
      setProposals(data);
    } catch {
      // Silently handle — may be no proposals yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProposals();
  }, [orderId]);

  const handleAccept = async (proposalId: number) => {
    try {
      setActionLoading(proposalId);
      await acceptProposal(orderId, proposalId);
      toast.success("Proposta aceita com sucesso!");
      onProposalAccepted?.();
      await loadProposals();
    } catch (err: any) {
      toast.error("Erro", err?.response?.data?.message || "Erro ao aceitar proposta");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (proposalId: number) => {
    try {
      setActionLoading(proposalId);
      await rejectProposal(orderId, proposalId);
      toast.success("Proposta recusada");
      await loadProposals();
    } catch (err: any) {
      toast.error("Erro", err?.response?.data?.message || "Erro ao recusar proposta");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="card p-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  const pendingProposals = proposals.filter((p) => p.status === "PENDING");
  if (pendingProposals.length === 0 && proposals.length === 0) {
    return null; // Don't show if no proposals
  }

  // Sort proposals
  const sortedProposals = useMemo(() => {
    if (!sortBy) return proposals;
    const sorted = [...proposals];
    sorted.sort((a, b) => {
      // Always put pending first
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (a.status !== "PENDING" && b.status === "PENDING") return 1;

      switch (sortBy) {
        case "price":
          return a.price - b.price;
        case "rating":
          return b.professional.ratingAverage - a.professional.ratingAverage;
        case "deadline":
          return (a.estimatedDays || 999) - (b.estimatedDays || 999);
        default:
          return 0;
      }
    });
    return sorted;
  }, [proposals, sortBy]);

  // Calculate badges
  const lowestPrice = pendingProposals.length > 0 ? Math.min(...pendingProposals.map((p) => p.price)) : 0;
  const fastestDays = pendingProposals.filter((p) => p.estimatedDays).length > 0
    ? Math.min(...pendingProposals.filter((p) => p.estimatedDays).map((p) => p.estimatedDays!))
    : null;
  const bestRated = pendingProposals.length > 0
    ? Math.max(...pendingProposals.map((p) => p.professional.ratingAverage))
    : 0;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          Propostas ({pendingProposals.length})
        </h2>
        {pendingProposals.length > 1 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">Compare e escolha a melhor</span>
        )}
      </div>

      {/* Sort controls */}
      {pendingProposals.length > 1 && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Ordenar:</span>
          {([
            { key: "price" as const, label: "Preco" },
            { key: "rating" as const, label: "Avaliacao" },
            { key: "deadline" as const, label: "Prazo" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(sortBy === key ? null : key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                sortBy === key
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {proposals.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
          Nenhuma proposta recebida ainda. Aguarde profissionais responderem.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedProposals.map((proposal) => {
            const isPending = proposal.status === "PENDING";
            const isCheapest = isPending && proposal.price === lowestPrice && pendingProposals.length > 1;
            const isFastest = isPending && fastestDays && proposal.estimatedDays === fastestDays && pendingProposals.length > 1;
            const isBestRated = isPending && proposal.professional.ratingAverage === bestRated && bestRated > 0 && pendingProposals.length > 1;

            return (
              <div
                key={proposal.id}
                className={`relative border rounded-xl p-4 transition-all ${
                  proposal.status === "ACCEPTED"
                    ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10"
                    : proposal.status === "REJECTED" || proposal.status === "WITHDRAWN"
                      ? "border-slate-200 dark:border-slate-700 opacity-50"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm"
                }`}
              >
                {/* Badges */}
                {isPending && (isCheapest || isFastest || isBestRated) && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {isCheapest && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        <TrendingDown className="w-3 h-3" /> Melhor preço
                      </span>
                    )}
                    {isFastest && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <Zap className="w-3 h-3" /> Mais rápido
                      </span>
                    )}
                    {isBestRated && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <Award className="w-3 h-3" /> Melhor avaliado
                      </span>
                    )}
                  </div>
                )}

                {/* Professional info + price */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      {proposal.professional.profileImage ? (
                        <img src={proposal.professional.profileImage} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                          {proposal.professional.name.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{proposal.professional.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {proposal.professional.ratingAverage > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            {proposal.professional.ratingAverage.toFixed(1)}
                            <span className="text-slate-400">({proposal.professional.totalReviews})</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{formatCurrency(proposal.price)}</p>
                    {proposal.status !== "PENDING" && (
                      <span className={`text-xs font-medium ${
                        proposal.status === "ACCEPTED" ? "text-green-600" :
                        proposal.status === "REJECTED" ? "text-red-500" : "text-slate-400"
                      }`}>
                        {proposal.status === "ACCEPTED" ? "Aceita" : proposal.status === "REJECTED" ? "Recusada" : "Retirada"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details grid */}
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  {proposal.estimatedDays && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{proposal.estimatedDays} dias</span>
                    </div>
                  )}
                  {proposal.estimatedHours && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{proposal.estimatedHours}h trabalho</span>
                    </div>
                  )}
                  {proposal.guaranteeDays && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <Shield className="w-3.5 h-3.5" />
                      <span>{proposal.guaranteeDays} dias garantia</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{proposal.description}</p>

                {/* Actions */}
                {isClient && isPending && (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => handleAccept(proposal.id)}
                      disabled={actionLoading !== null}
                      className="btn btn-primary btn-sm flex-1"
                    >
                      {actionLoading === proposal.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><CheckCircle className="w-4 h-4 mr-1" /> Aceitar</>
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(proposal.id)}
                      disabled={actionLoading !== null}
                      className="btn btn-outline btn-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Recusar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProposalComparator;
