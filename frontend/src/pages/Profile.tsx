import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  User as UserIcon,
  Mail,
  Phone,
  FileText,
  Shield,
  Star,
  Calendar,
  Edit3,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  MapPin,
  Briefcase,
  DollarSign,
  Camera,
  Award,
} from "lucide-react";
import { useAuth, User } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../services/api";
import { SkeletonProfile } from "../components/common/Skeleton";
import Tabs from "../components/common/Tabs";
import { formatCurrency } from "../utils/formatters";

interface ProfileFormData {
  name: string;
  phone: string;
  bio: string;
  document: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface FullProfile extends User {
  addresses?: Array<{
    id: number;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  }>;
  categories?: Array<{
    id: number;
    categoryId: number;
    experienceYears?: number;
    hourlyRate?: number;
    isPrimary: boolean;
    category?: { id: number; name: string; icon?: string };
  }>;
  serviceListings?: Array<{
    id: number;
    title: string;
    price: number;
    isAvailable: boolean;
    category?: { id: number; name: string };
  }>;
  certifications?: Array<{
    id: number;
    title: string;
    issuer: string;
    issueDate: string;
    expiryDate?: string;
  }>;
}

const Profile: React.FC = () => {
  const { updateProfile: updateAuthProfile } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("about");

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: "",
    phone: "",
    bio: "",
    document: "",
  });

  // Password states
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/auth/profile");
      const userData = response.data.data.user;
      setProfile(userData);
      setFormData({
        name: userData.name || "",
        phone: userData.phone || "",
        bio: userData.bio || "",
        document: userData.document || "",
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await api.put("/auth/profile", {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        bio: formData.bio.trim() || null,
        document: formData.document.trim() || null,
      });

      const updatedUser = response.data.data.user;
      setProfile((prev) => (prev ? { ...prev, ...updatedUser } : prev));
      updateAuthProfile(updatedUser);
      setIsEditing(false);
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      setSaveError(
        err?.response?.data?.message || "Erro ao atualizar perfil",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
    if (profile) {
      setFormData({
        name: profile.name || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
        document: profile.document || "",
      });
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordError("Preencha todos os campos.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("As senhas nao coincidem.");
      return;
    }

    setChangingPassword(true);

    try {
      await api.post("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordSection(false);
      toast.success("Senha alterada com sucesso!");
    } catch (err: any) {
      setPasswordError(
        err?.response?.data?.message || "Erro ao alterar senha",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      CLIENT: {
        label: "Cliente",
        className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
      },
      PROFESSIONAL: {
        label: "Profissional",
        className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
      },
      ADMIN: {
        label: "Administrador",
        className: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
      },
    };
    return badges[role] || badges.CLIENT;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Profile completion calculation
  const profileCompletion = useMemo(() => {
    if (!profile) return { percent: 0, missing: [] as string[] };
    const fields: Array<{ key: string; label: string; check: boolean }> = [
      { key: "name", label: "Nome", check: !!profile.name },
      { key: "phone", label: "Telefone", check: !!profile.phone },
      { key: "document", label: "CPF/CNPJ", check: !!profile.document },
      { key: "bio", label: "Sobre voce", check: !!profile.bio },
      { key: "profileImage", label: "Foto de perfil", check: !!profile.profileImage },
      { key: "verified", label: "Verificacao de identidade", check: profile.isVerified },
    ];
    if (profile.role === "PROFESSIONAL") {
      fields.push(
        { key: "categories", label: "Especialidades", check: !!(profile.categories && profile.categories.length > 0) },
        { key: "services", label: "Servicos cadastrados", check: !!(profile.serviceListings && profile.serviceListings.length > 0) },
      );
    }
    const filled = fields.filter((f) => f.check).length;
    const percent = Math.round((filled / fields.length) * 100);
    const missing = fields.filter((f) => !f.check).map((f) => f.label);
    return { percent, missing };
  }, [profile]);

  // Dynamic tabs
  const profileTabs = useMemo(() => {
    const tabs = [
      { id: "about", label: "Sobre" },
      { id: "security", label: "Seguranca" },
    ];
    if (profile?.role === "PROFESSIONAL") {
      tabs.splice(1, 0, { id: "services", label: "Servicos" });
    }
    if (profile?.addresses && profile.addresses.length > 0) {
      tabs.push({ id: "addresses", label: "Enderecos" });
    }
    return tabs;
  }, [profile]);

  if (loading) {
    return <SkeletonProfile />;
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Erro ao carregar perfil
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button onClick={loadProfile} className="btn btn-primary">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const roleBadge = getRoleBadge(profile.role);
  const initials = profile.name
    .split(" ")
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Cover Banner */}
      <div className="relative rounded-xl overflow-hidden mb-16 h-40 sm:h-48 bg-gradient-to-r from-primary-500 via-primary-600 to-indigo-600">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAyMGgyME0yMCAwdjIwTTIwIDIwaDIwTTIwIDIwdjIwIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIxIiBmaWxsPSJub25lIi8+PC9zdmc+')] opacity-30" />

        {/* Avatar overlapping the banner */}
        <div className="absolute -bottom-12 left-6 sm:left-8">
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white dark:border-slate-900 bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shadow-lg overflow-hidden">
              {profile.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt={profile.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-3xl sm:text-4xl font-bold text-primary-600 dark:text-primary-400">
                  {initials}
                </span>
              )}
            </div>
            {/* Camera overlay for upload prep */}
            <button
              type="button"
              onClick={() => toast.info("Upload de avatar sera habilitado em breve.")}
              className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors duration-200 cursor-pointer"
              aria-label="Alterar foto de perfil"
            >
              <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </button>
          </div>
        </div>

        {/* Edit button on banner */}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="absolute top-4 right-4 btn btn-sm bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Editar perfil
          </button>
        )}
      </div>

      {/* Profile header info (below banner, offset for avatar) */}
      <div className="mb-6 pl-0 sm:pl-36">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {profile.name}
          </h1>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex px-3 py-0.5 rounded-full text-xs font-medium ${roleBadge.className}`}
            >
              {roleBadge.label}
            </span>
            {profile.isVerified && (
              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Verificado
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Mail className="w-4 h-4" />
            {profile.email}
          </span>
          {profile.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-4 h-4" />
              {profile.phone}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Membro desde {formatDate(profile.createdAt)}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-6 mt-3">
          {profile.ratingAverage > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {profile.ratingAverage.toFixed(1)}
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-sm">
                ({profile.totalReviews} avaliacoes)
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(profile.balance)}
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-sm">saldo</span>
          </div>
        </div>
      </div>

      {/* Profile Completion Indicator */}
      {profileCompletion.percent < 100 && (
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Complete seu perfil</h3>
            <span className="ml-auto text-sm font-bold text-primary-600 dark:text-primary-400">{profileCompletion.percent}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 mb-3">
            <div
              className="bg-gradient-to-r from-primary-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${profileCompletion.percent}%` }}
            />
          </div>
          {profileCompletion.missing.length > 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Falta preencher: {profileCompletion.missing.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={profileTabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
        className="mb-6"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* About Tab */}
          {activeTab === "about" && (
            <>
              {/* Personal Info */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <UserIcon className="w-5 h-5" />
                    Informacoes Pessoais
                  </h2>
                  {isEditing && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="btn btn-outline btn-sm flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving || !formData.name.trim()}
                        className="btn btn-primary btn-sm flex items-center gap-1 disabled:opacity-70"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  )}
                </div>

                {saveError && (
                  <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                    {saveError}
                  </div>
                )}

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nome completo *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Seu nome completo"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="(11) 99999-9999"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        CPF / CNPJ
                      </label>
                      <input
                        type="text"
                        value={formData.document}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            document: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="000.000.000-00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Sobre voce
                      </label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, bio: e.target.value }))
                        }
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Conte um pouco sobre voce..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <InfoRow
                      icon={<UserIcon className="w-4 h-4" />}
                      label="Nome"
                      value={profile.name}
                    />
                    <InfoRow
                      icon={<Mail className="w-4 h-4" />}
                      label="Email"
                      value={profile.email}
                    />
                    <InfoRow
                      icon={<Phone className="w-4 h-4" />}
                      label="Telefone"
                      value={profile.phone || "Nao informado"}
                      muted={!profile.phone}
                    />
                    <InfoRow
                      icon={<FileText className="w-4 h-4" />}
                      label="CPF / CNPJ"
                      value={profile.document || "Nao informado"}
                      muted={!profile.document}
                    />
                    <div className="pt-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Sobre
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 text-sm whitespace-pre-line">
                        {profile.bio || "Nenhuma descricao adicionada."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Certifications in About tab */}
              {profile.certifications && profile.certifications.length > 0 && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Certificacoes
                  </h2>
                  <div className="space-y-3">
                    {profile.certifications.map((cert) => (
                      <div key={cert.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {cert.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {cert.issuer} - {formatDate(cert.issueDate)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Services Tab (Professional only) */}
          {activeTab === "services" && profile.role === "PROFESSIONAL" && (
            <>
              {/* Categories / Specialties */}
              {profile.categories && profile.categories.length > 0 && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Especialidades
                  </h2>
                  <div className="space-y-3">
                    {profile.categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                      >
                        <div>
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {cat.category?.name || "Categoria"}
                          </span>
                          {cat.isPrimary && (
                            <span className="ml-2 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded-full">
                              Principal
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          {cat.experienceYears && (
                            <span>{cat.experienceYears} anos</span>
                          )}
                          {cat.hourlyRate && (
                            <span>{formatCurrency(cat.hourlyRate)}/h</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Service Listings */}
              {profile.serviceListings && profile.serviceListings.length > 0 ? (
                <div className="card">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Servicos Cadastrados
                  </h2>
                  <div className="space-y-3">
                    {profile.serviceListings.map((svc) => (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {svc.title}
                          </p>
                          {svc.category && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{svc.category.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-sm font-semibold text-primary-600">{formatCurrency(svc.price)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${svc.isAvailable ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                            {svc.isAvailable ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card text-center py-8">
                  <Briefcase className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">Nenhum servico cadastrado ainda.</p>
                </div>
              )}
            </>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Seguranca
                </h2>
              </div>

              {!showPasswordSection ? (
                <button
                  onClick={() => setShowPasswordSection(true)}
                  className="btn btn-outline flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Alterar senha
                </button>
              ) : (
                <div className="space-y-4">
                  {passwordError && (
                    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                      {passwordError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Senha atual
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            currentPassword: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nova senha
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Minimo 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Confirmar nova senha
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowPasswordSection(false);
                        setPasswordError(null);
                        setPasswordForm({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        });
                      }}
                      className="btn btn-outline"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="btn btn-primary disabled:opacity-70"
                    >
                      {changingPassword ? "Alterando..." : "Alterar senha"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Addresses Tab */}
          {activeTab === "addresses" && profile.addresses && profile.addresses.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Enderecos
              </h2>
              <div className="space-y-3">
                {profile.addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <p>
                      {addr.street}, {addr.number}
                      {addr.complement && ` - ${addr.complement}`}
                    </p>
                    <p>
                      {addr.neighborhood} - {addr.city}/{addr.state}
                    </p>
                    <p className="text-slate-400 dark:text-slate-500">CEP: {addr.zipCode}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Status */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Conta
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">Status</span>
                <StatusBadge status={profile.status} />
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">Verificacao</span>
                {profile.isVerified ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Verificado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Pendente
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">Tipo</span>
                <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                  {roleBadge.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">Saldo</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(profile.balance)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats for Professional */}
          {profile.role === "PROFESSIONAL" && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Resumo
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Servicos</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {profile.serviceListings?.length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Especialidades</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {profile.categories?.length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Certificacoes</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {profile.certifications?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper components

const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}> = ({ icon, label, value, muted }) => (
  <div className="flex items-start gap-3 px-1">
    <span className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      <p className={`text-sm break-words ${muted ? "text-slate-400 dark:text-slate-500 italic" : "text-slate-900 dark:text-slate-100"}`}>
        {value}
      </p>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    PENDING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    SUSPENDED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    INACTIVE: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  };

  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    PENDING: "Pendente",
    SUSPENDED: "Suspenso",
    INACTIVE: "Inativo",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.INACTIVE}`}
    >
      {labels[status] || status}
    </span>
  );
};

export default Profile;
