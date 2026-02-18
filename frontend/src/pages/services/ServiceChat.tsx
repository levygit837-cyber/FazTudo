import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Paperclip,
  MapPin,
  X,
  FileText,
  Download,
  AlertTriangle,
  Info,
  MessageCircle,
  ShoppingCart,
  Check,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Skeleton } from "../../components/common/Skeleton";
import {
  getOrderById,
  getOrderMessages,
  sendMessage,
  uploadChatFile,
  convertDraftOrder,
} from "../../services/serviceService";
import { Message, ServiceOrder } from "../../types";
import { formatRelativeTime } from "../../utils/formatters";
import { useSocket, useOrderRoom } from "../../hooks/useSocket";
import { useToast } from "../../context/ToastContext";

const POLLING_INTERVAL_MS = 30000; // Fallback polling — Socket.io handles real-time
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ServiceChat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filterWarning, setFilterWarning] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertProposal, setConvertProposal] = useState<{ proposedBy: number; proposerName: string } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const isProfessionalRoute = location.pathname.includes("/professional/");
  const isDraft = order?.status === "DRAFT";
  const orderId = id ? parseInt(id, 10) : undefined;

  // Socket.io: join order room for real-time messages
  useOrderRoom(orderId);

  // Socket.io: receive new messages in real-time
  const handleSocketMessage = useCallback((msg: any) => {
    if (!msg || !msg.id) return;
    setMessages((prev) => {
      // Deduplicate by ID
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg as Message];
    });
  }, []);
  useSocket("chat:message", handleSocketMessage);

  // Socket.io: handle order status changes (e.g. DRAFT → PENDING)
  const handleStatusChanged = useCallback((data: { orderId: number; status: string }) => {
    if (!order || data.orderId !== order.id) return;
    setOrder((prev) => prev ? { ...prev, status: data.status as any } : prev);
  }, [order]);
  useSocket("order:statusChanged", handleStatusChanged);

  // Socket.io: handle convert proposal from other party
  const handleConvertProposal = useCallback((data: { orderId: number; proposedBy: number; proposerName: string }) => {
    if (orderId && data.orderId === orderId) {
      setConvertProposal({ proposedBy: data.proposedBy, proposerName: data.proposerName });
    }
  }, [orderId]);
  useSocket("order:convertProposal", handleConvertProposal);

  // Socket.io: convert accepted — redirect client to checkout
  const handleConvertAccepted = useCallback((data: { orderId: number }) => {
    if (orderId && data.orderId === orderId) {
      toast.success("Pedido formalizado! Redirecionando para o checkout...");
      navigate(`/client/orders/${orderId}/checkout`);
    }
  }, [orderId, navigate, toast]);
  useSocket("order:convertAccepted", handleConvertAccepted);

  const chatTitle = useMemo(() => {
    if (!order || !user) return "Chat do Serviço";
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
        err?.response?.data?.message || "Não foi possível carregar o chat.",
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
      setFilterWarning(null);
      const result = await sendMessage(orderId, text.trim());
      setText("");
      // Checar se houve warning de filtro na resposta
      if ((result as any).filterWarning) {
        setFilterWarning((result as any).filterWarning);
        setTimeout(() => setFilterWarning(null), 8000);
      }
      await loadMessages(orderId);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Não foi possível enviar a mensagem.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) return;

    try {
      setUploading(true);
      setError(null);
      const uploaded = await uploadChatFile(orderId, file);
      await sendMessage(orderId, file.name, {
        type: "ATTACHMENT",
        attachmentUrl: uploaded.url,
        attachmentName: uploaded.originalName,
        attachmentType: uploaded.mimeType,
        attachmentSize: uploaded.size,
      });
      await loadMessages(orderId);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Não foi possível enviar o arquivo.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleShareLocation = async () => {
    if (!id) return;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) return;

    if (!navigator.geolocation) {
      setError("Geolocalização não suportada pelo navegador.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          setSending(true);
          setError(null);
          await sendMessage(orderId, "Localização compartilhada", {
            type: "LOCATION",
            locationLat: position.coords.latitude,
            locationLng: position.coords.longitude,
            locationLabel: "Minha localização atual",
          });
          setShowLocationPicker(false);
          await loadMessages(orderId);
        } catch (err: any) {
          setError("Não foi possível compartilhar a localização.");
        } finally {
          setSending(false);
        }
      },
      () => {
        setError("Não foi possível obter sua localização. Verifique as permissões.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleShareOrderAddress = async () => {
    if (!id || !order?.address) return;
    const orderId = parseInt(id, 10);
    if (Number.isNaN(orderId)) return;

    try {
      setSending(true);
      setError(null);
      const addr = order.address;
      const label = `${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""} - ${addr.neighborhood}, ${addr.city}/${addr.state}`;
      await sendMessage(orderId, label, {
        type: "LOCATION",
        locationLat: addr.latitude || undefined,
        locationLng: addr.longitude || undefined,
        locationLabel: label,
      });
      setShowLocationPicker(false);
      await loadMessages(orderId);
    } catch (err: any) {
      setError("Não foi possível compartilhar o endereço.");
    } finally {
      setSending(false);
    }
  };

  // Render de mensagem de acordo com o tipo
  const renderMessageContent = (message: Message) => {
    const msgType = message.type || "TEXT";
    const isOwn = message.senderId === user?.id;

    switch (msgType) {
      case "SYSTEM":
        return (
          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-4 py-2 text-center text-xs text-slate-500 dark:text-slate-400">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{message.content}</span>
            </div>
          </div>
        );

      case "ATTACHMENT": {
        const isImage = message.attachmentType?.startsWith("image/");
        const fileUrl = message.attachmentUrl
          ? `${API_BASE}${message.attachmentUrl}`
          : "#";

        return (
          <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isOwn
                  ? "rounded-br-sm bg-primary-600 text-white"
                  : "rounded-bl-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              }`}
            >
              {isImage ? (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={fileUrl}
                    alt={message.attachmentName || "Imagem"}
                    className="max-h-48 rounded-lg object-cover"
                  />
                </a>
              ) : (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 rounded-lg p-2 ${
                    isOwn
                      ? "bg-primary-700 hover:bg-primary-800"
                      : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                  }`}
                >
                  <FileText className="h-8 w-8 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {message.attachmentName || "Arquivo"}
                    </p>
                    {message.attachmentSize && (
                      <p className={`text-xs ${isOwn ? "text-primary-200" : "text-slate-500 dark:text-slate-400"}`}>
                        {formatFileSize(message.attachmentSize)}
                      </p>
                    )}
                  </div>
                  <Download className="h-4 w-4 flex-shrink-0" />
                </a>
              )}
              <p
                className={`mt-1 text-[11px] ${
                  isOwn ? "text-primary-100" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {formatRelativeTime(message.createdAt)}
              </p>
            </div>
          </div>
        );
      }

      case "LOCATION": {
        const lat = message.locationLat;
        const lng = message.locationLng;
        const mapsUrl = lat && lng
          ? `https://www.google.com/maps?q=${lat},${lng}`
          : "#";

        return (
          <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isOwn
                  ? "rounded-br-sm bg-primary-600 text-white"
                  : "rounded-bl-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              }`}
            >
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 rounded-lg p-2 ${
                  isOwn
                    ? "bg-primary-700 hover:bg-primary-800"
                    : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                <MapPin className="h-6 w-6 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {message.locationLabel || "Localização"}
                  </p>
                  {lat && lng && (
                    <p className={`text-xs ${isOwn ? "text-primary-200" : "text-slate-500 dark:text-slate-400"}`}>
                      Abrir no Google Maps
                    </p>
                  )}
                </div>
              </a>
              <p
                className={`mt-1 text-[11px] ${
                  isOwn ? "text-primary-100" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {formatRelativeTime(message.createdAt)}
              </p>
            </div>
          </div>
        );
      }

      default:
        return (
          <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                isOwn
                  ? "rounded-br-sm bg-primary-600 text-white"
                  : "rounded-bl-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              }`}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
              <p
                className={`mt-1 text-[11px] ${
                  isOwn
                    ? "text-primary-100"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {formatRelativeTime(message.createdAt)}
              </p>
            </div>
          </div>
        );
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
          <div className="flex justify-start"><Skeleton className="h-16 w-2/3 rounded-2xl" /></div>
          <div className="flex justify-end"><Skeleton className="h-12 w-1/2 rounded-2xl" /></div>
          <div className="flex justify-start"><Skeleton className="h-20 w-3/5 rounded-2xl" /></div>
          <div className="flex justify-end"><Skeleton className="h-10 w-2/5 rounded-2xl" /></div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );

  const backPath = isProfessionalRoute
    ? `/professional/messages`
    : `/client/messages`;

  return (
    <div
      className="mx-auto flex h-[calc(100vh-9rem)] w-full max-w-6xl flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      role="region"
      aria-label="Chat do serviço"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backPath)}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Voltar para mensagens"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {chatTitle}
            </h1>
            {order && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {order.title}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* DRAFT Order Banner */}
      {isDraft && (
        <div className="border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          {convertProposal && convertProposal.proposedBy !== user?.id ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} className="text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-emerald-800 dark:text-emerald-200">
                  {convertProposal.proposerName} quer converter esta conversa em pedido formal
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!orderId) return;
                    setConverting(true);
                    try {
                      await convertDraftOrder(orderId, "accept");
                      toast.success("Pedido formalizado!");
                    } catch (err: any) {
                      toast.error(err?.response?.data?.message || "Erro ao aceitar proposta");
                    } finally {
                      setConverting(false);
                    }
                  }}
                  disabled={converting}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 disabled:opacity-50"
                >
                  {converting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Aceitar
                </button>
                <button
                  onClick={async () => {
                    if (!orderId) return;
                    setConverting(true);
                    try {
                      await convertDraftOrder(orderId, "reject");
                      setConvertProposal(null);
                      toast.info("Proposta recusada");
                    } catch (err: any) {
                      toast.error(err?.response?.data?.message || "Erro ao recusar");
                    } finally {
                      setConverting(false);
                    }
                  }}
                  disabled={converting}
                  className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <X size={14} />
                  Recusar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <MessageCircle size={16} className="text-amber-600 flex-shrink-0" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  Conversa de duvidas — ainda nao e um pedido formal
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!orderId) return;
                  setConverting(true);
                  try {
                    await convertDraftOrder(orderId, "propose");
                    toast.success("Proposta enviada! Aguardando confirmacao.");
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || "Erro ao propor pedido");
                  } finally {
                    setConverting(false);
                  }
                }}
                disabled={converting}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-3 py-1.5 disabled:opacity-50"
              >
                {converting ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                Contratar servico
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filter Warning */}
      {filterWarning && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{filterWarning}</span>
          <button onClick={() => setFilterWarning(null)} className="ml-auto">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Messages */}
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
          messages.map((message) => (
            <React.Fragment key={message.id}>
              {renderMessageContent(message)}
            </React.Fragment>
          ))
        )}
      </div>

      {/* Location Picker */}
      {showLocationPicker && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Compartilhar localização
            </span>
            <button onClick={() => setShowLocationPicker(false)}>
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleShareLocation}
              disabled={sending}
              className="btn btn-primary flex-1 text-sm"
            >
              <MapPin className="h-4 w-4 mr-1" />
              Minha localização atual
            </button>
            {order?.address && (
              <button
                onClick={handleShareOrderAddress}
                disabled={sending}
                className="btn btn-secondary flex-1 text-sm"
              >
                <MapPin className="h-4 w-4 mr-1" />
                Endereço do serviço
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex gap-2">
          {/* File upload — hidden for DRAFT orders */}
          {!isDraft && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || sending}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
                aria-label="Anexar arquivo"
                title="Anexar arquivo"
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Location — hidden for DRAFT orders */}
          {!isDraft && (
            <button
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              disabled={sending}
              className={`rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 ${showLocationPicker ? "text-primary-600" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
              aria-label="Compartilhar localização"
              title="Compartilhar localização"
            >
              <MapPin className="h-5 w-5" />
            </button>
          )}

          {/* Text input */}
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
            disabled={sending || uploading}
            aria-label="Mensagem"
          />

          {/* Send */}
          <button
            onClick={handleSend}
            className="btn btn-primary"
            disabled={sending || uploading || !text.trim()}
            aria-label="Enviar mensagem"
          >
            {uploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceChat;
