import React from "react";
import { Link } from "react-router";
import { MessageSquare, Users, ChevronRight, Power } from "lucide-react";
import { CompanyChannel } from "../../types";
import clsx from "clsx";

interface Props {
  channel: CompanyChannel;
  onToggleActive: () => void;
}

const ChannelCard: React.FC<Props> = ({ channel, onToggleActive }) => (
  <div className={clsx(
    "card p-5 flex flex-col gap-3 transition-all",
    !channel.isActive && "opacity-60"
  )}>
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{channel.name}</h3>
          {channel.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{channel.description}</p>
          )}
        </div>
      </div>
      <button
        onClick={onToggleActive}
        title={channel.isActive ? "Desativar canal" : "Ativar canal"}
        className={clsx(
          "p-1.5 rounded-lg transition-colors",
          channel.isActive
            ? "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            : "text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
        )}
      >
        <Power className="h-4 w-4" />
      </button>
    </div>

    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <Users className="h-4 w-4" />
      <span>{channel._count?.members ?? channel.members?.length ?? 0} membros</span>
      <span className={clsx(
        "ml-auto px-2 py-0.5 rounded-full text-xs font-medium",
        channel.isActive
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
      )}>
        {channel.isActive ? "Ativo" : "Inativo"}
      </span>
    </div>

    <Link
      to={`/company/channels/${channel.id}`}
      className="flex items-center justify-between text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1"
    >
      Gerenciar membros
      <ChevronRight className="h-4 w-4" />
    </Link>
  </div>
);

export default ChannelCard;
