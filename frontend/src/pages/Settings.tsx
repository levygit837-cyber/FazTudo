import React, { useState } from "react";
import {
  Bell,
  BookOpen,
  CreditCard,
  Eye,
  Globe,
  MapPin,
  Moon,
  Palette,
  Shield,
  Sun,
  Type,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useTour, TourId } from "../context/TourContext";

// ── Helpers ──────────────────────────────────────────────

const STORAGE_KEY = "faztudo-settings";

interface SettingsData {
  notifications: {
    email: boolean;
    push: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    messages: boolean;
  };
  privacy: {
    profilePublic: boolean;
    showPhone: boolean;
    showEmail: boolean;
  };
  appearance: {
    fontSize: "small" | "medium" | "large";
  };
  serviceArea: {
    city: string;
    state: string;
    radius: number;
  };
}

const defaultSettings: SettingsData = {
  notifications: {
    email: true,
    push: true,
    orderUpdates: true,
    promotions: false,
    messages: true,
  },
  privacy: {
    profilePublic: true,
    showPhone: false,
    showEmail: false,
  },
  appearance: {
    fontSize: "medium",
  },
  serviceArea: {
    city: "",
    state: "",
    radius: 25,
  },
};

function loadSettings(): SettingsData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return defaultSettings;
}

function saveSettings(data: SettingsData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Toggle component ─────────────────────────────────────

const Toggle: React.FC<{
  enabled: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
}> = ({ enabled, onToggle, label, description }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
        enabled ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);

// ── Section wrapper ──────────────────────────────────────

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <div className="card p-5 sm:p-6">
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    </div>
    <div className="divide-y divide-slate-100 dark:divide-slate-700">{children}</div>
  </div>
);

// ── Brazilian states ─────────────────────────────────────

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

// ── Main component ──────────────────────────────────────

const Settings: React.FC = () => {
  const { isProfessional, isClient, logout } = useAuth();
  const { resetTour } = useTour();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsData>(loadSettings);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof SettingsData>(
    section: K,
    key: keyof SettingsData[K],
    value: SettingsData[K][keyof SettingsData[K]],
  ) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [section]: { ...prev[section], [key]: value },
      };
      saveSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return next;
    });
  };

  const toggleNotif = (key: keyof SettingsData["notifications"]) => {
    update("notifications", key, !settings.notifications[key]);
  };

  const togglePrivacy = (key: keyof SettingsData["privacy"]) => {
    update("privacy", key, !settings.privacy[key]);
  };

  return (
    <div className="container-responsive py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Configuracoes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie suas preferencias e configuracoes da conta
          </p>
        </div>
        {saved && (
          <span className="rounded-lg bg-green-100 dark:bg-green-900/20 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400">
            Salvo
          </span>
        )}
      </div>

      <div className="space-y-5">
        {/* ── Notificacoes ─────────────────────────────── */}
        <Section icon={<Bell className="h-5 w-5" />} title="Notificacoes">
          <Toggle
            label="Notificacoes por e-mail"
            description="Receba atualizacoes sobre pedidos e mensagens"
            enabled={settings.notifications.email}
            onToggle={() => toggleNotif("email")}
          />
          <Toggle
            label="Notificacoes push"
            description="Receba alertas em tempo real no navegador"
            enabled={settings.notifications.push}
            onToggle={() => toggleNotif("push")}
          />
          <Toggle
            label="Atualizacoes de pedidos"
            description="Mudancas de status, confirmacoes e prazos"
            enabled={settings.notifications.orderUpdates}
            onToggle={() => toggleNotif("orderUpdates")}
          />
          <Toggle
            label="Mensagens"
            description="Novas mensagens de clientes ou profissionais"
            enabled={settings.notifications.messages}
            onToggle={() => toggleNotif("messages")}
          />
          <Toggle
            label="Promocoes e novidades"
            description="Ofertas especiais e atualizacoes da plataforma"
            enabled={settings.notifications.promotions}
            onToggle={() => toggleNotif("promotions")}
          />
        </Section>

        {/* ── Privacidade ──────────────────────────────── */}
        <Section icon={<Eye className="h-5 w-5" />} title="Privacidade">
          <Toggle
            label="Perfil publico"
            description="Outros usuarios podem ver seu perfil"
            enabled={settings.privacy.profilePublic}
            onToggle={() => togglePrivacy("profilePublic")}
          />
          <Toggle
            label="Exibir telefone"
            description="Mostrar numero de telefone no perfil"
            enabled={settings.privacy.showPhone}
            onToggle={() => togglePrivacy("showPhone")}
          />
          <Toggle
            label="Exibir e-mail"
            description="Mostrar endereco de e-mail no perfil"
            enabled={settings.privacy.showEmail}
            onToggle={() => togglePrivacy("showEmail")}
          />
        </Section>

        {/* ── Aparencia ────────────────────────────────── */}
        <Section icon={<Palette className="h-5 w-5" />} title="Aparencia">
          {/* Theme toggle */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Tema</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Escolha entre tema claro e escuro
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {theme === "light" ? (
                <>
                  <Sun className="h-4 w-4 text-amber-500" />
                  Claro
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-indigo-400" />
                  Escuro
                </>
              )}
            </button>
          </div>

          {/* Font size */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Tamanho da fonte
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ajuste o tamanho do texto da interface
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600">
              {(["small", "medium", "large"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => update("appearance", "fontSize", size)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.appearance.fontSize === size
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
                  } ${size === "small" ? "rounded-l-md" : size === "large" ? "rounded-r-md" : ""}`}
                >
                  <Type
                    className={`inline-block ${
                      size === "small" ? "h-3 w-3" : size === "medium" ? "h-4 w-4" : "h-5 w-5"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Idioma ───────────────────────────────────── */}
        <Section icon={<Globe className="h-5 w-5" />} title="Idioma">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Idioma da interface
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Outros idiomas estarao disponiveis em breve
              </p>
            </div>
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Portugues (BR)
            </span>
          </div>
        </Section>

        {/* ── Area de servico (PROFESSIONAL) ──────────── */}
        {isProfessional && (
          <Section icon={<MapPin className="h-5 w-5" />} title="Area de Servico">
            <div className="space-y-4 py-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Estado
                  </label>
                  <select
                    value={settings.serviceArea.state}
                    onChange={(e) => update("serviceArea", "state", e.target.value)}
                    className="form-input w-full"
                  >
                    <option value="">Selecione...</option>
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Cidade
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Sao Paulo"
                    value={settings.serviceArea.city}
                    onChange={(e) => update("serviceArea", "city", e.target.value)}
                    className="form-input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Raio de atendimento: {settings.serviceArea.radius} km
                </label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={settings.serviceArea.radius}
                  onChange={(e) => update("serviceArea", "radius", Number(e.target.value))}
                  className="w-full accent-primary-600"
                />
                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                  <span>5 km</span>
                  <span>100 km</span>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ── Metodo de pagamento (PROFESSIONAL) ─────── */}
        {isProfessional && (
          <Section icon={<CreditCard className="h-5 w-5" />} title="Metodo de Recebimento">
            <div className="py-3">
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
                <CreditCard className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Conta bancaria ou PIX
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Em breve voce podera configurar sua conta para recebimentos.
                </p>
                <button
                  disabled
                  className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 dark:bg-slate-700"
                >
                  Em breve
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* ── Metodo de pagamento (CLIENT) ────────────── */}
        {isClient && (
          <Section icon={<CreditCard className="h-5 w-5" />} title="Metodos de Pagamento">
            <div className="py-3">
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-slate-600">
                <CreditCard className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Cartoes e PIX
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Em breve voce podera adicionar cartoes e chaves PIX para pagamento.
                </p>
                <button
                  disabled
                  className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-400 dark:bg-slate-700"
                >
                  Em breve
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* ── Conta ────────────────────────────────────── */}
        <Section icon={<Shield className="h-5 w-5" />} title="Conta">
          <div className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Desativar conta
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sua conta sera desativada e voce podera reativar depois
                </p>
              </div>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                onClick={() => {
                  // TODO: Implement account deactivation via API
                  toast.info("Funcionalidade em desenvolvimento.");
                }}
              >
                Desativar
              </button>
            </div>
          </div>
          <div className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Excluir conta</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta acao e permanente e nao pode ser desfeita
                </p>
              </div>
              <button
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                onClick={() => setShowDeleteModal(true)}
              >
                Excluir
              </button>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Tutorial section ───────────────────────────── */}
      {(isClient || isProfessional) && (
        <Section icon={<BookOpen className="h-5 w-5" />} title="Tutorial">
          <div className="py-1">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Rever o tutorial de boas-vindas a qualquer momento.
            </p>
            <div className="flex flex-wrap gap-3">
              {isClient && (
                <button
                  onClick={() => resetTour("client" as TourId)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Rever tutorial do cliente
                </button>
              )}
              {isProfessional && (
                <button
                  onClick={() => resetTour("professional" as TourId)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-800/50 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Rever tutorial profissional
                </button>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Delete account modal ───────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Excluir conta">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Excluir conta
              </h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Esta acao e <strong>irreversivel</strong>. Todos os seus dados, pedidos e
              avaliacoes serao permanentemente removidos. Digite{" "}
              <strong className="text-red-600">EXCLUIR</strong> para confirmar.
            </p>
            <input
              type="text"
              placeholder="Digite EXCLUIR"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="form-input mb-4 w-full"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                disabled={deleteConfirmText !== "EXCLUIR"}
                onClick={() => {
                  // TODO: Implement account deletion via API
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                  toast.success("Conta excluida com sucesso.");
                  logout();
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
