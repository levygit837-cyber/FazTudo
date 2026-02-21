import { Response } from "express";
import prisma from "../lib/prisma";
import { createLogger } from "../lib/logger";
import { AuthRequest } from "../middleware/auth";

const log = createLogger("cartCheckout");

// POST /api/services/orders/from-cart
export async function createOrderFromCart(req: AuthRequest, res: Response) {
  try {
    const clientId = req.user!.id;
    const { storefrontId, items } = req.body as {
      storefrontId: number;
      items: {
        serviceId: number;
        quantity: number;
        selectedOptionIds?: number[];
      }[];
    };

    // 1. Validate storefront exists and is published
    const storefront = await prisma.storefront.findUnique({
      where: { id: storefrontId, isActive: true, isPublished: true },
      select: { id: true, userId: true, name: true },
    });

    if (!storefront) {
      res
        .status(404)
        .json({ success: false, message: "Vitrine nao encontrada" });
      return;
    }

    // 2. Can't order from yourself
    if (storefront.userId === clientId) {
      res.status(400).json({
        success: false,
        message: "Voce nao pode fazer pedido na propria vitrine",
      });
      return;
    }

    // 3. Fetch all requested services + their options in one query
    const serviceIds = items.map((i) => i.serviceId);
    const services = await prisma.storefrontService.findMany({
      where: {
        id: { in: serviceIds },
        isAvailable: true,
        category: { storefrontId },
      },
      include: { options: true },
    });

    // Validate all services found and belong to storefront
    if (services.length !== serviceIds.length) {
      const found = new Set(services.map((s) => s.id));
      const missing = serviceIds.filter((id) => !found.has(id));
      res.status(400).json({
        success: false,
        message: `Servicos nao encontrados ou indisponiveis: ${missing.join(", ")}`,
      });
      return;
    }

    // 4. Build order items with price calculation
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    let totalPrice = 0;
    const orderItemsData: {
      serviceId: number;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      optionsSnapshot: any;
    }[] = [];

    for (const item of items) {
      const service = serviceMap.get(item.serviceId)!;
      let unitPrice = service.price;

      // Check for option price overrides
      let selectedOptions: { id: number; name: string; price: number | null }[] = [];
      if (item.selectedOptionIds && item.selectedOptionIds.length > 0) {
        const optionMap = new Map(service.options.map((o) => [o.id, o]));
        for (const optId of item.selectedOptionIds) {
          const opt = optionMap.get(optId);
          if (!opt) {
            res.status(400).json({
              success: false,
              message: `Opcao ${optId} nao encontrada para servico "${service.title}"`,
            });
            return;
          }
          selectedOptions.push({
            id: opt.id,
            name: opt.name,
            price: opt.price,
          });
          // If option has a price, it overrides (add to base)
          if (opt.price !== null) {
            unitPrice += opt.price;
          }
        }
      }

      const itemTotal = unitPrice * item.quantity;
      totalPrice += itemTotal;

      orderItemsData.push({
        serviceId: item.serviceId,
        quantity: item.quantity,
        unitPrice,
        totalPrice: itemTotal,
        optionsSnapshot:
          selectedOptions.length > 0 ? selectedOptions : null,
      });
    }

    // 5. Create ServiceOrder + ServiceOrderItems in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const serviceOrder = await tx.serviceOrder.create({
        data: {
          title: `Pedido - ${storefront.name}`,
          description: `Pedido com ${items.length} item(ns) da vitrine ${storefront.name}`,
          price: totalPrice,
          status: "PENDING",
          clientId,
          professionalId: storefront.userId,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              service: { select: { id: true, title: true, price: true } },
            },
          },
        },
      });

      return serviceOrder;
    });

    log.info(
      {
        orderId: order.id,
        clientId,
        storefrontId,
        totalPrice,
        itemCount: items.length,
      },
      "Cart checkout order created",
    );

    res.status(201).json({
      success: true,
      message: "Pedido criado com sucesso",
      data: order,
    });
  } catch (error: any) {
    log.error({ err: error }, "Error creating order from cart");
    res
      .status(500)
      .json({ success: false, message: "Erro ao criar pedido do carrinho" });
  }
}
