import React, { useState, FormEvent } from "react";
import { useNavigate } from "react-router";
import { Lock, Mail, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const LoginPage: React.FC = () => {
  const { login, error, clearError, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(email, password);
      navigate("/");
    } catch {
      // error is set in context
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white font-bold text-xl mb-4 shadow-glow-blue">
            FT
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            FazTudo Admin
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Acesse o painel administrativo
          </p>
        </div>

        {/* Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error alert */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@faztudo.com"
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Senha
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          Apenas administradores podem acessar este painel.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
