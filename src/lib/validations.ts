import { z } from 'zod'
import { isValidCnpj } from '@/services/fiscal/cnpj.service'

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
  cnpj: z
    .string()
    .min(1, 'CNPJ é obrigatório')
    .refine(isValidCnpj, 'CNPJ inválido'),
  aceiteLgpd: z.literal(true, { error: 'É necessário aceitar a Política de Privacidade e os Termos' }),
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
  // Fiscal fields (optional)
  ncm: z.string().max(12).trim().nullable().optional(),
  cfop: z.string().max(6).trim().nullable().optional(),
  cstCsosn: z.string().max(5).trim().nullable().optional(),
  origemMercadoria: z.string().max(2).trim().nullable().optional(),
  unidadeTributavel: z.string().max(10).trim().nullable().optional(),
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

// ── Usuários ─────────────────────────────────────────────────────────────────

export const convidarFuncionarioSchema = z.object({
  email: z.string().email('Email inválido'),
  roleId: z.string().cuid('ID de cargo inválido').min(1, 'Selecione um cargo'),
})

export type ConvidarFuncionarioInput = z.infer<typeof convidarFuncionarioSchema>

export const convidarCozinheiroSchema = z
  .object({
    nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    pin: z
      .string()
      .length(4, 'PIN deve ter exatamente 4 dígitos')
      .regex(/^\d{4}$/, 'PIN deve conter apenas dígitos'),
    confirmPin: z.string().length(4, 'PIN deve ter exatamente 4 dígitos'),
    roleId: z.string().cuid('ID de cargo inválido').optional(),
  })
  .refine((d) => d.pin === d.confirmPin, {
    message: 'Os PINs não coincidem',
    path: ['confirmPin'],
  })

export type ConvidarCozinheiroInput = z.infer<typeof convidarCozinheiroSchema>

export const redefinirPinSchema = z
  .object({
    pin: z
      .string()
      .length(4, 'PIN deve ter exatamente 4 dígitos')
      .regex(/^\d{4}$/, 'PIN deve conter apenas dígitos'),
    confirmPin: z.string().length(4, 'PIN deve ter exatamente 4 dígitos'),
  })
  .refine((d) => d.pin === d.confirmPin, {
    message: 'Os PINs não coincidem',
    path: ['confirmPin'],
  })

export type RedefinirPinInput = z.infer<typeof redefinirPinSchema>

// ── PDV ──────────────────────────────────────────────────────────────────────

export const ambienteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(100).trim(),
  ordem: z.number().int().min(0).optional(),
})

export type AmbienteInput = z.infer<typeof ambienteSchema>

export const mesaSchema = z.object({
  numero: z.number().int().min(1, 'Número deve ser maior que 0').max(9999),
  identificacao: z.string().max(50).trim().optional(),
  cadeiras: z.number().int().min(1).max(50).default(4),
  ambienteId: z.string().cuid().optional(),
  grupoId: z.string().optional(),
})

export type MesaInput = z.infer<typeof mesaSchema>

export const pedidoItemSchema = z.object({
  productId: z.string().cuid('ID do produto inválido'),
  quantidade: z.number().int().min(1, 'Quantidade mínima é 1').max(999),
  observacao: z.string().max(500).trim().optional(),
})

export type PedidoItemInput = z.infer<typeof pedidoItemSchema>

export const criarPedidoSchema = z.object({
  mesaId: z.string().cuid('ID da mesa inválido'),
  garcomId: z.string().cuid('ID do garçom inválido'),
  itens: z.array(pedidoItemSchema).min(1, 'Pedido deve ter pelo menos 1 item'),
})

export type CriarPedidoInput = z.infer<typeof criarPedidoSchema>

export const reservaSchema = z.object({
  clienteNome: z.string().min(1, 'Nome é obrigatório').max(150).trim(),
  contato: z.string().max(100).trim().optional(),
  dataHora: z.string().datetime('Data/hora inválida'),
  numPessoas: z.number().int().min(1).max(500),
  mesaIds: z.array(z.string().cuid()).min(1, 'Selecione pelo menos uma mesa'),
  observacao: z.string().max(500).trim().optional(),
})

export type ReservaInput = z.infer<typeof reservaSchema>

export const configPdvSchema = z.object({
  taxaServico: z.number().min(0).max(100).optional(),
  taxaServicoAtiva: z.boolean().optional(),
  couvert: z.number().min(0).max(9999).optional(),
  taxaEntrega: z.number().min(0).max(9999).optional(),
  formasPagamento: z.array(z.enum(['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX'])).optional(),
})

export type ConfigPdvInput = z.infer<typeof configPdvSchema>

// ── Helper ───────────────────────────────────────────────────────────────────

/** Returns a 400 response body from a ZodError */
export function zodErrorResponse(error: z.ZodError) {
  const firstIssue = error.issues[0]
  return { error: firstIssue?.message ?? 'Dados inválidos' }
}
