import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ModalPortal from "../common/ModalPortal";

interface RegisterPromptClientProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToProfessional: () => void;
}

type VerificationMethod = "EMAIL" | "SMS";
type ClientStep = 1 | 2 | 3;

interface ClientFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  verificationMethod: VerificationMethod;
}

interface ClientCtaOption {
  id: string;
  title: string;
  subtitle: string;
  microcopy: string;
  metric: string;
}

const CLIENT_CTA_OPTIONS: ClientCtaOption[] = [
  {
    id: "agility",
    title: "Resolver hoje",
    subtitle: "Para quem quer agilidade total",
    microcopy: "Pedidos urgentes recebem propostas em poucos minutos.",
    metric: "Tempo medio: menos de 20 min",
  },
  {
    id: "quality",
    title: "Priorizar qualidade",
    subtitle: "Compare reputacao antes de fechar",
    microcopy: "Avaliacoes detalhadas ajudam a escolher com seguranca.",
    metric: "Media de satisfacao: 4.9/5",
  },
  {
    id: "budget",
    title: "Controlar orcamento",
    subtitle: "Negocie sem perder transparencia",
    microcopy: "Voce acompanha propostas e condicoes no mesmo lugar.",
    metric: "Mais de 50 mil servicos finalizados",
  },
];

const INITIAL_FORM: ClientFormData = {
  name: "",
  phone: "",
  email: "",
  address: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
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

const RegisterPromptClient: React.FC<RegisterPromptClientProps> = ({
  isOpen,
  onClose,
  onSwitchToProfessional,
}) => {
  const navigate = useNavigate();
  const { register, clearError, error: authError } = useAuth();

  const [step, setStep] = useState<ClientStep>(1);
  const [formData, setFormData] = useState<ClientFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [selectedCtaId, setSelectedCtaId] = useState<string>(
    CLIENT_CTA_OPTIONS[0].id,
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
    setSelectedCtaId(CLIENT_CTA_OPTIONS[0].id);
    setIsSwitchingRole(false);
    clearError();
  }, [isOpen]);

  const selectedCta = useMemo(
    () => CLIENT_CTA_OPTIONS.find((option) => option.id === selectedCtaId) || CLIENT_CTA_OPTIONS[0],
    [selectedCtaId],
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
      nextErrors.address = "Endereco e obrigatorio.";
    }

    if (formData.password.length < 8) {
      nextErrors.password = "Senha precisa ter pelo menos 8 caracteres.";
    } else if (!/[a-z]/.test(formData.password)) {
      nextErrors.password = "Senha precisa ter pelo menos uma letra minuscula.";
    } else if (!/[A-Z]/.test(formData.password)) {
      nextErrors.password = "Senha precisa ter pelo menos uma letra maiuscula.";
    } else if (!/\d/.test(formData.password)) {
      nextErrors.password = "Senha precisa ter pelo menos um numero.";
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

    if (!formData.verificationMethod) {
      nextErrors.verificationMethod = "Selecione o metodo de verificacao.";
    }

    if (formData.verificationMethod === "SMS") {
      const phoneDigits = formData.phone.replace(ONLY_DIGITS_REGEX, "");
      if (phoneDigits.length < 10) {
        nextErrors.verificationMethod = "Telefone invalido para verificacao por SMS.";
      }
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
    field: keyof ClientFormData,
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

  const handleSwitchToProfessional = () => {
    if (isSwitchingRole) return;

    setIsSwitchingRole(true);
    window.setTimeout(() => {
      onSwitchToProfessional();
    }, SWITCH_ANIMATION_DELAY_MS);
  };

  const handleSubmitRegistration = async () => {
    if (isSubmitting) return;

    if (!validateStep1() || !validateStep2()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const phoneDigits = formData.phone.replace(ONLY_DIGITS_REGEX, "");
      await register(
        {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: "CLIENT",
          ...(phoneDigits.length >= 10 ? { phone: phoneDigits } : {}),
        },
        { redirectOnSuccess: false },
      );

      localStorage.setItem(
        "client_onboarding_profile",
        JSON.stringify({
          address: formData.address.trim(),
          verificationMethod: formData.verificationMethod,
          createdAt: new Date().toISOString(),
        }),
      );

      setIsCompleted(true);
    } catch (error: any) {
      const backendErrors = error?.response?.data?.errors;
      if (backendErrors && Array.isArray(backendErrors)) {
        const message = backendErrors
          .map((e: { field: string; message: string }) => e.message)
          .join(". ");
        setSubmitError(message);
      } else {
        const message =
          error?.response?.data?.message ||
          "Nao foi possivel concluir o cadastro agora.";
        setSubmitError(message);
      }
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
          aria-label="Fechar cadastro de cliente"
        />

        <div
          className={`relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl animate-soft-pop transition-all duration-150 ${
            isSwitchingRole ? "translate-x-1 scale-[0.99] opacity-0" : "translate-x-0 scale-100 opacity-100"
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

          <div className="grid gap-0 md:grid-cols-[1fr_1.35fr]">
            <div className="relative hidden bg-slate-50 p-8 md:block">
              <div className="absolute inset-0 bg-[radial-gradient(#dbeafe_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
              <div className="relative space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  FazTudo para Clientes
                </div>

                <div>
                  <h3 className="text-3xl font-bold leading-tight text-slate-900">
                    Qual resultado voce quer primeiro?
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Escolha uma estrategia e veja como a plataforma se adapta ao seu ritmo.
                  </p>
                </div>

                <div className="space-y-2">
                  {CLIENT_CTA_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedCtaId(option.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selectedCtaId === option.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">{option.title}</p>
                      <p className="text-xs text-slate-500">{option.subtitle}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">{selectedCta.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedCta.microcopy}</p>
                  <p className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {selectedCta.metric}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm">
                  Sou Cliente
                </button>
                <button
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                  onClick={handleSwitchToProfessional}
                >
                  Sou Profissional
                </button>
              </div>

              <div className="flex flex-wrap gap-4">
                <StepBadge active={step === 1} index={1} label="Dados" />
                <StepBadge active={step === 2} index={2} label="Verificacao" />
                <StepBadge active={step === 3} index={3} label="Conclusao" />
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
                        <label className="mb-1 block text-sm font-medium text-slate-700">Endereco</label>
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
                              placeholder="Minimo 8 caracteres"
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
                      <h2 className="text-2xl font-bold text-slate-900">Etapa 2: Verificacao</h2>
                      <p className="text-sm text-slate-600">
                        Escolha como deseja validar a conta quando a verificacao for liberada.
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
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <h2 className="text-2xl font-bold text-slate-900">Etapa 3: Confirmacao</h2>
                      <p className="text-sm text-slate-600">
                        Revise os dados e finalize o cadastro de cliente.
                      </p>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <p><strong>Nome:</strong> {formData.name}</p>
                        <p><strong>E-mail:</strong> {formData.email}</p>
                        <p><strong>Telefone:</strong> {formData.phone}</p>
                        <p><strong>Endereco:</strong> {formData.address}</p>
                        <p><strong>Verificacao:</strong> {formData.verificationMethod === "EMAIL" ? "E-mail" : "SMS"}</p>
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
                        {isSubmitting ? "Criando conta..." : "Criar conta de cliente"}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </>
              )}

              {isCompleted && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-semibold">Cadastro criado com sucesso.</p>
                    <p className="mt-1">
                      Sua conta foi criada e a validacao por {formData.verificationMethod === "EMAIL" ? "e-mail" : "SMS"} sera habilitada na proxima etapa da plataforma.
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

export default RegisterPromptClient;
