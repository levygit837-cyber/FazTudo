import { z } from "zod";

// ── Storefront ─────────────────────────────────────────
export const createStorefrontSchema = z.object({
  name: z.string().min(2, "Nome deve ter no minimo 2 caracteres").max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minusculas, numeros e hifens",
    )
    .optional(),
  description: z.string().max(500).optional(),
  mainCategoryId: z.number().int().positive().optional(),
  serviceLocation: z.string().max(200).optional(),
  teamSize: z.number().int().min(1).optional(),
  workingHours: z.string().max(500).optional(),
  averageServiceTime: z.string().max(200).optional(),
});

export const updateStorefrontSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug invalido")
    .optional(),
  description: z.string().max(500).optional().nullable(),
  logo: z.string().url().optional().nullable(),
  banner: z.string().url().optional().nullable(),
  mainCategoryId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  serviceLocation: z.string().max(200).optional().nullable(),
  teamSize: z.number().int().min(1).optional().nullable(),
  workingHours: z.string().max(500).optional().nullable(),
  averageServiceTime: z.string().max(200).optional().nullable(),
});

export const publishStorefrontSchema = z.object({
  isPublished: z.boolean(),
});

// ── StorefrontCategory ─────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1, "Nome obrigatorio").max(100),
  order: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

export const reorderCategoriesSchema = z.object({
  order: z.array(
    z.object({
      id: z.number().int().positive(),
      order: z.number().int().min(0),
    }),
  ),
});

// ── StorefrontService ──────────────────────────────────
export const createServiceSchema = z.object({
  categoryId: z.number().int().positive(),
  title: z
    .string()
    .min(2, "Titulo deve ter no minimo 2 caracteres")
    .max(200),
  description: z.string().max(2000).optional(),
  price: z.number().positive("Preco deve ser positivo"),
  images: z.array(z.string().url()).max(10).optional(),
  order: z.number().int().min(0).optional(),
  serviceLocation: z.string().max(200).optional(),
});

export const updateServiceSchema = z.object({
  categoryId: z.number().int().positive().optional(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  price: z.number().positive().optional(),
  images: z.array(z.string().url()).max(10).optional(),
  isAvailable: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  serviceLocation: z.string().max(200).optional().nullable(),
});

// ── StorefrontServiceOption ────────────────────────────
export const createOptionSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio").max(200),
  price: z.number().min(0).optional().nullable(),
  isDefault: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export const updateOptionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z.number().min(0).optional().nullable(),
  isDefault: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// ── Cart Checkout ──────────────────────────────────────
export const cartCheckoutSchema = z.object({
  storefrontId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        serviceId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99).default(1),
        selectedOptionIds: z.array(z.number().int().positive()).optional(),
      }),
    )
    .min(1, "Carrinho deve ter pelo menos 1 item"),
});
