import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { MessageSquare, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getUserChats } from "../services/serviceService";
import { ChatConversation } from "../types";
import { Skeleton } from "../components/common/Skeleton";
import { formatRelativeTime } from "../utils/formatters";
import InlineChatPanel from "../components/chat/InlineChatPanel";

const statusLabels: Record<string, string> = {
  DRAFT: "Dúvidas",
  PENDING: "Pendente",
  ACCEPTED: "Aceito",
  IN_PROGRESS: "Em andamento",
  AWAITING_CLIENT_CONFIRMATION: "Aguardando confirmação",
  AWAITING_PROFESSIONAL_CONFIRMATION: "Aguardando profissional",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  DISPUTED: "Em disputa",
};

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const { user, isProfessional: authIsProfessional, isCompany } = useAuth();
  const isProfessional = authIsProfessional;

  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [visibleChat, setVisibleChat] = useState<ChatConversation | null>(null);

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
    const s = search.toLowerCase();
    return (
      chat.orderTitle.toLowerCase().includes(s) ||
      (chat.otherUser?.name.toLowerCase().includes(s) ?? false)
    );
  });

  const getLastMessagePreview = (chat: ChatConversation): string => {
    if (!chat.lastMessage) return "Nenhuma mensagem";
    if (chat.lastMessage.type === "SYSTEM") return "📋 Mensagem do sistema";
    if (chat.lastMessage.type === "ATTACHMENT") return "📎 Arquivo anexado";
    if (chat.lastMessage.type === "LOCATION") return "📍 Localização compartilhada";
    const prefix = chat.lastMessage.senderId === user?.id ? "Você: " : "";
    const content = chat.lastMessage.content;
    return `${prefix}${content.length > 50 ? content.substring(0, 50) + "..." : content}`;
  };

  const handleSelectChat = (chat: ChatConversation) => {
    if (chat.orderId === selectedChat?.orderId) return;

    // Mobile: navigate as before
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      let basePath: string;
      if (isCompany) basePath = `/company/orders/${chat.orderId}/chat`;
      else if (isProfessional) basePath = `/professional/services/${chat.orderId}/chat`;
      else basePath = `/client/orders/${chat.orderId}/chat`;
      navigate(basePath);
      return;
    }

    // Desktop: smooth fade transition
    if (selectedChat) {
      setTransitioning(true);
      setTimeout(() => {
        setSelectedChat(chat);
        setVisibleChat(chat);
        setTransitioning(false);
      }, 150);
    } else {
      setSelectedChat(chat);
      setVisibleChat(chat);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Left Panel: Conversation List ── */}
      <div
        className={`
          flex flex-col bg-white dark:bg-slate-900
          border-r border-slate-200 dark:border-slate-700
          w-full md:w-80 lg:w-96 shrink-0
          ${selectedChat ? "hidden md:flex" : "flex"}
        `}
      >
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Mensagens
          </h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="input w-full pl-9 text-sm py-2"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-32 rounded" />
                    <Skeleton className="h-3 w-48 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {search ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
              </p>
              {!search && (
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  As conversas aparecem após a confirmação do pagamento de um serviço.
                </p>
              )}
            </div>
          ) : (
            <div className="py-2">
              {filteredChats.map((chat) => {
                const isSelected = selectedChat?.orderId === chat.orderId;
                return (
                  <button
                    key={chat.orderId}
                    onClick={() => handleSelectChat(chat)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors
                      ${
                        isSelected
                          ? "bg-primary-50 dark:bg-primary-900/20 border-r-2 border-primary-500"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }
                    `}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {chat.otherUser?.profileImage ? (
                        <img
                          src={chat.otherUser.profileImage}
                          alt={chat.otherUser.name}
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 font-semibold">
                          {chat.otherUser?.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      {chat.unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white">
                          {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-sm font-semibold truncate ${
                            chat.unreadCount > 0
                              ? "text-slate-900 dark:text-slate-100"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {chat.otherUser?.name || "Usuário"}
                        </p>
                        {chat.lastMessage && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatRelativeTime(chat.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-primary-600 dark:text-primary-400 font-medium truncate mt-0.5">
                        {statusLabels[chat.orderStatus] || chat.orderStatus}
                      </p>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          chat.unreadCount > 0
                            ? "font-medium text-slate-700 dark:text-slate-200"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {getLastMessagePreview(chat)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Chat ── */}
      <div
        className={`
          flex-1 flex-col overflow-hidden
          bg-white dark:bg-slate-900
          hidden md:flex
        `}
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "translateX(6px)" : "translateX(0)",
          transition: "opacity 150ms ease, transform 150ms ease",
        }}
      >
        <InlineChatPanel
          orderId={visibleChat?.orderId ?? null}
          orderTitle={visibleChat?.orderTitle}
          otherUserName={visibleChat?.otherUser?.name}
        />
      </div>
    </div>
  );
};

export default Messages;
