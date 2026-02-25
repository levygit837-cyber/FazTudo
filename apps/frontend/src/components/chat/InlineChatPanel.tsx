import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Send, Loader2, MessageSquare } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getOrderMessages,
  sendMessage,
} from "../../services/serviceService";
import type { Message } from "../../types";
import { formatRelativeTime } from "../../utils/formatters";

interface InlineChatPanelProps {
  orderId: number | null;
  orderTitle?: string;
  otherUserName?: string;
  onClose?: () => void;
}

const InlineChatPanel: React.FC<InlineChatPanelProps> = ({
  orderId,
  orderTitle,
  otherUserName,
  onClose,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getOrderMessages(orderId, { limit: 50 });
      setMessages(data.items);
    } catch {
      // silently fail on polling
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setMessages([]);
    loadMessages().finally(() => setLoading(false));

    // Poll every 10s
    pollingRef.current = setInterval(loadMessages, 10000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [orderId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !orderId || sending) return;
    const content = text.trim();
    setText("");
    setSending(true);
    try {
      await sendMessage(orderId, content);
      await loadMessages();
    } catch {
      setText(content); // restore on error
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Empty state (no chat selected)
  if (!orderId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
        <MessageSquare className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-600" />
        <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
          Selecione uma conversa
        </p>
        <p className="text-sm mt-1 text-slate-400 dark:text-slate-600 max-w-xs">
          Clique em uma conversa à esquerda para ver as mensagens aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {otherUserName || "Conversa"}
          </p>
          {orderTitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {orderTitle}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors ml-2 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">
            Nenhuma mensagem ainda. Diga olá!
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user?.id;
            if (msg.type === "SYSTEM") {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {msg.content}
                  </span>
                </div>
              );
            }
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? "bg-primary-600 text-white rounded-br-sm"
                      : "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm rounded-bl-sm"
                  }`}
                >
                  <p>{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isMine ? "text-white/60" : "text-slate-400"
                    }`}
                  >
                    {formatRelativeTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InlineChatPanel;
