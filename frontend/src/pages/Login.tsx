import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import {
  Mail,
  Lock,
  Loader,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
} from "lucide-react";
import clsx from "clsx";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error: authError, clearError } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");

  const from = location.state?.from?.pathname || "/";

  // Validação do formulário
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.password) {
      newErrors.password = "Senha é obrigatória";
    } else if (formData.password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manipulador de mudança nos campos
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

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
  };

  // Manipulador de envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await login(formData);
      // O redirecionamento é tratado no contexto de autenticação
    } catch (error: any) {
      // Erro já é tratado no contexto, mas podemos adicionar feedback adicional
      console.error("Login failed:", error);
    }
  };

  // Resetar senha
  const handleForgotPassword = () => {
    navigate("/forgot-password");
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-slate-50 dark:bg-slate-800 px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Cabeçalho */}
        <div className="text-center">
          <img src="/logo.png" alt="FazTudo" className="mx-auto mb-6 h-24 w-auto object-contain" />
           <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Bem-vindo de volta
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Entre na sua conta para continuar
          </p>
        </div>

        {/* Card do formulário */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl sm:p-8">
          {/* Erro geral */}
          {(authError || submitError) && (
            <div className="mb-6 flex items-start rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="mr-2 mt-0.5 h-5 w-5 shrink-0" />
              <span>{authError || submitError}</span>
            </div>
          )}

          {/* Mensagem de redirecionamento */}
          {from !== "/" && (
            <div className="mb-6 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
              <p className="text-sm">
                Você precisa estar logado para acessar <strong>{from}</strong>
              </p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Campo Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={clsx(
                    "w-full rounded-xl border bg-white dark:bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-600",
                    errors.email
                      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-300 dark:border-slate-600",
                  )}
                  placeholder="seu@email.com"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Campo Senha */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Senha
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  disabled={isLoading}
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={clsx(
                    "w-full rounded-xl border bg-white dark:bg-slate-900 py-2.5 pl-10 pr-10 text-sm text-slate-900 dark:text-slate-100 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-600",
                    errors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                      : "border-slate-300 dark:border-slate-600",
                  )}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Lembrar de mim */}
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 block text-sm text-slate-700 dark:text-slate-300"
              >
                Lembrar de mim
              </label>
            </div>

            {/* Botão de envio */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full rounded-xl bg-primary-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader className="mr-2 inline h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Divisor */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 dark:text-slate-400">
                  Ou continue com
                </span>
              </div>
            </div>

            {/* Login social (placeholders) */}
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
                <svg
                  className="mr-2 h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-2 16h-2v-6h2v6zm-1-6.891c-.607 0-1.1-.496-1.1-1.109 0-.612.492-1.109 1.1-1.109s1.1.497 1.1 1.109c0 .613-.493 1.109-1.1 1.109zm8 6.891h-1.998v-3.862c0-1.881-2.002-1.722-2.002 0v3.862h-2v-6h2v1.093c.872-1.616 4-1.736 4 1.548v3.359z" />
                </svg>
                LinkedIn
              </button>
            </div>
          </div>

          {/* Link para registro */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Não tem uma conta?{" "}
              <Link
                to="/register"
                className="font-semibold text-primary-600 hover:text-primary-700"
              >
                Cadastre-se gratuitamente
              </Link>
            </p>
          </div>
        </div>

        {/* Informações de segurança */}
        <div className="space-y-2 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>
            Ao entrar, você concorda com nossos{" "}
            <Link
              to="/termos"
              className="underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              Termos de Servico
            </Link>{" "}
            e{" "}
            <Link
              to="/privacidade"
              className="underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              Politica de Privacidade
            </Link>
          </p>
          <p className="flex items-center justify-center">
            <Shield className="w-3 h-3 mr-1" />
            Seus dados estão seguros conosco
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
