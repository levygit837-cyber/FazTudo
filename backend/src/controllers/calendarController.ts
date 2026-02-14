import type { Response } from "express";
import prisma from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";

const successResponse = (data: any, message: string = "Success") => ({
  success: true, message, data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false, message, statusCode,
});

/**
 * GET /api/dashboard/professional/calendar?month=2026-02
 * Monthly overview: per-day order counts, availability
 */
export const getCalendarOverview = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access calendar"));
      return;
    }

    const userId = req.user.id;
    const monthStr = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const parts = monthStr.split("-");
    const year = parseInt(parts[0] || "2026", 10);
    const month = parseInt(parts[1] || "1", 10) - 1; // JS months are 0-indexed

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Fetch orders for this month
    const orders = await prisma.serviceOrder.findMany({
      where: {
        professionalId: userId,
        scheduledDate: { gte: monthStart, lt: monthEnd },
      },
      select: {
        id: true,
        title: true,
        status: true,
        scheduledDate: true,
        client: { select: { id: true, name: true, profileImage: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Fetch weekly schedule
    const schedule = await prisma.professionalSchedule.findMany({
      where: { professionalId: userId },
      orderBy: { dayOfWeek: "asc" },
    });

    // Fetch schedule blocks for the month
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        professionalId: userId,
        startDateTime: { gte: monthStart, lt: monthEnd },
      },
    });

    // Build per-day summary
    const days: Array<{
      date: string;
      dayOfMonth: number;
      dayOfWeek: number;
      totalOrders: number;
      completedOrders: number;
      upcomingOrders: number;
      isAvailable: boolean;
      isBlocked: boolean;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = date.toISOString().slice(0, 10);
      const dow = date.getDay();

      const dayOrders = orders.filter(
        (o) => o.scheduledDate && o.scheduledDate.toISOString().slice(0, 10) === dateStr
      );

      const scheduleDay = schedule.find((s) => s.dayOfWeek === dow);
      const isAvailable = scheduleDay ? scheduleDay.isAvailable : dow !== 0;

      const dayBlocks = blocks.filter(
        (b) => b.startDateTime.toISOString().slice(0, 10) === dateStr
      );

      days.push({
        date: dateStr,
        dayOfMonth: d,
        dayOfWeek: dow,
        totalOrders: dayOrders.length,
        completedOrders: dayOrders.filter((o) => o.status === "COMPLETED").length,
        upcomingOrders: dayOrders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length,
        isAvailable,
        isBlocked: dayBlocks.length > 0,
      });
    }

    res.status(200).json(
      successResponse({
        month: monthStr,
        daysInMonth,
        days,
        totalMonthOrders: orders.length,
        schedule: schedule.length > 0 ? schedule : null,
      }, "Calendar overview retrieved"),
    );
  } catch (error) {
    console.error("Calendar overview error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

/**
 * GET /api/dashboard/professional/calendar/:date
 * Daily detail: hourly schedule with order slots
 */
export const getCalendarDayDetail = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can access calendar"));
      return;
    }

    const userId = req.user.id;
    const dateStr = req.params.date as string; // YYYY-MM-DD

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      res.status(400).json(errorResponse("Invalid date format. Use YYYY-MM-DD"));
      return;
    }

    const date = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59");
    const dow = date.getDay();

    // Fetch orders for this day
    const orders = await prisma.serviceOrder.findMany({
      where: {
        professionalId: userId,
        scheduledDate: { gte: date, lte: dayEnd },
      },
      include: {
        client: { select: { id: true, name: true, profileImage: true, phone: true } },
        serviceListing: { select: { id: true, title: true } },
        address: true,
      },
      orderBy: { scheduledDate: "asc" },
    });

    // Fetch schedule for this day of week
    const scheduleDay = await prisma.professionalSchedule.findUnique({
      where: { professionalId_dayOfWeek: { professionalId: userId, dayOfWeek: dow } },
    });

    // Fetch blocks for this day
    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        professionalId: userId,
        startDateTime: { lte: dayEnd },
        endDateTime: { gte: date },
      },
    });

    const startTime = scheduleDay?.startTime || (dow === 0 ? null : "08:00");
    const endTime = scheduleDay?.endTime || (dow === 0 ? null : "18:00");
    const isAvailable = scheduleDay?.isAvailable ?? (dow !== 0);

    // Build hourly slots
    const slots: Array<{
      time: string;
      available: boolean;
      order: any | null;
      blockReason: string | null;
    }> = [];

    if (isAvailable && startTime && endTime) {
      const startH = parseInt(startTime.split(":")[0] || "8", 10);
      const endH = parseInt(endTime.split(":")[0] || "18", 10);

      for (let h = startH; h < endH; h++) {
        const timeStr = `${String(h).padStart(2, "0")}:00`;
        const slotStart = new Date(`${dateStr}T${timeStr}:00`);
        const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

        const slotOrder = orders.find((o) => {
          if (!o.scheduledDate) return false;
          const orderH = o.scheduledDate.getHours();
          return orderH === h;
        });

        const block = blocks.find(
          (b) => slotStart < b.endDateTime && slotEnd > b.startDateTime
        );

        slots.push({
          time: timeStr,
          available: !slotOrder && !block,
          order: slotOrder
            ? {
                id: slotOrder.id,
                title: slotOrder.title,
                status: slotOrder.status,
                price: slotOrder.price,
                client: slotOrder.client,
                address: slotOrder.address,
              }
            : null,
          blockReason: block?.reason || null,
        });
      }
    }

    res.status(200).json(
      successResponse({
        date: dateStr,
        dayOfWeek: dow,
        isAvailable,
        startTime,
        endTime,
        slots,
        totalOrders: orders.length,
      }, "Calendar day detail retrieved"),
    );
  } catch (error) {
    console.error("Calendar day detail error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
