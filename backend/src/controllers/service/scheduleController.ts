import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";

const successResponse = (data: any, message: string = "Success") => ({
  success: true, message, data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false, message, statusCode,
});

// GET /api/services/professionals/:id/schedule — Get availability grid
export const getProfessionalSchedule = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const professionalId = parseInt(String(req.params.id), 10);
    if (isNaN(professionalId)) {
      res.status(400).json(errorResponse("Invalid professional ID"));
      return;
    }

    const professional = await prisma.user.findFirst({
      where: { id: professionalId, role: "PROFESSIONAL" },
      select: { id: true, name: true },
    });

    if (!professional) {
      res.status(404).json(errorResponse("Professional not found"));
      return;
    }

    const schedule = await prisma.professionalSchedule.findMany({
      where: { professionalId },
      orderBy: { dayOfWeek: "asc" },
    });

    // Se não tem agenda configurada, retornar horário padrão
    if (schedule.length === 0) {
      const defaultSchedule = Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i,
        startTime: i === 0 ? "00:00" : "08:00",
        endTime: i === 0 ? "00:00" : "18:00",
        isAvailable: i !== 0, // Domingo indisponível
      }));
      res.status(200).json(successResponse({ schedule: defaultSchedule, isDefault: true }));
      return;
    }

    res.status(200).json(successResponse({ schedule, isDefault: false }));
  } catch (error) {
    console.error("Get professional schedule error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// PUT /api/services/professionals/schedule — Set weekly schedule (professional)
export const updateProfessionalSchedule = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "PROFESSIONAL") {
      res.status(403).json(errorResponse("Only professionals can update schedule"));
      return;
    }

    const { schedule } = req.body;

    if (!Array.isArray(schedule)) {
      res.status(400).json(errorResponse("Schedule must be an array"));
      return;
    }

    // Validar cada entrada
    for (const entry of schedule) {
      if (entry.dayOfWeek === undefined || entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
        res.status(400).json(errorResponse("Invalid dayOfWeek (must be 0-6)"));
        return;
      }
      if (!entry.startTime || !entry.endTime) {
        res.status(400).json(errorResponse("startTime and endTime are required"));
        return;
      }
    }

    // Upsert cada dia da semana
    const results = await prisma.$transaction(
      schedule.map((entry: any) =>
        prisma.professionalSchedule.upsert({
          where: {
            professionalId_dayOfWeek: {
              professionalId: req.user!.id,
              dayOfWeek: entry.dayOfWeek,
            },
          },
          update: {
            startTime: entry.startTime,
            endTime: entry.endTime,
            isAvailable: entry.isAvailable !== false,
          },
          create: {
            professionalId: req.user!.id,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            isAvailable: entry.isAvailable !== false,
          },
        })
      )
    );

    res.status(200).json(successResponse({ schedule: results }, "Schedule updated"));
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// GET /api/services/professionals/:id/available-slots?date=YYYY-MM-DD
export const getAvailableSlots = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const professionalId = parseInt(String(req.params.id), 10);
    if (isNaN(professionalId)) {
      res.status(400).json(errorResponse("Invalid professional ID"));
      return;
    }

    const dateStr = req.query.date as string;
    if (!dateStr) {
      res.status(400).json(errorResponse("Date query parameter is required (YYYY-MM-DD)"));
      return;
    }

    const date = new Date(dateStr + "T00:00:00");
    if (isNaN(date.getTime())) {
      res.status(400).json(errorResponse("Invalid date format"));
      return;
    }

    const dayOfWeek = date.getDay();

    // Buscar configuração do dia
    const daySchedule = await prisma.professionalSchedule.findUnique({
      where: {
        professionalId_dayOfWeek: {
          professionalId,
          dayOfWeek,
        },
      },
    });

    // Horário padrão se não configurado
    const startTime = daySchedule?.startTime || (dayOfWeek === 0 ? null : "08:00");
    const endTime = daySchedule?.endTime || (dayOfWeek === 0 ? null : "18:00");
    const isAvailable = daySchedule?.isAvailable ?? (dayOfWeek !== 0);

    if (!isAvailable || !startTime || !endTime) {
      res.status(200).json(successResponse({ slots: [], date: dateStr, isAvailable: false }));
      return;
    }

    // Buscar bloqueios do dia
    const dayStart = new Date(dateStr + "T00:00:00");
    const dayEnd = new Date(dateStr + "T23:59:59");

    const blocks = await prisma.scheduleBlock.findMany({
      where: {
        professionalId,
        startDateTime: { lte: dayEnd },
        endDateTime: { gte: dayStart },
      },
      orderBy: { startDateTime: "asc" },
    });

    // Gerar slots de 1 hora
    const startParts = startTime.split(":").map(Number);
    const endParts = endTime.split(":").map(Number);
    const startH = startParts[0] ?? 8;
    const startM = startParts[1] ?? 0;
    const endH = endParts[0] ?? 18;
    const slots: { time: string; available: boolean; reason?: string }[] = [];

    for (let h = startH; h < endH; h++) {
      const slotStart = new Date(dateStr + `T${String(h).padStart(2, "0")}:${String(startM).padStart(2, "0")}:00`);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      const conflictingBlock = blocks.find(
        (b) => slotStart < b.endDateTime && slotEnd > b.startDateTime
      );

      slots.push({
        time: `${String(h).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
        available: !conflictingBlock,
        reason: conflictingBlock?.reason || undefined,
      });
    }

    res.status(200).json(successResponse({ slots, date: dateStr, isAvailable: true }));
  } catch (error) {
    console.error("Get available slots error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// POST /api/services/orders/:id/reschedule — Reschedule an order
export const rescheduleOrder = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }

    const orderId = parseInt(String(req.params.id), 10);
    if (isNaN(orderId)) {
      res.status(400).json(errorResponse("Invalid order ID"));
      return;
    }

    const { newDate, reason } = req.body;
    if (!newDate) {
      res.status(400).json(errorResponse("New date is required"));
      return;
    }

    const serviceOrder = await prisma.serviceOrder.findUnique({
      where: { id: orderId },
    });

    if (!serviceOrder) {
      res.status(404).json(errorResponse("Service order not found"));
      return;
    }

    // Verificar permissão
    const isClient = serviceOrder.clientId === req.user.id;
    const isProfessional = serviceOrder.professionalId === req.user.id;
    if (!isClient && !isProfessional && req.user.role !== "ADMIN") {
      res.status(403).json(errorResponse("Access denied"));
      return;
    }

    // Apenas pedidos aceitos ou em andamento podem ser reagendados
    if (!["ACCEPTED", "IN_PROGRESS", "PENDING"].includes(serviceOrder.status)) {
      res.status(400).json(errorResponse("Order cannot be rescheduled in current status"));
      return;
    }

    const updatedOrder = await prisma.serviceOrder.update({
      where: { id: orderId },
      data: {
        scheduledDate: new Date(newDate),
      },
    });

    // Notificar a outra parte
    const notifyUserId = isClient ? serviceOrder.professionalId : serviceOrder.clientId;
    if (notifyUserId) {
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          type: "SYSTEM_ALERT",
          title: "Pedido reagendado",
          message: `O pedido "${serviceOrder.title}" foi reagendado para ${new Date(newDate).toLocaleDateString("pt-BR")}${reason ? `. Motivo: ${reason}` : ""}`,
          serviceOrderId: orderId,
          metadata: { newDate, reason, rescheduledBy: req.user.id },
        },
      });
    }

    res.status(200).json(successResponse({ serviceOrder: updatedOrder }, "Order rescheduled"));
  } catch (error) {
    console.error("Reschedule order error:", error);
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
