import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import { getAvailableSlots } from "../../services/serviceService";

interface Slot {
  time: string;
  available: boolean;
  reason?: string;
}

interface AvailabilityCalendarProps {
  professionalId: number;
  onSlotSelect?: (date: string, time: string) => void;
  selectedDate?: string;
  selectedTime?: string;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  professionalId,
  onSlotSelect,
  selectedDate: externalDate,
  selectedTime: externalTime,
}) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(externalDate || "");
  const [selectedTime, setSelectedTime] = useState<string>(externalTime || "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Generate calendar days
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    const load = async () => {
      try {
        setLoadingSlots(true);
        const data = await getAvailableSlots(professionalId, selectedDate);
        setSlots(data.slots || []);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    load();
  }, [selectedDate, professionalId]);

  const handleDateClick = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (dateStr < todayStr) return;
    setSelectedDate(dateStr);
    setSelectedTime("");
  };

  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
    onSlotSelect?.(selectedDate, time);
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const isPast = currentYear < today.getFullYear() || (currentYear === today.getFullYear() && currentMonth < today.getMonth());

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} disabled={isPast} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h3>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-slate-400 dark:text-slate-500 py-1">{d}</div>
        ))}
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const isPastDay = dateStr < todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              disabled={isPastDay}
              className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                isSelected
                  ? "bg-primary-600 text-white shadow-sm"
                  : isToday
                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-700"
                    : isPastDay
                      ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            Horários — {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </h4>
          {loadingSlots ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-3">Sem horários disponíveis nesta data</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.available && handleTimeClick(slot.time)}
                  disabled={!slot.available}
                  className={`px-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedTime === slot.time
                      ? "bg-primary-600 text-white shadow-sm"
                      : slot.available
                        ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed line-through"
                  }`}
                  title={!slot.available ? slot.reason || "Indisponível" : ""}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;
