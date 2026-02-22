import React, { useEffect, useState } from "react";
import {
  DollarSign,
  Plus,
  Loader,
  AlertCircle,
  X,
  Send,
} from "lucide-react";
import api from "../../services/api";
import { CompanySalaryRule, CompanyMember, CompanyRole } from "../../types";
import SalaryRuleCard from "../../components/company/SalaryRuleCard";
import { CurrencyInput } from "../../components/common/CurrencyInput";

const CompanySalary: React.FC = () => {
  const [rules, setRules] = useState<CompanySalaryRule[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    amount: "",
    dayOfMonth: "5",
    description: "",
    roleId: "",
    memberId: "",
  });
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ memberId: "", amount: "", note: "" });
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get("/company/salary/rules"),
      api.get("/company/members"),
      api.get("/company/members/roles"),
    ])
      .then(([rulesRes, membersRes, rolesRes]) => {
        setRules(rulesRes.data.data ?? []);
        setMembers(membersRes.data.data ?? []);
        setRoles(rolesRes.data.data ?? []);
      })
      .catch((err) => setError(err.response?.data?.message || "Erro ao carregar dados"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleRule = async (ruleId: number, isActive: boolean) => {
    try {
      await api.patch(`/company/salary/rules/${ruleId}`, { isActive });
      setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, isActive } : r));
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao atualizar regra");
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.amount || Number(ruleForm.amount) <= 0) {
      setRuleError("Valor inválido"); return;
    }
    setRuleLoading(true);
    setRuleError(null);
    try {
      const payload: Record<string, unknown> = {
        amount: Number(ruleForm.amount),
        dayOfMonth: Number(ruleForm.dayOfMonth),
        description: ruleForm.description || undefined,
      };
      if (ruleForm.roleId) payload.roleId = Number(ruleForm.roleId);
      if (ruleForm.memberId) payload.memberId = Number(ruleForm.memberId);
      const r = await api.post("/company/salary/rules", payload);
      setRules((prev) => [...prev, r.data.data]);
      setShowRuleModal(false);
      setRuleForm({ amount: "", dayOfMonth: "5", description: "", roleId: "", memberId: "" });
    } catch (err: any) {
      setRuleError(err.response?.data?.message || "Erro ao criar regra");
    } finally {
      setRuleLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.memberId || !transferForm.amount) {
      setTransferError("Selecione o membro e o valor"); return;
    }
    setTransferLoading(true);
    setTransferError(null);
    setTransferSuccess(false);
    try {
      await api.post("/company/salary/transfer", {
        memberId: Number(transferForm.memberId),
        amount: Number(transferForm.amount),
        note: transferForm.note || undefined,
      });
      setTransferSuccess(true);
      setTransferForm({ memberId: "", amount: "", note: "" });
      setTimeout(() => {
        setShowTransferModal(false);
        setTransferSuccess(false);
      }, 1500);
    } catch (err: any) {
      setTransferError(err.response?.data?.message || "Erro ao transferir");
    } finally {
      setTransferLoading(false);
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
          <DollarSign className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Salários</h1>
            <p className="text-sm text-slate-500">Regras automáticas e transferências manuais</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTransferModal(true)}
            className="btn flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Transferir
          </button>
          <button
            onClick={() => setShowRuleModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Regra
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="card p-12 text-center">
          <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma regra de salário criada</p>
          <p className="text-sm text-slate-400 mt-1">Crie regras automáticas de pagamento para sua equipe.</p>
          <button onClick={() => setShowRuleModal(true)} className="btn btn-primary mt-4 mx-auto">
            Criar Regra
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <SalaryRuleCard key={rule.id} rule={rule} onToggle={handleToggleRule} />
          ))}
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" /> Nova Regra de Salário
              </h3>
              <button onClick={() => setShowRuleModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRule} className="p-6 space-y-4">
              {ruleError && (
                <div className="alert alert-error text-sm">
                  <AlertCircle className="h-4 w-4 mr-2" />{ruleError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <CurrencyInput
                    label="Valor (R$)"
                    value={ruleForm.amount ? Number(ruleForm.amount) : 0}
                    onChange={(reais) => setRuleForm((p) => ({ ...p, amount: String(reais) }))}
                    disabled={ruleLoading}
                    required
                  />
                </div>
                <div>
                  <label className="label">Dia do Mês</label>
                  <select
                    value={ruleForm.dayOfMonth}
                    onChange={(e) => setRuleForm((p) => ({ ...p, dayOfMonth: e.target.value }))}
                    className="input"
                    disabled={ruleLoading}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={String(day)}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Descrição (opcional)</label>
                <input
                  type="text"
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm((p) => ({ ...p, description: e.target.value }))}
                  className="input"
                  placeholder="Ex: Salário base..."
                  disabled={ruleLoading}
                />
              </div>
              <div>
                <label className="label">Aplicar ao Cargo (opcional)</label>
                <select
                  value={ruleForm.roleId}
                  onChange={(e) => setRuleForm((p) => ({ ...p, roleId: e.target.value, memberId: "" }))}
                  className="input"
                  disabled={ruleLoading}
                >
                  <option value="">Nenhum cargo específico</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Aplicar ao Membro (opcional)</label>
                <select
                  value={ruleForm.memberId}
                  onChange={(e) => setRuleForm((p) => ({ ...p, memberId: e.target.value, roleId: "" }))}
                  className="input"
                  disabled={ruleLoading}
                >
                  <option value="">Nenhum membro específico</option>
                  {members.filter((m) => m.isActive).map((m) => (
                    <option key={m.id} value={m.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRuleModal(false)} className="btn flex-1" disabled={ruleLoading}>Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={ruleLoading}>
                  {ruleLoading ? <Loader className="h-4 w-4 animate-spin mx-auto" /> : "Criar Regra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" /> Transferência Manual
              </h3>
              <button onClick={() => { setShowTransferModal(false); setTransferSuccess(false); setTransferError(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              {transferSuccess ? (
                <div className="alert alert-success">Transferência realizada com sucesso!</div>
              ) : (
                <>
                  {transferError && (
                    <div className="alert alert-error text-sm">
                      <AlertCircle className="h-4 w-4 mr-2" />{transferError}
                    </div>
                  )}
                  <div>
                    <label className="label">Membro</label>
                    <select
                      value={transferForm.memberId}
                      onChange={(e) => setTransferForm((p) => ({ ...p, memberId: e.target.value }))}
                      className="input"
                      required
                      disabled={transferLoading}
                    >
                      <option value="">Selecione um membro</option>
                      {members.filter((m) => m.isActive).map((m) => (
                        <option key={m.id} value={m.id}>{m.user.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <CurrencyInput
                      label="Valor (R$)"
                      value={transferForm.amount ? Number(transferForm.amount) : 0}
                      onChange={(reais) => setTransferForm((p) => ({ ...p, amount: String(reais) }))}
                      disabled={transferLoading}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Observação (opcional)</label>
                    <input
                      type="text"
                      value={transferForm.note}
                      onChange={(e) => setTransferForm((p) => ({ ...p, note: e.target.value }))}
                      className="input"
                      placeholder="Ex: Bônus por projeto..."
                      disabled={transferLoading}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowTransferModal(false)} className="btn flex-1" disabled={transferLoading}>Cancelar</button>
                    <button type="submit" className="btn btn-primary flex-1" disabled={transferLoading}>
                      {transferLoading ? <Loader className="h-4 w-4 animate-spin mx-auto" /> : "Transferir"}
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

export default CompanySalary;
