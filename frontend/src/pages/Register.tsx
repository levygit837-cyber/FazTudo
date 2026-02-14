import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Briefcase,
  Users,
  FileText,
  AlertCircle,
  Loader,
  CheckCircle,
  Shield,
  Check,
  X as XIcon,
} from "lucide-react";
import clsx from "clsx";

const parseRoleParam = (roleParam?: string | null): "CLIENT" | "PROFESSIONAL" => {
  const normalizedRole = roleParam?.toLowerCase().trim();

  if (
    normalizedRole === "professional" ||
    normalizedRole === "profissional" ||
    normalizedRole === "pro"
  ) {
    return "PROFESSIONAL";
  }

  return "CLIENT";
};

const Register: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { register, isLoading, error: authError, clearError } = useAuth();

  const roleFromQuery = parseRoleParam(searchParams.get("role"));

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: roleFromQuery,
    document: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const passwordStrength = useMemo(() => {
    const pw = formData.password;
    if (!pw) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return { score, label: "Fraca", color: "bg-red-500" };
    if (score <= 3) return { score, label: "Razoavel", color: "bg-yellow-500" };
    if (score <= 4) return { score, label: "Boa", color: "bg-blue-500" };
    return { score, label: "Forte", color: "bg-green-500" };
  }, [formData.password]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      role: roleFromQuery,
      document: roleFromQuery === "CLIENT" ? "" : prev.document,
    }));
  }, [roleFromQuery]);

  // Validação do formulário
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Nome
    if (!formData.name.trim()) {
      newErrors.name = "Nome completo é obrigatório";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Nome deve ter pelo menos 3 caracteres";
    }

    // Email
    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    // Telefone (opcional, mas se preenchido, deve ser válido)
    if (formData.phone && !/^\(\d{2}\) \d{5}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = "Telefone inválido. Use (99) 99999-9999";
    }

    // Senha
    if (!formData.password) {
      newErrors.password = "Senha é obrigatória";
    } else if (formData.password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres";
    } else if (!/(?=.*[A-Z])/.test(formData.password)) {
      newErrors.password = "Senha deve conter pelo menos uma letra maiúscula";
    } else if (!/(?=.*\d)/.test(formData.password)) {
      newErrors.password = "Senha deve conter pelo menos um número";
    }

    // Confirmação de senha
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirme sua senha";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "As senhas não coincidem";
    }

    // Documento (CPF/CNPJ) para profissionais
    if (formData.role === "PROFESSIONAL" && !formData.document.trim()) {
      newErrors.document = "CPF/CNPJ é obrigatório para profissionais";
    } else if (formData.document.trim()) {
      const doc = formData.document.replace(/\D/g, "");
      if (doc.length !== 11 && doc.length !== 14) {
        newErrors.document = "CPF deve ter 11 dígitos ou CNPJ 14 dígitos";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    }
  };

  // Formatar CPF/CNPJ
  const formatDocument = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else {
      return numbers.replace(
        /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
        "$1.$2.$3/$4-$5",
      );
    }
  };

  // Manipulador de mudança nos campos
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Aplicar formatação específica
    if (name === "phone") {
      formattedValue = formatPhone(value);
    } else if (name === "document") {
      formattedValue = formatDocument(value);
    }

    setFormData((prev) => ({ ...prev, [name]: formattedValue }));

    // Limpar erro do campo quando o usuário começa a digitar
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (submitError) {
      setSubmitError("");
    }
    if (authError) {
      clearError();
    }
    if (success) {
      setSuccess(false);
    }
  };

  // Manipulador de seleção de role
  const handleRoleChange = (role: "CLIENT" | "PROFESSIONAL") => {
    setFormData((prev) => ({
      ...prev,
      role,
      document: role === "CLIENT" ? "" : prev.document,
    }));

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("role", role === "PROFESSIONAL" ? "professional" : "client");
    setSearchParams(nextParams, { replace: true });

    if (errors.role) {
      setErrors((prev) => ({ ...prev, role: "" }));
    }
    if (errors.document && role === "CLIENT") {
      setErrors((prev) => ({ ...prev, document: "" }));
    }
  };

  // Manipulador de envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Preparar dados para envio (remover formatação de telefone e documento)
      const submitData = {
        ...formData,
        phone: formData.phone ? formData.phone.replace(/\D/g, "") : undefined,
        document: formData.document
          ? formData.document.replace(/\D/g, "")
          : undefined,
        confirmPassword: undefined,
      };

      await register(submitData);
      setSuccess(true);
      // O redirecionamento é tratado no contexto de autenticação
    } catch (error: any) {
      console.error("Registration failed:", error);
      setSubmitError(
        error.response?.data?.message ||
          "Erro ao criar conta. Tente novamente.",
      );
    }
  };

  // Limpar todos os erros
  const clearAllErrors = () => {
    setErrors({});
    setSubmitError("");
    clearError();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Cabeçalho */}
        <div className="text-center">
          <img src="/logo.png" alt="FazTudo" className="mx-auto mb-6 h-24 w-auto object-contain" />
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Crie sua conta
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Junte-se a milhares de profissionais e clientes
          </p>
        </div>

        {/* Card do formulário */}
        <div className="card p-8">
          {/* Mensagem de sucesso */}
          {success && (
            <div className="alert alert-success mb-6">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span>Conta criada com sucesso! Redirecionando...</span>
            </div>
          )}

          {/* Erro geral */}
          {(authError || submitError) && (
            <div className="alert alert-error mb-6">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>{authError || submitError}</span>
              <button
                onClick={clearAllErrors}
                className="ml-auto text-sm underline"
              >
                Fechar
              </button>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {/* Seleção de tipo de conta */}
            <div>
              <label className="label mb-3">Tipo de conta</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleRoleChange("CLIENT")}
                  className={clsx(
                    "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                    formData.role === "CLIENT"
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                  )}
                >
                  <Users className={clsx("w-6 h-6 mb-2", formData.role === "CLIENT" && "text-primary-600 dark:text-primary-400")} />
                  <span className={clsx("font-medium", formData.role === "CLIENT" && "text-primary-700 dark:text-primary-300")}>Cliente</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Contratar serviços
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange("PROFESSIONAL")}
                  className={clsx(
                    "flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
                    formData.role === "PROFESSIONAL"
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
                  )}
                >
                  <Briefcase className={clsx("w-6 h-6 mb-2", formData.role === "PROFESSIONAL" && "text-primary-600 dark:text-primary-400")} />
                  <span className={clsx("font-medium", formData.role === "PROFESSIONAL" && "text-primary-700 dark:text-primary-300")}>Profissional</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Oferecer serviços
                  </span>
                </button>
              </div>
              {errors.role && <p className="form-error mt-2">{errors.role}</p>}
            </div>

            {/* Campo Nome */}
            <div>
              <label htmlFor="name" className="label">
                Nome completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={clsx("input pl-10", errors.name && "input-error")}
                  placeholder="Seu nome completo"
                  disabled={isLoading}
                />
              </div>
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            {/* Campo Email */}
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={clsx("input pl-10", errors.email && "input-error")}
                  placeholder="seu@email.com"
                  disabled={isLoading}
                />
              </div>
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            {/* Campo Telefone */}
            <div>
              <label htmlFor="phone" className="label">
                Telefone <span className="text-slate-500 dark:text-slate-400">(opcional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className={clsx("input pl-10", errors.phone && "input-error")}
                  placeholder="(99) 99999-9999"
                  disabled={isLoading}
                />
              </div>
              {errors.phone && <p className="form-error">{errors.phone}</p>}
            </div>

            {/* Campo Documento (apenas para profissionais) */}
            {formData.role === "PROFESSIONAL" && (
              <div>
                <label htmlFor="document" className="label">
                  CPF/CNPJ
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <input
                    id="document"
                    name="document"
                    type="text"
                    value={formData.document}
                    onChange={handleChange}
                    className={clsx(
                      "input pl-10",
                      errors.document && "input-error",
                    )}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    disabled={isLoading}
                  />
                </div>
                {errors.document && (
                  <p className="form-error">{errors.document}</p>
                )}
              </div>
            )}

            {/* Campo Senha */}
            <div>
              <label htmlFor="password" className="label">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={clsx(
                    "input pl-10 pr-10",
                    errors.password && "input-error",
                  )}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="form-error">{errors.password}</p>
              )}
              {formData.password && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                            i <= Math.ceil(passwordStrength.score / 1.5)
                              ? passwordStrength.color
                              : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span
                      className={`text-xs font-medium ${passwordStrength.color.replace(
                        "bg-",
                        "text-",
                      )}`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {[
                      {
                        check: formData.password.length >= 6,
                        text: "Pelo menos 6 caracteres",
                      },
                      {
                        check: /[A-Z]/.test(formData.password),
                        text: "Uma letra maiuscula",
                      },
                      {
                        check: /\d/.test(formData.password),
                        text: "Um numero",
                      },
                      {
                        check: /[^A-Za-z0-9]/.test(formData.password),
                        text: "Um caractere especial (opcional)",
                      },
                    ].map((rule, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        {rule.check ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <XIcon className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                        )}
                        <span
                          className={
                            rule.check
                              ? "text-green-600 dark:text-green-400"
                              : "text-slate-400 dark:text-slate-500"
                          }
                        >
                          {rule.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Campo Confirmar Senha */}
            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirmar senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={clsx(
                    "input pl-10 pr-10",
                    errors.confirmPassword && "input-error",
                  )}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="form-error">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Termos e condições */}
            <div className="flex items-start">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-600 rounded mt-1"
                disabled={isLoading}
              />
              <label
                htmlFor="terms"
                className="ml-2 block text-sm text-slate-700 dark:text-slate-300"
              >
                Concordo com os{" "}
                <Link
                  to="/terms"
                  className="text-primary-600 hover:text-primary-800"
                >
                  Termos de Serviço
                </Link>{" "}
                e{" "}
                <Link
                  to="/privacy"
                  className="text-primary-600 hover:text-primary-800"
                >
                  Política de Privacidade
                </Link>
              </label>
            </div>

            {/* Botão de envio */}
            <button
              type="submit"
              disabled={isLoading || success}
              className="btn btn-primary w-full py-3 text-base font-semibold relative"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin inline" />
                  Criando conta...
                </>
              ) : (
                `Criar conta como ${formData.role === "PROFESSIONAL" ? "Profissional" : "Cliente"}`
              )}
            </button>
          </form>

          {/* Social login divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">
                  Ou cadastre-se com
                </span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-70"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
              <button
                type="button"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-70"
              >
                <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.496-1.1-1.109 0-.612.492-1.109 1.1-1.109s1.1.497 1.1 1.109c0 .613-.493 1.109-1.1 1.109zm8 6.891h-1.998v-3.862c0-1.881-2.002-1.722-2.002 0v3.862h-2v-6h2v1.093c.872-1.616 4-1.736 4 1.548v3.359z" />
                </svg>
                LinkedIn
              </button>
            </div>
          </div>

          {/* Link para login */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Já tem uma conta?{" "}
              <Link
                to="/login"
                className="font-semibold text-primary-600 hover:text-primary-800"
              >
                Faça login
              </Link>
            </p>
          </div>
        </div>

        {/* Informações de segurança */}
        <div className="text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
          <p>
            <Shield className="w-3 h-3 mr-1 inline" />
            Seus dados estão seguros conosco. Nunca compartilhamos suas
            informações.
          </p>
          <p className="text-slate-400 dark:text-slate-500">
            Em caso de dúvidas, entre em contato:{" "}
            <a
              href="mailto:support@faztudo.com"
              className="underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              support@faztudo.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
