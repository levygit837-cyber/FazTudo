import { useState, FormEvent } from "react";
import { Link, useParams, useNavigate } from "react-router";
import api from "../services/api";

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordRequirements = [
    { label: "Pelo menos 8 caracteres", test: (p: string) => p.length >= 8 },
    { label: "Uma letra maiúscula", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Uma letra minúscula", test: (p: string) => /[a-z]/.test(p) },
    { label: "Um número", test: (p: string) => /\d/.test(p) },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    const allMet = passwordRequirements.every((r) => r.test(newPassword));
    if (!allMet) {
      setError("A senha não atende todos os requisitos.");
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Token inválido ou expirado. Solicite um novo link."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Link inválido
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Este link de redefinição de senha é inválido.
          </p>
          <Link
            to="/forgot-password"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-md w-full text-center bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Senha redefinida!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Sua senha foi alterada com sucesso. Redirecionando para o login...
          </p>
          <Link
            to="/login"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            Redefinir senha
          </h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Digite sua nova senha abaixo.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Nova senha
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
              placeholder="Nova senha"
              disabled={isLoading}
            />
          </div>

          {/* Password requirements checklist */}
          {newPassword.length > 0 && (
            <ul className="space-y-1">
              {passwordRequirements.map((req) => (
                <li
                  key={req.label}
                  className={`flex items-center text-sm ${
                    req.test(newPassword)
                      ? "text-green-600 dark:text-green-400"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {req.test(newPassword) ? (
                    <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {req.label}
                </li>
              ))}
            </ul>
          )}

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Confirmar nova senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
              placeholder="Confirme a nova senha"
              disabled={isLoading}
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                As senhas não coincidem
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !newPassword || !confirmPassword}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isLoading ? "Redefinindo..." : "Redefinir senha"}
          </button>

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Voltar ao login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
