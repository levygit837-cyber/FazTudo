import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { env } from "./env";

let mpClient: MercadoPagoConfig | null = null;

export function getMercadoPagoClient(): MercadoPagoConfig {
  if (!mpClient) {
    if (!env.MP_ACCESS_TOKEN) {
      throw new Error(
        "MercadoPago access token not configured. Set ACESS_TOKEN_MP in VARIAVEIS/.env.mp"
      );
    }
    mpClient = new MercadoPagoConfig({
      accessToken: env.MP_ACCESS_TOKEN,
      options: { timeout: 10000 },
    });
  }
  return mpClient;
}

export function getPreferenceClient(): Preference {
  return new Preference(getMercadoPagoClient());
}

export function getPaymentClient(): Payment {
  return new Payment(getMercadoPagoClient());
}
