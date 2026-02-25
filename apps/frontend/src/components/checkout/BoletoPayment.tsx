import { useState } from "react";
import { FileText, Copy, ExternalLink, CheckCircle, Calendar } from "lucide-react";
import clsx from "clsx";

interface Props {
  boletoUrl: string;
  barcode: string;
  expirationDate: string;
  status: string;
}

export default function BoletoPayment({ boletoUrl, barcode, expirationDate, status }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = barcode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const formattedExpiry = expirationDate
    ? new Date(expirationDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  if (status === "approved") {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <div className="text-center">
          <h4 className="font-semibold text-lg text-slate-900 dark:text-white">Boleto pago!</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Seu pagamento foi confirmado com sucesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {/* Boleto Icon */}
      <div className="flex flex-col items-center gap-3">
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
          <FileText className="w-12 h-12 text-amber-500" />
        </div>
        <div className="text-center">
          <h4 className="font-semibold text-slate-900 dark:text-white">
            Boleto gerado com sucesso!
          </h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            O pagamento será confirmado em até 2 dias úteis após o pagamento.
          </p>
        </div>
      </div>

      {/* Expiration */}
      {formattedExpiry && (
        <div className="flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <Calendar className="w-4 h-4" />
          <span>Vencimento: {formattedExpiry}</span>
        </div>
      )}

      {/* Barcode */}
      {barcode && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <p className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all text-center leading-relaxed">
            {barcode}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {boletoUrl && (
          <a
            href={boletoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary w-full py-2.5 text-sm font-medium flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir boleto
          </a>
        )}

        {barcode && (
          <button
            onClick={handleCopy}
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
                Copiar linha digitável
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
