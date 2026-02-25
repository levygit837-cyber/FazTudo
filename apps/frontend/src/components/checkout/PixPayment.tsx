import { useState, useEffect } from "react";
import { QrCode, Copy, CheckCircle, Clock, AlertCircle } from "lucide-react";
import clsx from "clsx";

interface Props {
  qrCode: string;
  qrCodeBase64: string;
  expirationDate: string;
  status: string;
  onCopy?: () => void;
}

export default function PixPayment({ qrCode, qrCodeBase64, expirationDate, status, onCopy }: Props) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expirationDate) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expirationDate).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft("Expirado");
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expirationDate]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = qrCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (status === "approved") {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="text-center">
          <h4 className="font-semibold text-lg text-slate-900 dark:text-white">PIX confirmado!</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Seu pagamento foi aprovado com sucesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 p-4">
      {/* Timer */}
      <div className={clsx(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        expired
          ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
      )}>
        {expired ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
        {expired ? "QR Code expirado" : `Expira em ${timeLeft}`}
      </div>

      {/* QR Code */}
      <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200">
        {qrCodeBase64 ? (
          <img
            src={`data:image/png;base64,${qrCodeBase64}`}
            alt="QR Code PIX"
            className="w-48 h-48"
          />
        ) : (
          <div className="w-48 h-48 flex items-center justify-center bg-slate-100 rounded-lg">
            <QrCode className="w-16 h-16 text-slate-300" />
          </div>
        )}
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        disabled={expired}
        className={clsx(
          "btn w-full py-2.5 text-sm font-medium flex items-center justify-center gap-2",
          copied ? "btn-success" : "btn-outline"
        )}
      >
        {copied ? (
          <>
            <CheckCircle className="w-4 h-4" />
            Código copiado!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copiar código PIX
          </>
        )}
      </button>

      {/* Instructions */}
      <div className="text-center space-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Abra o app do seu banco e escaneie o QR Code ou cole o código PIX.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          O pagamento será confirmado automaticamente.
        </p>
      </div>
    </div>
  );
}
