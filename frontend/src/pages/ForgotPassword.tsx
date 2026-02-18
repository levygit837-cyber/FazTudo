import { useState, FormEvent } from "react";
import { Link } from "react-router";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Ocorreu um erro. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-4">
              <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Verifique seu email
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Se uma conta existir com o email <strong>{email}</strong>, você
              receberá um link para redefinir sua senha.
            </p>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
              Não recebeu? Verifique sua caixa de spam ou{" "}
              <button
                onClick={() => setSubmitted(false)}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                tente novamente
              </button>
              .
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block text-primary-600 hover:text-primary-700 font-medium"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Esqueceu a senha?
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Digite seu email e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6"
        >
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
              placeholder="seu@email.com"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {isLoading ? "Enviando..." : "Enviar link de redefinição"}
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
