/**
 * Formata valor em moeda brasileira (BRL)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/**
 * Formata data para exibição
 */
export const formatDate = (
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("pt-BR", options);
};

/**
 * Formata data e hora para exibição
 */
export const formatDateTime = (date: string | Date): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Formata data relativa (há X minutos, há X horas, etc.)
 */
export const formatRelativeTime = (date: string | Date): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "agora";
  } else if (diffMins < 60) {
    return `ha ${diffMins} minuto${diffMins > 1 ? "s" : ""}`;
  } else if (diffHours < 24) {
    return `ha ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
  } else if (diffDays < 7) {
    return `ha ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
  } else {
    return formatDate(dateObj);
  }
};

/**
 * Formata número de telefone
 */
export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

/**
 * Formata CPF
 */
export const formatCPF = (cpf: string): string => {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }
  return cpf;
};

/**
 * Formata CNPJ
 */
export const formatCNPJ = (cnpj: string): string => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  }
  return cnpj;
};

/**
 * Formata CEP
 */
export const formatCEP = (cep: string): string => {
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  return cep;
};

/**
 * Trunca texto com reticências
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
};

/**
 * Formata rating com estrelas
 */
export const formatRating = (rating: number): string => {
  return rating.toFixed(1);
};

/**
 * Pluraliza palavra em português
 */
export const pluralize = (
  count: number,
  singular: string,
  plural: string
): string => {
  return count === 1 ? singular : plural;
};

/**
 * Formata número de avaliações
 */
export const formatReviewCount = (count: number): string => {
  if (count === 0) return "Sem avaliacoes";
  return `${count} ${pluralize(count, "avaliacao", "avaliacoes")}`;
};

/**
 * Formata status do pedido
 */
export const formatOrderStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    DRAFT: "Rascunho",
    PENDING: "Pendente",
    IN_PROGRESS: "Em andamento",
    AWAITING_CLIENT_CONFIRMATION: "Aguardando sua confirmação",
    AWAITING_PROFESSIONAL_CONFIRMATION: "Aguardando confirmação do profissional",
    COMPLETED: "Concluido",
    CANCELLED: "Cancelado",
    EXPIRED: "Expirado",
    DISPUTED: "Em disputa",
  };
  return statusMap[status] || status;
};

/**
 * Formata status do pagamento
 */
export const formatPaymentStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    PENDING: "Pendente",
    HELD: "Em escrow",
    RELEASED: "Liberado",
    REFUNDED: "Reembolsado",
    FAILED: "Falhou",
    PARTIALLY_REFUNDED: "Parcialmente reembolsado",
  };
  return statusMap[status] || status;
};

/**
 * Formata tipo de transacao para exibicao
 */
export const formatTransactionType = (type: string): string => {
  const typeMap: Record<string, string> = {
    DEPOSIT: "Deposito",
    WITHDRAWAL: "Saque",
    PAYMENT: "Pagamento",
    REFUND: "Reembolso",
    FEE: "Taxa",
  };
  return typeMap[type] || type;
};

/**
 * Retorna cor Tailwind para tipo de transacao
 */
export const getTransactionTypeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    DEPOSIT: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
    WITHDRAWAL: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
    PAYMENT: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
    REFUND: "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30",
    FEE: "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800",
  };
  return colorMap[type] || "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800";
};

export default {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatPhone,
  formatCPF,
  formatCNPJ,
  formatCEP,
  truncateText,
  formatRating,
  pluralize,
  formatReviewCount,
  formatOrderStatus,
  formatPaymentStatus,
  formatTransactionType,
  getTransactionTypeColor,
};
