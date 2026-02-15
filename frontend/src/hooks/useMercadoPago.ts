import { useState, useEffect, useRef } from "react";
import { getMPConfig } from "../services/serviceService";
import type { MPConfig } from "../types";

declare global {
  interface Window {
    MercadoPago: any;
  }
}

export function useMercadoPago() {
  const [mpConfig, setMpConfig] = useState<MPConfig | null>(null);
  const [mpInstance, setMpInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Fetch config from backend
        const config = await getMPConfig();
        if (!mounted) return;
        setMpConfig(config);

        // 2. Load MP SDK if not already loaded
        if (!scriptLoadedRef.current && !window.MercadoPago) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://sdk.mercadopago.com/js/v2";
            script.async = true;
            script.onload = () => {
              scriptLoadedRef.current = true;
              resolve();
            };
            script.onerror = () => reject(new Error("Failed to load MercadoPago SDK"));
            document.head.appendChild(script);
          });
        }

        if (!mounted) return;

        // 3. Initialize MP instance
        if (window.MercadoPago) {
          const mp = new window.MercadoPago(config.publicKey, {
            locale: "pt-BR",
          });
          setMpInstance(mp);
        }

        setLoading(false);
      } catch (err: any) {
        if (!mounted) return;
        setError(err.message || "Erro ao inicializar MercadoPago");
        setLoading(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, []);

  const createCardToken = async (cardData: {
    cardNumber: string;
    cardholderName: string;
    expirationMonth: string;
    expirationYear: string;
    securityCode: string;
    identificationNumber: string;
  }) => {
    if (!mpInstance) throw new Error("MercadoPago not initialized");

    const token = await mpInstance.createCardToken({
      cardNumber: cardData.cardNumber.replace(/\s/g, ""),
      cardholderName: cardData.cardholderName,
      cardExpirationMonth: cardData.expirationMonth,
      cardExpirationYear: cardData.expirationYear,
      securityCode: cardData.securityCode,
      identificationType: "CPF",
      identificationNumber: cardData.identificationNumber.replace(/[.\-]/g, ""),
    });

    return token;
  };

  return {
    mpConfig,
    mpInstance,
    loading,
    error,
    createCardToken,
  };
}
