import { getPreferenceClient, getPaymentClient } from "../config/mercadopago";
import { env } from "../config/env";

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
      notification_url: `${backendUrl}/api/payments/webhook`,
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
