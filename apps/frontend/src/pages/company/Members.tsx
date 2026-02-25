import React, { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Loader,
  AlertCircle,
  X,
  Mail,
  Link2,
  Copy,
  Check,
} from "lucide-react";
import api from "../../services/api";
import { CompanyMember, CompanyRole } from "../../types";
import MemberCard from "../../components/company/MemberCard";
import companyInviteService from "../../services/companyInviteService";

const CompanyMembers: React.FC = () => {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [inviteForm, setInviteForm] = useState({ email: "", roleId: "" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // invite-by-link state
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get("/company/members"),
      api.get("/company/members/roles"),
    ])
      .then(([membersRes, rolesRes]) => {
        setMembers(membersRes.data.data ?? []);
        setRoles(rolesRes.data.data ?? []);
      })
      .catch((err) => setError(err.response?.data?.message || "Erro ao carregar membros"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRemove = async (memberId: number) => {
    if (!window.confirm("Deseja remover este membro da empresa?")) return;
    try {
      await api.delete(`/company/members/${memberId}`);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao remover membro");
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setLinkError(null);
    try {
      const res = await companyInviteService.generateInviteLink({ role: "MEMBER" });
      if (res.success && res.data) {
        setInviteLink(res.data.link);
        setInviteExpiry(res.data.expiresAt);
      } else {
        setLinkError("Não foi possível gerar o link. Tente novamente.");
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Erro ao gerar link de convite";
      setLinkError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email) {
      setInviteError("Preencha o email");
      return;
    }
    setInviteLoading(true);
    setInviteError(null);
    try {
      await api.post("/company/members/invite", {
        email: inviteForm.email,
        ...(inviteForm.roleId ? { roleId: Number(inviteForm.roleId) } : {}),
      });
      setInviteSuccess(true);
      setInviteForm({ email: "", roleId: "" });
      setTimeout(() => {
        setShowModal(false);
        setInviteSuccess(false);
        fetchData();
      }, 1500);
    } catch (err: any) {
      setInviteError(err.response?.data?.message || "Erro ao convidar membro");
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Membros</h1>
            <p className="text-sm text-slate-500">{members.length} membro{members.length !== 1 ? "s" : ""} na equipe</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Convidar Membro
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Invite by link card */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Convidar novo membro
          </h2>
        </div>

        {linkError && (
          <div className="alert alert-error mb-3">
            <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
            <span>{linkError}</span>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn btn-primary flex items-center gap-2"
        >
          {generating ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {generating ? "Gerando…" : "Gerar link de convite"}
        </button>

        {inviteLink && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="input flex-1 bg-slate-50 dark:bg-slate-900 text-sm"
                aria-label="Link de convite"
              />
              <button
                onClick={handleCopy}
                className="btn flex items-center gap-1.5 shrink-0"
                title={copySuccess ? "Copiado!" : "Copiar link"}
              >
                {copySuccess ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </>
                )}
              </button>
            </div>

            {inviteExpiry && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Expira em:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {new Date(inviteExpiry).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {members.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum membro ainda</p>
          <p className="text-sm text-slate-400 mt-1">Convide profissionais para compor sua equipe.</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary mt-4 mx-auto"
          >
            Convidar Membro
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                Convidar Membro
              </h3>
              <button
                onClick={() => { setShowModal(false); setInviteError(null); setInviteSuccess(false); }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {inviteSuccess ? (
                <div className="alert alert-success">
                  <span>Convite enviado com sucesso!</span>
                </div>
              ) : (
                <>
                  {inviteError && (
                    <div className="alert alert-error">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      <span>{inviteError}</span>
                    </div>
                  )}
                  <div>
                    <label className="label" htmlFor="invite-email">Email do Profissional</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        id="invite-email"
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                        className="input pl-10"
                        placeholder="profissional@email.com"
                        required
                        disabled={inviteLoading}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="invite-role">Cargo (opcional)</label>
                    <select
                      id="invite-role"
                      value={inviteForm.roleId}
                      onChange={(e) => setInviteForm((p) => ({ ...p, roleId: e.target.value }))}
                      className="input"
                      disabled={inviteLoading}
                    >
                      <option value="">Sem cargo definido</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    {roles.length === 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Nenhum cargo criado.{" "}
                        <a href="/company/roles" className="text-blue-600 hover:underline">Crie cargos primeiro.</a>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn flex-1"
                      disabled={inviteLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-1"
                      disabled={inviteLoading}
                    >
                      {inviteLoading ? <Loader className="h-4 w-4 animate-spin mx-auto" /> : "Convidar"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyMembers;
