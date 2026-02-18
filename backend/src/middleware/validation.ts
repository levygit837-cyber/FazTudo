import { z } from 'zod';

// ============================================
// HELPERS
// ============================================

/** Sanitize string: trim + collapse spaces */
const sanitizedString = z.string().transform((s: string) => s.trim().replace(/\s+/g, ' '));

/** Email: lowercase, trimmed, validated */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email invalido');

/** Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number */
const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no minimo 8 caracteres')
  .max(128, 'Senha deve ter no maximo 128 caracteres')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minuscula')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiuscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um numero');

/** Phone: digits, optional dashes/spaces, 10-15 chars */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[\d\s\-+()]{10,15}$/, 'Telefone invalido');

/** Positive monetary amount */
const positiveAmountSchema = z
  .number()
  .positive('Valor deve ser maior que zero')
  .finite('Valor invalido');

// ============================================
// AUTH SCHEMAS
// ============================================

export const registerSchema = z.object({
  name: sanitizedString
    .pipe(z.string().min(2, 'Nome deve ter no minimo 2 caracteres').max(100, 'Nome muito longo')),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  role: z.enum(['CLIENT', 'PROFESSIONAL', 'COMPANY'], {
    error: 'Role deve ser CLIENT, PROFESSIONAL ou COMPANY',
  }).optional().default('CLIENT'),
  document: z.string().trim().optional(),
  cnpj: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'COMPANY') {
    if (!data.cnpj) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CNPJ é obrigatório para empresas',
        path: ['cnpj'],
      });
      return;
    }
    const digits = data.cnpj.replace(/\D/g, '');
    if (digits.length < 11 || digits.length > 18) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CNPJ inválido (deve ter entre 11 e 18 dígitos)',
        path: ['cnpj'],
      });
    }
  }
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha e obrigatoria').max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual e obrigatoria'),
  newPassword: passwordSchema,
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: 'Nova senha deve ser diferente da atual', path: ['newPassword'] },
);

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token e obrigatorio'),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: sanitizedString
    .pipe(z.string().min(2).max(100))
    .optional(),
  phone: phoneSchema.optional(),
  bio: sanitizedString
    .pipe(z.string().max(500, 'Bio muito longa'))
    .optional(),
  profileImage: z.string().url('URL de imagem invalida').optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Pelo menos um campo deve ser fornecido' },
);

// ============================================
// SERVICE SCHEMAS
// ============================================

export const createServiceSchema = z.object({
  title: sanitizedString
    .pipe(z.string().min(5, 'Titulo deve ter no minimo 5 caracteres').max(150, 'Titulo muito longo')),
  description: sanitizedString
    .pipe(z.string().min(20, 'Descricao deve ter no minimo 20 caracteres').max(2000, 'Descricao muito longa')),
  price: positiveAmountSchema.pipe(z.number().max(999999.99, 'Valor maximo excedido')),
  categoryId: z.number().int().positive('Categoria invalida'),
  estimatedDuration: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateServiceSchema = createServiceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Pelo menos um campo deve ser fornecido' },
);

// ============================================
// WALLET SCHEMAS
// ============================================

export const withdrawalSchema = z.object({
  amount: positiveAmountSchema
    .pipe(z.number()
      .min(10, 'Valor minimo para saque e R$ 10,00')
      .max(50000, 'Valor maximo por saque e R$ 50.000,00')
    ),
});

// ============================================
// ADMIN SCHEMAS
// ============================================

export const updateUserStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE'], {
    error: 'Status deve ser PENDING, ACTIVE, SUSPENDED ou INACTIVE',
  }),
});

export const reviewVerificationSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED'], {
    error: 'Acao deve ser APPROVED ou REJECTED',
  }),
  rejectionReason: z.string().max(500).optional(),
}).refine(
  (data) => data.action !== 'REJECTED' || (data.rejectionReason && data.rejectionReason.trim().length > 0),
  { message: 'Motivo da rejeicao e obrigatorio ao rejeitar', path: ['rejectionReason'] },
);

// ============================================
// PAGINATION / QUERY SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchQuerySchema = paginationSchema.extend({
  search: z.string().max(200).optional(),
});

// ============================================
// SERVICE ORDER SCHEMAS
// ============================================

export const createOrderSchema = z.object({
  serviceListingId: z.number().int().positive('Servico invalido'),
  title: sanitizedString
    .pipe(z.string().min(3, 'Titulo muito curto').max(200, 'Titulo muito longo'))
    .optional(),
  description: sanitizedString
    .pipe(z.string().min(10, 'Descricao muito curta').max(2000, 'Descricao muito longa')),
  address: z.string().max(500).optional(),
  scheduledDate: z.string().datetime({ message: 'Data invalida' }).optional(),
});

// ============================================
// PAYMENT SCHEMAS
// ============================================

export const createPaymentSchema = z.object({
  paymentMethod: z.enum(['pix', 'credit_card', 'boleto'], {
    error: 'Metodo de pagamento invalido. Use: pix, credit_card ou boleto',
  }),
  // Dados do pagador (obrigatórios)
  payerEmail: z.string().email('Email invalido'),
  payerName: z.string().min(2, 'Nome muito curto').max(200),
  payerCPF: z.string().min(11, 'CPF invalido').max(14),
  // Campos para cartão de crédito (opcionais)
  token: z.string().max(500).optional(),
  paymentMethodId: z.string().max(100).optional(),
  installments: z.number().int().min(1).max(24).optional(),
});

// ============================================
// MESSAGE SCHEMAS
// ============================================

export const sendMessageSchema = z.object({
  content: sanitizedString
    .pipe(z.string().min(1, 'Mensagem nao pode ser vazia').max(2000, 'Mensagem muito longa')),
  type: z.enum(["TEXT", "ATTACHMENT", "LOCATION"]).optional().default("TEXT"),
  // Attachment fields
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
  attachmentType: z.string().optional(),
  attachmentSize: z.number().optional(),
  // Location fields
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  locationLabel: z.string().max(500).optional(),
});

// ============================================
// REVIEW SCHEMAS
// ============================================

export const createReviewSchema = z.object({
  rating: z.number().min(1, 'Nota minima e 1').max(5, 'Nota maxima e 5'),
  comment: sanitizedString
    .pipe(z.string().max(1000, 'Comentario muito longo'))
    .optional(),
});

// ============================================
// VERIFICATION SCHEMAS
// ============================================

export const documentVerificationSchema = z.object({
  documentType: z.enum(['CPF', 'CNPJ', 'RG'], {
    error: 'Tipo de documento invalido',
  }),
  documentNumber: z.string().min(1).max(20).optional(),
  documentImageUrl: z.string().url('URL de imagem invalida').optional(),
});

export const facialVerificationSchema = z.object({
  selfieImageUrl: z.string().url('URL de selfie invalida'),
});

// ============================================
// ID PARAM SCHEMAS
// ============================================

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalido'),
});

export const orderIdParamSchema = z.object({
  orderId: z.coerce.number().int().positive('ID do pedido invalido'),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

// ============================================
// ADMIN-SPECIFIC SCHEMAS
// ============================================

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha obrigatoria'),
});

export const resolveDisputeSchema = z.object({
  resolution: z.string().min(10, 'Descricao da resolucao muito curta').max(1000),
  action: z.enum(['FAVOR_CLIENT', 'FAVOR_PROFESSIONAL', 'MUTUAL_AGREEMENT'], {
    error: 'Acao invalida',
  }),
});

export const updateDisputeStatusSchema = z.object({
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED'], {
    error: 'Status invalido',
  }),
});

export const updatePlatformConfigSchema = z.object({
  platformFeePercentage: z.number().min(0).max(50).optional(),
  defaultHoldDays: z.number().int().min(0).max(365).optional(),
  disputePeriodDays: z.number().int().min(0).max(30).optional(),
  requireVerificationProfessional: z.boolean().optional(),
  requireVerificationCompany: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional(),
});

export const createDisputeSchema = z.object({
  reason: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  attachments: z.array(z.string().url()).max(10).optional(),
});

export const createProposalSchema = z.object({
  price: z.number().positive().max(1000000),
  description: z.string().min(10).max(5000),
  estimatedDays: z.number().int().min(0).max(365).optional(),
  estimatedHours: z.number().int().min(0).max(24).optional(),
  guaranteeDays: z.number().int().min(0).max(365).optional(),
});
