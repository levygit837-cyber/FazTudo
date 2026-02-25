import React from "react";
import { Link } from "react-router";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const VerifyAccount: React.FC = () => {
  const { user } = useAuth();

  // Usuário já verificado: mostrar tela de confirmação
  if (user?.isVerified) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center px-4 py-10">
        <div className="card w-full border border-slate-200 dark:border-slate-700 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Conta verificada!
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            {user?.name ? `${user.name}, sua` : "Sua"} identidade já foi verificada com sucesso.
            Você tem acesso completo à plataforma.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/professional/dashboard" className="btn btn-primary">
              Ir para o painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Usuário não verificado: mostrar instrução de verificação
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center px-4 py-10">
      <div
        className="card w-full border border-slate-200 dark:border-slate-700 p-8 text-center"
        data-tour="tour-verify-form"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Verificação de conta
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          {user?.name
            ? `${user.name}, sua conta ainda precisa passar pela verificação de identidade para liberar todas as funções.`
            : "Sua conta ainda precisa passar pela verificação de identidade para liberar todas as funções."}
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Você será notificado por e-mail quando a verificação for aprovada.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/login" className="btn btn-outline">
            Voltar para login
          </Link>
          <Link to="/" className="btn btn-primary">
            Ir para página inicial
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyAccount;
