import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Search, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserChats } from "../services/serviceService";
import { ChatConversation } from "../types";
import { Skeleton } from "../components/common/Skeleton";
import { formatRelativeTime } from "../utils/formatters";

const statusLabels: Record<string, string> = {
  DRAFT: "Duvidas",
  ACCEPTED: "Aceito",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT_CONFIRMATION: "Aguardando confirmação",
  COMPLETED: "Concluído",
  DISPUTED: "Em disputa",
};

const Messages: React.FC = () => {
  const navigate = useNavigate();

  const { user, isProfessional: authIsProfessional, isCompany } = useAuth();
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const isProfessional = authIsProfessional;

  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getUserChats();
        setChats(data);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Erro ao carregar conversas.");
      } finally {
        setLoading(false);
      }
    };
    loadChats();
  }, []);

  const filteredChats = chats.filter((chat) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    return (
      chat.orderTitle.toLowerCase().includes(searchLower) ||
      chat.otherUser?.name.toLowerCase().includes(searchLower)
    );
  });

  const handleOpenChat = (orderId: number) => {
    let basePath: string;
    if (isCompany) {
      basePath = `/company/orders/${orderId}/chat`;
    } else if (isProfessional) {
      basePath = `/professional/services/${orderId}/chat`;
    } else {
      basePath = `/client/orders/${orderId}/chat`;
    }
    navigate(basePath);
  };

  const getLastMessagePreview = (chat: ChatConversation): string => {
    if (!chat.lastMessage) return "Nenhuma mensagem";
    if (chat.lastMessage.type === "SYSTEM") return "📋 Mensagem do sistema";
    if (chat.lastMessage.type === "ATTACHMENT") return "📎 Arquivo anexado";
    if (chat.lastMessage.type === "LOCATION") return "📍 Localização compartilhada";
    const prefix = chat.lastMessage.senderId === user?.id ? "Você: " : "";
    const content = chat.lastMessage.content;
    return `${prefix}${content.length > 50 ? content.substring(0, 50) + "..." : content}`;
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="mt-2 h-10 w-full rounded-lg" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Mensagens
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Conversas sobre seus serviços
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar conversa por nome ou serviço..."
          className="input w-full pl-10"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Chat List */}
      {filteredChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-8 py-16 text-center">
          <MessageSquare className="mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {search
              ? "Tente buscar com outros termos."
              : "As conversas são criadas automaticamente após a confirmação do pagamento de um serviço."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredChats.map((chat) => (
            <button
              key={chat.orderId}
              onClick={() => handleOpenChat(chat.orderId)}
              className="flex w-full items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-left transition-all hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {chat.otherUser?.profileImage ? (
                  <img
                    src={chat.otherUser.profileImage}
                    alt={chat.otherUser.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-semibold text-lg">
                    {chat.otherUser?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
                {chat.unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                    {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-sm font-semibold truncate ${chat.unreadCount > 0 ? "text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"}`}>
                    {chat.otherUser?.name || "Usuário"}
                  </h3>
                  {chat.lastMessage && (
                    <span className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(chat.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-primary-600 dark:text-primary-400 font-medium truncate">
                  {chat.orderTitle} · {statusLabels[chat.orderStatus] || chat.orderStatus}
                </p>
                <p className={`mt-1 text-sm truncate ${chat.unreadCount > 0 ? "font-medium text-slate-800 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
                  {getLastMessagePreview(chat)}
                </p>
              </div>

              {/* Arrow */}
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Messages;
