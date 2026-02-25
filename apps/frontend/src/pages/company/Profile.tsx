import React, { useEffect, useState } from "react";
import {
  Building2,
  Globe,
  Phone,
  FileText,
  Loader,
  CheckCircle,
  Clock,
  Save,
  AlertCircle,
} from "lucide-react";
import api from "../../services/api";
import { CompanyProfile as CompanyProfileType } from "../../types";

interface ProfileForm {
  companyName: string;
  description: string;
  website: string;
  phone: string;
  industry: string;
}

const CompanyProfile: React.FC = () => {
  const [profile, setProfile] = useState<CompanyProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<ProfileForm>({
    companyName: "",
    description: "",
    website: "",
    phone: "",
    industry: "",
  });

  useEffect(() => {
    api
      .get("/company/profile")
      .then((r) => {
        const p: CompanyProfileType = r.data.data;
        setProfile(p);
        setForm({
          companyName: p.companyName ?? "",
          description: p.description ?? "",
          website: p.website ?? "",
          phone: p.phone ?? "",
          industry: p.industry ?? "",
        });
      })
      .catch((err) => setError(err.response?.data?.message || "Erro ao carregar perfil"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const r = await api.put("/company/profile", form);
      setProfile(r.data.data);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
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
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Building2 className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Perfil da Empresa</h1>
          <p className="text-sm text-slate-500">Atualize as informações públicas da sua empresa</p>
        </div>
        {profile && (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
              profile.isVerified
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
            }`}
          >
            {profile.isVerified ? (
              <><CheckCircle className="h-4 w-4" /> Verificada</>
            ) : (
              <><Clock className="h-4 w-4" /> Verificação Pendente</>
            )}
          </span>
        )}
      </div>

      <div className="card p-6">
        {error && (
          <div className="alert alert-error mb-4">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success mb-4">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span>Perfil atualizado com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company Name */}
          <div>
            <label htmlFor="companyName" className="label">Nome da Empresa</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                id="companyName"
                name="companyName"
                type="text"
                value={form.companyName}
                onChange={handleChange}
                className="input pl-10"
                placeholder="Razão Social ou Nome Fantasia"
                required
                disabled={saving}
              />
            </div>
          </div>

          {/* Industry */}
          <div>
            <label htmlFor="industry" className="label">Segmento / Setor</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                id="industry"
                name="industry"
                type="text"
                value={form.industry}
                onChange={handleChange}
                className="input pl-10"
                placeholder="Ex: Tecnologia, Construção, Limpeza..."
                disabled={saving}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="label">Descrição</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              className="input resize-none"
              placeholder="Descreva sua empresa, serviços oferecidos e diferenciais..."
              disabled={saving}
            />
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="label">Website</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                id="website"
                name="website"
                type="url"
                value={form.website}
                onChange={handleChange}
                className="input pl-10"
                placeholder="https://www.suaempresa.com.br"
                disabled={saving}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="label">Telefone Comercial</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                className="input pl-10"
                placeholder="(99) 99999-9999"
                disabled={saving}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader className="h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="h-4 w-4" /> Salvar Alterações</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyProfile;
