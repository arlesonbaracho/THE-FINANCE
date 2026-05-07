import { z } from 'zod'

// ── Auth ─────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  restaurantName: z
    .string()
    .min(2, 'Nome do restaurante deve ter ao menos 2 caracteres')
    .max(100)
    .trim(),
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100).trim(),
  email: z.string().email('Email inválido').max(254).toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .max(128)
    .regex(/[A-Z]/, 'A senha deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'A senha deve conter ao menos um número'),
})

export type RegisterInput = z.infer<typeof registerSchema>

// ── Ingredient ───────────────────────────────────────────────────────────────

export const VALID_UNITS = ['KG', 'G', 'L', 'ML', 'UN'] as const

export const ingredientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(150).trim(),
  unit: z.enum(VALID_UNITS, { error: 'Unidade inválida' }),
  unidadeCompra: z.enum(VALID_UNITS).nullable().optional(),
  fatorConversao: z.number().positive().max(99_999).default(1),
  currentQty: z.number().min(0).max(999_999).default(0),
  minimumQty: z.number().min(0).max(999_999).default(0),
  quantidadeMaxima: z.number().min(0).max(999_999).nullable().optional(),
  pontoReposicao: z.number().min(0).max(999_999).default(0),
  unitCost: z.number().min(0).max(999_999).default(0),
  subcategoria: z.string().max(100).trim().nullable().optional(),
  localizacao: z.string().max(200).trim().nullable().optional(),
  foto: z.string().url().nullable().optional(),
  dataValidade: z.string().datetime().nullable().optional(),
  categoryId: z.string().cuid().nullable().optional(),
  supplierId: z.string().cuid().nullable().optional(),
  fornecedorSecundarioId: z.string().cuid().nullable().optional(),
})

export type IngredientInput = z.infer<typeof ingredientSchema>

// ── Movement ─────────────────────────────────────────────────────────────────

export const VALID_MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT', 'LOSS', 'EXPIRY', 'INTERNAL_USE'] as const

export const movementSchema = z.object({
  type: z.enum(VALID_MOVEMENT_TYPES, { error: 'Tipo de movimentação inválido' }),
  quantity: z
    .number()
    .positive('Quantidade deve ser positiva')
    .max(999_999, 'Quantidade muito alta'),
  unitCost: z.number().min(0).max(999_999).optional(),
  reason: z.string().max(200).trim().optional(),
  note: z.string().max(500).trim().optional(),
})

export type MovementInput = z.infer<typeof movementSchema>

// ── Product ──────────────────────────────────────────────────────────────────

export const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(150).trim(),
  salePrice: z.number().min(0).max(999_999).default(0),
  categoryId: z.string().cuid().nullable().optional(),
  active: z.boolean().optional(),
})

export type ProductInput = z.infer<typeof productSchema>

// ── Product Ingredient link ───────────────────────────────────────────────────

export const productIngredientSchema = z.object({
  ingredientId: z.string().cuid('ID de insumo inválido'),
  quantity: z
    .number()
    .positive('Quantidade deve ser positiva')
    .max(999_999),
})

export type ProductIngredientInput = z.infer<typeof productIngredientSchema>

// ── Helper ───────────────────────────────────────────────────────────────────

/** Returns a 400 response body from a ZodError */
export function zodErrorResponse(error: z.ZodError) {
  const firstIssue = error.issues[0]
  return { error: firstIssue?.message ?? 'Dados inválidos' }
}
