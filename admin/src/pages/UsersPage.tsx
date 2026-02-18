import React from "react";
import { Users } from "lucide-react";

const UsersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="text-primary-500" size={24} />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Usuarios
        </h2>
      </div>
      <div className="card">
        <p className="text-slate-500 dark:text-slate-400">
          Pagina de gerenciamento de usuarios em construcao. Aqui sera possivel
          listar, buscar e gerenciar todos os usuarios da plataforma.
        </p>
      </div>
    </div>
  );
};

export default UsersPage;
