import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ModalPortal from "../common/ModalPortal";

interface RegisterPromptProfessionalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToClient: () => void;
}

type ProfessionalStep = 1 | 2 | 3;
type VerificationMethod = "EMAIL" | "SMS";
type PricingModel = "HOUR" | "SERVICE" | "NEGOTIATE";

interface ProfessionalFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  serviceRadiusKm: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  mainCategories: string;
  subcategories: string;
  experienceValue: string;
  experienceUnit: "years" | "months";
  pricingModel: PricingModel;
  acceptedServiceRules: boolean;
  verificationMethod: VerificationMethod;
}

interface ProfessionalGoal {
  id: string;
  title: string;
  subtitle: string;
  microcopy: string;
  metric: string;
}

const PROFESSIONAL_GOALS: ProfessionalGoal[] = [
  {
    id: "agenda",
    title: "Lotar agenda",
    subtitle: "Receber mais pedidos qualificados",
    microcopy: "Mantenha sua vitrine ativa para aparecer em novas buscas todos os dias.",
    metric: "Media de novos pedidos por semana: 8+",
  },
  {
    id: "ticket",
    title: "Aumentar ticket medio",
    subtitle: "Valorizar servico com reputacao",
    microcopy: "Perfis com avaliacoes consistentes tendem a fechar com tickets maiores.",
    metric: "Profissionais em destaque crescem faturamento todo mes",
  },
  {
    id: "recorrencia",
    title: "Ganhar recorrencia",
    subtitle: "Transformar clientes em parceiros",
    microcopy: "Organize servicos recorrentes e mantenha previsibilidade de renda.",
    metric: "Clientes recorrentes elevam previsibilidade do caixa",
  },
];

const INITIAL_FORM: ProfessionalFormData = {
  name: "",
  phone: "",
  email: "",
  address: "",
  serviceRadiusKm: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
  mainCategories: "",
  subcategories: "",
  experienceValue: "",
  experienceUnit: "years",
  pricingModel: "HOUR",
  acceptedServiceRules: false,
  verificationMethod: "EMAIL",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONLY_DIGITS_REGEX = /\D/g;
const SWITCH_ANIMATION_DELAY_MS = 170;

const formatPhone = (value: string): string => {
  const digits = value.replace(ONLY_DIGITS_REGEX, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const toList = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const StepBadge: React.FC<{ active: boolean; label: string; index: number }> = ({
  active,
  label,
  index,
}) => (
  <div className="inline-flex items-center gap-2">
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
        active
          ? "bg-primary-600 text-white"
          : "bg-slate-200 text-slate-600"
      }`}
    >
      {index}
    </span>
    <span className={`text-xs font-medium ${active ? "text-slate-900" : "text-slate-500"}`}>
      {label}
    </span>
  </div>
);

const RegisterPromptProfessional: React.FC<RegisterPromptProfessionalProps> = ({
  isOpen,
  onClose,
  onSwitchToClient,
}) => {
  const navigate = useNavigate();
  const { register, clearError, error: authError } = useAuth();

  const [step, setStep] = useState<ProfessionalStep>(1);
  const [formData, setFormData] = useState<ProfessionalFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    PROFESSIONAL_GOALS[0].id,
  );
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setFormData(INITIAL_FORM);
    setErrors({});
    setSubmitError("");
    setIsSubmitting(false);
    setIsCompleted(false);
    setSelectedGoalId(PROFESSIONAL_GOALS[0].id);
    setIsSwitchingRole(false);
    clearError();
  }, [isOpen]);

  const selectedGoal = useMemo(
    () =>
      PROFESSIONAL_GOALS.find((goal) => goal.id === selectedGoalId) ||
      PROFESSIONAL_GOALS[0],
    [selectedGoalId],
  );

  const combinedError = useMemo(
    () => submitError || authError || "",
    [authError, submitError],
  );

  if (!isOpen) return null;

  const validateStep1 = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      nextErrors.name = "Nome completo e obrigatorio.";
    }

    const phoneDigits = formData.phone.replace(ONLY_DIGITS_REGEX, "");
    if (phoneDigits.length < 10) {
      nextErrors.phone = "Telefone invalido.";
    }

    if (!EMAIL_REGEX.test(formData.email.trim())) {
      nextErrors.email = "E-mail invalido.";
    }

    if (!formData.address.trim()) {
      nextErrors.address = "Endereco completo e obrigatorio.";
    }

    const serviceRadius = Number(formData.serviceRadiusKm);
    if (!Number.isFinite(serviceRadius) || serviceRadius <= 0) {
      nextErrors.serviceRadiusKm = "Informe um raio de atendimento valido.";
    }

    if (formData.password.length < 6) {
      nextErrors.password = "Senha precisa ter pelo menos 6 caracteres.";
    }

    if (formData.confirmPassword !== formData.password) {
      nextErrors.confirmPassword = "As senhas nao coincidem.";
    }

    if (!formData.acceptedTerms) {
      nextErrors.acceptedTerms = "Aceite os termos para continuar.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!formData.mainCategories.trim()) {
      nextErrors.mainCategories = "Informe ao menos uma categoria principal.";
    }

    const experienceValue = Number(formData.experienceValue);
    if (!Number.isFinite(experienceValue) || experienceValue <= 0) {
      nextErrors.experienceValue = "Informe a experiencia em anos ou meses.";
    }

    if (!formData.pricingModel) {
      nextErrors.pricingModel = "Selecione a forma de cobranca.";
    }

    if (!formData.acceptedServiceRules) {
      nextErrors.acceptedServiceRules = "Aceite as regras de prestacao para continuar.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!formData.verificationMethod) {
      nextErrors.verificationMethod = "Selecione o metodo de verificacao.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;

    setErrors({});
    setSubmitError("");
    setStep((previousStep) => {
      if (previousStep === 1) return 2;
      return 3;
    });
  };

  const handlePreviousStep = () => {
    setErrors({});
    setSubmitError("");
    setStep((previousStep) => {
      if (previousStep === 3) return 2;
      return 1;
    });
  };

  const handleFieldChange = (
    field: keyof ProfessionalFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }

    if (submitError) {
      setSubmitError("");
    }

    if (authError) {
      clearError();
    }
  };

  const handleSwitchToClient = () => {
    if (isSwitchingRole) return;

    setIsSwitchingRole(true);
    window.setTimeout(() => {
      onSwitchToClient();
    }, SWITCH_ANIMATION_DELAY_MS);
  };

  const handleSubmitRegistration = async () => {
    if (isSubmitting) return;

    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await register(
        {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.replace(ONLY_DIGITS_REGEX, ""),
          password: formData.password,
          role: "PROFESSIONAL",
        },
        { redirectOnSuccess: false },
      );

      localStorage.setItem(
        "professional_onboarding_profile",
        JSON.stringify({
          fullAddress: formData.address.trim(),
          serviceRadiusKm: Number(formData.serviceRadiusKm),
          mainCategories: toList(formData.mainCategories),
          subcategories: toList(formData.subcategories),
          experienceValue: Number(formData.experienceValue),
          experienceUnit: formData.experienceUnit,
          pricingModel: formData.pricingModel,
          verificationMethod: formData.verificationMethod,
          createdAt: new Date().toISOString(),
        }),
      );

      setIsCompleted(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        "Nao foi possivel concluir o cadastro profissional agora.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <button
          className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Fechar cadastro profissional"
        />

        <div
          className={`relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-soft-pop transition-all duration-150 ${
            isSwitchingRole ? "-translate-x-1 scale-[0.99] opacity-0" : "translate-x-0 scale-100 opacity-100"
          }`}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="grid gap-0 md:grid-cols-[1fr_1.45fr]">
            <div className="hidden bg-slate-900 p-8 text-white md:block">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  <Briefcase className="h-3.5 w-3.5" />
                  FazTudo Pro
                </div>

                <div>
                  <h3 className="text-3xl font-bold leading-tight">
                    Qual crescimento voce quer acelerar?
                  </h3>
                  <p className="mt-2 text-sm text-slate-200">
                    Escolha um foco e veja como posicionar seu perfil para escalar resultados.
                  </p>
                </div>

                <div className="space-y-2">
                  {PROFESSIONAL_GOALS.map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setSelectedGoalId(goal.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selectedGoalId === goal.id
                          ? "border-white/50 bg-white/10"
                          : "border-white/20 bg-white/5 hover:border-white/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">{goal.title}</p>
                      <p className="text-xs text-slate-200">{goal.subtitle}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-white/20 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white">{selectedGoal.title}</p>
                  <p className="mt-1 text-sm text-slate-100">{selectedGoal.microcopy}</p>
                  <p className="mt-3 inline-flex rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white">
                    {selectedGoal.metric}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                  onClick={handleSwitchToClient}
                >
                  Sou Cliente
                </button>
                <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm">
                  Sou Profissional
                </button>
              </div>

              <div className="flex flex-wrap gap-4">
                <StepBadge active={step === 1} index={1} label="Dados" />
                <StepBadge active={step === 2} index={2} label="Atuacao" />
                <StepBadge active={step === 3} index={3} label="Validacao" />
              </div>

              {combinedError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {combinedError}
                </div>
              )}

              {!isCompleted && (
                <>
                  {step === 1 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-slate-900">Etapa 1: Dados pessoais</h2>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Nome completo</label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(event) => handleFieldChange("name", event.target.value)}
                            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                            placeholder="Seu nome completo"
                            autoComplete="name"
                          />
                        </div>
                        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Telefone</label>
                          <div className="relative">
                            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="tel"
                              value={formData.phone}
                              onChange={(event) =>
                                handleFieldChange("phone", formatPhone(event.target.value))
                              }
                              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                              placeholder="(11) 99999-9999"
                              autoComplete="tel"
                            />
                          </div>
                          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="email"
                              value={formData.email}
                              onChange={(event) => handleFieldChange("email", event.target.value)}
                              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                              placeholder="seu@email.com"
                              autoComplete="email"
                            />
                          </div>
                          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Endereco completo</label>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={formData.address}
                            onChange={(event) => handleFieldChange("address", event.target.value)}
                            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                            placeholder="Rua, numero, bairro, cidade"
                            autoComplete="street-address"
                          />
                        </div>
                        {errors.address && <p className="mt-1 text-xs text-red-600">{errors.address}</p>}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Raio de atendimento (km)</label>
                        <input
                          type="number"
                          min={1}
                          value={formData.serviceRadiusKm}
                          onChange={(event) => handleFieldChange("serviceRadiusKm", event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                          placeholder="Ex: 15"
                        />
                        {errors.serviceRadiusKm && (
                          <p className="mt-1 text-xs text-red-600">{errors.serviceRadiusKm}</p>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="password"
                              value={formData.password}
                              onChange={(event) => handleFieldChange("password", event.target.value)}
                              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                              placeholder="Minimo 6 caracteres"
                              autoComplete="new-password"
                            />
                          </div>
                          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Confirmar senha</label>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              type="password"
                              value={formData.confirmPassword}
                              onChange={(event) =>
                                handleFieldChange("confirmPassword", event.target.value)
                              }
                              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                              placeholder="Repita a senha"
                              autoComplete="new-password"
                            />
                          </div>
                          {errors.confirmPassword && (
                            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
                          )}
                        </div>
                      </div>

                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={formData.acceptedTerms}
                          onChange={(event) =>
                            handleFieldChange("acceptedTerms", event.target.checked)
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span>Li e aceito os termos de uso e politica de privacidade.</span>
                      </label>
                      {errors.acceptedTerms && (
                        <p className="text-xs text-red-600">{errors.acceptedTerms}</p>
                      )}
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-slate-900">Etapa 2: Dados de atuacao</h2>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Categorias principais de servico</label>
                        <input
                          type="text"
                          value={formData.mainCategories}
                          onChange={(event) => handleFieldChange("mainCategories", event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                          placeholder="Ex: Eletrica, Hidraulica"
                        />
                        {errors.mainCategories && (
                          <p className="mt-1 text-xs text-red-600">{errors.mainCategories}</p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Subcategorias (opcional)</label>
                        <input
                          type="text"
                          value={formData.subcategories}
                          onChange={(event) => handleFieldChange("subcategories", event.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                          placeholder="Ex: Instalacao de chuveiro, manutencao preventiva"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Experiencia</label>
                          <input
                            type="number"
                            min={1}
                            value={formData.experienceValue}
                            onChange={(event) => handleFieldChange("experienceValue", event.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                            placeholder="Ex: 3"
                          />
                          {errors.experienceValue && (
                            <p className="mt-1 text-xs text-red-600">{errors.experienceValue}</p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">Unidade</label>
                          <select
                            value={formData.experienceUnit}
                            onChange={(event) =>
                              handleFieldChange("experienceUnit", event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                          >
                            <option value="years">Anos</option>
                            <option value="months">Meses</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Forma de cobranca</label>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {[
                            { value: "HOUR", label: "Por hora" },
                            { value: "SERVICE", label: "Por servico" },
                            { value: "NEGOTIATE", label: "Combinar" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => handleFieldChange("pricingModel", option.value)}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                formData.pricingModel === option.value
                                  ? "border-primary-500 bg-primary-50 text-primary-700"
                                  : "border-slate-300 text-slate-700 hover:border-slate-400"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        {errors.pricingModel && (
                          <p className="mt-1 text-xs text-red-600">{errors.pricingModel}</p>
                        )}
                      </div>

                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={formData.acceptedServiceRules}
                          onChange={(event) =>
                            handleFieldChange("acceptedServiceRules", event.target.checked)
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span>Concordo com os termos e regras de prestacao de servicos.</span>
                      </label>
                      {errors.acceptedServiceRules && (
                        <p className="text-xs text-red-600">{errors.acceptedServiceRules}</p>
                      )}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-slate-900">Etapa 3: Validacao inicial</h2>
                      <p className="text-sm text-slate-600">
                        Selecione como receber a verificacao da conta apos concluir o cadastro.
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleFieldChange("verificationMethod", "EMAIL")}
                          className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                            formData.verificationMethod === "EMAIL"
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-slate-300 text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          <span className="mb-1 block font-semibold">E-mail</span>
                          <span className="text-xs text-slate-500">Codigo enviado para {formData.email || "seu e-mail"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFieldChange("verificationMethod", "SMS")}
                          className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                            formData.verificationMethod === "SMS"
                              ? "border-primary-500 bg-primary-50 text-primary-700"
                              : "border-slate-300 text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          <span className="mb-1 block font-semibold">SMS</span>
                          <span className="text-xs text-slate-500">Codigo enviado para {formData.phone || "seu telefone"}</span>
                        </button>
                      </div>

                      {errors.verificationMethod && (
                        <p className="text-xs text-red-600">{errors.verificationMethod}</p>
                      )}

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <p className="font-semibold">KYC sera solicitado depois no perfil.</p>
                        <p className="mt-1">
                          Para aceitar servicos, o profissional precisara concluir KYC verificado no perfil (CPF/CNPJ, documento com foto e selfie).
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    {step > 1 ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                        onClick={handlePreviousStep}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar
                      </button>
                    ) : (
                      <div />
                    )}

                    {step < 3 ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                        onClick={handleNextStep}
                      >
                        Proxima etapa
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                        onClick={handleSubmitRegistration}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Criando conta..." : "Criar conta profissional"}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </>
              )}

              {isCompleted && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-semibold">Cadastro profissional concluido.</p>
                    <p className="mt-1">
                      Conta criada com sucesso. O KYC sera concluido depois no perfil, antes de aceitar servicos.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                      onClick={() => navigate("/verify-email")}
                    >
                      Continuar
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                      onClick={onClose}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RegisterPromptProfessional;
