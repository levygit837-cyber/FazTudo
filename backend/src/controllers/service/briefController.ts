import type { Response } from "express";
import prisma from "../../lib/prisma";
import type { AuthRequest } from "../../middleware/auth";
import { NotificationType } from "@prisma/client";

import { createLogger } from "../../lib/logger";

const log = createLogger("briefController");


const successResponse = (data: any, message: string = "Success") => ({
  success: true, message, data,
});

const errorResponse = (message: string, statusCode: number = 400) => ({
  success: false, message, statusCode,
});

// Category-specific brief templates
const BRIEF_TEMPLATES: Record<string, { fields: { name: string; label: string; type: string; required: boolean; options?: string[] }[] }> = {
  eletrica: {
    fields: [
      { name: "serviceType", label: "Tipo de serviço", type: "select", required: true, options: ["Instalação", "Reparo", "Troca", "Inspeção", "Projeto"] },
      { name: "area", label: "Área (m²)", type: "number", required: false },
      { name: "hasBlueprint", label: "Possui planta?", type: "boolean", required: false },
      { name: "details", label: "Descreva o problema/necessidade", type: "textarea", required: true },
    ],
  },
  design: {
    fields: [
      { name: "designType", label: "Tipo de design", type: "select", required: true, options: ["Logo", "Identidade Visual", "UI/UX", "Material Impresso", "Social Media"] },
      { name: "hasReferences", label: "Tem referências?", type: "boolean", required: false },
      { name: "deadline", label: "Prazo desejado (dias)", type: "number", required: false },
      { name: "details", label: "Briefing do projeto", type: "textarea", required: true },
    ],
  },
  limpeza: {
    fields: [
      { name: "propertyType", label: "Tipo de imóvel", type: "select", required: true, options: ["Casa", "Apartamento", "Escritório", "Comércio", "Galpão"] },
      { name: "area", label: "Área (m²)", type: "number", required: true },
      { name: "rooms", label: "Número de cômodos", type: "number", required: false },
      { name: "frequency", label: "Frequência", type: "select", required: false, options: ["Única vez", "Semanal", "Quinzenal", "Mensal"] },
      { name: "details", label: "Observações", type: "textarea", required: false },
    ],
  },
  pintura: {
    fields: [
      { name: "serviceType", label: "Tipo de pintura", type: "select", required: true, options: ["Interna", "Externa", "Textura", "Verniz", "Epóxi"] },
      { name: "area", label: "Área (m²)", type: "number", required: true },
      { name: "rooms", label: "Número de cômodos", type: "number", required: false },
      { name: "hasOwnPaint", label: "Já tem tinta?", type: "boolean", required: false },
      { name: "details", label: "Descreva o serviço", type: "textarea", required: true },
    ],
  },
  encanamento: {
    fields: [
      { name: "serviceType", label: "Tipo de serviço", type: "select", required: true, options: ["Vazamento", "Instalação", "Desentupimento", "Manutenção", "Projeto hidráulico"] },
      { name: "urgency", label: "É emergência?", type: "boolean", required: false },
      { name: "details", label: "Descreva o problema", type: "textarea", required: true },
    ],
  },
  default: {
    fields: [
      { name: "details", label: "Descreva o serviço desejado", type: "textarea", required: true },
    ],
  },
};

// GET /api/services/briefs/templates/:categorySlug
export const getBriefTemplate = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const categorySlug = String(req.params.categorySlug || "default");
    const template = BRIEF_TEMPLATES[categorySlug.toLowerCase()] || BRIEF_TEMPLATES.default;
    res.status(200).json(successResponse({ template, categorySlug }));
  } catch (error) {
    log.error({ err: error }, "Get brief template error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};

// POST /api/services/orders/with-brief — Create order + brief in one shot
export const createOrderWithBrief = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse("Not authenticated"));
      return;
    }
    if (req.user.role !== "CLIENT") {
      res.status(403).json(errorResponse("Only clients can create orders"));
      return;
    }

    const {
      title,
      description,
      categoryId,
      urgencyLevel,
      priceRangeMin,
      priceRangeMax,
      briefData,
      mediaUrls,
      notes,
      addressId,
      addressNotes,
      scheduledDate,
      serviceListingId,
    } = req.body;

    if (!title) {
      res.status(400).json(errorResponse("Title is required"));
      return;
    }

    // Verificar categoria
    if (categoryId) {
      const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
      if (!category) {
        res.status(404).json(errorResponse("Category not found"));
        return;
      }
    }

    // Verificar endereço
    if (addressId) {
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId: req.user.id },
      });
      if (!address) {
        res.status(404).json(errorResponse("Address not found"));
        return;
      }
    }

    // Se serviceListingId fornecido, vincular ao profissional
    let professionalId: number | null = null;
    let price = 0;
    if (serviceListingId) {
      const listing = await prisma.serviceListing.findUnique({
        where: { id: serviceListingId },
      });
      if (listing) {
        professionalId = listing.professionalId;
        price = listing.price;
      }
    }

    // Use faixa de preço se disponível
    if (!price && priceRangeMin) {
      price = priceRangeMin;
    }

    // Calcular deadline
    const deadlineDays = urgencyLevel === "URGENT" ? 1 : urgencyLevel === "HIGH" ? 3 : 7;
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);

    // Criar order + brief numa transação
    const result = await prisma.$transaction(async (tx) => {
      const serviceOrder = await tx.serviceOrder.create({
        data: {
          title,
          description: description || notes || null,
          price,
          status: "PENDING",
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          deadlineDays,
          deadlineDate,
          clientId: req.user!.id,
          professionalId,
          serviceListingId: serviceListingId || null,
          addressId: addressId || null,
          addressNotes: addressNotes || null,
        },
      });

      const orderBrief = await tx.orderBrief.create({
        data: {
          serviceOrderId: serviceOrder.id,
          categoryId: categoryId || null,
          urgencyLevel: urgencyLevel || "NORMAL",
          priceRangeMin: priceRangeMin || null,
          priceRangeMax: priceRangeMax || null,
          briefData: briefData || {},
          mediaUrls: mediaUrls || [],
          notes: notes || null,
        },
      });

      return { serviceOrder, orderBrief };
    });

    // Notificar profissional se atribuído
    if (professionalId) {
      await prisma.notification.create({
        data: {
          userId: professionalId,
          type: NotificationType.ORDER_CREATED,
          title: "Novo pedido recebido",
          message: `Novo pedido "${title}" de ${req.user.name}`,
          serviceOrderId: result.serviceOrder.id,
          metadata: { clientId: req.user.id, urgencyLevel },
        },
      });
    }

    res.status(201).json(successResponse(result, "Order with brief created successfully"));
  } catch (error) {
    log.error({ err: error }, "Create order with brief error");
    res.status(500).json(errorResponse("Internal server error", 500));
  }
};
