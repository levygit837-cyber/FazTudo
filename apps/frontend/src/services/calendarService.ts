import api, { ApiResponse, extractData } from "./api";

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  dayOfWeek: number;
  totalOrders: number;
  completedOrders: number;
  upcomingOrders: number;
  isAvailable: boolean;
  isBlocked: boolean;
}

export interface CalendarOverview {
  month: string;
  daysInMonth: number;
  days: CalendarDay[];
  totalMonthOrders: number;
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }> | null;
}

export interface CalendarSlot {
  time: string;
  available: boolean;
  order: {
    id: number;
    title: string;
    status: string;
    price: number;
    client: { id: number; name: string; profileImage: string | null };
    address: { street: string; number: string; neighborhood: string; city: string } | null;
  } | null;
  blockReason: string | null;
}

export interface CalendarDayDetail {
  date: string;
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  slots: CalendarSlot[];
  totalOrders: number;
}

export const getCalendarOverview = async (month: string): Promise<CalendarOverview> => {
  const response = await api.get<ApiResponse<CalendarOverview>>(
    "/dashboard/professional/calendar",
    { params: { month } }
  );
  return extractData(response);
};

export const getCalendarDayDetail = async (date: string): Promise<CalendarDayDetail> => {
  const response = await api.get<ApiResponse<CalendarDayDetail>>(
    `/dashboard/professional/calendar/${date}`
  );
  return extractData(response);
};
