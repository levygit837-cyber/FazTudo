import { getPreferenceClient, getPaymentClient } from "../config/mercadopago";
import { env } from "../config/env";

/**
 * Retorna a notification_url para o MercadoPago.
 * MercadoPago rejeita localhost (code 4020).
 * Em dev sem BACKEND_URL configurado, omitimos o campo.
 */
function getNotificationUrl(): string | undefined {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl || backendUrl.includes("localhost")) {
    return undefined; // MP não aceita localhost — webhook será ignorado em dev local
  }
  return `${backendUrl}/api/services/payments/webhook`;
}

// ============================================
// SECURITY: Webhook Secret Guard (VULN-01)
// ============================================

/**
 * Validates that the webhook secret is configured before any signature check.
 * Returns false immediately if the secret is empty, preventing forged webhook
 * acceptance in environments where MP_WEBHOOK_SECRET was not set.
 *
 * NOTE: Full HMAC signature validation is performed in lib/webhookValidator.ts.
 * This guard provides defence-in-depth at the service layer.
 */
export function isMPWebhookSecretConfigured(): boolean {
  return Boolean(env.MP_WEBHOOK_SECRET && env.MP_WEBHOOK_SECRET.trim().length > 0);
}

export interface CreateMPPreferenceParams {
  orderId: number;
  title: string;
  description: string;
  amount: number;
  payerEmail: string;
  payerName: string;
  externalReference: string;
}

export interface MPPreferenceResult {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string;
}

/**
 * Creates a MercadoPago Checkout Pro preference for an order payment.
 */
export async function createPaymentPreference(
  params: CreateMPPreferenceParams
): Promise<MPPreferenceResult> {
  const preference = getPreferenceClient();

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${env.PORT}`;
  const frontendUrl = env.CORS_ORIGIN.split(",")[0] || "http://localhost:5173";

  const response = await preference.create({
    body: {
      items: [
        {
          id: `order-${params.orderId}`,
          title: params.title,
          description: params.description || params.title,
          quantity: 1,
          unit_price: params.amount,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: params.payerEmail,
        name: params.payerName,
      },
      back_urls: {
        success: `${frontendUrl}/client/orders/${params.orderId}?payment=success`,
        failure: `${frontendUrl}/client/orders/${params.orderId}?payment=failure`,
        pending: `${frontendUrl}/client/orders/${params.orderId}?payment=pending`,
      },
      auto_return: "approved",
      ...(getNotificationUrl() && { notification_url: getNotificationUrl() }),
      external_reference: params.externalReference,
      statement_descriptor: "FAZTUDO",
    },
  });

  return {
    preferenceId: response.id!,
    initPoint: response.init_point!,
    sandboxInitPoint: response.sandbox_init_point!,
  };
}

/**
 * Fetches a payment from MercadoPago by its ID to verify status.
 */
export async function getMPPaymentStatus(mpPaymentId: string) {
  const payment = getPaymentClient();
  const response = await payment.get({ id: mpPaymentId });
  return {
    id: response.id,
    status: response.status,
    statusDetail: response.status_detail,
    externalReference: response.external_reference,
    transactionAmount: response.transaction_amount,
    paymentMethodId: response.payment_method_id,
    payerEmail: response.payer?.email,
    dateApproved: response.date_approved,
  };
}

// ============================================
// CHECKOUT TRANSPARENTE - Payment Functions
// ============================================

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
      ...(getNotificationUrl() && { notification_url: getNotificationUrl() }),
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
      ...(getNotificationUrl() && { notification_url: getNotificationUrl() }),
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
      ...(getNotificationUrl() && { notification_url: getNotificationUrl() }),
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
