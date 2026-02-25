import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import ModalPortal from "../common/ModalPortal";

interface AvailabilityPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: string, time: string) => void;
  professionalName: string;
  loading?: boolean;
}

const HOURS = [
  "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00",
];

const AvailabilityPicker: React.FC<AvailabilityPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  professionalName,
  loading = false,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Preencher dias vazios antes do primeiro dia
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Dias do mes
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    if (date < today) return;
    const dateStr = date.toISOString().split("T")[0];
    setSelectedDate(dateStr);
    setSelectedTime(null);
  };

  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
  };

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      onSelect(selectedDate, selectedTime);
    }
  };

  const isPastDate = (date: Date) => date < today;
  const isToday = (date: Date) =>
    date.toDateString() === today.toDateString();

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex items-center justify-center" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative mx-4 w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Escolha a data e horario
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Agenda de {professionalName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Calendario */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Dias */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="h-10" />;
                }

                const dateStr = date.toISOString().split("T")[0];
                const past = isPastDate(date);
                const todayDate = isToday(date);
                const selected = selectedDate === dateStr;

                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDateClick(date)}
                    disabled={past}
                    className={`h-10 rounded-lg text-sm font-medium transition-all ${
                      past
                        ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                        : selected
                        ? "bg-primary-600 text-white"
                        : todayDate
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 hover:bg-primary-100"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horarios */}
          {selectedDate && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Horarios disponiveis
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {HOURS.map((time) => (
                  <button
                    key={time}
                    onClick={() => handleTimeClick(time)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      selectedTime === time
                        ? "bg-primary-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botao de confirmar */}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 btn btn-outline">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedDate || !selectedTime || loading}
              className="flex-1 btn btn-primary disabled:opacity-50"
            >
              {loading ? "Confirmando..." : "Confirmar horario"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default AvailabilityPicker;
