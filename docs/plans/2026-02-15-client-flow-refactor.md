# Refatoracao do Fluxo do Cliente - FazTudo

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar o fluxo do cliente para servicos, checkout, pedidos e mensagens, criando um fluxo de contratacao guiado por etapas (stepper) com disponibilidade do profissional, e um fluxo de acompanhamento de pedidos com confirmacao dupla.

**Architecture:** O fluxo de contratacao sera transformado em um wizard multi-step na pagina de detalhes do pedido (`OrderDetails.tsx`), substituindo o modelo atual onde o pedido ja cai direto na tela com acoes, mensagens e progresso misturados. O chat so sera criado apos pagamento aprovado. A pagina de "Meus Pedidos" ganhara um novo stepper de acompanhamento pos-pagamento com confirmacao dupla (cliente + profissional).

**Tech Stack:** React + TypeScript, TailwindCSS, Prisma ORM (SQLite), Express.js

---

## Resumo das Mudancas

### O que REMOVER:
1. Secao "Mensagens" da pagina `OrderDetails.tsx` (chat inline no pedido)
2. Secao "Acoes" da pagina `OrderDetails.tsx` (pagamento, aceitar, cancelar etc.)
3. Progresso antigo (7 steps) do `OrderDetails.tsx` - substituir por novo fluxo
4. Disponibilidade da pagina de servico (`ServiceDetails.tsx`) - mover para apos clicar em contratar

### O que ADICIONAR:
1. Modal/wizard de disponibilidade ao clicar em "Contratar Servico"
2. Novo fluxo de checkout em steps: Pedido Criado -> Horarios -> Pagamento -> Confirmacao
3. Pagina de confirmacao de pagamento (check verde)
4. Chat criado apenas apos pagamento aprovado (backend gate)
5. Novo stepper de acompanhamento em "Meus Pedidos": Servico Iniciado -> Aguardando Profissional -> Em Execucao -> Aguardando Confirmacao (dupla) -> Concluido
6. Novo enum de status `AWAITING_PROFESSIONAL_CONFIRMATION` no backend

### Fluxo de Checkout (novo):
```
[Pagina do Servico] -> Clica "Contratar"
  -> Step 1: Pedido Criado (automatico)
  -> Step 2: Selecao de dia/horario (AvailabilityPicker)
  -> Step 3: Pagamento (selecionar metodo + pagar)
  -> Step 4: Confirmacao (pagina verde com check)
  -> Step 5: Info final (notificamos o profissional + orientacoes)
```

### Fluxo de Acompanhamento em "Meus Pedidos" (novo):
```
Servico Iniciado (verde, automatico apos pagamento)
  -> Aguardando Resposta do Profissional
  -> Servico em Andamento
  -> Aguardando Confirmacao do Cliente
  -> Aguardando Confirmacao do Profissional
  -> Concluido
  -> (opcional) Avaliacao
```

---

## Task 1: Adicionar novo status no backend - AWAITING_PROFESSIONAL_CONFIRMATION

**Files:**
- Modify: `backend/prisma/schema.prisma:23-32` (enum ServiceOrderStatus)
- Modify: `backend/src/controllers/serviceController.ts` (adicionar endpoint de confirmacao do profissional)
- Modify: `backend/src/routes/serviceRoutes.ts` (adicionar rota)
- Modify: `frontend/src/types/index.ts:18-27` (enum ServiceOrderStatus)

**Step 1: Adicionar novo status ao enum Prisma**

Em `backend/prisma/schema.prisma`, alterar o enum:

```prisma
enum ServiceOrderStatus {
  PENDING
  ACCEPTED
  IN_PROGRESS
  AWAITING_CLIENT_CONFIRMATION
  AWAITING_PROFESSIONAL_CONFIRMATION
  COMPLETED
  CANCELLED
  EXPIRED
  DISPUTED
}
```

**Step 2: Rodar migration do Prisma**

Run: `cd /home/levybonito/faztudo/backend && npx prisma migrate dev --name add_awaiting_professional_confirmation`
Expected: Migration criada com sucesso

**Step 3: Atualizar enum no frontend**

Em `frontend/src/types/index.ts`, adicionar ao enum `ServiceOrderStatus`:

```typescript
export enum ServiceOrderStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  IN_PROGRESS = "IN_PROGRESS",
  AWAITING_CLIENT_CONFIRMATION = "AWAITING_CLIENT_CONFIRMATION",
  AWAITING_PROFESSIONAL_CONFIRMATION = "AWAITING_PROFESSIONAL_CONFIRMATION",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  DISPUTED = "DISPUTED",
}
```

**Step 4: Adicionar controller para confirmacao do profissional**

Em `backend/src/controllers/serviceController.ts`, adicionar nova funcao `confirmProfessionalCompletion` logo apos `confirmServiceOrderCompletion`:

```typescript
// Profissional confirma conclusao apos cliente ja ter confirmado
export const confirmProfessionalCompletion = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "PROFESSIONAL" && req.user.role !== "ADMIN") {
      res.status(403).json(errorResponse("Only professionals can confirm completion"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: "HELD" },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.professionalId !== req.user.id && req.user.role !== "ADMIN") {
      res.status(403).json(errorResponse("You don't have permission"));
      return;
    }

    if (serviceOrder.status !== "AWAITING_PROFESSIONAL_CONFIRMATION") {
      res.status(400).json(
        errorResponse(`Order cannot be confirmed. Current status: ${serviceOrder.status}`)
      );
      return;
    }

    const now = new Date();
    const releaseDate = new Date(now);
    releaseDate.setDate(releaseDate.getDate() + env.ESCROW_AUTO_RELEASE_DAYS);

    const activePayment = serviceOrder.payments.find((p) => p.status === "HELD");

    const transactionOps: any[] = [
      prisma.serviceOrder.update({
        where: { id: orderId },
        data: {
          status: "COMPLETED",
          completedAt: now,
        },
        include: {
          client: { select: { id: true, name: true, email: true } },
          professional: { select: { id: true, name: true, email: true } },
        },
      }),
    ];

    if (activePayment) {
      transactionOps.push(
        prisma.payment.update({
          where: { id: activePayment.id },
          data: { heldUntil: releaseDate },
        })
      );
    }

    const [updatedOrder] = await prisma.$transaction(transactionOps);

    await createNotification(
      serviceOrder.clientId,
      NotificationType.ORDER_COMPLETED,
      "Servico concluido",
      `O profissional confirmou a conclusao do servico "${serviceOrder.title}". Pedido finalizado!`,
      orderId,
      { professionalId: req.user.id, professionalName: req.user.name },
    );

    res.status(200).json(
      successResponse(
        { serviceOrder: updatedOrder },
        "Professional confirmed completion. Order is now COMPLETED.",
      ),
    );
  } catch (error) {
    console.error("Confirm professional completion error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 5: Atualizar `confirmServiceOrderCompletion` para mudar para AWAITING_PROFESSIONAL_CONFIRMATION em vez de COMPLETED**

Em `backend/src/controllers/serviceController.ts`, modificar a funcao `confirmServiceOrderCompletion`:

Alterar a linha que faz `status: "COMPLETED"` para `status: "AWAITING_PROFESSIONAL_CONFIRMATION"` e remover a atualizacao do payment (que agora so acontece quando o profissional tambem confirma).

```typescript
// Na funcao confirmServiceOrderCompletion, substituir o bloco do $transaction por:
const updatedOrder = await prisma.serviceOrder.update({
  where: { id: orderId },
  data: {
    status: "AWAITING_PROFESSIONAL_CONFIRMATION",
    // clientConfirmedAt ja existe? Se nao, usar updatedAt
  },
  include: {
    client: { select: { id: true, name: true, email: true } },
    professional: { select: { id: true, name: true, email: true } },
  },
});

// Notificar profissional para confirmar
if (serviceOrder.professionalId) {
  await createNotification(
    serviceOrder.professionalId,
    NotificationType.ORDER_COMPLETED,
    "Cliente confirmou conclusao",
    `O cliente confirmou a conclusao do servico "${serviceOrder.title}". Confirme tambem para finalizar o pedido.`,
    orderId,
    { clientId: req.user.id, clientName: req.user.name },
  );
}
```

**Step 6: Adicionar rota no backend**

Em `backend/src/routes/serviceRoutes.ts`, adicionar apos a rota de `confirm-completion`:

```typescript
// Profissional confirma conclusao (apos cliente ja ter confirmado)
router.post(
  "/orders/:id/confirm-professional",
  verifyToken,
  requireRole("PROFESSIONAL", "ADMIN"),
  requireVerified,
  serviceController.confirmProfessionalCompletion,
);
```

**Step 7: Adicionar funcao de API no frontend**

Em `frontend/src/services/serviceService.ts`, adicionar:

```typescript
/**
 * Profissional confirma conclusao do servico
 */
export const confirmProfessionalCompletion = async (id: number): Promise<ServiceOrder> => {
  const response = await api.post<ApiResponse<any>>(
    `/services/orders/${id}/confirm-professional`,
  );
  const payload = extractData(response);
  return payload.serviceOrder || payload;
};
```

**Step 8: Exportar no default export**

Adicionar `confirmProfessionalCompletion` ao objeto default export do `serviceService.ts`.

**Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/controllers/serviceController.ts backend/src/routes/serviceRoutes.ts frontend/src/types/index.ts frontend/src/services/serviceService.ts
git commit -m "feat: add AWAITING_PROFESSIONAL_CONFIRMATION status with dual confirmation flow"
```

---

## Task 2: Criar componente AvailabilityPicker para selecao de horarios

**Files:**
- Create: `frontend/src/components/orders/AvailabilityPicker.tsx`

**Context:** Este componente sera um modal/drawer que aparece quando o cliente clica em "Contratar Servico". Ele mostra os dias e horarios disponiveis do profissional. Como o backend atual nao tem tabela ProfessionalSchedule ainda no schema (apenas no design), vamos criar um componente simples com calendario que permite selecionar data e hora, e futuramente integrar com a API de disponibilidade.

**Step 1: Criar o componente AvailabilityPicker**

Criar `frontend/src/components/orders/AvailabilityPicker.tsx`:

```tsx
import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Calendar, X } from "lucide-react";
import ModalPortal from "../common/ModalPortal";

interface AvailabilityPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: string, time: string) => void;
  professionalName: string;
  loading?: boolean;
}

const HOURS = [
  "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00",
];

const AvailabilityPicker: React.FC<AvailabilityPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  professionalName,
  loading = false,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Preencher dias vazios antes do primeiro dia
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Dias do mes
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    if (date < today) return;
    const dateStr = date.toISOString().split("T")[0];
    setSelectedDate(dateStr);
    setSelectedTime(null);
  };

  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
  };

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      onSelect(selectedDate, selectedTime);
    }
  };

  const isPastDate = (date: Date) => date < today;
  const isToday = (date: Date) =>
    date.toDateString() === today.toDateString();

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative mx-4 w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Escolha a data e horario
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Agenda de {professionalName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Calendario */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Dias */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="h-10" />;
                }

                const dateStr = date.toISOString().split("T")[0];
                const past = isPastDate(date);
                const todayDate = isToday(date);
                const selected = selectedDate === dateStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDateClick(date)}
                    disabled={past}
                    className={`h-10 rounded-lg text-sm font-medium transition-all ${
                      past
                        ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                        : selected
                        ? "bg-primary-600 text-white"
                        : todayDate
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 hover:bg-primary-100"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horarios */}
          {selectedDate && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Horarios disponiveis
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {HOURS.map((time) => (
                  <button
                    key={time}
                    onClick={() => handleTimeClick(time)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      selectedTime === time
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botao de confirmar */}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 btn btn-outline">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedTime || loading}
              className="flex-1 btn btn-primary disabled:opacity-50"
            >
              {loading ? "Confirmando..." : "Confirmar horario"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default AvailabilityPicker;
```

**Step 2: Commit**

```bash
git add frontend/src/components/orders/AvailabilityPicker.tsx
git commit -m "feat: create AvailabilityPicker component for scheduling"
```

---

## Task 3: Refatorar pagina ServiceDetails - mover disponibilidade e alterar fluxo de contratacao

**Files:**
- Modify: `frontend/src/pages/services/ServiceDetails.tsx`

**Context:** Atualmente, ao clicar em "Contratar servico", o sistema cria o pedido e redireciona direto para `/client/orders/:id`. O novo fluxo sera: clicar em "Contratar" -> abrir AvailabilityPicker -> selecionar data/hora -> criar pedido com scheduledDate -> redirecionar para a pagina do pedido (que tera o checkout step wizard).

**Step 1: Importar AvailabilityPicker e adicionar estado**

Em `frontend/src/pages/services/ServiceDetails.tsx`:

Adicionar import:
```typescript
import AvailabilityPicker from "../../components/orders/AvailabilityPicker";
```

Adicionar estados:
```typescript
const [showAvailability, setShowAvailability] = useState(false);
```

**Step 2: Alterar handleHireService**

Substituir a funcao `handleHireService` para abrir o picker ao inves de criar pedido direto:

```typescript
const handleHireService = () => {
  if (!isAuthenticated) {
    navigate("/login", { state: { from: `/services/${id}` } });
    return;
  }

  if (user?.role !== "CLIENT") {
    setHireError("Somente clientes podem contratar servicos.");
    return;
  }

  if (!service) return;
  setShowAvailability(true);
};

const handleScheduleConfirm = async (date: string, time: string) => {
  if (!service) return;

  try {
    setHiring(true);
    setHireError(null);

    const scheduledDate = `${date}T${time}:00`;

    const order = await createOrder({
      serviceListingId: service.id,
      title: service.title,
      description: `Pedido criado a partir da pagina do servico "${service.title}"`,
      scheduledDate,
    });

    setShowAvailability(false);
    navigate(`/client/orders/${order.id}`);
  } catch (error: any) {
    setHireError(
      error?.response?.data?.message ||
        "Nao foi possivel criar o pedido agora.",
    );
  } finally {
    setHiring(false);
  }
};
```

**Step 3: Adicionar o componente AvailabilityPicker no JSX**

Logo antes do fechamento do ultimo `</div>` do componente (antes do Sticky Mobile CTA Bar), adicionar:

```tsx
{/* Availability Picker */}
{showAvailability && service && (
  <AvailabilityPicker
    isOpen={showAvailability}
    onClose={() => setShowAvailability(false)}
    onSelect={handleScheduleConfirm}
    professionalName={service.professional.name}
    loading={hiring}
  />
)}
```

**Step 4: Commit**

```bash
git add frontend/src/pages/services/ServiceDetails.tsx
git commit -m "feat: add availability picker to service hire flow"
```

---

## Task 4: Criar pagina de confirmacao de pagamento

**Files:**
- Create: `frontend/src/pages/checkout/PaymentConfirmation.tsx`
- Modify: `frontend/src/App.tsx` (adicionar rota)

**Step 1: Criar pagina PaymentConfirmation**

Criar `frontend/src/pages/checkout/PaymentConfirmation.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle, MessageSquare, ArrowRight, Bell } from "lucide-react";
import { getOrderById } from "../../services/serviceService";
import { ServiceOrder } from "../../types";
import { formatCurrency } from "../../utils/formatters";

const PaymentConfirmation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ServiceOrder | null>(null);

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) return;
      try {
        const data = await getOrderById(parseInt(id));
        setOrder(data);
      } catch {
        navigate("/client/orders");
      }
    };
    loadOrder();
  }, [id]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Check Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-bounce-slow">
            <CheckCircle className="w-14 h-14 text-green-500" />
          </div>
        </div>

        {/* Titulo */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Pagamento confirmado!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Seu pedido foi criado com sucesso
          </p>
        </div>

        {/* Detalhes do pedido */}
        {order && (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Pedido</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">#{order.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Servico</span>
              <span className="font-medium text-slate-900 dark:text-slate-100 text-right max-w-[200px] truncate">{order.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Valor</span>
              <span className="font-semibold text-primary-600">{formatCurrency(order.price)}</span>
            </div>
            {order.professional && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Profissional</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{order.professional.name}</span>
              </div>
            )}
          </div>
        )}

        {/* Info de notificacao */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                Notificamos o profissional!
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                O profissional sera notificado sobre seu pedido e entrara em contato em breve.
                Caso demore, voce pode enviar uma mensagem pelo chat do pedido.
              </p>
            </div>
          </div>
        </div>

        {/* Acoes */}
        <div className="space-y-3 pt-2">
          <Link
            to={`/client/orders/${id}`}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            Acompanhar pedido
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/client/orders"
            className="btn btn-outline w-full"
          >
            Ver todos os pedidos
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmation;
```

**Step 2: Adicionar rota no App.tsx**

Em `frontend/src/App.tsx`:

Adicionar import:
```typescript
import PaymentConfirmation from "./pages/checkout/PaymentConfirmation";
```

Dentro do bloco de rotas `client`, adicionar:
```tsx
<Route path="orders/:id/payment-confirmed" element={<PaymentConfirmation />} />
```

**Step 3: Commit**

```bash
git add frontend/src/pages/checkout/PaymentConfirmation.tsx frontend/src/App.tsx
git commit -m "feat: create payment confirmation page with green check"
```

---

## Task 5: Refatorar OrderDetails - remover Mensagens e Acoes, criar checkout wizard

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`

**Context:** Esta e a maior mudanca. Vamos transformar a pagina de detalhes do pedido em:
- **Para pedidos PENDING (sem pagamento):** Mostrar um checkout wizard com steps (Pedido Criado -> Horario selecionado -> Pagamento)
- **Para pedidos com pagamento ja feito:** Mostrar o acompanhamento (stepper de progresso do servico)
- **Remover:** secao "Mensagens" inline e secao "Acoes"
- **Chat:** Botao de chat so aparece se pagamento aprovado

**Step 1: Reescrever OrderDetails.tsx**

Substituir completamente o conteudo de `frontend/src/pages/orders/OrderDetails.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  MessageSquare,
  Star,
  ArrowLeft,
  CreditCard,
  Calendar,
  AlertCircle,
  Bell,
  Loader2,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { SkeletonOrderCard, Skeleton, SkeletonText } from "../../components/common/Skeleton";
import {
  getOrderById,
  acceptOrder,
  startOrder,
  submitOrderCompletion,
  confirmOrderCompletion,
  confirmProfessionalCompletion,
  cancelOrder,
  createPayment,
  releasePayment,
  createReview,
} from "../../services/serviceService";
import { ServiceOrder, ServiceOrderStatus } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatOrderStatus,
  formatPaymentStatus,
} from "../../utils/formatters";

// =====================================
// CHECKOUT STEPPER (pedidos sem pagamento)
// =====================================
interface CheckoutStepperProps {
  currentStep: number; // 0=criado, 1=horario, 2=pagamento
}

const CHECKOUT_STEPS = [
  { label: "Pedido Criado", icon: <CheckCircle className="w-4 h-4" /> },
  { label: "Horario", icon: <Calendar className="w-4 h-4" /> },
  { label: "Pagamento", icon: <CreditCard className="w-4 h-4" /> },
];

const CheckoutStepper: React.FC<CheckoutStepperProps> = ({ currentStep }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      {CHECKOUT_STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                    : isCurrent
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                }`}
              >
                {isCompleted ? <CheckCircle className="w-5 h-5" /> : step.icon}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCompleted || isCurrent
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < CHECKOUT_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  isCompleted
                    ? "bg-green-300 dark:bg-green-700"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// =====================================
// ORDER PROGRESS STEPPER (pedidos pagos - acompanhamento)
// =====================================
interface OrderProgressStepperProps {
  order: ServiceOrder;
}

const OrderProgressStepper: React.FC<OrderProgressStepperProps> = ({ order }) => {
  const getSteps = () => {
    const steps = [
      {
        label: "Servico Iniciado",
        description: "Pagamento aprovado",
        done: true, // Sempre verde pois pagamento ja foi aprovado
        icon: <CheckCircle className="w-4 h-4" />,
      },
      {
        label: "Aguardando Profissional",
        description: "Profissional precisa confirmar o servico",
        done: [
          "ACCEPTED", "IN_PROGRESS",
          "AWAITING_CLIENT_CONFIRMATION",
          "AWAITING_PROFESSIONAL_CONFIRMATION",
          "COMPLETED",
        ].includes(order.status),
        icon: <User className="w-4 h-4" />,
      },
      {
        label: "Servico em Andamento",
        description: "Profissional esta realizando o servico",
        done: [
          "IN_PROGRESS",
          "AWAITING_CLIENT_CONFIRMATION",
          "AWAITING_PROFESSIONAL_CONFIRMATION",
          "COMPLETED",
        ].includes(order.status),
        icon: <Clock className="w-4 h-4" />,
      },
      {
        label: "Aguardando Confirmacao",
        description: order.status === "AWAITING_CLIENT_CONFIRMATION"
          ? "Confirme que o servico foi concluido"
          : order.status === "AWAITING_PROFESSIONAL_CONFIRMATION"
          ? "Aguardando profissional confirmar"
          : "Cliente e profissional confirmam conclusao",
        done: ["AWAITING_PROFESSIONAL_CONFIRMATION", "COMPLETED"].includes(order.status),
        icon: <CheckCircle className="w-4 h-4" />,
      },
      {
        label: "Concluido",
        description: "Servico finalizado com sucesso",
        done: order.status === "COMPLETED",
        icon: <Star className="w-4 h-4" />,
      },
    ];
    return steps;
  };

  const steps = getSteps();

  return (
    <div className="relative">
      {steps.map((step, index) => (
        <div key={index} className="relative flex items-start gap-3 pb-6 last:pb-0">
          {index < steps.length - 1 && (
            <div
              className={`absolute left-4 top-8 w-0.5 h-[calc(100%-8px)] ${
                step.done
                  ? "bg-green-300 dark:bg-green-700"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          )}
          <div
            className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              step.done
                ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
            }`}
          >
            {step.icon}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p
              className={`text-sm font-medium ${
                step.done
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {step.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

// =====================================
// MAIN ORDER DETAILS COMPONENT
// =====================================
const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    variant: "danger" | "warning" | "info";
    confirmLabel: string;
    action: () => Promise<any>;
  } | null>(null);

  // Review state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState("pix");

  const isOrderClient = order?.clientId === user?.id;
  const isOrderProfessional = order?.professionalId === user?.id;
  const chatRoute = isOrderProfessional
    ? `/professional/services/${id}/chat`
    : `/client/orders/${id}/chat`;

  const loadOrder = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const orderData = await getOrderById(parseInt(id));
      setOrder(orderData);
      if (orderData.reviews && orderData.reviews.length > 0) {
        const myReview = orderData.reviews.find((r: any) => r.authorId === user?.id);
        if (myReview) setReviewSubmitted(true);
      }
    } catch (err) {
      setError("Erro ao carregar pedido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  const handleAction = async (action: () => Promise<any>, successMsg?: string) => {
    try {
      setActionLoading(true);
      setError(null);
      await action();
      await loadOrder();
      toast.success(successMsg || "Acao realizada com sucesso");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao executar acao";
      setError(msg);
      toast.error("Erro", msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    await handleAction(confirmAction.action);
    setConfirmAction(null);
  };

  const handlePayment = async () => {
    if (!order) return;
    try {
      setActionLoading(true);
      setError(null);
      await createPayment(order.id, paymentMethod);
      // Redirecionar para pagina de confirmacao
      navigate(`/client/orders/${order.id}/payment-confirmed`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao processar pagamento";
      setError(msg);
      toast.error("Erro no pagamento", msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!order) return;
    try {
      setActionLoading(true);
      await createReview(order.id, { rating: reviewRating, comment: reviewComment || undefined });
      setReviewSubmitted(true);
      await loadOrder();
      toast.success("Avaliacao enviada!");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao enviar avaliacao");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="container mx-auto px-4 py-8 max-w-4xl animate-pulse space-y-6">
      <Skeleton className="h-6 w-40 rounded" />
      <SkeletonOrderCard />
      <SkeletonText lines={5} />
    </div>
  );

  if (!order) return (
    <div className="text-center py-12 text-slate-600 dark:text-slate-400">
      Pedido nao encontrado
    </div>
  );

  const activePayment = order.payments?.find((p) => p.status === "HELD" || p.status === "RELEASED");
  const hasPendingPayment = order.payments?.some((p) => p.status === "HELD");
  const hasReleasedPayment = order.payments?.some((p) => p.status === "RELEASED");
  const needsPayment = !order.payments?.length || order.payments.every((p) => p.status === "FAILED" || p.status === "REFUNDED");
  const paymentApproved = !!activePayment;

  // Determinar checkout step
  const getCheckoutStep = (): number => {
    if (paymentApproved) return 3; // Pagamento feito
    if (order.scheduledDate) return 2; // Horario selecionado, falta pagar
    return 1; // Pedido criado, falta horario (mas horario ja foi selecionado na ServiceDetails)
  };

  const isCheckoutPhase = isOrderClient && needsPayment && ["PENDING", "ACCEPTED"].includes(order.status);
  const isTrackingPhase = paymentApproved || ["IN_PROGRESS", "AWAITING_CLIENT_CONFIRMATION", "AWAITING_PROFESSIONAL_CONFIRMATION", "COMPLETED"].includes(order.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{order.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pedido #{order.id} - {formatRelativeTime(order.createdAt)}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          order.status === "COMPLETED" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
          order.status === "CANCELLED" ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" :
          order.status === "AWAITING_CLIENT_CONFIRMATION" || order.status === "AWAITING_PROFESSIONAL_CONFIRMATION" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
          order.status === "IN_PROGRESS" ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" :
          order.status === "PENDING" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" :
          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
        }`}>
          {formatOrderStatus(order.status)}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* CHECKOUT STEPPER (pre-pagamento) */}
      {isCheckoutPhase && (
        <div className="card">
          <CheckoutStepper currentStep={order.scheduledDate ? 2 : 1} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info do pedido */}
          <div className="card">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Detalhes do Pedido</h2>
            {order.description && (
              <p className="text-slate-600 dark:text-slate-400 mb-4">{order.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Valor</span>
                <p className="font-semibold text-lg text-primary-600">{formatCurrency(order.price)}</p>
              </div>
              {order.scheduledDate && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Agendado para</span>
                  <p className="font-medium">{formatDateTime(order.scheduledDate)}</p>
                </div>
              )}
              <div>
                <span className="text-slate-500 dark:text-slate-400">Criado em</span>
                <p className="font-medium">{formatDateTime(order.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* CHECKOUT: Pagamento (apenas se esta na fase de checkout) */}
          {isCheckoutPhase && isOrderClient && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
                <CreditCard className="w-5 h-5 inline mr-2" />
                Pagamento
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Selecione o metodo de pagamento para confirmar seu pedido:
                </p>
                <div className="flex gap-3">
                  {["pix", "cartao", "boleto"].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-4 py-3 rounded-lg text-sm font-medium border transition-colors flex-1 ${
                        paymentMethod === method
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {method === "pix" ? "PIX" : method === "cartao" ? "Cartao" : "Boleto"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handlePayment}
                  disabled={actionLoading}
                  className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pagar {formatCurrency(order.price)}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TRACKING: Progresso do servico (apos pagamento) */}
          {isTrackingPhase && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Progresso do Servico</h2>
              <OrderProgressStepper order={order} />
            </div>
          )}

          {/* Acoes do profissional (somente visivel para o profissional) */}
          {isOrderProfessional && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Acoes</h2>
              <div className="flex flex-wrap gap-3">
                {order.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => handleAction(() => acceptOrder(order.id), "Pedido aceito!")}
                      disabled={actionLoading}
                      className="btn btn-primary"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Aceitar Pedido
                    </button>
                    <button
                      onClick={() =>
                        setConfirmAction({
                          title: "Recusar pedido",
                          message: "Tem certeza que deseja recusar este pedido?",
                          variant: "danger",
                          confirmLabel: "Recusar",
                          action: () => cancelOrder(order.id, "Recusado pelo profissional"),
                        })
                      }
                      disabled={actionLoading}
                      className="btn btn-outline text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Recusar
                    </button>
                  </>
                )}
                {order.status === "ACCEPTED" && (
                  <button
                    onClick={() => handleAction(() => startOrder(order.id), "Servico iniciado!")}
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Iniciar Servico
                  </button>
                )}
                {order.status === "IN_PROGRESS" && (
                  <button
                    onClick={() => handleAction(() => submitOrderCompletion(order.id), "Servico marcado como entregue!")}
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Entregue
                  </button>
                )}
                {order.status === "AWAITING_PROFESSIONAL_CONFIRMATION" && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Confirmar conclusao",
                        message: "Confirme que o servico foi concluido conforme combinado.",
                        variant: "warning",
                        confirmLabel: "Confirmar Conclusao",
                        action: () => confirmProfessionalCompletion(order.id),
                      })
                    }
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar Conclusao
                  </button>
                )}
                {order.status === "AWAITING_CLIENT_CONFIRMATION" && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Aguardando o cliente confirmar para finalizar o pedido.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Acoes do cliente (confirmacao e cancelamento - apenas em Meus Pedidos) */}
          {isOrderClient && (
            <div className="card">
              <div className="flex flex-wrap gap-3">
                {/* Botao de Chat - so aparece apos pagamento aprovado */}
                {paymentApproved && !["CANCELLED", "EXPIRED"].includes(order.status) && (
                  <button
                    onClick={() => navigate(chatRoute)}
                    className="btn btn-outline flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Abrir chat do servico
                  </button>
                )}

                {/* Cliente confirma conclusao */}
                {order.status === "AWAITING_CLIENT_CONFIRMATION" && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Confirmar conclusao",
                        message: "Ao confirmar, voce atesta que o servico foi entregue conforme combinado.",
                        variant: "warning",
                        confirmLabel: "Confirmar",
                        action: () => confirmOrderCompletion(order.id),
                      })
                    }
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirmar conclusao do servico
                  </button>
                )}

                {/* Aguardando confirmacao do profissional */}
                {order.status === "AWAITING_PROFESSIONAL_CONFIRMATION" && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Voce ja confirmou! Aguardando o profissional confirmar a conclusao do servico.
                    </p>
                  </div>
                )}

                {/* Liberar pagamento */}
                {order.status === "COMPLETED" && hasPendingPayment && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Liberar pagamento",
                        message: "Ao liberar, o valor sera transferido ao profissional. Esta acao nao pode ser desfeita.",
                        variant: "warning",
                        confirmLabel: "Liberar",
                        action: () => releasePayment(order.id),
                      })
                    }
                    disabled={actionLoading}
                    className="btn btn-primary"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Liberar Pagamento
                  </button>
                )}

                {/* Cancelar pedido (somente pre-pagamento) */}
                {["PENDING", "ACCEPTED"].includes(order.status) && needsPayment && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        title: "Cancelar pedido",
                        message: "Tem certeza que deseja cancelar este pedido?",
                        variant: "danger",
                        confirmLabel: "Cancelar pedido",
                        action: () => cancelOrder(order.id, "Cancelado pelo cliente"),
                      })
                    }
                    disabled={actionLoading}
                    className="btn btn-outline text-red-600 dark:text-red-400 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar Pedido
                  </button>
                )}

                {/* Status finais */}
                {order.status === "CANCELLED" && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Este pedido foi cancelado.</p>
                )}
                {order.status === "COMPLETED" && hasReleasedPayment && (
                  <p className="text-sm text-green-600">Pagamento liberado com sucesso!</p>
                )}
              </div>
            </div>
          )}

          {/* Avaliacao (apenas apos conclusao) */}
          {order.status === "COMPLETED" && (
            <div className="card">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Avaliacao</h2>
              {reviewSubmitted ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-slate-600 dark:text-slate-400">Avaliacao enviada com sucesso!</p>
                  {order.reviews && order.reviews.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {order.reviews.map((review) => (
                        <div key={review.id} className="text-left bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`w-4 h-4 ${s <= review.rating ? "text-yellow-500 fill-current" : "text-slate-300 dark:text-slate-600"}`} />
                              ))}
                            </div>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              por {review.author?.name}
                            </span>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nota</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => setReviewRating(s)} className="p-1">
                          <Star className={`w-8 h-8 transition-colors ${s <= reviewRating ? "text-yellow-500 fill-current" : "text-slate-300 dark:text-slate-600 hover:text-yellow-300"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Comentario (opcional)
                    </label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Como foi sua experiencia?"
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button onClick={handleSubmitReview} disabled={actionLoading} className="btn btn-primary">
                    Enviar Avaliacao
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info do outro usuario */}
          <div className="card">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {isOrderClient ? "Profissional" : "Cliente"}
            </h3>
            {(() => {
              const otherUser = isOrderClient ? order.professional : order.client;
              if (!otherUser) return <p className="text-sm text-slate-500 dark:text-slate-400">Nao atribuido</p>;
              return (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                    {otherUser.profileImage ? (
                      <img src={otherUser.profileImage} alt={otherUser.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                        {otherUser.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{otherUser.name}</p>
                    {(otherUser as any).ratingAverage !== undefined && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {(otherUser as any).ratingAverage?.toFixed(1)} ({(otherUser as any).totalReviews})
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Pagamento info (apos pago) */}
          {activePayment && (
            <div className="card">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Pagamento</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Valor</span>
                  <span className="font-medium">{formatCurrency(activePayment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <span className={`font-medium ${
                    activePayment.status === "HELD" ? "text-yellow-600 dark:text-yellow-400" :
                    activePayment.status === "RELEASED" ? "text-green-600 dark:text-green-400" :
                    "text-slate-600 dark:text-slate-400"
                  }`}>
                    {formatPaymentStatus(activePayment.status)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Metodo</span>
                  <span className="font-medium capitalize">{activePayment.paymentMethod}</span>
                </div>
                {activePayment.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Pago em</span>
                    <span className="font-medium">{formatDate(activePayment.paidAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Endereco */}
          {order.address && (
            <div className="card">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Endereco</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {order.address.street}, {order.address.number}
                {order.address.complement && ` - ${order.address.complement}`}
                <br />
                {order.address.neighborhood} - {order.address.city}/{order.address.state}
                <br />
                CEP: {order.address.zipCode}
              </p>
              {order.addressNotes && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Obs: {order.addressNotes}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmAction !== null}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmedAction}
        title={confirmAction?.title || ""}
        message={confirmAction?.message || ""}
        confirmLabel={confirmAction?.confirmLabel || "Confirmar"}
        variant={confirmAction?.variant || "danger"}
        loading={actionLoading}
      />
    </div>
  );
};

export default OrderDetails;
```

**Step 2: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: refactor OrderDetails with checkout wizard and tracking stepper, remove inline messages and actions"
```

---

## Task 6: Atualizar OrderCard para incluir novo status

**Files:**
- Modify: `frontend/src/components/orders/OrderCard.tsx`

**Step 1: Adicionar config para novo status**

Em `frontend/src/components/orders/OrderCard.tsx`, adicionar no objeto `statusConfig`:

```typescript
[ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION]: {
  color: "text-orange-600",
  bgColor: "bg-orange-100 dark:bg-orange-900/30",
  icon: <Clock className="w-4 h-4" />,
},
```

**Step 2: Commit**

```bash
git add frontend/src/components/orders/OrderCard.tsx
git commit -m "feat: add AWAITING_PROFESSIONAL_CONFIRMATION status to OrderCard"
```

---

## Task 7: Atualizar formatters para novo status

**Files:**
- Modify: `frontend/src/utils/formatters.ts`

**Step 1: Adicionar formatacao do novo status**

Em `frontend/src/utils/formatters.ts`, na funcao `formatOrderStatus`, adicionar case:

```typescript
case "AWAITING_PROFESSIONAL_CONFIRMATION":
  return "Aguardando Profissional";
```

**Step 2: Commit**

```bash
git add frontend/src/utils/formatters.ts
git commit -m "feat: add format for AWAITING_PROFESSIONAL_CONFIRMATION status"
```

---

## Task 8: Atualizar ServiceOrdersList com novo status no tab

**Files:**
- Modify: `frontend/src/components/orders/ServiceOrdersList.tsx`

**Step 1: Adicionar tab para novo status**

Em `frontend/src/components/orders/ServiceOrdersList.tsx`:

No `roleConfigs.client.statusLabels`, adicionar:
```typescript
[ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION]: "Aguardando Profissional",
```

No `roleConfigs.professional.statusLabels`, adicionar:
```typescript
[ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION]: "Confirmar Conclusao",
```

No array `statusTabs`, adicionar antes de "Concluidos":
```typescript
{ id: ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION, label: config.statusLabels[ServiceOrderStatus.AWAITING_PROFESSIONAL_CONFIRMATION] || "Aguardando Profissional" },
```

**Step 2: Commit**

```bash
git add frontend/src/components/orders/ServiceOrdersList.tsx
git commit -m "feat: add AWAITING_PROFESSIONAL_CONFIRMATION tab to orders list"
```

---

## Task 9: Adicionar gate de chat no backend - so permitir apos pagamento

**Files:**
- Modify: `backend/src/controllers/serviceController.ts` (funcao `sendMessage`)

**Step 1: Adicionar verificacao de pagamento no sendMessage**

Em `backend/src/controllers/serviceController.ts`, na funcao `sendMessage`, apos verificar se o usuario esta envolvido no pedido, adicionar:

```typescript
// Verificar se pagamento foi aprovado antes de permitir chat
const hasApprovedPayment = await prisma.payment.findFirst({
  where: {
    serviceOrderId: orderId,
    status: { in: ["HELD", "RELEASED"] },
  },
});

if (!hasApprovedPayment && !isAdmin) {
  res.status(403).json(
    errorResponse("Chat so esta disponivel apos o pagamento ser aprovado")
  );
  return;
}
```

**Step 2: Commit**

```bash
git add backend/src/controllers/serviceController.ts
git commit -m "feat: gate chat behind payment approval"
```

---

## Task 10: Atualizar backend validStatuses e cancelamento para incluir novo status

**Files:**
- Modify: `backend/src/controllers/serviceController.ts`

**Step 1: Atualizar validStatuses no getUserServiceOrders**

Na funcao `getUserServiceOrders`, adicionar `"AWAITING_PROFESSIONAL_CONFIRMATION"` ao array `validStatuses`:

```typescript
const validStatuses = [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
  "AWAITING_CLIENT_CONFIRMATION",
  "AWAITING_PROFESSIONAL_CONFIRMATION",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "DISPUTED",
];
```

**Step 2: Exportar nova funcao no default export**

Adicionar `confirmProfessionalCompletion` ao objeto default export.

**Step 3: Commit**

```bash
git add backend/src/controllers/serviceController.ts
git commit -m "feat: update backend to handle new AWAITING_PROFESSIONAL_CONFIRMATION status"
```

---

## Task 11: Teste de integracao manual e cleanup

**Step 1: Rodar o build do frontend**

Run: `cd /home/levybonito/faztudo/frontend && npm run build`
Expected: Build sem erros

**Step 2: Rodar o build do backend**

Run: `cd /home/levybonito/faztudo/backend && npx tsc --noEmit`
Expected: Sem erros de tipo

**Step 3: Verificar que a migration do Prisma foi aplicada**

Run: `cd /home/levybonito/faztudo/backend && npx prisma generate`
Expected: Prisma Client gerado com sucesso

**Step 4: Commit final se necessario**

```bash
git add -A
git commit -m "chore: final cleanup and build verification"
```

---

## Resumo de arquivos afetados

### Backend:
| Arquivo | Acao |
|---------|------|
| `backend/prisma/schema.prisma` | Adicionar AWAITING_PROFESSIONAL_CONFIRMATION ao enum |
| `backend/src/controllers/serviceController.ts` | Adicionar confirmProfessionalCompletion, alterar confirmServiceOrderCompletion, gate de chat |
| `backend/src/routes/serviceRoutes.ts` | Adicionar rota confirm-professional |

### Frontend:
| Arquivo | Acao |
|---------|------|
| `frontend/src/types/index.ts` | Adicionar AWAITING_PROFESSIONAL_CONFIRMATION ao enum |
| `frontend/src/services/serviceService.ts` | Adicionar confirmProfessionalCompletion |
| `frontend/src/pages/services/ServiceDetails.tsx` | Adicionar AvailabilityPicker ao fluxo de contratacao |
| `frontend/src/pages/orders/OrderDetails.tsx` | Reescrever com checkout wizard + tracking stepper, remover mensagens e acoes |
| `frontend/src/pages/checkout/PaymentConfirmation.tsx` | CRIAR - pagina de confirmacao verde |
| `frontend/src/components/orders/AvailabilityPicker.tsx` | CRIAR - picker de data/hora |
| `frontend/src/components/orders/OrderCard.tsx` | Adicionar novo status |
| `frontend/src/components/orders/ServiceOrdersList.tsx` | Adicionar tab para novo status |
| `frontend/src/utils/formatters.ts` | Adicionar formatacao do novo status |
| `frontend/src/App.tsx` | Adicionar rota payment-confirmed |

### Sobre "Profissional a Caminho":
Conforme sua duvida: **NAO** adicionaremos "profissional a caminho" porque seria estranho para servicos agendados para dias futuros. O fluxo ficara: Servico Iniciado -> Aguardando Profissional -> Servico em Andamento -> Confirmacoes -> Concluido.
