import { ShieldCheck, Clock, MapPin } from "lucide-react";
import type { ServiceOrder } from "../../types";

interface Props {
  order: ServiceOrder;
}

export default function CheckoutSummary({ order }: Props) {
  return (
    <div className="card p-5 space-y-5 sticky top-24">
      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
        Resumo do pedido
      </h3>

      <div className="space-y-3">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {order.title}
          </p>
          {order.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {order.description}
            </p>
          )}
        </div>

        {order.professional && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            {order.professional.profileImage ? (
              <img
                src={order.professional.profileImage}
                alt={order.professional.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                  {order.professional.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {order.professional.name}
              </p>
              {order.professional.ratingAverage > 0 && (
                <p className="text-xs text-slate-500">
                  ⭐ {order.professional.ratingAverage.toFixed(1)} ({order.professional.totalReviews} avaliações)
                </p>
              )}
            </div>
          </div>
        )}

        {order.scheduledDate && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Clock className="w-4 h-4" />
            <span>
              {new Date(order.scheduledDate).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {order.address && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="line-clamp-1">
              {order.address.street}, {order.address.number} — {order.address.neighborhood}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">Valor do serviço</span>
          <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
            R$ {order.price.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
          <span className="font-semibold text-slate-900 dark:text-white">Total</span>
          <span className="font-mono font-bold text-xl text-primary-600 dark:text-primary-400">
            R$ {order.price.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
        <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Pagamento seguro via MercadoPago. Seu dinheiro fica protegido até a conclusão do serviço.
        </p>
      </div>
    </div>
  );
}
