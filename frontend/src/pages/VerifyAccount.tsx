import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const VerifyAccount: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center px-4 py-10">
      <div className="card w-full border border-slate-200 dark:border-slate-700 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Conta em verificacao
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          {user?.name
            ? `${user.name}, sua conta ainda precisa passar pela validacao documental e facial para liberar todas as funcoes.`
            : "Sua conta ainda precisa passar pela validacao documental e facial para liberar todas as funcoes."}
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enquanto o fluxo completo de KYC nao for finalizado, use os usuarios de
          teste verificados para desenvolvimento.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/login" className="btn btn-outline">
            Voltar para login
          </Link>
          <Link to="/" className="btn btn-primary">
            Ir para pagina inicial
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyAccount;
