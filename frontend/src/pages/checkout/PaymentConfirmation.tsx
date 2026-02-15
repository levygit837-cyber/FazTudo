import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle, ArrowRight, Bell } from "lucide-react";
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
