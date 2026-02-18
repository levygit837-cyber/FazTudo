import React, { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Save,
  AlertCircle,
  Loader2,
  CheckCircle,
  DollarSign,
  Clock,
  Shield,
  HardDrive,
  Power,
} from "lucide-react";
import {
  getPlatformConfig,
  updatePlatformConfig,
  type PlatformConfig,
} from "../services/adminService";

// ==================== Types ====================

interface FormErrors {
  platformFeePercentage?: string;
  escrowHoldDays?: string;
  maxFileUploadSize?: string;
}

// ==================== Skeleton ====================

const FieldSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-2">
    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
    <div className="h-10 w-full bg-slate-200 dark:bg-slate-700 rounded-lg" />
  </div>
);

// ==================== Component ====================

const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // Form state
  const [feePercentage, setFeePercentage] = useState("");
  const [holdDays, setHoldDays] = useState("");
  const [maxUpload, setMaxUpload] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlatformConfig();
      setConfig(data);
      setFeePercentage(String(data.platformFeePercentage));
      setHoldDays(String(data.escrowHoldDays));
      setMaxUpload(String(data.maxFileUploadSize));
      setMaintenanceMode(data.maintenanceMode);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar configuracoes"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const validate = (): boolean => {
    const errors: FormErrors = {};
    const fee = Number(feePercentage);
    const days = Number(holdDays);
    const upload = Number(maxUpload);

    if (isNaN(fee) || fee < 0 || fee > 50) {
      errors.platformFeePercentage = "Taxa deve ser entre 0% e 50%";
    }
    if (isNaN(days) || days < 0 || days > 365 || !Number.isInteger(days)) {
      errors.escrowHoldDays = "Dias deve ser um inteiro entre 0 e 365";
    }
    if (isNaN(upload) || upload <= 0) {
      errors.maxFileUploadSize = "Tamanho deve ser maior que 0";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setToast(null);
    try {
      const updated = await updatePlatformConfig({
        platformFeePercentage: Number(feePercentage),
        escrowHoldDays: Number(holdDays),
        maxFileUploadSize: Number(maxUpload),
        maintenanceMode,
      });
      setConfig(updated);
      setToast({ message: "Configuracoes salvas com sucesso!", type: "success" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Erro ao salvar",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // ==================== Error State ====================

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings className="text-primary-500" size={24} />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Configuracoes
          </h2>
        </div>
        <div className="card flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={48} className="text-red-400 mb-4" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => void fetchConfig()}
            className="btn bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
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
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-emerald-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Configuracoes
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Escrow Config */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <Shield size={20} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Configuracao de Escrow
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Taxas e prazos de custoia de pagamentos
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-6">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Platform Fee */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <DollarSign size={14} className="text-slate-400" />
                  Taxa da Plataforma (%)
                </label>
                <input
                  type="number"
                  value={feePercentage}
                  onChange={(e) => {
                    setFeePercentage(e.target.value);
                    setFormErrors((prev) => ({
                      ...prev,
                      platformFeePercentage: undefined,
                    }));
                  }}
                  min={0}
                  max={50}
                  step={0.1}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${
                    formErrors.platformFeePercentage
                      ? "border-red-400 dark:border-red-500"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {formErrors.platformFeePercentage && (
                  <p className="text-xs text-red-500 mt-1">
                    {formErrors.platformFeePercentage}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Porcentagem retida pela plataforma em cada transacao (0-50%)
                </p>
              </div>

              {/* Hold Days */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Clock size={14} className="text-slate-400" />
                  Dias de Retencao (Escrow)
                </label>
                <input
                  type="number"
                  value={holdDays}
                  onChange={(e) => {
                    setHoldDays(e.target.value);
                    setFormErrors((prev) => ({
                      ...prev,
                      escrowHoldDays: undefined,
                    }));
                  }}
                  min={0}
                  max={365}
                  step={1}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${
                    formErrors.escrowHoldDays
                      ? "border-red-400 dark:border-red-500"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {formErrors.escrowHoldDays && (
                  <p className="text-xs text-red-500 mt-1">
                    {formErrors.escrowHoldDays}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Numero de dias que o pagamento fica retido antes de liberar
                  (0-365)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* System Config */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <HardDrive
                size={20}
                className="text-violet-600 dark:text-violet-400"
              />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Configuracao do Sistema
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Parametros gerais da plataforma
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-6">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Max Upload Size */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <HardDrive size={14} className="text-slate-400" />
                  Tamanho Max. Upload (bytes)
                </label>
                <input
                  type="number"
                  value={maxUpload}
                  onChange={(e) => {
                    setMaxUpload(e.target.value);
                    setFormErrors((prev) => ({
                      ...prev,
                      maxFileUploadSize: undefined,
                    }));
                  }}
                  min={1}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none transition-colors ${
                    formErrors.maxFileUploadSize
                      ? "border-red-400 dark:border-red-500"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {formErrors.maxFileUploadSize && (
                  <p className="text-xs text-red-500 mt-1">
                    {formErrors.maxFileUploadSize}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  {maxUpload
                    ? `~${(Number(maxUpload) / (1024 * 1024)).toFixed(1)} MB`
                    : "—"}
                </p>
              </div>

              {/* Maintenance Mode */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  <Power size={14} className="text-slate-400" />
                  Modo de Manutencao
                </label>
                <button
                  onClick={() => setMaintenanceMode(!maintenanceMode)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                    maintenanceMode
                      ? "bg-red-500"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      maintenanceMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <p className="text-xs text-slate-400 mt-1">
                  {maintenanceMode
                    ? "Plataforma em manutencao — usuarios nao podem acessar"
                    : "Plataforma operacional"}
                </p>
              </div>

              {/* Display current config */}
              {config && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Valores Atuais
                  </h4>
                  <div className="space-y-2">
                    {(
                      Object.entries(config) as [
                        keyof PlatformConfig,
                        PlatformConfig[keyof PlatformConfig],
                      ][]
                    ).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">
                          {key}
                        </span>
                        <span className="text-slate-900 dark:text-slate-100 font-medium">
                          {typeof value === "boolean"
                            ? value
                              ? "Sim"
                              : "Nao"
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      {!loading && (
        <div className="flex justify-end">
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors disabled:opacity-50 shadow-sm"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {saving ? "Salvando..." : "Salvar Configuracoes"}
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
