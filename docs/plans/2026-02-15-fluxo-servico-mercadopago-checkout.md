# Integração Fluxo Real de Serviço + Mercado Pago Checkout Transparente

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar o fluxo completo de serviço entre cliente e profissional com checkout transparente do Mercado Pago (cartão, PIX, boleto), notificações visuais em cada etapa, confirmação dupla de conclusão e review pós-serviço.

**Architecture:** O checkout atual redireciona para o Mercado Pago (Checkout Pro). Vamos migrar para Checkout Transparente, onde o pagamento acontece dentro do próprio site. O backend criará pagamentos via API do MP e o frontend terá uma página de checkout dedicada com formulários de cartão, PIX QR code e boleto. O fluxo de status do pedido seguirá: PENDING → (pagamento) → ACCEPTED → IN_PROGRESS → AWAITING_CLIENT_CONFIRMATION → COMPLETED → PAYMENT_RELEASED. Notificações visuais (toasts, banners, modais) guiarão ambos os lados.

**Tech Stack:** React 18 + Vite + TailwindCSS (frontend), Express 5 + Prisma 7 + SQLite (backend), MercadoPago SDK Node.js v2.12.0, Zod validation

---

## Análise do Fluxo e Respostas às Perguntas

### Como o cliente quer receber informações/notifiers sobre o serviço?
- **Toast imediato** ao realizar pagamento (sucesso/falha/pendente)
- **Banner de status** no topo da página de detalhes do pedido mostrando o estado atual com cores e ícones
- **Notificação no sistema** para cada mudança de status (pagamento confirmado, profissional aceitou, profissional a caminho, serviço iniciado, serviço concluído)
- **Timeline visual** atualizada em tempo real no OrderDetails
- **Badge de notificação** no menu com contagem de não lidas
- **CTA proativo** para avaliar o serviço após conclusão

### Que tipo de informações o profissional precisa para completar o serviço?
- **Endereço completo** do cliente com link para Google Maps
- **Detalhes do serviço** (descrição, imagens do brief, notas)
- **Data/horário agendado**
- **Dados do cliente** (nome, telefone)
- **Status do pagamento** (confirmado antes de ir ao local)
- **Chat disponível** para troca de informações adicionais

### Como deixar o fluxo simples de entender para ambos?
- **Stepper visual** mostrando em qual etapa do fluxo estão
- **Ações contextuais** — só mostrar botões relevantes para o estado atual
- **Banners informativos** explicando o que acontece a seguir
- **Notificações descritivas** em português com próxima ação esperada
- **Confirmação dupla visual** — ambos veem quem já confirmou

---

## Resumo das Tasks

| # | Task | Descrição |
|---|------|-----------|
| 1 | Backend: Endpoint de Public Key MP | Expor a public key do MP para o frontend |
| 2 | Backend: Checkout Transparente - Cartão | Criar endpoint de pagamento com cartão via API do MP |
| 3 | Backend: Checkout Transparente - PIX | Criar endpoint de pagamento PIX com retorno de QR code |
| 4 | Backend: Checkout Transparente - Boleto | Criar endpoint de pagamento com boleto bancário |
| 5 | Backend: Melhorar Webhook MP | Aprimorar webhook para processar todos os tipos de pagamento |
| 6 | Backend: Notificações de Fluxo | Adicionar notificações para cada etapa do fluxo |
| 7 | Backend: Confirmação Dupla | Implementar flags de confirmação dupla (clientConfirmed/professionalConfirmed) |
| 8 | Frontend: Página de Checkout | Criar página de checkout com formulários de cartão, PIX e boleto |
| 9 | Frontend: Status Banners e Stepper | Banners visuais de status e stepper no OrderDetails |
| 10 | Frontend: Confirmação Dupla Visual | UI de confirmação dupla com indicadores visuais |
| 11 | Frontend: Review CTA pós-serviço | CTA proativo para avaliação com upload de imagens |
| 12 | Frontend: Notificações Toast do Fluxo | Toasts contextuais para cada etapa do fluxo |
| 13 | Integração: Rotas e Navegação | Conectar checkout ao fluxo, adicionar rotas |
| 14 | Testes Funcionais | Testar o fluxo completo end-to-end |

---

### Task 1: Backend - Endpoint de Public Key do Mercado Pago

**Files:**
- Modify: `backend/src/routes/serviceRoutes.ts`
- Modify: `backend/src/controllers/service/paymentController.ts`

**Step 1: Adicionar endpoint de public key no paymentController**

Adicionar ao final de `backend/src/controllers/service/paymentController.ts`:

```typescript
// Retorna public key do MercadoPago para o frontend
export const getMercadoPagoPublicKey = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const publicKey = env.MP_PUBLIC_KEY;
    if (!publicKey) {
      res.status(500).json(errorResponse("MercadoPago public key not configured", 500));
      return;
    }

    res.status(200).json(successResponse({
      publicKey,
      sandbox: env.MP_SANDBOX,
    }, "MercadoPago config retrieved"));
  } catch (error) {
    console.error("Get MP config error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 2: Registrar rota no serviceRoutes**

Em `backend/src/routes/serviceRoutes.ts`, importar `getMercadoPagoPublicKey` e adicionar:

```typescript
router.get("/payments/config", verifyToken, getMercadoPagoPublicKey);
```

**Step 3: Commit**

```bash
git add backend/src/controllers/service/paymentController.ts backend/src/routes/serviceRoutes.ts
git commit -m "feat: add endpoint to expose MercadoPago public key to frontend"
```

---

### Task 2: Backend - Checkout Transparente com Cartão de Crédito

**Files:**
- Modify: `backend/src/services/mercadopagoService.ts`
- Modify: `backend/src/controllers/service/paymentController.ts`
- Modify: `backend/src/config/mercadopago.ts`

**Step 1: Adicionar Order client ao config do MP**

Em `backend/src/config/mercadopago.ts`, importar e exportar `Order`:

```typescript
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
// A SDK v2.12.0 usa Payment para checkout transparente
// Não precisa de "Order" - usamos Payment.create() diretamente
```

Verificar que `getPaymentClient()` já existe — já temos isso. ✓

**Step 2: Adicionar função de pagamento com cartão no mercadopagoService**

Adicionar ao `backend/src/services/mercadopagoService.ts`:

```typescript
import { getPreferenceClient, getPaymentClient } from "../config/mercadopago";
import { env } from "../config/env";

// ... interfaces existentes ...

export interface CreateCardPaymentParams {
  orderId: number;
  token: string;
  paymentMethodId: string;
  installments: number;
  amount: number;
  payerEmail: string;
  payerName: string;
  payerCPF: string;
  externalReference: string;
  description: string;
}

export interface MPPaymentResult {
  id: number;
  status: string;
  statusDetail: string;
  paymentMethodId: string;
  installments: number;
  transactionAmount: number;
  dateApproved: string | null;
}

/**
 * Cria pagamento com cartão de crédito via Checkout Transparente
 */
export async function createCardPayment(
  params: CreateCardPaymentParams
): Promise<MPPaymentResult> {
  const payment = getPaymentClient();

  const response = await payment.create({
    body: {
      transaction_amount: params.amount,
      token: params.token,
      description: params.description,
      installments: params.installments,
      payment_method_id: params.paymentMethodId,
      payer: {
        email: params.payerEmail,
        first_name: params.payerName.split(" ")[0],
        last_name: params.payerName.split(" ").slice(1).join(" ") || params.payerName,
        identification: {
          type: "CPF",
          number: params.payerCPF,
        },
      },
      external_reference: params.externalReference,
      notification_url: `${process.env.BACKEND_URL || `http://localhost:${env.PORT}`}/api/payments/webhook`,
      statement_descriptor: "FAZTUDO",
    },
    requestOptions: {
      idempotencyKey: `card-${params.externalReference}`,
    },
  });

  return {
    id: response.id!,
    status: response.status!,
    statusDetail: response.status_detail!,
    paymentMethodId: response.payment_method_id!,
    installments: response.installments!,
    transactionAmount: response.transaction_amount!,
    dateApproved: response.date_approved || null,
  };
}
```

**Step 3: Adicionar função de pagamento PIX**

Adicionar ao `backend/src/services/mercadopagoService.ts`:

```typescript
export interface CreatePixPaymentParams {
  orderId: number;
  amount: number;
  payerEmail: string;
  payerName: string;
  payerCPF: string;
  externalReference: string;
  description: string;
}

export interface MPPixResult {
  id: number;
  status: string;
  statusDetail: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  expirationDate: string;
}

/**
 * Cria pagamento PIX via Checkout Transparente
 */
export async function createPixPayment(
  params: CreatePixPaymentParams
): Promise<MPPixResult> {
  const payment = getPaymentClient();

  const response = await payment.create({
    body: {
      transaction_amount: params.amount,
      description: params.description,
      payment_method_id: "pix",
      payer: {
        email: params.payerEmail,
        first_name: params.payerName.split(" ")[0],
        last_name: params.payerName.split(" ").slice(1).join(" ") || params.payerName,
        identification: {
          type: "CPF",
          number: params.payerCPF,
        },
      },
      external_reference: params.externalReference,
      notification_url: `${process.env.BACKEND_URL || `http://localhost:${env.PORT}`}/api/payments/webhook`,
    },
    requestOptions: {
      idempotencyKey: `pix-${params.externalReference}`,
    },
  });

  const pointOfInteraction = (response as any).point_of_interaction?.transaction_data;

  return {
    id: response.id!,
    status: response.status!,
    statusDetail: response.status_detail!,
    qrCode: pointOfInteraction?.qr_code || "",
    qrCodeBase64: pointOfInteraction?.qr_code_base64 || "",
    ticketUrl: pointOfInteraction?.ticket_url || "",
    expirationDate: (response as any).date_of_expiration || "",
  };
}
```

**Step 4: Adicionar função de pagamento com Boleto**

Adicionar ao `backend/src/services/mercadopagoService.ts`:

```typescript
export interface CreateBoletoPaymentParams {
  orderId: number;
  amount: number;
  payerEmail: string;
  payerName: string;
  payerCPF: string;
  externalReference: string;
  description: string;
}

export interface MPBoletoResult {
  id: number;
  status: string;
  statusDetail: string;
  boletoUrl: string;
  barcode: string;
  expirationDate: string;
}

/**
 * Cria pagamento com Boleto Bancário via Checkout Transparente
 */
export async function createBoletoPayment(
  params: CreateBoletoPaymentParams
): Promise<MPBoletoResult> {
  const payment = getPaymentClient();

  const response = await payment.create({
    body: {
      transaction_amount: params.amount,
      description: params.description,
      payment_method_id: "bolbradesco",
      payer: {
        email: params.payerEmail,
        first_name: params.payerName.split(" ")[0],
        last_name: params.payerName.split(" ").slice(1).join(" ") || params.payerName,
        identification: {
          type: "CPF",
          number: params.payerCPF,
        },
      },
      external_reference: params.externalReference,
      notification_url: `${process.env.BACKEND_URL || `http://localhost:${env.PORT}`}/api/payments/webhook`,
    },
    requestOptions: {
      idempotencyKey: `boleto-${params.externalReference}`,
    },
  });

  const transactionData = (response as any).transaction_details;

  return {
    id: response.id!,
    status: response.status!,
    statusDetail: response.status_detail!,
    boletoUrl: transactionData?.external_resource_url || "",
    barcode: transactionData?.barcode?.content || (response as any).barcode?.content || "",
    expirationDate: (response as any).date_of_expiration || "",
  };
}
```

**Step 5: Commit**

```bash
git add backend/src/services/mercadopagoService.ts backend/src/config/mercadopago.ts
git commit -m "feat: add transparent checkout payment functions for card, PIX and boleto"
```

---

### Task 3: Backend - Refatorar Controller de Pagamento para Checkout Transparente

**Files:**
- Modify: `backend/src/controllers/service/paymentController.ts`
- Modify: `backend/src/routes/serviceRoutes.ts`

**Step 1: Refatorar createPayment para suportar checkout transparente**

Reescrever o `createPayment` em `backend/src/controllers/service/paymentController.ts`. O novo controller recebe `paymentMethod` ("credit_card", "pix", "boleto") e os dados correspondentes, e chama a função correta do mercadopagoService:

```typescript
// Tipos para checkout transparente
interface CheckoutTransparenteBody {
  paymentMethod: "credit_card" | "pix" | "boleto";
  // Para cartão de crédito
  token?: string;
  paymentMethodId?: string;
  installments?: number;
  // Dados do pagador (todos os métodos)
  payerEmail?: string;
  payerName?: string;
  payerCPF?: string;
}

export const createPayment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "CLIENT") {
      res.status(403).json(errorResponse("Only clients can create payments"));
      return;
    }

    const orderId = parseInt(String(req.params.orderId), 10);
    const body: CheckoutTransparenteBody = req.body;

    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    if (!body.paymentMethod) {
      res.status(400).json(errorResponse("Payment method is required"));
      return;
    }

    if (!body.payerEmail || !body.payerName || !body.payerCPF) {
      res.status(400).json(errorResponse("Payer email, name and CPF are required"));
      return;
    }

    // Validar campos específicos do cartão
    if (body.paymentMethod === "credit_card") {
      if (!body.token || !body.paymentMethodId) {
        res.status(400).json(errorResponse("Card token and payment method ID are required for credit card payments"));
        return;
      }
    }

    // Buscar pedido
    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        professional: true,
        client: true,
        serviceListing: true,
        payments: {
          where: {
            status: { in: ["PENDING", "HELD"] },
          },
        },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.clientId !== req.user.id) {
      res.status(403).json(errorResponse("You don't have permission to pay for this order"));
      return;
    }

    if (serviceOrder.status !== "PENDING" && serviceOrder.status !== "ACCEPTED") {
      res.status(400).json(errorResponse(`Payment cannot be processed. Order status: ${serviceOrder.status}`));
      return;
    }

    if (serviceOrder.payments.length > 0) {
      res.status(400).json(errorResponse("There is already an active payment for this order"));
      return;
    }

    // Calcular taxas
    const platformFeePercentage = env.PLATFORM_FEE_PERCENTAGE;
    const platformFee = (serviceOrder.price * platformFeePercentage) / 100;
    const professionalAmount = serviceOrder.price - platformFee;
    const externalReference = `order-${orderId}-${Date.now()}`;

    let mpResult: any = null;
    let paymentData: any = {};

    try {
      if (body.paymentMethod === "credit_card") {
        const result = await createCardPayment({
          orderId,
          token: body.token!,
          paymentMethodId: body.paymentMethodId!,
          installments: body.installments || 1,
          amount: serviceOrder.price,
          payerEmail: body.payerEmail,
          payerName: body.payerName,
          payerCPF: body.payerCPF,
          externalReference,
          description: serviceOrder.title,
        });
        mpResult = result;
        paymentData = {
          mpPaymentId: result.id,
          mpStatus: result.status,
          mpStatusDetail: result.statusDetail,
          paymentType: "credit_card",
        };
      } else if (body.paymentMethod === "pix") {
        const result = await createPixPayment({
          orderId,
          amount: serviceOrder.price,
          payerEmail: body.payerEmail,
          payerName: body.payerName,
          payerCPF: body.payerCPF,
          externalReference,
          description: serviceOrder.title,
        });
        mpResult = result;
        paymentData = {
          mpPaymentId: result.id,
          mpStatus: result.status,
          mpStatusDetail: result.statusDetail,
          paymentType: "pix",
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          ticketUrl: result.ticketUrl,
          expirationDate: result.expirationDate,
        };
      } else if (body.paymentMethod === "boleto") {
        const result = await createBoletoPayment({
          orderId,
          amount: serviceOrder.price,
          payerEmail: body.payerEmail,
          payerName: body.payerName,
          payerCPF: body.payerCPF,
          externalReference,
          description: serviceOrder.title,
        });
        mpResult = result;
        paymentData = {
          mpPaymentId: result.id,
          mpStatus: result.status,
          mpStatusDetail: result.statusDetail,
          paymentType: "boleto",
          boletoUrl: result.boletoUrl,
          barcode: result.barcode,
          expirationDate: result.expirationDate,
        };
      }
    } catch (mpError: any) {
      console.error("MercadoPago payment creation failed:", mpError);

      // Em dev, criar pagamento local como fallback
      if (env.NODE_ENV !== "production") {
        console.warn("⚠️ MercadoPago unavailable — creating local payment record");
        mpResult = { status: "approved", id: `local-${Date.now()}` };
        paymentData = { paymentType: body.paymentMethod, localFallback: true };
      } else {
        res.status(502).json(errorResponse("Payment gateway unavailable. Try again later.", 502));
        return;
      }
    }

    // Determinar status do pagamento com base na resposta do MP
    const isApproved = mpResult?.status === "approved";
    const isPending = mpResult?.status === "pending" || mpResult?.status === "in_process";
    const now = new Date();
    const heldUntil = new Date();
    heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

    const payment = await prisma.payment.create({
      data: {
        amount: serviceOrder.price,
        status: isApproved ? "HELD" : "PENDING",
        paymentMethod: body.paymentMethod,
        transactionId: String(mpResult?.id || ""),
        metadata: {
          externalReference,
          ...paymentData,
          platformFee,
          professionalAmount,
          platformFeePercentage,
        },
        paidAt: isApproved ? now : null,
        heldUntil: isApproved ? heldUntil : null,
        serviceOrderId: orderId,
        clientId: req.user.id,
        professionalId: serviceOrder.professionalId || undefined,
      },
      include: {
        serviceOrder: { select: { title: true, price: true } },
        client: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
      },
    });

    // Se aprovado, criar transação e notificar profissional
    if (isApproved) {
      await prisma.transaction.create({
        data: {
          type: "PAYMENT",
          amount: serviceOrder.price,
          description: `Pagamento confirmado para pedido #${orderId}: ${serviceOrder.title}`,
          balanceBefore: 0,
          balanceAfter: 0,
          userId: req.user.id,
          paymentId: payment.id,
        },
      });

      // Notificar profissional sobre pagamento
      if (serviceOrder.professionalId) {
        await createNotification(
          serviceOrder.professionalId,
          NotificationType.PAYMENT_RECEIVED,
          "💰 Pagamento confirmado",
          `Pagamento de R$${serviceOrder.price.toFixed(2)} confirmado para "${serviceOrder.title}". Verifique os detalhes do serviço e entre em contato com o cliente.`,
          orderId,
          { amount: serviceOrder.price, platformFee, professionalAmount, paymentMethod: body.paymentMethod },
        );
      }

      // Notificar cliente sobre pagamento aprovado
      await createNotification(
        req.user.id,
        NotificationType.PAYMENT_RECEIVED,
        "✅ Pagamento aprovado",
        `Seu pagamento de R$${serviceOrder.price.toFixed(2)} para "${serviceOrder.title}" foi aprovado! O profissional será notificado.`,
        orderId,
        { amount: serviceOrder.price, paymentMethod: body.paymentMethod },
      );
    }

    // Resposta com dados específicos do método de pagamento
    res.status(201).json(
      successResponse(
        {
          payment,
          paymentData: {
            status: mpResult?.status || "unknown",
            statusDetail: mpResult?.statusDetail || "",
            ...paymentData,
          },
          feeBreakdown: {
            totalAmount: serviceOrder.price,
            platformFeePercentage,
            platformFee,
            professionalAmount,
          },
        },
        isApproved
          ? "Pagamento aprovado! O profissional será notificado."
          : isPending
            ? "Pagamento em processamento. Você será notificado quando for confirmado."
            : "Pagamento criado.",
      ),
    );
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**IMPORTANTE:** Importar as funções de pagamento no topo do arquivo:

```typescript
import {
  createPaymentPreference,
  getMPPaymentStatus,
  createCardPayment,
  createPixPayment,
  createBoletoPayment,
} from "../../services/mercadopagoService";
```

**Step 2: Commit**

```bash
git add backend/src/controllers/service/paymentController.ts backend/src/routes/serviceRoutes.ts
git commit -m "feat: refactor payment controller for transparent checkout with card/PIX/boleto"
```

---

### Task 4: Backend - Melhorar Webhook do Mercado Pago

**Files:**
- Modify: `backend/src/controllers/service/paymentController.ts`

**Step 1: Refatorar webhook para lidar com tipos v1 e v2 de notificação**

O webhook atual já funciona, mas precisamos melhorar para:
1. Lidar com `action` (novo formato) além de `type`
2. Buscar pagamento por `transactionId` (mpPaymentId) além de `externalReference`
3. Notificar cliente sobre mudanças de status

Atualizar a função `mercadoPagoWebhook`:

```typescript
export const mercadoPagoWebhook = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { type, data, action } = req.body;

    // MP pode enviar type="payment" ou action="payment.created"/"payment.updated"
    const isPaymentNotification =
      type === "payment" ||
      action === "payment.created" ||
      action === "payment.updated";

    if (!isPaymentNotification) {
      res.status(200).json({ received: true });
      return;
    }

    const mpPaymentId = data?.id;
    if (!mpPaymentId) {
      res.status(200).json({ received: true });
      return;
    }

    // Buscar status real do pagamento no MP
    let mpPayment;
    try {
      mpPayment = await getMPPaymentStatus(String(mpPaymentId));
    } catch (err) {
      console.error("Failed to fetch MP payment status:", err);
      res.status(200).json({ received: true });
      return;
    }

    // Buscar pagamento no nosso banco: por transactionId ou externalReference
    let payment = await prisma.payment.findFirst({
      where: {
        transactionId: String(mpPaymentId),
        status: { in: ["PENDING", "HELD"] },
      },
      include: { serviceOrder: true },
    });

    // Fallback: buscar por externalReference
    if (!payment && mpPayment.externalReference) {
      const refParts = mpPayment.externalReference.split("-");
      const orderId = parseInt(refParts[1] || "", 10);
      if (!isNaN(orderId)) {
        payment = await prisma.payment.findFirst({
          where: {
            serviceOrderId: orderId,
            status: "PENDING",
          },
          include: { serviceOrder: true },
        });
      }
    }

    if (!payment) {
      res.status(200).json({ received: true });
      return;
    }

    if (mpPayment.status === "approved") {
      const now = new Date();
      const heldUntil = new Date();
      heldUntil.setDate(heldUntil.getDate() + env.DEFAULT_ESCROW_HOLD_DAYS);

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "HELD",
            transactionId: String(mpPaymentId),
            paidAt: now,
            heldUntil,
            metadata: {
              ...(payment.metadata as any || {}),
              mpPaymentId,
              mpStatus: mpPayment.status,
              mpStatusDetail: mpPayment.statusDetail,
              mpPaymentMethod: mpPayment.paymentMethodId,
              mpDateApproved: mpPayment.dateApproved,
            },
          },
        }),
        prisma.transaction.create({
          data: {
            type: "PAYMENT",
            amount: payment.amount,
            description: `Pagamento confirmado via MercadoPago para pedido #${payment.serviceOrderId}`,
            balanceBefore: 0,
            balanceAfter: 0,
            userId: payment.clientId,
            paymentId: payment.id,
          },
        }),
      ]);

      // Notificar profissional
      if (payment.serviceOrder.professionalId) {
        const platformFee = (payment.amount * env.PLATFORM_FEE_PERCENTAGE) / 100;
        await createNotification(
          payment.serviceOrder.professionalId,
          NotificationType.PAYMENT_RECEIVED,
          "💰 Pagamento confirmado",
          `Pagamento de R$${payment.amount.toFixed(2)} confirmado para "${payment.serviceOrder.title}". O cliente está aguardando o serviço.`,
          payment.serviceOrderId,
          { amount: payment.amount, platformFee },
        );
      }

      // Notificar cliente
      await createNotification(
        payment.clientId,
        NotificationType.PAYMENT_RECEIVED,
        "✅ Pagamento aprovado",
        `Seu pagamento de R$${payment.amount.toFixed(2)} para "${payment.serviceOrder.title}" foi aprovado!`,
        payment.serviceOrderId,
        { amount: payment.amount },
      );

    } else if (mpPayment.status === "rejected" || mpPayment.status === "cancelled") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          metadata: {
            ...(payment.metadata as any || {}),
            mpPaymentId,
            mpStatus: mpPayment.status,
            mpStatusDetail: mpPayment.statusDetail,
          },
        },
      });

      // Notificar cliente sobre falha
      await createNotification(
        payment.clientId,
        NotificationType.SYSTEM_ALERT,
        "❌ Pagamento recusado",
        `Seu pagamento para "${payment.serviceOrder.title}" foi recusado. Tente novamente com outro método de pagamento.`,
        payment.serviceOrderId,
        { reason: mpPayment.statusDetail },
      );
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("MercadoPago webhook error:", error);
    res.status(200).json({ received: true });
  }
};
```

**Step 2: Commit**

```bash
git add backend/src/controllers/service/paymentController.ts
git commit -m "feat: improve MercadoPago webhook to handle all payment types and notify both parties"
```

---

### Task 5: Backend - Schema de Confirmação Dupla

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/controllers/service/orderController.ts`

**Step 1: Adicionar campos de confirmação dupla ao schema**

Em `backend/prisma/schema.prisma`, adicionar ao model `ServiceOrder`:

```prisma
  clientConfirmedAt       DateTime?
  professionalConfirmedAt DateTime?
```

**Step 2: Executar migration**

```bash
cd backend && npx prisma db push
```

**Step 3: Refatorar completeServiceOrder para confirmação do profissional**

Atualizar `completeServiceOrder` no `orderController.ts` para marcar `professionalConfirmedAt`:

```typescript
export const completeServiceOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    if (req.user.role !== "PROFESSIONAL" && req.user.role !== "ADMIN") {
      res.status(403).json(errorResponse("Only professionals can complete service orders"));
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
        payments: { where: { status: "HELD" } },
      },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    if (serviceOrder.professionalId !== req.user.id && req.user.role !== "ADMIN") {
      res.status(403).json(errorResponse("You don't have permission to complete this order"));
      return;
    }

    if (serviceOrder.status !== "IN_PROGRESS") {
      res.status(400).json(errorResponse(`Order cannot be submitted for completion. Current status: ${serviceOrder.status}`));
      return;
    }

    const activePayment = serviceOrder.payments.find((p) => p.status === "HELD");
    if (!activePayment) {
      res.status(400).json(errorResponse("No payment held in escrow for this order"));
      return;
    }

    const now = new Date();

    // Marcar confirmação do profissional e mudar status
    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        status: "AWAITING_CLIENT_CONFIRMATION",
        professionalConfirmedAt: now,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });

    // Notificar cliente
    await createNotification(
      serviceOrder.clientId,
      NotificationType.ORDER_COMPLETED,
      "🔔 Serviço concluído pelo profissional",
      `O profissional ${req.user.name} marcou o serviço "${serviceOrder.title}" como concluído. Confirme a conclusão para liberar o pagamento.`,
      orderId,
      { professionalId: req.user.id, professionalName: req.user.name, professionalConfirmedAt: now.toISOString() },
    );

    res.status(200).json(
      successResponse(
        {
          serviceOrder: updatedOrder,
          confirmations: {
            professionalConfirmed: true,
            clientConfirmed: false,
            professionalConfirmedAt: now.toISOString(),
            clientConfirmedAt: null,
          },
        },
        "Service marked as delivered. Waiting for client confirmation.",
      ),
    );
  } catch (error) {
    console.error("Complete service order error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
```

**Step 4: Refatorar confirmServiceOrderCompletion para confirmação do cliente**

Atualizar `confirmServiceOrderCompletion` no `orderController.ts` para marcar `clientConfirmedAt` e finalizar:

Na função existente, adicionar `clientConfirmedAt: now` ao update do serviceOrder:

```typescript
// Dentro do prisma.$transaction, no update do serviceOrder:
data: {
  status: "COMPLETED",
  completedAt: now,
  clientConfirmedAt: now,
},
```

E na resposta, incluir:

```typescript
confirmations: {
  professionalConfirmed: true,
  clientConfirmed: true,
  professionalConfirmedAt: serviceOrder.professionalConfirmedAt?.toISOString() || null,
  clientConfirmedAt: now.toISOString(),
},
```

E notificar profissional sobre conclusão:

```typescript
// Após a transação, notificar profissional
if (serviceOrder.professionalId) {
  await createNotification(
    serviceOrder.professionalId,
    NotificationType.PAYMENT_RELEASED,
    "🎉 Pagamento liberado!",
    `O cliente confirmou a conclusão do serviço "${serviceOrder.title}". R$${professionalAmount.toFixed(2)} foram liberados para sua carteira!`,
    orderId,
    {
      clientId: req.user.id,
      clientName: req.user.name,
      totalAmount: activePayment.amount,
      platformFee,
      professionalAmount,
      releasedAt: now.toISOString(),
    },
  );
}
```

**Step 5: Incluir campos de confirmação no getServiceOrder**

No `getServiceOrder`, o include do `serviceOrder` já traz todos os campos. Precisamos garantir que os campos `clientConfirmedAt` e `professionalConfirmedAt` são retornados na resposta. Como Prisma retorna todos os campos por padrão, não precisa de alteração adicional.

**Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/controllers/service/orderController.ts
git commit -m "feat: add dual confirmation fields and update order completion flow"
```

---

### Task 6: Backend - Notificações para Cada Etapa do Fluxo

**Files:**
- Modify: `backend/src/controllers/service/orderController.ts`

**Step 1: Melhorar notificação do createServiceOrder**

No `createServiceOrder`, já notifica o profissional. Adicionar notificação para o cliente também:

```typescript
// Após criar o pedido, notificar o cliente de que o pedido foi criado com sucesso
await createNotification(
  req.user.id,
  NotificationType.ORDER_CREATED,
  "📋 Pedido criado",
  `Seu pedido "${title}" foi enviado para o profissional ${serviceListing.professional.name}. Aguarde a aceitação.`,
  serviceOrder.id,
  { professionalId: serviceListing.professionalId, professionalName: serviceListing.professional.name },
);
```

**Step 2: Melhorar notificação do startServiceOrder**

Atualizar o tipo de notificação (está usando ORDER_ACCEPTED quando deveria ser mais específico) e a mensagem:

```typescript
// No startServiceOrder, notificação para o cliente:
await createNotification(
  serviceOrder.clientId,
  NotificationType.ORDER_ACCEPTED,
  "🚀 Profissional a caminho",
  `O profissional ${req.user.name} iniciou o serviço "${serviceOrder.title}" e está a caminho do local.`,
  orderId,
  { professionalId: req.user.id, professionalName: req.user.name },
);
```

**Step 3: Commit**

```bash
git add backend/src/controllers/service/orderController.ts
git commit -m "feat: add comprehensive notifications for every step of service flow"
```

---

### Task 7: Frontend - Tipos para Checkout Transparente

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/serviceService.ts`

**Step 1: Adicionar tipos do checkout transparente**

Em `frontend/src/types/index.ts`, atualizar `CheckoutResponse` e adicionar novos tipos:

```typescript
// Substituir CheckoutResponse existente por:
export interface TransparentCheckoutResponse {
  payment: Payment;
  paymentData: {
    status: string;
    statusDetail: string;
    paymentType: string;
    // PIX
    qrCode?: string;
    qrCodeBase64?: string;
    ticketUrl?: string;
    // Boleto
    boletoUrl?: string;
    barcode?: string;
    // Comum
    expirationDate?: string;
    mpPaymentId?: number;
  };
  feeBreakdown: {
    totalAmount: number;
    platformFeePercentage: number;
    platformFee: number;
    professionalAmount: number;
  };
}

export interface CheckoutFormData {
  paymentMethod: "credit_card" | "pix" | "boleto";
  payerEmail: string;
  payerName: string;
  payerCPF: string;
  // Cartão
  token?: string;
  paymentMethodId?: string;
  installments?: number;
}

export interface MPConfig {
  publicKey: string;
  sandbox: boolean;
}

// Adicionar ao ServiceOrder
// clientConfirmedAt?: string;
// professionalConfirmedAt?: string;
```

Adicionar ao interface `ServiceOrder`:

```typescript
  clientConfirmedAt?: string;
  professionalConfirmedAt?: string;
```

**Step 2: Atualizar serviceService para checkout transparente**

Em `frontend/src/services/serviceService.ts`, atualizar `createPayment`:

```typescript
/**
 * Obtém configuração do MercadoPago (public key)
 */
export const getMPConfig = async (): Promise<MPConfig> => {
  const response = await api.get<ApiResponse<MPConfig>>("/services/payments/config");
  return extractData(response);
};

/**
 * Cria pagamento via checkout transparente (cartão/PIX/boleto)
 */
export const createPayment = async (
  orderId: number,
  data: CheckoutFormData,
): Promise<TransparentCheckoutResponse> => {
  const response = await api.post<ApiResponse<TransparentCheckoutResponse>>(
    `/services/orders/${orderId}/payments`,
    data,
  );
  return extractData(response);
};
```

Importar os novos tipos:
```typescript
import { CheckoutFormData, TransparentCheckoutResponse, MPConfig, Message, ServiceListing, ServiceOrder, ServiceOrderStatus } from "../types";
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/serviceService.ts
git commit -m "feat: add frontend types and service functions for transparent checkout"
```

---

### Task 8: Frontend - Página de Checkout

**Files:**
- Create: `frontend/src/pages/checkout/Checkout.tsx`
- Create: `frontend/src/components/checkout/CardForm.tsx`
- Create: `frontend/src/components/checkout/PixPayment.tsx`
- Create: `frontend/src/components/checkout/BoletoPayment.tsx`
- Create: `frontend/src/components/checkout/PaymentMethodSelector.tsx`
- Create: `frontend/src/components/checkout/CheckoutSummary.tsx`
- Create: `frontend/src/components/checkout/PaymentStatusBanner.tsx`

> **Instrução:** Use a skill `frontend-design` para criar estes componentes com design de alta qualidade. Siga as diretrizes abaixo.

**Design Requirements:**

1. **Checkout.tsx** — Página principal de checkout:
   - Header com nome do serviço, valor e profissional
   - Formulário de dados pessoais (nome, email, CPF) — pré-preenchido do perfil do usuário
   - Seletor de método de pagamento (3 cards visuais: Cartão, PIX, Boleto)
   - Área dinâmica que mostra o formulário do método selecionado
   - Resumo lateral com breakdown de valores
   - Botão "Pagar" com loading state
   - Estados visuais: processando, sucesso, falha

2. **CardForm.tsx** — Formulário de cartão:
   - Campos: número do cartão, nome, validade, CVV
   - Selector de parcelas
   - Integrar com `MercadoPago.js` SDK para tokenizar cartão no frontend
   - Script do MP: `<script src="https://sdk.mercadopago.com/js/v2"></script>`
   - Usar `window.MercadoPago` para criar instância do cardForm

3. **PixPayment.tsx** — Exibição do PIX:
   - Após criar pagamento, mostrar QR code (base64 image)
   - Campo "Pix Copia e Cola" com botão de copiar
   - Countdown de expiração
   - Status "Aguardando pagamento..." com polling
   - Animação de check quando pagamento confirmado

4. **BoletoPayment.tsx** — Exibição do Boleto:
   - Link para abrir PDF do boleto
   - Código de barras copiável
   - Instruções de pagamento
   - Aviso sobre prazo de compensação (1-3 dias úteis)

5. **PaymentMethodSelector.tsx** — 3 cards visuais:
   - Cartão de Crédito (ícone de cartão)
   - PIX (ícone de QR/bolt)
   - Boleto Bancário (ícone de barcode)
   - Card selecionado com borda colorida e check

6. **CheckoutSummary.tsx** — Sidebar:
   - Nome do serviço
   - Profissional (foto, nome, rating)
   - Subtotal
   - Taxa da plataforma
   - Total
   - Selo de "Pagamento Seguro"

7. **PaymentStatusBanner.tsx** — Banner reutilizável:
   - Variantes: processing, success, failure, pending
   - Ícones animados
   - Mensagem descritiva
   - Botão de ação (tentar novamente / ver pedido / etc.)

**Step 1: Criar arquivo de cada componente** (seguir a order acima)

**Step 2: Integrar MercadoPago.js no frontend**

Adicionar script do MP no `index.html`:

```html
<script src="https://sdk.mercadopago.com/js/v2"></script>
```

Ou criar um hook `useMercadoPago`:

```typescript
// frontend/src/hooks/useMercadoPago.ts
import { useState, useEffect } from "react";
import { getMPConfig } from "../services/serviceService";

export function useMercadoPago() {
  const [mp, setMp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Carregar script do MP se ainda não existe
        if (!(window as any).MercadoPago) {
          const script = document.createElement("script");
          script.src = "https://sdk.mercadopago.com/js/v2";
          script.async = true;
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const config = await getMPConfig();
        const mpInstance = new (window as any).MercadoPago(config.publicKey, {
          locale: "pt-BR",
        });
        setMp(mpInstance);
      } catch (err) {
        setError("Erro ao inicializar gateway de pagamento");
        console.error("MP init error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  return { mp, loading, error };
}
```

**Step 3: Commit**

```bash
git add frontend/src/pages/checkout/ frontend/src/components/checkout/ frontend/src/hooks/useMercadoPago.ts
git commit -m "feat: add transparent checkout page with card, PIX and boleto forms"
```

---

### Task 9: Frontend - Status Banners e Stepper Visual no OrderDetails

**Files:**
- Create: `frontend/src/components/orders/ServiceFlowStepper.tsx`
- Create: `frontend/src/components/orders/FlowStatusBanner.tsx`
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`

**Design Requirements:**

1. **ServiceFlowStepper.tsx** — Stepper horizontal (mobile: vertical):
   - Steps: Pedido Criado → Pagamento → Aceito → Em Andamento → Concluído → Pagamento Liberado
   - Step atual destacado com animação pulse
   - Steps completos com check verde
   - Steps futuros em cinza
   - Linha de progresso conectando os steps
   - Ícone e label para cada step
   - Data/hora em cada step completado

2. **FlowStatusBanner.tsx** — Banner contextual no topo:
   - Mensagem e cor baseada no status atual + role do usuário
   - **Cliente + PENDING:** "Seu pedido foi enviado! Aguardando aceitação do profissional." (azul)
   - **Profissional + PENDING:** "Novo pedido recebido! Aceite ou recuse." (azul)
   - **Cliente + ACCEPTED (sem pagamento):** "O profissional aceitou! Realize o pagamento para continuar." (amarelo)
   - **Cliente + ACCEPTED (com pagamento):** "Pagamento confirmado! O profissional será notificado." (verde)
   - **Profissional + ACCEPTED (com pagamento):** "Pagamento confirmado pelo cliente! Inicie o serviço quando estiver pronto." (verde)
   - **IN_PROGRESS (ambos):** "Serviço em andamento..." (indigo)
   - **AWAITING_CLIENT_CONFIRMATION (cliente):** "O profissional concluiu o serviço. Confirme a conclusão!" (amber)
   - **AWAITING_CLIENT_CONFIRMATION (profissional):** "Aguardando o cliente confirmar a conclusão..." (amber)
   - **COMPLETED:** "Serviço concluído! Pagamento liberado." (verde)
   - **CANCELLED:** "Este pedido foi cancelado." (vermelho)

3. **Atualizar OrderDetails.tsx:**
   - Adicionar `ServiceFlowStepper` no topo (substituir timeline antiga)
   - Adicionar `FlowStatusBanner` abaixo do header
   - Modificar botão de pagamento para navegar para `/client/orders/{id}/checkout`
   - Adicionar seção de confirmação dupla visual (Task 10)

**Step 1: Criar os componentes**

**Step 2: Integrar no OrderDetails**

**Step 3: Commit**

```bash
git add frontend/src/components/orders/ServiceFlowStepper.tsx frontend/src/components/orders/FlowStatusBanner.tsx frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: add visual stepper and contextual status banners to order flow"
```

---

### Task 10: Frontend - Confirmação Dupla Visual

**Files:**
- Create: `frontend/src/components/orders/DualConfirmation.tsx`
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`

**Design Requirements:**

**DualConfirmation.tsx:**
- Dois cards lado a lado (ou empilhados no mobile):
  - Card do Profissional: foto, nome, status de confirmação
  - Card do Cliente: foto, nome, status de confirmação
- Estados visuais:
  - **Não confirmado:** Card cinza, ícone de círculo vazio, texto "Aguardando..."
  - **Confirmado:** Card verde, ícone de check animado, texto "Confirmado" + data/hora
- Barra de progresso entre os dois (0%, 50%, 100%)
- Quando ambos confirmam: confetti visual ou animação de sucesso
- Mensagem explicativa: "Quando ambos confirmarem, o pagamento será liberado para o profissional."

**Props:**
```typescript
interface DualConfirmationProps {
  professionalName: string;
  professionalImage?: string;
  clientName: string;
  clientImage?: string;
  professionalConfirmedAt?: string | null;
  clientConfirmedAt?: string | null;
  isClient: boolean;
  isProfessional: boolean;
  onConfirm: () => void;
  loading: boolean;
  orderStatus: string;
}
```

**Step 1: Criar DualConfirmation.tsx**

**Step 2: Integrar no OrderDetails na seção de ações quando status é AWAITING_CLIENT_CONFIRMATION ou COMPLETED**

**Step 3: Commit**

```bash
git add frontend/src/components/orders/DualConfirmation.tsx frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: add dual confirmation visual component for service completion"
```

---

### Task 11: Frontend - Review CTA Pós-Serviço com Imagens

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`
- Create: `frontend/src/components/orders/ReviewCTA.tsx`

**Design Requirements:**

**ReviewCTA.tsx:**
- Card proativo que aparece quando status é COMPLETED e o usuário não deixou review
- Banner chamativo com gradiente: "Como foi o serviço? Deixe sua avaliação!"
- 3 critérios de avaliação: Qualidade, Pontualidade, Comunicação (já existe)
- Upload de fotos do serviço (até 3 imagens)
- Textarea para comentário
- Botão "Enviar Avaliação" com confetti/animação de sucesso
- Após enviar: card com resumo da review e botão "Recontratar"

**Step 1: Extrair e refinar a lógica de review existente no OrderDetails para o novo componente**

**Step 2: Commit**

```bash
git add frontend/src/components/orders/ReviewCTA.tsx frontend/src/pages/orders/OrderDetails.tsx
git commit -m "feat: add proactive review CTA component with image upload after service completion"
```

---

### Task 12: Frontend - Notificações Toast do Fluxo

**Files:**
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`
- Modify: `frontend/src/pages/checkout/Checkout.tsx`

**Step 1: Adicionar toasts contextuais**

Adicionar toasts em cada ação do fluxo:

```typescript
// Pagamento aprovado (cartão)
toast.success("Pagamento aprovado! O profissional será notificado.");

// PIX gerado
toast.info("QR Code PIX gerado! Escaneie para pagar.");

// Boleto gerado
toast.info("Boleto gerado! Copie o código ou abra o PDF.");

// Pagamento recusado
toast.error("Pagamento recusado", "Tente novamente com outro método de pagamento.");

// Profissional aceitou
toast.success("O profissional aceitou seu pedido!");

// Serviço iniciado
toast.info("O profissional está a caminho!");

// Serviço concluído pelo profissional
toast.warning("Confirme a conclusão", "O profissional marcou o serviço como concluído. Confirme para liberar o pagamento.");

// Ambos confirmaram
toast.success("Serviço concluído! Pagamento liberado para o profissional.");

// Avaliação enviada
toast.success("Avaliação enviada! Obrigado pelo feedback.");
```

**Step 2: Commit**

```bash
git add frontend/src/pages/orders/OrderDetails.tsx frontend/src/pages/checkout/Checkout.tsx
git commit -m "feat: add contextual toast notifications for every step of the service flow"
```

---

### Task 13: Integração - Rotas e Navegação

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/orders/OrderDetails.tsx`
- Modify: `frontend/src/pages/services/ServiceDetails.tsx`

**Step 1: Adicionar rota de checkout no App.tsx**

```typescript
import Checkout from "./pages/checkout/Checkout";

// Dentro das rotas do client:
<Route path="orders/:id/checkout" element={<Checkout />} />
```

**Step 2: Atualizar botão de pagamento no OrderDetails**

Em vez de chamar `handlePayment` inline, navegar para a página de checkout:

```typescript
// Substituir o botão de pagamento atual por:
<button
  onClick={() => navigate(`/client/orders/${order.id}/checkout`)}
  className="btn btn-primary"
>
  <CreditCard className="w-4 h-4 mr-2" />
  Pagar {formatCurrency(order.price)}
</button>
```

**Step 3: Atualizar ServiceDetails para redirecionar ao OrderDetails após solicitar**

O fluxo de "Solicitar Serviço" no ServiceDetails já navega para o pedido criado. Manter esse comportamento.

**Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/orders/OrderDetails.tsx frontend/src/pages/services/ServiceDetails.tsx
git commit -m "feat: add checkout route and connect payment flow navigation"
```

---

### Task 14: Testes Funcionais do Fluxo

**Files:**
- O teste é funcional/manual, mas vamos criar um script de teste automatizado

**Step 1: Verificar que o backend compila e inicia sem erros**

```bash
cd backend && npx tsc --noEmit
```

Expected: sem erros de compilação

**Step 2: Verificar que o frontend compila sem erros**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sem erros de compilação

**Step 3: Iniciar backend e verificar endpoints**

```bash
cd backend && npm run dev &
sleep 3
# Testar health check
curl http://localhost:3001/api/health
```

Expected: `{ "status": "ok" }`

**Step 4: Testar criação de serviço (como profissional)**

```bash
# Login como profissional
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@test.com","password":"Test1234"}' | jq -r '.data.token')

# Criar serviço
curl -s -X POST http://localhost:3001/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Teste Encanamento","description":"Serviço de encanamento","price":150.00,"categoryId":1}'
```

Expected: Serviço criado com sucesso (status 201)

**Step 5: Testar solicitação de serviço (como cliente)**

```bash
# Login como cliente
CLIENT_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"client@test.com","password":"Test1234"}' | jq -r '.data.token')

# Solicitar serviço
curl -s -X POST http://localhost:3001/api/services/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -d '{"serviceListingId":1,"title":"Conserto de torneira"}'
```

Expected: Order criado com status PENDING (201)

**Step 6: Testar endpoint de config do MP**

```bash
curl -s http://localhost:3001/api/services/payments/config \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

Expected: `{ publicKey: "...", sandbox: true }`

**Step 7: Testar criação de pagamento PIX (sandbox)**

```bash
ORDER_ID=<id do pedido criado>
curl -s -X POST "http://localhost:3001/api/services/orders/$ORDER_ID/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -d '{"paymentMethod":"pix","payerEmail":"test@test.com","payerName":"Test User","payerCPF":"12345678909"}'
```

Expected: Pagamento criado com QR code PIX (ou fallback local em dev)

**Step 8: Testar aceitação e fluxo completo**

```bash
# Profissional aceita
curl -s -X POST "http://localhost:3001/api/services/orders/$ORDER_ID/accept" \
  -H "Authorization: Bearer $TOKEN"

# Profissional inicia
curl -s -X POST "http://localhost:3001/api/services/orders/$ORDER_ID/start" \
  -H "Authorization: Bearer $TOKEN"

# Profissional marca como concluído
curl -s -X POST "http://localhost:3001/api/services/orders/$ORDER_ID/submit-completion" \
  -H "Authorization: Bearer $TOKEN"

# Cliente confirma conclusão
curl -s -X POST "http://localhost:3001/api/services/orders/$ORDER_ID/confirm-completion" \
  -H "Authorization: Bearer $CLIENT_TOKEN"

# Verificar status final
curl -s "http://localhost:3001/api/services/orders/$ORDER_ID" \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

Expected: Order COMPLETED com pagamento RELEASED e notificações criadas

**Step 9: Verificar notificações**

```bash
# Notificações do profissional
curl -s "http://localhost:3001/api/services/notifications" \
  -H "Authorization: Bearer $TOKEN"

# Notificações do cliente
curl -s "http://localhost:3001/api/services/notifications" \
  -H "Authorization: Bearer $CLIENT_TOKEN"
```

Expected: Notificações de cada etapa do fluxo

**Step 10: Commit final**

```bash
git add -A
git commit -m "feat: complete service flow integration with MercadoPago transparent checkout"
```

---

## Checklist de Verificação Final

- [ ] Pagamento com cartão funciona (tokenização + cobrança)
- [ ] Pagamento com PIX gera QR code funcional
- [ ] Pagamento com boleto gera link funcional
- [ ] Webhook processa notificações do MP corretamente
- [ ] Notificação enviada ao profissional quando pagamento aprovado
- [ ] Notificação enviada ao cliente quando profissional aceita
- [ ] Notificação enviada ao cliente quando profissional inicia serviço
- [ ] Notificação enviada ao cliente quando profissional conclui
- [ ] Notificação enviada ao profissional quando cliente confirma
- [ ] Notificação enviada ao profissional quando pagamento liberado
- [ ] Confirmação dupla funciona (profissional + cliente)
- [ ] Visualização gráfica da confirmação dupla
- [ ] Stepper visual mostra progresso correto
- [ ] Banners de status mostram mensagem contextual correta
- [ ] Toasts aparecem em cada ação do fluxo
- [ ] Review CTA aparece após conclusão
- [ ] Página de checkout tem boa UX em mobile
- [ ] Página de checkout carrega dados do usuário automaticamente
- [ ] Fluxo de navegação: Serviço → Solicitar → Checkout → Detalhes do Pedido
- [ ] Dados do endereço visíveis para o profissional
- [ ] Chat funciona durante todo o fluxo

---

## Ordem de Execução Recomendada

1. **Tasks 1-4:** Backend - Endpoints e Checkout Transparente (pode ser paralelizado)
2. **Task 5:** Backend - Confirmação Dupla (depende do schema)
3. **Task 6:** Backend - Notificações (pode rodar junto com 5)
4. **Task 7:** Frontend - Tipos (deve rodar antes das Tasks 8-12)
5. **Tasks 8-12:** Frontend - Checkout + Visuais (pode ser paralelizado usando frontend-design skill)
6. **Task 13:** Integração - Rotas (depende de 8)
7. **Task 14:** Testes Funcionais (depende de tudo)

---

## Notas Importantes

### Mercado Pago Sandbox
- Credenciais de sandbox estão em `VARIAVEIS/.env.mp`
- Para testar cartão use: `5031 4332 1540 6351` (Mastercard teste MP)
- CVV: `123`, Validade: qualquer futura
- CPF teste: `12345678909`
- O flag `MP_SANDBOX` controla se usa sandbox ou produção

### Variáveis de Ambiente
- `ACESS_TOKEN_MP` → mapeia para `env.MP_ACCESS_TOKEN`
- `PUBLIC_KEY_MP` → mapeia para `env.MP_PUBLIC_KEY`
- `CLIENT_ID` → mapeia para `env.MP_CLIENT_ID`
- `CLIENT_SECRET` → mapeia para `env.MP_CLIENT_SECRET`

### Segurança
- O token do cartão é gerado no frontend pelo SDK do MP (nunca passa dados brutos do cartão pelo nosso backend)
- Webhook do MP deve responder 200 sempre para evitar retries
- CPF é validado pelo MP na criação do pagamento
