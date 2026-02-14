import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Skeleton } from "../../components/common/Skeleton";
import {
  getOrderById,
  getOrderMessages,
  sendMessage,
} from "../../services/serviceService";
import { Message, ServiceOrder } from "../../types";
import { formatDateTime, formatRelativeTime } from "../../utils/formatters";

const POLLING_INTERVAL_MS = 5000;

const ServiceChat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isProfessionalRoute = location.pathname.includes("/professional/");

  const chatTitle = useMemo(() => {
    if (!order || !user) return "Chat do Servico";
    if (isProfessionalRoute) return order.client?.name || "Cliente";
    return order.professional?.name || "Profissional";
  }, [order, user, isProfessionalRoute]);

  const loadOrder = async (orderId: number) => {
    const fetchedOrder = await getOrderById(orderId);
    setOrder(fetchedOrder);
  };

  const loadMessages = async (orderId: number) => {
    const response = await getOrderMessages(orderId, { limit: 100 });
    setMessages(response.items);
  };

  const loadAll = async (showLoading = false) => {
    if (!id) return;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) return;

    try {
      if (showLoading) setLoading(true);
      setError(null);
      await Promise.all([loadOrder(orderId), loadMessages(orderId)]);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Nao foi possivel carregar o chat.",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) return;

    const interval = setInterval(() => {
      loadMessages(orderId).catch(() => undefined);
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop =
      scrollContainerRef.current.scrollHeight;
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || !id) return;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) return;

    try {
      setSending(true);
      setError(null);
      await sendMessage(orderId, text.trim());
      setText("");
      await loadMessages(orderId);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Nao foi possivel enviar a mensagem.",
      );
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <div className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-6xl flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 animate-pulse">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
        </div>
        <div className="flex-1 space-y-4 px-4 py-6">
          <div className="flex justify-start">
            <Skeleton className="h-16 w-2/3 rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-12 w-1/2 rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <Skeleton className="h-20 w-3/5 rounded-2xl" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-2/5 rounded-2xl" />
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );

  const backPath = isProfessionalRoute
    ? `/professional/services/${id}`
    : `/client/orders/${id}`;

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-6xl flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" role="region" aria-label="Chat do servico">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {chatTitle}
            </h1>
            {order && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pedido #{order.id} · {order.title}
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-label="Mensagens"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma mensagem ainda. Envie a primeira para iniciar a conversa.
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.senderId === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isOwnMessage
                      ? "rounded-br-sm bg-primary-600 text-white"
                      : "rounded-bl-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p
                    className={`mt-1 text-[11px] ${
                      isOwnMessage
                        ? "text-primary-100"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {formatRelativeTime(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Ultima atualizacao: {formatDateTime(new Date())}
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digite uma mensagem..."
            className="input flex-1"
            disabled={sending}
            aria-label="Mensagem"
          />
          <button
            onClick={handleSend}
            className="btn btn-primary"
            disabled={sending || !text.trim()}
            aria-label="Enviar mensagem"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceChat;
