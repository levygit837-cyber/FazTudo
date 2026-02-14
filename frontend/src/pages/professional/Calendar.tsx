import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SkeletonDashboard } from "../../components/common/Skeleton";
import {
  getCalendarOverview,
  getCalendarDayDetail,
  CalendarOverview,
  CalendarDayDetail,
  CalendarDay,
} from "../../services/calendarService";
import { formatCurrency, formatOrderStatus } from "../../utils/formatters";

const DAY_DETAIL_CACHE = new Map<string, CalendarDayDetail>();

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ProfessionalCalendar: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<CalendarOverview | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<CalendarDayDetail | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const pendingRequestRef = useRef<string | null>(null);

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const loadOverview = useCallback(async (month: string) => {
    try {
      setLoading(true);
      const data = await getCalendarOverview(month);
      setOverview(data);
      setSelectedDay(null);
      setDayDetail(null);
    } catch (error) {
      console.error("Erro ao carregar calendario:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview(currentMonth);
  }, [currentMonth, loadOverview]);

  const handleDayClick = async (day: CalendarDay) => {
    if (day.date === selectedDay) return;

    const cachedDetail = DAY_DETAIL_CACHE.get(day.date);
    if (cachedDetail) {
      setSelectedDay(day.date);
      setDayDetail(cachedDetail);
      return;
    }

    const requestId = day.date;
    pendingRequestRef.current = requestId;

    setSelectedDay(day.date);
    setDayLoading(true);

    try {
      const detail = await getCalendarDayDetail(day.date);
      if (pendingRequestRef.current === requestId) {
        DAY_DETAIL_CACHE.set(day.date, detail);
        setDayDetail(detail);
      }
    } catch (error) {
      if (pendingRequestRef.current === requestId) {
        console.error("Erro ao carregar detalhe do dia:", error);
        setDayDetail(null);
      }
    } finally {
      if (pendingRequestRef.current === requestId) {
        setDayLoading(false);
      }
    }
  };

  const navigateMonth = (direction: -1 | 1) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const [year, month] = currentMonth.split("-").map(Number);
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  if (loading && !overview) return <SkeletonDashboard />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Agenda Operacional
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Visualize e gerencie seus agendamentos do mes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 card">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAY_NAMES.map((name) => (
              <div
                key={name}
                className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2"
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Month days */}
            {overview?.days.map((day) => {
              const isToday = day.date === new Date().toISOString().slice(0, 10);
              const isSelected = day.date === selectedDay;
              const hasOrders = day.totalOrders > 0;

              return (
                <button
                  key={day.date}
                  onClick={() => handleDayClick(day)}
                  className={`
                    aspect-square rounded-lg p-1 flex flex-col items-center justify-center
                    text-sm transition-all relative
                    ${isSelected
                      ? "bg-primary-600 text-white ring-2 ring-primary-300"
                      : isToday
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 ring-1 ring-primary-200"
                        : !day.isAvailable
                          ? "bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }
                  `}
                >
                  <span className="font-medium">{day.dayOfMonth}</span>
                  {hasOrders && (
                    <div className="flex gap-0.5 mt-0.5">
                      {day.completedOrders > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-emerald-200" : "bg-emerald-500"}`} />
                      )}
                      {day.upcomingOrders > 0 && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-blue-200" : "bg-blue-500"}`} />
                      )}
                    </div>
                  )}
                  {hasOrders && (
                    <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
                      {day.totalOrders}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Concluidos
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Proximos
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600" /> Indisponivel
            </div>
          </div>
        </div>

        {/* Day Detail Sidebar */}
        <div className="card min-h-[400px]">
          {!selectedDay ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <CalendarIcon className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">Selecione um dia para ver os agendamentos</p>
            </div>
          ) : dayLoading && !dayDetail ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : dayDetail ? (
            <div className="relative">
              {dayLoading && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 z-10 flex items-center justify-center rounded-xl">
                  <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div className={dayLoading ? "opacity-50 pointer-events-none" : ""}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </h3>
                    <span className="text-sm text-slate-500">
                      {dayDetail.totalOrders} agendamento{dayDetail.totalOrders !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {!dayDetail.isAvailable ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500">
                      <XCircle className="w-5 h-5" />
                      <span className="text-sm">Dia indisponivel na sua agenda</span>
                    </div>
                  ) : dayDetail.slots.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum horario configurado</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {dayDetail.slots.map((slot) => (
                        <div
                          key={slot.time}
                          className={`
                            p-3 rounded-lg border text-sm
                            ${slot.order
                              ? "border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/10"
                              : slot.blockReason
                                ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10"
                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            }
                          `}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {slot.time}
                            </span>
                            {slot.order && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                {formatOrderStatus(slot.order.status)}
                              </span>
                            )}
                          </div>

                          {slot.order ? (
                            <div className="ml-6 space-y-1">
                              <Link
                                to={`/professional/services/${slot.order.id}`}
                                className="font-medium text-primary-600 hover:underline"
                              >
                                {slot.order.title}
                              </Link>
                              <div className="flex items-center gap-1 text-slate-500">
                                <User className="w-3 h-3" />
                                {slot.order.client.name}
                              </div>
                              {slot.order.address && (
                                <div className="flex items-center gap-1 text-slate-500">
                                  <MapPin className="w-3 h-3" />
                                  {slot.order.address.street}, {slot.order.address.number} - {slot.order.address.neighborhood}
                                </div>
                              )}
                              <p className="font-medium text-emerald-600">
                                {formatCurrency(slot.order.price)}
                              </p>
                            </div>
                          ) : slot.blockReason ? (
                            <p className="ml-6 text-red-600 dark:text-red-400 text-xs">
                              Bloqueado: {slot.blockReason}
                            </p>
                          ) : (
                            <p className="ml-6 text-slate-400 text-xs">Disponivel</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProfessionalCalendar;
