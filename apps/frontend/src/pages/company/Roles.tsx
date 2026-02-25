import React, { useEffect, useState } from "react";
import {
  Shield,
  Plus,
  Loader,
  AlertCircle,
  X,
  Users,
} from "lucide-react";
import api from "../../services/api";
import { CompanyRole, CompanyPermissions } from "../../types";
import PermissionToggle from "../../components/company/PermissionToggle";

const defaultPermissions = (): CompanyPermissions => ({
  metrics: { view: false, viewTeam: false },
  chat: { view: false, respond: false, manage: false },
  orders: { view: false, assign: false, manage: false },
  finance: { view: false, transfer: false, salary: false },
  team: { view: false, invite: false, manage: false },
  catalog: { edit: false },
  company: { settings: false, roles: false },
});

interface PermissionSection {
  key: keyof CompanyPermissions;
  label: string;
  fields: { key: string; label: string; desc: string }[];
}

const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    key: "metrics",
    label: "Métricas",
    fields: [
      { key: "view", label: "Ver métricas próprias", desc: "Acesso às estatísticas pessoais" },
      { key: "viewTeam", label: "Ver métricas da equipe", desc: "Acesso às estatísticas de todos os membros" },
    ],
  },
  {
    key: "orders",
    label: "Pedidos",
    fields: [
      { key: "view", label: "Visualizar pedidos", desc: "Ver pedidos da empresa" },
      { key: "assign", label: "Designar equipe", desc: "Atribuir membros a pedidos" },
      { key: "manage", label: "Gerenciar pedidos", desc: "Aceitar, recusar e alterar status" },
    ],
  },
  {
    key: "chat",
    label: "Chat",
    fields: [
      { key: "view", label: "Ver conversas", desc: "Leitura das conversas de pedidos" },
      { key: "respond", label: "Responder", desc: "Enviar mensagens em conversas" },
      { key: "manage", label: "Gerenciar chat", desc: "Moderar e arquivar conversas" },
    ],
  },
  {
    key: "finance",
    label: "Finanças",
    fields: [
      { key: "view", label: "Ver finanças", desc: "Visualizar receitas e transações" },
      { key: "transfer", label: "Transferir fundos", desc: "Realizar transferências entre membros" },
      { key: "salary", label: "Gerenciar salários", desc: "Criar e editar regras de salário" },
    ],
  },
  {
    key: "team",
    label: "Equipe",
    fields: [
      { key: "view", label: "Ver membros", desc: "Visualizar lista de membros" },
      { key: "invite", label: "Convidar membros", desc: "Enviar convites para profissionais" },
      { key: "manage", label: "Gerenciar membros", desc: "Remover e alterar membros" },
    ],
  },
  {
    key: "catalog",
    label: "Catálogo",
    fields: [
      { key: "edit", label: "Editar serviços", desc: "Criar e editar serviços da empresa" },
    ],
  },
  {
    key: "company",
    label: "Empresa",
    fields: [
      { key: "settings", label: "Configurações", desc: "Alterar dados e configurações da empresa" },
      { key: "roles", label: "Gerenciar cargos", desc: "Criar e editar cargos e permissões" },
    ],
  },
];

const CompanyRoles: React.FC = () => {
  const [rolesList, setRolesList] = useState<CompanyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CompanyRole | null>(null);

  const [form, setForm] = useState({ name: "", level: 1 });
  const [permissions, setPermissions] = useState<CompanyPermissions>(defaultPermissions());
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRoles = () => {
    api
      .get("/company/members/roles")
      .then((r) => setRolesList(r.data.data ?? []))
      .catch((err) => setError(err.response?.data?.message || "Erro ao carregar cargos"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const openCreateModal = () => {
    setSelectedRole(null);
    setForm({ name: "", level: 1 });
    setPermissions(defaultPermissions());
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (role: CompanyRole) => {
    setSelectedRole(role);
    setForm({ name: role.name, level: role.level });
    setPermissions(role.permissions ?? defaultPermissions());
    setFormError(null);
    setShowModal(true);
  };

  const togglePermission = (
    section: keyof CompanyPermissions,
    field: string,
    value: boolean
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [section]: { ...(prev[section] as any), [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Nome do cargo é obrigatório"); return; }
    setFormLoading(true);
    setFormError(null);
    try {
      if (selectedRole) {
        const r = await api.put(`/company/members/roles/${selectedRole.id}`, { ...form, permissions });
        setRolesList((prev) => prev.map((ro) => ro.id === selectedRole.id ? r.data.data : ro));
      } else {
        const r = await api.post("/company/members/roles", { ...form, permissions });
        setRolesList((prev) => [...prev, r.data.data]);
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Erro ao salvar cargo");
    } finally {
      setFormLoading(false);
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
          <Shield className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cargos</h1>
            <p className="text-sm text-slate-500">Defina hierarquia e permissões da sua equipe</p>
          </div>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Criar Cargo
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {rolesList.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhum cargo criado</p>
          <p className="text-sm text-slate-400 mt-1">Crie cargos para organizar sua equipe e definir permissões.</p>
          <button onClick={openCreateModal} className="btn btn-primary mt-4 mx-auto">
            Criar Primeiro Cargo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rolesList.map((role) => (
            <div
              key={role.id}
              className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openEditModal(role)}
            >
              <div
                className="w-3 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: role.color ?? "#3b82f6" }}
              />
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{role.name}</p>
                <p className="text-xs text-slate-500">Nível {role.level}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Users className="h-4 w-4" />
                <span>Clique para editar</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                {selectedRole ? "Editar Cargo" : "Criar Cargo"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="alert alert-error">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nome do Cargo</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="input"
                      placeholder="Ex: Supervisor, Técnico..."
                      required
                      disabled={formLoading}
                    />
                  </div>
                  <div>
                    <label className="label">Nível (1 = mais alto)</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={form.level}
                      onChange={(e) => setForm((p) => ({ ...p, level: Number(e.target.value) }))}
                      className="input"
                      disabled={formLoading}
                    />
                  </div>
                </div>

                <div>
                  <p className="label mb-3">Permissões</p>
                  {PERMISSION_SECTIONS.map((section) => (
                    <div key={section.key} className="mb-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {section.label}
                      </p>
                      <div className="card p-2">
                        {section.fields.map((field) => (
                          <PermissionToggle
                            key={field.key}
                            label={field.label}
                            description={field.desc}
                            value={(permissions[section.key] as any)[field.key] ?? false}
                            onChange={(val) => togglePermission(section.key, field.key, val)}
                            disabled={formLoading}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex gap-3 flex-shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="btn flex-1" disabled={formLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={formLoading}>
                  {formLoading ? <Loader className="h-4 w-4 animate-spin mx-auto" /> : selectedRole ? "Salvar" : "Criar Cargo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyRoles;
