import React from "react";
import { useParams } from "react-router-dom";
import { Users } from "lucide-react";

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Detalhes do Usuario #{id}
        </h2>
      </div>
      <div className="card">
        <p className="text-slate-500 dark:text-slate-400">
          Pagina de detalhes do usuario em construcao. Aqui serao exibidas as
          informacoes completas e acoes disponiveis para o usuario.
        </p>
      </div>
    </div>
  );
};

export default UserDetailPage;
